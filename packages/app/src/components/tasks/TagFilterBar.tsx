import { useMemo } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { useApp } from "@/hooks/app";
import { Task } from "@/hooks/tasks";
import { isTaskDone } from "@/utils/data";

interface TagFilterBarProps {
  tasks: Task[];
}

export default function TagFilterBar({ tasks }: TagFilterBarProps) {
  const [appData, setAppData] = useApp();
  const activeTags = appData.activeTags ?? [];

  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    const activeDate = appData.activeDate ?? new Date();

    tasks?.forEach((task) => {
      const pending = isTaskDone(task, activeDate);
      if (!pending) return;

      const tags = Array.isArray(task?.tags) ? task.tags : [];

      tags.forEach((tag) => {
        const normalized = typeof tag === "string"
          ? tag.toLowerCase()
          : tag && typeof (tag as any).title === "string"
            ? (tag as any).title.toLowerCase()
            : "";
        if (!normalized) return;
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, appData.activeDate]);

  const toggleTag = (tag: string) => {
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];

    setAppData({ ...appData, activeTags: next });
  };

  if (availableTags.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl surface-card border px-4 py-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-primary">Filter by tags</span>
          {activeTags.length > 0 && (
            <span className="rounded-full bg-accent-blue/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-blue-800 ring-1 ring-accent-blue/20">
              {activeTags.length} active
            </span>
          )}
        </div>
        {activeTags.length > 0 && (
          <button
            type="button"
            className="text-xs font-semibold text-accent-blue hover:text-accent-blue-700"
            onClick={() => setAppData({ ...appData, activeTags: [] })}
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {availableTags.map(({ name, count }) => {
          const isActive = activeTags.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggleTag(name)}
              title={isActive ? `Remove #${name} filter` : `Filter by #${name}`}
              className={`group flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                isActive
                  ? "bg-accent-blue text-white shadow-xs shadow-accent-blue/30"
                  : "bg-white text-primary ring-1 ring-accent-blue/20 hover:ring-accent-blue/40"
              }`}
            >
              <span>#{name}</span>
              {isActive ? (
                <span className="relative flex h-3.5 w-3.5 items-center justify-center text-white/90">
                  <span className="group-hover:opacity-0 transition-opacity">{count}</span>
                  <XMarkIcon className="absolute inset-0 h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              ) : (
                <span className="text-muted">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
