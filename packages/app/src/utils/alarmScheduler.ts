import { Capacitor } from "@capacitor/core";
import { Alarm, loadAlarms } from "@/hooks/alarms";
import { loadTasks } from "@/hooks/tasks";
import { scheduleNativeAlarm, cancelNativeAlarm, onNativeAlarmFired, requestAlarmAuthorization } from "@/plugins/alarm";
import { matchDate } from "./date";
import { Logger } from "./logger";

const isWeb = () => Capacitor.getPlatform() === "web";
const WEB_CHECK_INTERVAL_MS = 15 * 1000;
const LOOKAHEAD_DAYS = 8;

export type RingingHandler = (alarmId: string) => void;

let ringingHandler: RingingHandler | null = null;
let webCheckInterval: ReturnType<typeof setInterval> | null = null;
let cachedAlarms: Alarm[] = [];
// Guards against re-triggering the overlay for the same still-ringing alarm on every
// web interval tick; cleared once the alarm is dismissed/snoozed/completed.
const ringingIds = new Set<string>();

/** Registered once (e.g. from AuthBootstrap) so the scheduler can surface AlarmRingingOverlay. */
export function setAlarmRingingHandler(handler: RingingHandler | null): void {
  ringingHandler = handler;
}

export function clearRingingGuard(alarmId: string): void {
  ringingIds.delete(alarmId);
}

function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(":").map((v) => Number(v));
  return { hours: Number.isFinite(h) ? h : 0, minutes: Number.isFinite(m) ? m : 0 };
}

function wasFiredOnDay(alarm: Alarm, day: Date): boolean {
  if (!alarm.lastFiredAt) return false;
  const firedAt = new Date(alarm.lastFiredAt);
  if (Number.isNaN(firedAt.getTime())) return false;
  return matchDate(firedAt, day);
}

function nextFireForRepeating(alarm: Alarm, from: Date): Date | null {
  const { hours, minutes } = parseTime(alarm.time);

  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset++) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);

    if (!alarm.repeatDays.includes(candidate.getDay())) continue;
    if (wasFiredOnDay(alarm, candidate)) continue;

    // Today's slot may already be in the past relative to `from` — that's fine, it
    // means the alarm is currently due/overdue and should ring now.
    return candidate;
  }

  return null;
}

function nextFireForOnce(alarm: Alarm): Date | null {
  if (!alarm.date || alarm.lastFiredAt) return null;

  const { hours, minutes } = parseTime(alarm.time);
  const day = new Date(`${alarm.date}T00:00:00`);
  if (Number.isNaN(day.getTime())) return null;

  day.setHours(hours, minutes, 0, 0);
  return day;
}

export function computeNextFire(alarm: Alarm, now: Date): Date | null {
  if (!alarm.enabled) return null;

  if (alarm.snoozedUntil) {
    const snoozeTime = new Date(alarm.snoozedUntil);
    if (!Number.isNaN(snoozeTime.getTime())) return snoozeTime;
  }

  return alarm.repeatDays.length > 0 ? nextFireForRepeating(alarm, now) : nextFireForOnce(alarm);
}

async function alarmContent(alarm: Alarm): Promise<{ title: string; body: string }> {
  if (alarm.scope === "task" && alarm.task) {
    try {
      const tasks = await loadTasks();
      const task = tasks.find((t) => t.id === alarm.task);
      return { title: alarm.label || "Task Alarm", body: task?.title ?? "Tap to see your task." };
    } catch {
      return { title: alarm.label || "Task Alarm", body: "Tap to see your task." };
    }
  }

  const groupLabel = alarm.group ? alarm.group.replace(/\b\w/g, (c) => c.toUpperCase()) : "Group";
  return { title: alarm.label || `${groupLabel} Alarm`, body: `Tasks in "${groupLabel}" need attention.` };
}

function fireDueWebAlarms(now: Date): void {
  for (const alarm of cachedAlarms) {
    const nextFire = computeNextFire(alarm, now);
    if (!nextFire) continue;
    if (nextFire.getTime() <= now.getTime() && !ringingIds.has(alarm.id)) {
      ringingIds.add(alarm.id);
      ringingHandler?.(alarm.id);
    }
  }
}

function ensureWebWatcher(): void {
  if (webCheckInterval) return;
  webCheckInterval = setInterval(() => fireDueWebAlarms(new Date()), WEB_CHECK_INTERVAL_MS);
}

/**
 * Recomputes every alarm's next occurrence and pushes it to the platform: native
 * (iOS/Android) gets an OS-level alarm scheduled/cancelled per alarm; web keeps the
 * list in memory for the interval watcher. Call after alarm CRUD, after task list
 * refreshes (a task's due date may have shifted its alarm), and on app foreground.
 */
export async function reconcileAlarms(preloaded?: Alarm[]): Promise<void> {
  const alarms = preloaded ?? (await loadAlarms());
  cachedAlarms = alarms;

  if (isWeb()) {
    ensureWebWatcher();
    fireDueWebAlarms(new Date());
    return;
  }

  const now = new Date();
  const withNextFire = alarms.map((alarm) => ({ alarm, nextFire: computeNextFire(alarm, now) }));

  // AlarmKitPlugin.load() fires its own authorization request on cold launch, but that's
  // fire-and-forget — a schedule() call arriving here right after launch can race ahead of
  // it and silently fail (see AlarmKitPlugin.swift). Requesting again right before actually
  // scheduling anything closes that race; it's a no-op once already authorized/denied.
  if (withNextFire.some(({ nextFire }) => nextFire)) {
    await requestAlarmAuthorization();
  }

  for (const { alarm, nextFire } of withNextFire) {
    if (!nextFire) {
      await cancelNativeAlarm(alarm.id);
      continue;
    }

    const { title, body } = await alarmContent(alarm);
    await scheduleNativeAlarm({ id: alarm.id, fireAt: nextFire.toISOString(), title, body });
  }
}

/**
 * Catches up on any alarm whose fire time already passed while the app wasn't open
 * (web) or wasn't in the foreground (native cold resume) — call on app open/resume.
 */
export async function checkForMissedAlarms(): Promise<void> {
  try {
    const alarms = await loadAlarms();
    cachedAlarms = alarms;
    fireDueWebAlarms(new Date());
  } catch (err) {
    Logger.logWarning(`Unable to check for missed alarms: ${String(err)}`);
  }
}

/** Registered once so a native alarm firing (Live Activity tap, lock-screen "Mark Complete") shows the overlay. */
export function initNativeAlarmListener(): () => void {
  return onNativeAlarmFired((id) => {
    ringingIds.add(id);
    ringingHandler?.(id);
  });
}
