import { useState } from "react";
import {
    useCalendarToken,
    useRotateCalendarToken,
    useDeleteCalendarToken,
    buildIcsUrl,
    isNative,
    requestCalendarPermission,
    clearAllTidalTaskEvents,
} from "@/hooks/calendar";

export default function CalendarSyncSettings() {
    const tokenQuery = useCalendarToken();
    const rotate = useRotateCalendarToken();
    const remove = useDeleteCalendarToken();
    const [copied, setCopied] = useState(false);
    const [nativeStatus, setNativeStatus] = useState<string>("");
    const [showRotateConfirm, setShowRotateConfirm] = useState(false);

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
        try {
            const granted = await requestCalendarPermission();
            if (!granted) {
                setNativeStatus("Calendar access denied. Enable it in Settings > Privacy > Calendars.");
                return;
            }
            setNativeStatus("Calendar access granted. Tasks with dates will sync automatically.");
        } catch (e: any) {
            setNativeStatus(e?.message || "Unable to request calendar access.");
        }
    };

    const handleClearNative = async () => {
        setNativeStatus("");
        try {
            await clearAllTidalTaskEvents();
            setNativeStatus("Removed all TidalTask events from your calendar.");
        } catch (e: any) {
            setNativeStatus(e?.message || "Unable to clear calendar events.");
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

            {/* Native calendar (iOS only) */}
            {isNative && (
                <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted">Device calendar</span>
                    <p className="text-xs text-muted">
                        Push tasks directly into your device's native calendar. Events update when you modify tasks in TidalTask.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleNativeToggle}
                            className="rounded-lg bg-accent-blue px-3 py-2 text-xs font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition"
                        >
                            Connect device calendar
                        </button>
                        <button
                            type="button"
                            onClick={handleClearNative}
                            className="rounded-lg border border-(--surface-border) px-3 py-2 text-xs font-semibold text-primary hover:-translate-y-px transition"
                        >
                            Remove all events
                        </button>
                    </div>
                    {nativeStatus && <span className="text-xs text-muted">{nativeStatus}</span>}
                </div>
            )}
        </div>
    );
}
