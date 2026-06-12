import { useState } from "react";
import { useAuth } from "@/hooks/auth";
import { useUnreadAnnouncements, useMarkAnnouncementsRead } from "@/hooks/announcements";
import { useAnnouncementRenderer } from "@/utils/announcementRenderer";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/20/solid";

export default function HomeAnnouncements() {
    const auth = useAuth();
    const isLoggedIn = auth.isSuccess && (auth.data?.message === "Logged In" || !auth.data?.statusCode);
    const announcements = useUnreadAnnouncements(Boolean(isLoggedIn));
    const markRead = useMarkAnnouncementsRead();
    const { renderBody } = useAnnouncementRenderer();
    const [expanded, setExpanded] = useState<string | null>(null);

    const handleDismiss = (id: string) => {
        markRead.mutate([id]);
        if (expanded === id) setExpanded(null);
    };

    const list = announcements.data ?? [];

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">Announcements</span>
                {list.length > 0 && (
                    <span className="rounded-full bg-accent-blue/10 px-2.5 py-0.5 text-xs font-semibold text-accent-blue-700 dark:bg-[rgba(48,122,207,0.15)] dark:text-accent-blue-300">
                        {list.length} new
                    </span>
                )}
            </div>

            {announcements.isLoading && (
                <div className="rounded-2xl surface-card border px-4 py-3 text-sm text-muted animate-pulse">
                    Loading...
                </div>
            )}

            {!announcements.isLoading && list.length === 0 && (
                <div className="rounded-2xl surface-card border px-4 py-4 text-center text-sm text-muted">
                    You're all caught up!
                </div>
            )}

            {list.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {list.map((item) => {
                        const isOpen = expanded === item.id;
                        const formattedDate = new Date(item.date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                        });

                        return (
                            <li key={item.id} className="rounded-2xl surface-card border shadow-xs overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setExpanded(isOpen ? null : item.id)}
                                    className="flex w-full items-start justify-between gap-2 px-4 py-3 text-left transition hover:bg-silver-100/60 dark:hover:bg-vulcan-800/40"
                                >
                                    <div className="flex min-w-0 flex-1 items-start gap-2">
                                        {isOpen
                                            ? <ChevronDownIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                                            : <ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                                        }
                                        <span className="text-sm font-semibold text-primary leading-snug">{item.title}</span>
                                    </div>
                                    <span className="shrink-0 text-xs text-muted pt-0.5">{formattedDate}</span>
                                </button>

                                {isOpen && (
                                    <div className="border-t border-(--surface-border) px-4 pb-4 pt-3 flex flex-col gap-3">
                                        <div className="flex flex-col gap-1.5">
                                            {renderBody(item.body)}
                                        </div>
                                        <div className="flex items-center gap-2 pt-1">
                                            {item.ctaTitle && item.ctaAction && (
                                                <a
                                                    href={item.ctaAction.startsWith("http") ? item.ctaAction : undefined}
                                                    target={item.ctaAction.startsWith("http") ? "_blank" : undefined}
                                                    rel="noopener noreferrer"
                                                    className="rounded-lg bg-accent-blue px-3 py-1.5 text-xs font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition"
                                                >
                                                    {item.ctaTitle}
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleDismiss(item.id)}
                                                disabled={markRead.isPending}
                                                className="rounded-lg border border-(--surface-border) px-3 py-1.5 text-xs font-semibold text-muted hover:text-primary transition hover:-translate-y-px disabled:opacity-60"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
