import {
  LocalNotificationSchema,
  LocalNotifications,
  PendingLocalNotificationSchema,
  PendingResult,
  PermissionStatus,
  ScheduleResult,
} from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { getSettings, setSettings } from "@/hooks/settings";
import { Logger } from "./logger";
import { fetchData } from "./data";
import { acknowledgeDeliveredNotifications, pullPendingServerNotifications } from "@/hooks/notifications";
import type { Task } from "@/hooks/tasks";

const FALLBACK_BODY = "Stay on track—open TidalTask to see what's due today.";
const MAX_DELIVERED_SERVER_NOTIFICATION_IDS = 300;
const NO_TASKS_DUE_SUPPRESSION_MS = 24 * 60 * 60 * 1000;

const isWeb = () => Capacitor.getPlatform() === "web";
const supportsWebNotifications = () => typeof Notification !== "undefined";

/**
 * Server-pushed reminders exist to catch a user's attention when they're not
 * looking at the app. Firing them as native banners while the app is already
 * open in the foreground just spams the user with a popup for something
 * they're already looking at, so callers use this to skip that case.
 */
async function isAppInForeground(): Promise<boolean> {
  if (isWeb()) return document.visibilityState === "visible";

  try {
    const state = await CapacitorApp.getState();
    return state.isActive;
  } catch {
    return document.visibilityState === "visible";
  }
}

function isNoTasksDueBody(body?: string): boolean {
  if (!body) return false;
  const normalized = body.trim().toLowerCase();
  return (
    /\bnothing\b.*\bdue today\b/.test(normalized) ||
    /\bno tasks\b.*\bdue today\b/.test(normalized) ||
    /\bnothing\b.*\bdue for today\b/.test(normalized)
  );
}

async function filterSuppressedNotifications(
  options: LocalNotificationSchema[]
): Promise<LocalNotificationSchema[]> {
  if (!options.length) return options;

  const settings = await getSettings();
  const now = Date.now();
  const lastNoTasksDueAt = settings.lastNoTasksDueNotificationAt || 0;
  let noTasksDueShown = false;

  const allowed = options.filter((opt) => {
    const body = typeof opt.body === "string" ? opt.body : "";
    if (!isNoTasksDueBody(body)) return true;

    const recentlyShown = now - lastNoTasksDueAt < NO_TASKS_DUE_SUPPRESSION_MS;
    if (recentlyShown || noTasksDueShown) {
      return false;
    }

    noTasksDueShown = true;
    return true;
  });

  if (noTasksDueShown) {
    settings.lastNoTasksDueNotificationAt = now;
    await setSettings(settings);
  }

  return allowed;
}

export async function getTodayNotificationBody(): Promise<string> {
  try {
    const response = await fetchData("/task/today", {});
    if (!response.ok) throw new Error("Failed to fetch tasks");
    const tasks = await response.json();
    const titles: string[] = Array.isArray(tasks)
      ? tasks
          .map((t) => (typeof t?.title === "string" ? t.title.trim() : ""))
          .filter((t) => t.length > 0)
      : [];

    if (titles.length === 0) {
      return "Nothing due today. Set a plan and stay ahead.";
    }

    const preview = titles.slice(0, 3).join(", ");
    const more = titles.length - 3;
    const suffix = more > 0 ? ` (+${more} more)` : "";
    return `Due today: ${preview}${suffix}`;
  } catch (err) {
    Logger.logWarning(`Unable to build daily notification: ${String(err)}`);
    return FALLBACK_BODY;
  }
}

/* Checks if a user has been reminded */
export async function hasRemindedToday(): Promise<boolean> {
  const settings = await getSettings();

  if (settings.lastNotification) {
    const last = new Date(settings.lastNotification);
    const current = new Date();

    if (last.getDate() == current.getDate()) return true;
    else return false;
  }

  return false;
}

/* Runs all the checks for the notifications */
export async function initializeNotifications() {
  let checked = await checkPermissions();
  if (checked.display == "prompt" || checked.display == "prompt-with-rationale")
    await requestPermissions();

  const sendingDaily: boolean = await checkSendingDaily();
  if (!sendingDaily) await setDailyReminders();
  // Server notification sync is handled exclusively by useAuth() to avoid
  // racing with the auth hook's concurrent call on every app open.
}

