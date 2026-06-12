interface DueCapsule {
    skeleton?: boolean;
    count?: number;
    category?: string;
    label?: string;
    onClick?: (e: React.MouseEvent) => void;
}

const variants: Record<string, { bg: string; countColor: string; labelColor: string }> = {
    today: {
        bg: "bg-accent-blue-50 dark:bg-[rgba(48,122,207,0.14)]",
        countColor: "text-accent-blue-700 dark:text-accent-blue-300",
        labelColor: "text-accent-blue-600/80 dark:text-accent-blue-300/80",
    },
    tomorrow: {
        bg: "bg-amber-50 dark:bg-[rgba(245,158,11,0.13)]",
        countColor: "text-amber-700 dark:text-amber-300",
        labelColor: "text-amber-600/80 dark:text-amber-300/80",
    },
    "this week": {
        bg: "bg-violet-50 dark:bg-[rgba(139,92,246,0.13)]",
        countColor: "text-violet-700 dark:text-violet-300",
        labelColor: "text-violet-600/80 dark:text-violet-300/80",
    },
    "overdue-active": {
        bg: "bg-red-50 dark:bg-[rgba(248,113,113,0.13)]",
        countColor: "text-red-700 dark:text-red-300",
        labelColor: "text-red-600/80 dark:text-red-300/80",
    },
    "overdue-clear": {
        bg: "bg-emerald-50 dark:bg-[rgba(52,211,153,0.12)]",
        countColor: "text-emerald-700 dark:text-emerald-300",
        labelColor: "text-emerald-600/80 dark:text-emerald-300/80",
    },
};

const displayLabel = (category: string, label?: string) => {
    if (label) return label;
    if (category === "this week") return "This Week";
    return category.charAt(0).toUpperCase() + category.slice(1);
};

export default function DueCapsule({ skeleton, count, category, label, onClick }: DueCapsule) {
    const v = variants[category ?? "today"] ?? variants.today;

    if (skeleton)
        return (
            <div className={`flex h-full items-center justify-between gap-4 overflow-hidden rounded-2xl ${v.bg} px-4 py-3`}>
                <span className={`text-sm font-semibold leading-tight capitalize ${v.labelColor}`}>
                    {displayLabel(category ?? "today", label)}
                </span>
                <span className={`text-2xl font-bold tabular-nums ${v.countColor}`}>0</span>
            </div>
        );

    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex h-full w-full items-center justify-between gap-4 overflow-hidden rounded-2xl ${v.bg} px-4 py-3 text-left transition hover:brightness-95 dark:hover:brightness-110`}
        >
            <span className={`text-sm font-semibold leading-tight ${v.labelColor}`}>
                {displayLabel(category ?? "today", label)}
            </span>
            <span className={`text-2xl font-bold tabular-nums ${v.countColor}`}>{count ?? 0}</span>
        </button>
    );
}
