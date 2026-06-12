import { useState } from "react";
import { useAuth } from "@/hooks/auth";
import { useUnreadAnnouncements, useMarkAnnouncementsRead } from "@/hooks/announcements";
import { useAnnouncementRenderer } from "@/utils/announcementRenderer";
import { ChevronDownIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/20/solid";

type LocalNote = { id: string; text: string };

const NOTES_KEY = "home_notes_v1";

function loadNotes(): LocalNote[] {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? "[]"); }
  catch { return []; }
}

function persistNotes(notes: LocalNote[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export default function HomeAnnouncements() {
    const auth = useAuth();
    const isLoggedIn = auth.isSuccess && (auth.data?.message === "Logged In" || !auth.data?.statusCode);
    const announcements = useUnreadAnnouncements(Boolean(isLoggedIn));
    const markRead = useMarkAnnouncementsRead();
    const { renderBody } = useAnnouncementRenderer();
    const [expanded, setExpanded] = useState<string | null>(null);
    const [notes, setNotes] = useState<LocalNote[]>(loadNotes);
    const [draft, setDraft] = useState("");

    const handleDismiss = (id: string) => {
        markRead.mutate([id]);
        if (expanded === id) setExpanded(null);
    };

    const addNote = () => {
        const text = draft.trim();
        if (!text) return;
        const updated = [{ id: crypto.randomUUID(), text }, ...notes];
        setNotes(updated);
        persistNotes(updated);
        setDraft("");
    };

    const removeNote = (id: string) => {
        const updated = notes.filter((n) => n.id !== id);
        setNotes(updated);
        persistNotes(updated);
    };

    const list = announcements.data ?? [];

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">Notes</span>
                {list.length > 0 && (
                    <span className="rounded-full bg-accent-blue/10 px-2.5 py-0.5 text-xs font-semibold text-accent-blue-700 dark:bg-[rgba(48,122,207,0.15)] dark:text-accent-blue-300">
                        {list.length} new
                    </span>
                )}
            </div>

            {/* Personal notes */}
            {notes.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {notes.map((note) => (
                        <li key={note.id} className="group rounded-2xl surface-card border px-4 py-3 flex items-start gap-2 shadow-xs">
                            <p className="flex-1 text-sm text-primary leading-snug whitespace-pre-wrap">{note.text}</p>
                            <button
                                type="button"
                                onClick={() => removeNote(note.id)}
                                className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted hover:text-red-500 transition"
                                aria-label="Remove note"
                            >
                                <XMarkIcon className="h-4 w-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {/* Server announcements */}
            {announcements.isLoading && (
                <div className="rounded-2xl surface-card border px-4 py-3 text-sm text-muted animate-pulse">
                    Loading...
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

            {/* Add a note — desktop only */}
            <div className="hidden md:flex flex-col gap-2">
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote();
                    }}
                    className="w-full rounded-2xl border border-(--surface-border) !bg-(--surface-card) px-4 py-3 text-sm text-primary resize-none placeholder:text-muted focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition"
                />
                <button
                    type="button"
                    onClick={addNote}
                    disabled={!draft.trim()}
                    className="self-end rounded-lg bg-accent-blue px-3 py-1.5 text-xs font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition disabled:opacity-50 disabled:pointer-events-none"
                >
                    Save note
                </button>
            </div>
        </div>
    );
}