/* Sets daily reminders */
export async function setDailyReminders(hour?: number, minute?: number) {
  const timeBuilder = new Date();

  timeBuilder.setDate(timeBuilder.getDate() + 1);
  
  if (!hour || !minute) timeBuilder.setHours(8, 0, 0, 0);

  if (hour) timeBuilder.setHours(hour);

  if (minute) timeBuilder.setMinutes(minute);

  const id = new Date().getTime();

  const body = await getTodayNotificationBody();

  await scheduleNotification({
    title: "TidalTask: ADHD Manager",
    id,
    body,
    schedule: {
      at: timeBuilder,
      every: "day",
    },
  });

  return await getPendingById(id);
}

/* Checks if the system is sending daily notifications */
export async function checkSendingDaily(): Promise<boolean> {
  const { notifications: pending } = await getPending();
  const isPending = pending.filter((notif) => notif?.schedule?.every == "day");
  if (isPending.length > 0) return true;

  return false;
}

/* Gets pending notifications */
export async function getPending(): Promise<PendingResult> {
  return await LocalNotifications.getPending();
}

export async function getPendingById(
  id: number
): Promise<PendingLocalNotificationSchema | undefined> {
  const pending = await getPending();
  return pending.notifications.find((notif) => notif.id == id);
}

/* Sets the state of the daily reminder checker */
export async function setHasRemindedToday(state: boolean): Promise<Boolean> {
  const settings = await getSettings();
  settings.hasRemindedToday = state || true;
  await setSettings(settings);

  return settings.hasRemindedToday;
}

/* Sets the notification settings into the config */
export async function setNotificationConfig() {
  const settings = await getSettings();
  settings.lastNotification = new Date().getTime();

  await setHasRemindedToday(true);
  await setSettings(settings);
}

/* Checks if system can send notifications */
export async function checkPermissions(): Promise<PermissionStatus> {
  if (isWeb() && supportsWebNotifications()) {
    const state = Notification.permission;
    return { display: state } as PermissionStatus;
  }
  return await LocalNotifications.checkPermissions();
}

/* Requests the ability to request permissions from the user */
export async function requestPermissions(): Promise<PermissionStatus> {
  if (isWeb() && supportsWebNotifications()) {
    const state = await Notification.requestPermission();
    return { display: state } as PermissionStatus;
  }
  return await LocalNotifications.requestPermissions();
}

/* Schedules many notifications */
export async function scheduleNotification(
  ...options: LocalNotificationSchema[]
): Promise<ScheduleResult | undefined> {
  const allowedOptions = await filterSuppressedNotifications(options);
  if (!allowedOptions.length) {
    return undefined;
  }

  await setNotificationConfig();

  const checked = await checkPermissions();

  if (checked.display !== "granted") {
    Logger.logWarning(`Unable to send notification: Missing Permissions`);
    return undefined;
  }

  if (isWeb() && supportsWebNotifications()) {
    allowedOptions.forEach((opt) => {
      const delay =
        opt.schedule?.at instanceof Date
          ? Math.max(0, opt.schedule.at.getTime() - Date.now())
          : 0;
      window.setTimeout(() => {
        try {
          new Notification(opt.title || "TidalTask", { body: opt.body });
        } catch (err) {
          Logger.logWarning(`Web notification failed: ${String(err)}`);
        }
      }, delay);
    });
    return undefined;
  }

  const notif = await LocalNotifications.schedule({
    notifications: [...allowedOptions],
  });

  return notif;
}

export async function cancelNotifications(
  notifications: LocalNotificationSchema[]
) {
  LocalNotifications.cancel({ notifications });
}

export async function cancelNotification(
  notification: LocalNotificationSchema | undefined
) {
  if (notification)
    LocalNotifications.cancel({ notifications: [notification] });
}

function hashNotificationId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }

  const normalized = Math.abs(hash);
  return (normalized % 2147483646) + 1;
}

const TASK_DUE_ID_PREFIX = "task-due:";

function taskDueNotificationId(taskId: string): number {
  return hashNotificationId(`${TASK_DUE_ID_PREFIX}${taskId}`);
}

function hasTimedFutureDueDate(task: Task): boolean {
  if (task.repeater) return false;
  if (task.done === true) return false;
  const d = new Date(task.date);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return false;
  // No specific time set (midnight) — there's no "time of day" to notify at.
  if (d.getHours() === 0 && d.getMinutes() === 0) return false;
  return d.getTime() > Date.now();
}

/**
 * Schedules a local notification to fire at each eligible task's exact due time,
 * independent of the server-driven reminder system (works offline, no polling delay).
 * Only non-repeating, incomplete tasks with a specific future time are included —
 * repeating tasks aren't supported since they can have many pending occurrences.
 */
