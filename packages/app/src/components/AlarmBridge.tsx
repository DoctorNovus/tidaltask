import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuth, AuthStatus } from "@/hooks/auth";
import {
  reconcileAlarms,
  checkForMissedAlarms,
  setAlarmRingingHandler,
  initNativeAlarmListener,
} from "@/utils/alarmScheduler";
import { reconcileTaskDueNotifications } from "@/utils/notifs";
import { loadTasks } from "@/hooks/tasks";
import { Logger } from "@/utils/logger";
import AlarmRingingOverlay from "./alarm/AlarmRingingOverlay";

const ALARM_RECONCILE_INTERVAL_MS = 60 * 1000;

/**
 * Mirrors the polling pattern useAuth() already uses for server notifications
 * (packages/app/src/hooks/auth.ts), but for alarms: reconciles native/web alarm
 * schedules on an interval, catches up on any alarm missed while the app wasn't
 * open/foregrounded, and renders the ringing overlay when one fires.
 *
 * Also reconciles per-task due-time notifications here, not just after local task
 * mutations (hooks/tasks.ts) — otherwise a task created elsewhere (another device,
 * voice command, MCP tool) never gets an on-device notification scheduled, since
 * this device only learns about it once it happens to sync, not when it's due.
 */
async function reconcileDueNotifications(): Promise<void> {
  try {
    const tasks = await loadTasks();
    await reconcileTaskDueNotifications(tasks);
  } catch (err) {
    Logger.logWarning(String(err));
  }
}
export default function AlarmBridge() {
  const query = useQuery<AuthStatus>({
    queryKey: ["auth"],
    queryFn: getAuth,
    staleTime: 1000 * 60 * 60 * 30,
  });

  const [ringingAlarmId, setRingingAlarmId] = useState<string | null>(null);

  useEffect(() => {
    if (!query.isSuccess) return;
    const isAuthed = query.data?.message === "Logged In" || !query.data?.statusCode;
    if (!isAuthed) return;

    setAlarmRingingHandler((id) => setRingingAlarmId(id));

    reconcileAlarms().catch((err) => Logger.logWarning(String(err)));
    checkForMissedAlarms().catch((err) => Logger.logWarning(String(err)));
    reconcileDueNotifications();

    const removeNativeListener = initNativeAlarmListener();

    const interval = window.setInterval(() => {
      reconcileAlarms().catch((err) => Logger.logWarning(String(err)));
      reconcileDueNotifications();
    }, ALARM_RECONCILE_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkForMissedAlarms().catch((err) => Logger.logWarning(String(err)));
      }
      // Also reconcile on the transition to backgrounded, not just back to
      // foreground: reconcileTaskDueNotifications() now skips actually scheduling
      // the native banner while the app is in the foreground (to avoid spamming
      // the user with a popup for a task they're already looking at in-app), so a
      // task that became due while the app was open still needs to get scheduled
      // for real the moment the user actually leaves.
      reconcileDueNotifications();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      setAlarmRingingHandler(null);
      removeNativeListener();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [query.isSuccess, query.data]);

  return <AlarmRingingOverlay alarmId={ringingAlarmId} onClose={() => setRingingAlarmId(null)} />;
}
