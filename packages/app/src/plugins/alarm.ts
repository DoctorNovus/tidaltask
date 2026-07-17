import { registerPlugin, Capacitor } from "@capacitor/core";
import { Logger } from "@/utils/logger";

/**
 * Bridges to the native alarm implementation: AlarmKit on iOS (continuous
 * ring + Dynamic Island via Live Activity), AlarmManager + a foreground
 * service + full-screen activity on Android. No-op on web — web alarms are
 * driven entirely in JS by utils/alarmScheduler.ts.
 */
export interface NativeAlarmPayload {
  id: string;
  /** ISO datetime of the next concrete occurrence to ring at. */
  fireAt: string;
  title: string;
  body: string;
  sound?: string;
}

export interface AlarmNativePlugin {
  schedule(options: { alarm: NativeAlarmPayload }): Promise<void>;
  cancel(options: { id: string }): Promise<void>;
  /** Stops the ringing sound/Live Activity immediately without cancelling the schedule. */
  stopRinging(options: { id: string }): Promise<void>;
  addListener(
    eventName: "alarmFired",
    listenerFunc: (event: { id: string }) => void
  ): Promise<{ remove: () => void }>;
}

const AlarmNative = registerPlugin<AlarmNativePlugin>("AlarmNative");

const isNative = () => Capacitor.isNativePlatform();

export async function scheduleNativeAlarm(alarm: NativeAlarmPayload): Promise<void> {
  if (!isNative()) return;
  try {
    await AlarmNative.schedule({ alarm });
  } catch (err) {
    Logger.logWarning(`Unable to schedule native alarm ${alarm.id}: ${String(err)}`);
  }
}

export async function cancelNativeAlarm(id: string): Promise<void> {
  if (!isNative()) return;
  try {
    await AlarmNative.cancel({ id });
  } catch (err) {
    Logger.logWarning(`Unable to cancel native alarm ${id}: ${String(err)}`);
  }
}

export async function stopNativeAlarmRinging(id: string): Promise<void> {
  if (!isNative()) return;
  try {
    await AlarmNative.stopRinging({ id });
  } catch (err) {
    Logger.logWarning(`Unable to stop native alarm ${id}: ${String(err)}`);
  }
}

/**
 * Registered from App.tsx/AuthBootstrap: fires whenever the native side
 * launches or resumes into a ringing alarm (Live Activity tap, lock-screen
 * full-screen activity "Mark Complete" tap, or app relaunch while an alarm
 * is still ringing). The handler should show AlarmRingingOverlay for `id`.
 */
export function onNativeAlarmFired(handler: (id: string) => void): () => void {
  if (!isNative()) return () => {};

  const listener = AlarmNative.addListener("alarmFired", (data) => handler(data.id));
  return () => { listener.then((l) => l.remove()); };
}