export async function reconcileTaskDueNotifications(tasks: Task[]): Promise<void> {
  // Local scheduling this far ahead is unreliable in a browser tab (setTimeout doesn't
  // survive the tab closing), so this is native-only.
  if (isWeb()) return;

  const settings = await getSettings();
  const previousIds = settings.scheduledDueNotificationTaskIds || [];

  const eligible = tasks.filter((task) => task.id && hasTimedFutureDueDate(task));
  const eligibleIds = eligible.map((task) => task.id!);

  const noLongerEligible = previousIds.filter((id) => !eligibleIds.includes(id));
  if (noLongerEligible.length) {
    await cancelNotifications(noLongerEligible.map((id) => ({ id: taskDueNotificationId(id) } as LocalNotificationSchema)));
  }

  // Re-scheduling with the same id replaces any existing pending notification for that
  // task, so tasks that are still eligible don't need an explicit cancel first.
  //
  // Skip the actual (re)scheduling while the app is foregrounded — same reasoning as
  // isAppInForeground()'s doc comment on the server-notification path: presenting a
  // native banner for a task the user is already looking at in-app just spams them.
  // AlarmBridge re-runs this reconciliation on every visibility change (including the
  // transition to backgrounded), so a task that becomes due while the app is open still
  // gets scheduled for real the moment the user actually leaves the app.
  if (eligible.length && !(await isAppInForeground())) {
    await scheduleNotification(
      ...eligible.map((task) => ({
        id: taskDueNotificationId(task.id!),
        title: "TidalTask",
        body: task.title,
        schedule: { at: new Date(task.date) },
      }))
    );
  }

  settings.scheduledDueNotificationTaskIds = eligibleIds;
  await setSettings(settings);
}

function getDeliveredServerNotificationIds(settings: Awaited<ReturnType<typeof getSettings>>): Set<string> {
  return new Set((settings.deliveredServerNotificationIds || []).filter(Boolean));
}

async function markDeliveredServerNotificationIds(ids: string[]): Promise<void> {
  if (!ids.length) return;

  const settings = await getSettings();
  const delivered = getDeliveredServerNotificationIds(settings);
  ids.forEach((id) => delivered.add(id));

  settings.deliveredServerNotificationIds = Array.from(delivered).slice(-MAX_DELIVERED_SERVER_NOTIFICATION_IDS);
  await setSettings(settings);
}

export async function syncServerNotifications(): Promise<number> {
  const result = await syncServerNotificationsDetailed();
  return result.delivered;
}

type SyncResult = { pending: number; delivered: number; permission: PermissionStatus["display"] };
let _syncInFlight: Promise<SyncResult> | null = null;

export async function syncServerNotificationsDetailed(): Promise<SyncResult> {
  if (_syncInFlight) return _syncInFlight;
  _syncInFlight = _doSyncServerNotifications().finally(() => { _syncInFlight = null; });
  return _syncInFlight;
}

async function _doSyncServerNotifications(): Promise<SyncResult> {
  try {
    const pending = await pullPendingServerNotifications();
    if (!pending.length) {
      const permission = await checkPermissions();
      return { pending: 0, delivered: 0, permission: permission.display };
    }

    const settings = await getSettings();
    const alreadyDelivered = getDeliveredServerNotificationIds(settings);
    const permission = await checkPermissions();
    if (permission.display !== "granted") {
      Logger.logWarning("Notification permission is not granted; pending notifications were not acknowledged.");
      return { pending: pending.length, delivered: 0, permission: permission.display };
    }

    // Leave foreground-arriving reminders undelivered/unacknowledged so they still
    // pop up as a real notification the next time the app is backgrounded.
    if (await isAppInForeground()) {
      return { pending: pending.length, delivered: 0, permission: permission.display };
    }

    const deliveredIds: string[] = [];
    for (const item of pending) {
      if (alreadyDelivered.has(item.id)) {
        deliveredIds.push(item.id);
        continue;
      }

      const scheduled = await scheduleNotification({
        id: hashNotificationId(item.id),
        title: item.title || "TidalTask",
        body: item.body || FALLBACK_BODY,
        schedule: { at: new Date() }
      });

      if (scheduled !== undefined || isWeb()) {
        deliveredIds.push(item.id);
      }
    }

    if (deliveredIds.length > 0) {
      await markDeliveredServerNotificationIds(deliveredIds);
      await acknowledgeDeliveredNotifications(deliveredIds);
    }

    return { pending: pending.length, delivered: deliveredIds.length, permission: permission.display };
  } catch (err) {
    Logger.logWarning(`Unable to sync server notifications: ${String(err)}`);
    return { pending: 0, delivered: 0, permission: "denied" };
  }
}
