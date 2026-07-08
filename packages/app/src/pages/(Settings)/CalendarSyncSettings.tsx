import { useState } from "react";
import {
    useCalendarToken,
    useRotateCalendarToken,
    useDeleteCalendarToken,
    buildIcsUrl,
    isNative,
    requestCalendarPermission,
    clearAllTidalTaskEvents,
    reconcileDeviceCalendarSync,
} from "@/hooks/calendar";
import { useSettings, useUpdateSettings } from "@/hooks/settings";
import { useTasks } from "@/hooks/tasks";

export default function CalendarSyncSettings() {
    const tokenQuery = useCalendarToken();
    const rotate = useRotateCalendarToken();
    const remove = useDeleteCalendarToken();
    const settingsQuery = useSettings();
    const updateSettings = useUpdateSettings();
    const tasksQuery = useTasks();
    const [copied, setCopied] = useState(false);
    const [nativeStatus, setNativeStatus] = useState<string>("");
    const [nativeSyncPending, setNativeSyncPending] = useState(false);
    const [showEventsStatus, setShowEventsStatus] = useState<string>("");
    const [showRotateConfirm, setShowRotateConfirm] = useState(false);
    const showDeviceCalendarEvents = !!settingsQuery.data?.showDeviceCalendarEvents;
    const deviceCalendarSyncEnabled = !!settingsQuery.data?.deviceCalendarSyncEnabled;

    const handleToggleShowEvents = async () => {
        setShowEventsStatus("");
        if (showDeviceCalendarEvents) {
            await updateSettings.mutateAsync({ showDeviceCalendarEvents: false });
            return;
        }

        try {
            const granted = await requestCalendarPermission();
            if (!granted) {
                setShowEventsStatus("Calendar access denied. Enable it in Settings > Privacy > Calendars.");
                return;
            }
            await updateSettings.mutateAsync({ showDeviceCalendarEvents: true });
        } catch (e: any) {
            setShowEventsStatus(e?.message || "Unable to request calendar access.");
        }
    };

    const token = tokenQuery.data;
    const icsUrl = token ? buildIcsUrl(token) : null;

    const handleCopy = async () => {
        if (!icsUrl) return;
        try {
            await navigator.clipboard.writeText(icsUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback: select text manually
        }
    };

    const handleRotate = async () => {
        await rotate.mutateAsync();
        setCopied(false);
        setShowRotateConfirm(false);
    };

    const handleDisable = async () => {
        await remove.mutateAsync();
        setCopied(false);
    };

    const handleNativeToggle = async () => {
        setNativeStatus("");
        setNativeSyncPending(true);
        try {
            const granted = await requestCalendarPermission();
            if (!granted) {
                setNativeStatus("Calendar access denied. Enable it in Settings > Privacy > Calendars.");
                return;
            }
            await updateSettings.mutateAsync({ deviceCalendarSyncEnabled: true });
            await reconcileDeviceCalendarSync(tasksQuery.data || []);
            setNativeStatus("Calendar access granted. Your tasks with dates have been added, and future changes will sync automatically.");
        } catch (e: any) {
            setNativeStatus(e?.message || "Unable to request calendar access.");
        } finally {
            setNativeSyncPending(false);
        }
    };

    const handleClearNative = async () => {
        setNativeStatus("");
        setNativeSyncPending(true);
        try {
            await updateSettings.mutateAsync({ deviceCalendarSyncEnabled: false });
            await clearAllTidalTaskEvents();
            setNativeStatus("Disconnected and removed all TidalTask events from your calendar.");
        } catch (e: any) {
            setNativeStatus(e?.message || "Unable to clear calendar events.");
        } finally {
            setNativeSyncPending(false);
        }
    };

    if (tokenQuery.isLoading) {
        return <div className="text-sm text-muted py-2">Loading...</div>;
    }

    return (
        <div className="flex flex-col gap-5">
            {/* ICS subscription */}
            <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">Subscribe link</span>
                <p className="text-xs text-muted">
                    Add this link to any calendar app to see your upcoming tasks. The calendar updates automatically.
                </p>

                {icsUrl ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1 truncate rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-xs font-mono text-primary">
                                {icsUrl}
                            </div>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="shrink-0 rounded-lg bg-accent-blue px-3 py-2 text-xs font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition"
                            >
                                {copied ? "Copied!" : "Copy"}
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowRotateConfirm(true)}
                                className="rounded-lg border border-(--surface-border) px-3 py-1.5 text-xs font-semibold text-primary hover:-translate-y-px transition"
                            >
                                Regenerate link
                            </button>
                            <button
                                type="button"
                                onClick={handleDisable}
                                disabled={remove.isPending}
                                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:-translate-y-px transition disabled:opacity-70"
                            >
                                {remove.isPending ? "Disabling..." : "Disable"}
                            </button>
                        </div>

                        {showRotateConfirm && (
                            <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
                                <p className="text-xs text-amber-800 dark:text-amber-200">
                                    Regenerating the link will break any calendars already subscribed. You will need to re-add the new link.
                                </p>
                                <div className="mt-2 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleRotate}
                                        disabled={rotate.isPending}
                                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:-translate-y-px transition disabled:opacity-70"
                                    >
                                        {rotate.isPending ? "Regenerating..." : "Yes, regenerate"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowRotateConfirm(false)}
                                        className="rounded-lg border border-(--surface-border) px-3 py-1.5 text-xs font-semibold text-primary hover:-translate-y-px transition"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => rotate.mutateAsync()}
                        disabled={rotate.isPending}
                        className="self-start rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition disabled:opacity-70"
                    >
                        {rotate.isPending ? "Generating..." : "Enable calendar sync"}
                    </button>
                )}
            </div>

            {/* How to subscribe */}
            {icsUrl && (
                <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted">How to subscribe</span>
                    <div className="rounded-xl bg-silver-200 dark:bg-(--surface-raised) p-3 flex flex-col gap-2 text-xs text-primary">
                        <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">Apple Calendar (Mac)</span>
                            <span className="text-muted">File → New Calendar Subscription → paste the link</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">Apple Calendar (iPhone/iPad)</span>
                            <span className="text-muted">Copy the link, then open it in Safari — you'll be prompted to subscribe</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">Google Calendar</span>
                            <span className="text-muted">Settings → Add calendar → From URL → paste the link</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">Outlook</span>
                            <span className="text-muted">Add calendar → Subscribe from web → paste the link</span>
                        </div>
                    </div>
                    <p className="text-xs text-muted">
                        Only incomplete tasks with a date are included. Completed tasks are hidden automatically.
                    </p>
                </div>
            )}

            {/* Show device calendar events in TidalTask */}
            {isNative && (
                <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted">Show in TidalTask</span>
                    <p className="text-xs text-muted">
                        Display your device's calendar events on the Calendar page, alongside your tasks.
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleToggleShowEvents}
                            disabled={updateSettings.isPending || settingsQuery.isLoading}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold shadow-xs transition disabled:opacity-70 ${
                                showDeviceCalendarEvents
                                    ? "bg-accent-blue text-white shadow-accent-blue/30"
                                    : "border border-(--surface-border) text-primary hover:-translate-y-px"
                            }`}
                        >
                            {showDeviceCalendarEvents ? "Showing device calendar" : "Show device calendar"}
                        </button>
                    </div>
                    {showEventsStatus && <span className="text-xs text-muted">{showEventsStatus}</span>}
                </div>
            )}

            {/* Native calendar (iOS only) */}
            {isNative && (
                <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted">Device calendar</span>
                    <p className="text-xs text-muted">
                        Push tasks directly into your device's native calendar. Events update automatically whenever you add, edit, complete, or delete a task. Only non-repeating, incomplete tasks with a date are synced.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {deviceCalendarSyncEnabled ? (
                            <button
                                type="button"
                                onClick={handleClearNative}
                                disabled={nativeSyncPending}
                                className="rounded-lg border border-(--surface-border) px-3 py-2 text-xs font-semibold text-primary hover:-translate-y-px transition disabled:opacity-70"
                            >
                                {nativeSyncPending ? "Working..." : "Disconnect & remove events"}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleNativeToggle}
                                disabled={nativeSyncPending}
                                className="rounded-lg bg-accent-blue px-3 py-2 text-xs font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition disabled:opacity-70"
                            >
                                {nativeSyncPending ? "Connecting..." : "Connect device calendar"}
                            </button>
                        )}
                    </div>
                    {nativeStatus && <span className="text-xs text-muted">{nativeStatus}</span>}
                </div>
            )}
        </div>
    );
}
