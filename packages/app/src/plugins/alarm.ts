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

export type AlarmAuthorizationState = "authorized" | "denied" | "notDetermined";

export interface AlarmNativePlugin {
  schedule(options: { alarm: NativeAlarmPayload }): Promise<void>;
  cancel(options: { id: string }): Promise<void>;
  /** Stops the ringing sound/Live Activity immediately without cancelling the schedule. */
  stopRinging(options: { id: string }): Promise<void>;
  /** iOS (AlarmKit) only — Android has no equivalent app-level alarm permission. */
  checkAuthorization?(): Promise<{ state: AlarmAuthorizationState }>;
  requestAuthorization?(): Promise<{ state: AlarmAuthorizationState }>;
  openSettings?(): Promise<void>;
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
 * Current AlarmKit authorization state on iOS. Returns "authorized" on platforms without
 * this concept (web, Android) so callers don't show a false "alarms won't work" warning
 * there — schedule() failures on those platforms surface through their own error paths.
 */
export async function checkAlarmAuthorization(): Promise<AlarmAuthorizationState> {
  if (!isNative() || !AlarmNative.checkAuthorization) return "authorized";
  try {
    const { state } = await AlarmNative.checkAuthorization();
    return state;
  } catch (err) {
    Logger.logWarning(`Unable to check alarm authorization: ${String(err)}`);
    return "authorized";
  }
}

/**
 * Explicitly prompts for AlarmKit access. Call this from a user-initiated action (e.g. the
 * first time someone enables an alarm) rather than relying solely on the plugin's own
 * fire-and-forget request at app launch, which can lose the race against an early schedule().
 */
export async function requestAlarmAuthorization(): Promise<AlarmAuthorizationState> {
  if (!isNative() || !AlarmNative.requestAuthorization) return "authorized";
  try {
    const { state } = await AlarmNative.requestAuthorization();
    return state;
  } catch (err) {
    Logger.logWarning(`Unable to request alarm authorization: ${String(err)}`);
    return "authorized";
  }
}

/** Deep-links to the app's iOS Settings page, for recovering from a previously denied prompt. */
export async function openAlarmSettings(): Promise<void> {
  if (!isNative() || !AlarmNative.openSettings) return;
  try {
    await AlarmNative.openSettings();
  } catch (err) {
    Logger.logWarning(`Unable to open settings: ${String(err)}`);
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
