interface DueCapsule {
    skeleton?: boolean;
    count?: number;
    category?: string;
    label?: string;
    onClick?: (e: React.MouseEvent) => void;
}

/* Maps category keys to the CSS variable prefix for that slot */
const SLOT: Record<string, string> = {
    today:           "today",
    tomorrow:        "tomorrow",
    "this week":     "week",
    "overdue-active":"overdue",
    "overdue-clear": "clear",
};

const displayLabel = (category: string, label?: string) => {
    if (label) return label;
    if (category === "this week") return "This Week";
    return category.charAt(0).toUpperCase() + category.slice(1);
};

function capsuleStyle(slot: string) {
    return {
        bg:    `var(--capsule-${slot}-bg)`,
        text:  `var(--capsule-${slot}-text)`,
        muted: `var(--capsule-${slot}-muted)`,
    };
}

export default function DueCapsule({ skeleton, count, category, label, onClick }: DueCapsule) {
    const slot = SLOT[category ?? "today"] ?? "today";
    const s = capsuleStyle(slot);

    if (skeleton)
        return (
            <div
                className="flex h-full items-center justify-between gap-4 overflow-hidden rounded-2xl px-4 py-3"
                style={{ background: s.bg }}
            >
                <span className="text-sm font-semibold leading-tight capitalize" style={{ color: s.muted }}>
                    {displayLabel(category ?? "today", label)}
                </span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: s.text }}>0</span>
            </div>
        );

    return (
        <button
            type="button"
            onClick={onClick}
            className="flex h-full w-full items-center justify-between gap-4 overflow-hidden rounded-2xl px-4 py-3 text-left transition hover:brightness-95 dark:hover:brightness-110"
            style={{ background: s.bg }}
        >
            <span className="text-sm font-semibold leading-tight" style={{ color: s.muted }}>
                {displayLabel(category ?? "today", label)}
            </span>
            <span className="text-2xl font-bold tabular-nums" style={{ color: s.text }}>{count ?? 0}</span>
        </button>
    );
}
