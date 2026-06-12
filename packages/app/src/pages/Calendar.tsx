import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTasks, Task } from "@/hooks/tasks";
import { occursOnDate, isTaskDone } from "@/utils/data";
import TaskInfoMenu from "@/pages/(Layout)/TaskInfoMenu";
import { useApp } from "@/hooks/app";

type Scope = "today" | "tomorrow" | "week" | "month" | "overdue" | "all";
type ViewMode = "week" | "month";

const MAX_WEEK_TASKS = 6;
const MAX_MONTH_TASKS = 3;

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const hasTime = (task: Task) => {
  const d = new Date(task.date);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
};

const formatTime = (task: Task) =>
  new Date(task.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const sortByTime = (list: Task[]) =>
  [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

const startOfWeek = (reference: Date) => {
  const day = reference.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  start.setDate(reference.getDate() + diff);
  return start;
};

const normalizeDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isPendingOnDate = (task: Task, day: Date) => {
  // Leverage existing helper that returns true when still pending.
  return isTaskDone(task, day) && occursOnDate(task, day);
};

const isOverdue = (task: Task, today: Date) => {
  const taskDate = normalizeDay(new Date(task.date));
  return isPendingOnDate(task, taskDate) && taskDate < today;
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

const formatLabel = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString(undefined, options);

function buildWeekDays(anchor: Date) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }).map((_, idx) => {
    const day = new Date(start);
    day.setDate(start.getDate() + idx);
    return day;
  });
}

function buildMonthDays(anchor: Date): Array<Date | null> {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);

  // Start on Monday of the first week containing the 1st.
  const gridStart = startOfWeek(firstOfMonth);

  const days: Array<Date | null> = [];
  for (let d = new Date(gridStart); d <= lastOfMonth; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  // Pad trailing cells to keep 7 per row, but do not show next-month dates.
  const remainder = days.length % 7;
  if (remainder !== 0) {
    for (let i = remainder; i < 7; i++) days.push(null);
  }

  return days;
}

const scopeToDates = (scope: Scope, today: Date) => {
  const start = normalizeDay(today);
  const tomorrow = new Date(start);
  tomorrow.setDate(start.getDate() + 1);
  const endOfWeek = new Date(startOfWeek(today));
  endOfWeek.setDate(endOfWeek.getDate() + 6);

  switch (scope) {
    case "today":
      return { start, end: start };
    case "tomorrow":
      return { start: tomorrow, end: tomorrow };
    case "week":
      return { start: startOfWeek(today), end: endOfWeek };
    case "month":
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
      };
    case "overdue":
      return { start: new Date(0), end: new Date(today.getTime() - 1) };
    default:
      return { start: new Date(0), end: new Date(8640000000000000) }; // all dates
  }
};

function groupTasksByDay(tasks: Task[], start: Date, end: Date) {
  const grouped: Record<string, Task[]> = {};

  for (const task of tasks) {
    // Include every day in range where the task is pending, regardless of start date.
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = new Date(d);
      if (isPendingOnDate(task, day)) {
        const key = dayKey(day);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(task);
      }
    }
  }

  return grouped;
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tasks = useTasks();
  const [appState, setAppState] = useApp();
  const [isTaskMenuOpen, setIsTaskMenuOpen] = useState(false);

  const today = normalizeDay(new Date());
  const initialScope = (params.get("scope") as Scope) || "week";
  const initialView = (params.get("view") as ViewMode) || "week";
  const initialWeekParam = params.get("week");
  const initialMonthParam = params.get("month");

  const resolveWeekStart = (scope: Scope) => {
    if (scope === "tomorrow") {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return startOfWeek(tomorrow);
    }
    return startOfWeek(today);
  };

  const [scope, setScope] = useState<Scope>(initialScope);
  const [view, setView] = useState<ViewMode>(initialView);
  const [weekStart, setWeekStart] = useState<Date>(
    initialWeekParam ? normalizeDay(new Date(initialWeekParam)) : resolveWeekStart(initialScope)
  );
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => {
    const base = initialMonthParam ? new Date(initialMonthParam) : today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const { start, end } = useMemo(() => {
    if (view === "week") {
      const s = normalizeDay(weekStart);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      return { start: s, end: e };
    }

    if (view === "month") {
      const s = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
      const e = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0);
      return { start: s, end: e };
    }

    return scopeToDates(scope, today);
  }, [view, weekStart, monthAnchor, scope, today]);

  const grouped = useMemo(() => groupTasksByDay(tasks.data || [], start, end), [tasks.data, start, end]);

  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const monthDays = useMemo(() => buildMonthDays(monthAnchor), [monthAnchor]);
  const monthWeeks = useMemo(() => {
    const weeks: Array<Array<Date | null>> = [];
    for (let i = 0; i < monthDays.length; i += 7) {
      weeks.push(monthDays.slice(i, i + 7));
    }
    return weeks;
  }, [monthDays]);

  const overdueList = useMemo(() => {
    if (!tasks.data) return [];
    return tasks.data.filter((task) => isOverdue(task, today));
  }, [tasks.data, today]);

  const handleViewChange = (next: ViewMode) => {
    setView(next);
    if (next === "week") {
      navigate(`/calendar?scope=${scope}&view=${next}&week=${dayKey(weekStart)}`, { replace: true });
    } else {
      const monthKey = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1).toISOString().slice(0, 10);
      navigate(`/calendar?scope=${scope}&view=${next}&month=${monthKey}`, { replace: true });
    }
  };

  const changeWeek = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + delta * 7);
    setWeekStart(next);
    setScope("week");
    navigate(`/calendar?scope=week&view=week&week=${dayKey(next)}`, { replace: true });
  };

  const changeMonth = (delta: number) => {
    const next = new Date(monthAnchor);
    next.setMonth(monthAnchor.getMonth() + delta);
    next.setDate(1);
    setMonthAnchor(next);
    setView("month");
    const monthKey = next.toISOString().slice(0, 10);
    navigate(`/calendar?scope=${scope}&view=month&month=${monthKey}`, { replace: true });
  };

  const openTask = (task: Task, activeDay?: Date) => {
    setAppState({
      ...appState,
      activeTask: task,
      activeDate: activeDay ?? new Date(task.date),
    });
    setIsTaskMenuOpen(true);
  };

  const renderTask = (task: Task, day?: Date) => (
    <button
      key={task.id ?? task.title}
      type="button"
      onClick={() => openTask(task, day)}
      className="flex flex-col rounded-xl surface-card border px-3 py-2 xl:px-2 xl:py-1.5 text-left shadow-xs transition hover:border-accent-blue/40"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm xl:text-xs font-semibold text-primary xl:truncate">{task.title}</span>
        {task.priority ? <span className="text-[11px] font-semibold text-amber-600 shrink-0">P{task.priority}</span> : null}
      </div>
      {task.description ? (
        <p className="mt-1 text-xs text-muted line-clamp-2 xl:hidden">{task.description}</p>
      ) : null}
      {Array.isArray(task.tags) && task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 xl:hidden">
          {task.tags.map((tag) => (
            <span key={String(tag)} className="rounded-full bg-accent-blue/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-blue-800 ring-1 ring-accent-blue/20">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );

  const renderWeek = () => (
    <>
      {/* ── Desktop: 7-column strip with vertical dividers ── */}
      <div className="hidden md:grid md:grid-cols-7 md:grid-rows-1 md:flex-1 md:min-h-0 divide-x divide-(--surface-border) border border-(--surface-border) rounded-2xl overflow-hidden">
        {weekDays.map((day) => {
          const key = dayKey(day);
          const dayTasks = sortByTime(grouped[key] || []);
          const isToday = dayKey(day) === dayKey(today);
          const visible = dayTasks.slice(0, MAX_WEEK_TASKS);
          const overflow = dayTasks.length - MAX_WEEK_TASKS;

          return (
            <div key={key} className="flex flex-col">
              {/* Column header */}
              <div className={`flex flex-col shrink-0 items-center gap-1 px-2 py-3 border-b border-(--surface-border) ${isToday ? "bg-(--accent-subtle)" : ""}`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${isToday ? "text-accent-blue" : "text-muted"}`}>
                  {formatLabel(day, { weekday: "short" })}
                </span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${
                  isToday ? "bg-accent-blue-700 text-white" : "text-primary"
                }`}>
                  {day.getDate()}
                </div>
              </div>
              {/* Tasks */}
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto gap-2 p-2">
                {visible.length === 0 && (
                  <span className="text-center text-xs text-muted py-3">—</span>
                )}
                {visible.map((task) => (
                  <button
                    key={task.id ?? task.title}
                    type="button"
                    onClick={() => openTask(task, day)}
                    className="relative flex flex-col items-start w-full rounded-lg bg-(--surface-card) border border-(--surface-border) px-2 py-1.5 text-left transition hover:border-accent-blue/40"
                  >
                    {task.priority ? (
                      <span className="absolute top-1 right-1 text-[10px] font-bold text-amber-500 leading-none">
                        {"!".repeat(task.priority)}
                      </span>
                    ) : null}
                    {hasTime(task) && (
                      <span className="text-[10px] font-bold text-accent-blue leading-none mb-0.5">
                        {formatTime(task)}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-primary leading-snug line-clamp-2 pr-3">
                      {task.title}
                    </span>
                  </button>
                ))}
                {overflow > 0 && (
                  <span className="text-xs font-semibold text-accent-blue px-1">+{overflow} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Mobile: stacked day cards ── */}
      <div className="md:hidden flex flex-col gap-3">
        {weekDays.map((day) => {
          const key = dayKey(day);
          const dayTasks = grouped[key] || [];
          const isToday = dayKey(day) === dayKey(today);
          return (
            <div key={key} className="rounded-2xl surface-card border p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ring-1 ${
                  isToday
                    ? "bg-accent-blue/90 text-white ring-white/60 shadow-xs shadow-accent-blue/25"
                    : "bg-slate-100 text-primary ring-slate-200 dark:bg-(--surface-raised) dark:ring-(--surface-border)"
                }`}>
                  {formatLabel(day, { weekday: "short" })}
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-sm font-semibold text-primary">{formatLabel(day, { month: "short", day: "numeric" })}</span>
                  <span className="text-xs text-muted">{dayTasks.length} pending</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {dayTasks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted dark:border-(--surface-border) dark:bg-(--surface-raised)">
                    Nothing due.
                  </div>
                )}
                {dayTasks.map((task) => renderTask(task, day))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderMonth = () => (
    <>
      {/* ── Desktop: full-page month grid ── */}
      <div className="hidden md:flex md:flex-col border border-(--surface-border) rounded-2xl overflow-hidden">
        {/* Day-name header */}
        <div className="grid grid-cols-7 divide-x divide-(--surface-border) border-b border-(--surface-border)">
          {DAY_NAMES.map((name) => (
            <div key={name} className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted text-center">
              {name}
            </div>
          ))}
        </div>
        {/* Week rows */}
        <div className="flex flex-col divide-y divide-(--surface-border)">
          {monthWeeks.map((week, idx) => (
            <div key={idx} className="grid grid-cols-7 divide-x divide-(--surface-border) min-h-[130px]">
              {week.map((day, dayIdx) => {
                if (!day) {
                  return <div key={`empty-${idx}-${dayIdx}`} className="p-2 opacity-20 bg-(--app-background)" />;
                }
                const key = dayKey(day);
                const dayTasks = grouped[key] || [];
                const isToday = dayKey(day) === dayKey(today);
                const isCurrentMonth = day.getMonth() === monthAnchor.getMonth();
                const visible = dayTasks.slice(0, MAX_MONTH_TASKS);
                const overflow = dayTasks.length - MAX_MONTH_TASKS;

                return (
                  <div
                    key={key}
                    className={`flex flex-col p-2 gap-1 ${!isCurrentMonth ? "opacity-40" : ""}`}
                  >
                    <div className="flex justify-end mb-0.5">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${
                        isToday ? "ring-2 ring-accent-blue/70 text-accent-blue" : "text-primary"
                      }`}>
                        {day.getDate()}
                      </span>
                    </div>
                    {visible.map((task) => (
                      <button
                        key={task.id ?? task.title}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openTask(task, day); }}
                        className="truncate w-full text-left rounded-md bg-(--surface-raised) px-1.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-(--accent-subtle) hover:text-accent-blue"
                      >
                        {hasTime(task) && (
                          <span className="text-accent-blue mr-1">{formatTime(task)}</span>
                        )}
                        {task.title}
                      </button>
                    ))}
                    {overflow > 0 && (
                      <span className="text-[11px] font-semibold text-accent-blue pl-1">+{overflow} more</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Mobile: compact dot grid ── */}
      <div className="md:hidden flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => changeMonth(-1)} className="rounded-full surface-card border px-3 py-1.5 text-sm font-semibold text-primary shadow-xs transition hover:border-accent-blue/40" aria-label="Previous month">←</button>
          <span className="text-lg font-semibold text-primary">{formatLabel(monthAnchor, { month: "long", year: "numeric" })}</span>
          <button type="button" onClick={() => changeMonth(1)} className="rounded-full surface-card border px-3 py-1.5 text-sm font-semibold text-primary shadow-xs transition hover:border-accent-blue/40" aria-label="Next month">→</button>
        </div>
        <div className="grid grid-cols-7 border-b border-(--surface-border) pb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-muted py-1">{d.slice(0, 1)}</div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {monthWeeks.map((week, idx) => (
            <div key={idx} className="grid grid-cols-7 gap-1">
              {week.map((day, dayIdx) => {
                if (!day) return <div key={`empty-${idx}-${dayIdx}`} />;
                const key = dayKey(day);
                const dayTasks = grouped[key] || [];
                const isToday = dayKey(day) === dayKey(today);
                const isCurrentMonth = day.getMonth() === monthAnchor.getMonth();
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openTask(dayTasks[0] ?? { title: "", date: day, done: false, tags: [] } as Task, day)}
                    className={`flex flex-col items-center rounded-xl border py-1.5 transition ${
                      isToday ? "border-accent-blue/50 bg-(--accent-subtle)" : "border-transparent hover:bg-(--surface-raised)"
                    } ${!isCurrentMonth ? "opacity-40" : ""}`}
                  >
                    <span className={`text-xs font-semibold ${isToday ? "text-accent-blue" : "text-primary"}`}>{day.getDate()}</span>
                    {dayTasks.length > 0 && (
                      <span className="text-[9px] font-bold text-muted leading-none">{dayTasks.length}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="w-full flex flex-col flex-1 min-h-0 px-3 md:px-0 py-4 pb-28 md:pb-4 gap-4">
      {/* ── Header row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold text-primary">Calendar</h1>
          <p className="text-sm text-muted md:hidden">See what's coming up.</p>
        </div>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center gap-2">
          {view === "week" ? (
            <>
              <button type="button" onClick={() => changeWeek(-1)} className="rounded-full surface-card border px-3 py-1.5 text-sm font-semibold text-primary shadow-xs transition hover:border-accent-blue/40" aria-label="Previous week">←</button>
              <span className="min-w-[200px] text-center text-base font-semibold text-primary">
                Week of {formatLabel(weekStart, { month: "long", day: "numeric" })}
              </span>
              <button type="button" onClick={() => changeWeek(1)} className="rounded-full surface-card border px-3 py-1.5 text-sm font-semibold text-primary shadow-xs transition hover:border-accent-blue/40" aria-label="Next week">→</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => changeMonth(-1)} className="rounded-full surface-card border px-3 py-1.5 text-sm font-semibold text-primary shadow-xs transition hover:border-accent-blue/40" aria-label="Previous month">←</button>
              <span className="min-w-[180px] text-center text-base font-semibold text-primary">
                {formatLabel(monthAnchor, { month: "long", year: "numeric" })}
              </span>
              <button type="button" onClick={() => changeMonth(1)} className="rounded-full surface-card border px-3 py-1.5 text-sm font-semibold text-primary shadow-xs transition hover:border-accent-blue/40" aria-label="Next month">→</button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(["week", "month"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleViewChange(mode)}
              className={`rounded-full px-3 py-2 text-sm font-semibold shadow-xs transition ${view === mode ? "bg-accent-blue text-white shadow-accent-blue/30" : "surface-card border text-primary hover:-translate-y-px"}`}
            >
              {mode === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile week navigation */}
      {view === "week" && (
        <div className="flex md:hidden flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => changeWeek(-1)} className="rounded-full surface-card border px-3 py-1.5 text-sm font-semibold text-primary shadow-xs transition hover:border-accent-blue/40" aria-label="Previous week">←</button>
          <span className="text-base font-semibold text-primary">Week of {formatLabel(weekStart, { month: "long", day: "numeric" })}</span>
          <button type="button" onClick={() => changeWeek(1)} className="rounded-full surface-card border px-3 py-1.5 text-sm font-semibold text-primary shadow-xs transition hover:border-accent-blue/40" aria-label="Next week">→</button>
        </div>
      )}

      {/* Overdue banner */}
      {scope === "overdue" && (
        <div className="rounded-2xl border border-red-200/70 bg-red-50/70 p-4 shadow-xs dark:border-red-400/50 dark:bg-[rgba(248,113,113,0.12)]">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-red-700 dark:text-red-200">Overdue</span>
              <span className="text-sm text-red-700/80 dark:text-red-200/80">Pending tasks before today</span>
            </div>
            <span className="text-2xl font-bold text-red-700 dark:text-red-200">{overdueList.length}</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {overdueList.length === 0 && (
              <div className="rounded-xl border border-dashed border-red-200 bg-white/70 px-3 py-2 text-sm text-red-700 dark:border-red-300/60 dark:bg-(--surface-raised) dark:text-red-200">
                All caught up!
              </div>
            )}
            {overdueList.map((task) => renderTask(task))}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      {tasks.isLoading && (
        <div className="rounded-2xl surface-card border p-4 text-sm text-muted shadow-xs">
          Loading calendar...
        </div>
      )}
      {tasks.isSuccess && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {view === "week" ? renderWeek() : renderMonth()}
          <TaskInfoMenu type="edit" isOpen={isTaskMenuOpen} setIsOpen={setIsTaskMenuOpen} />
        </div>
      )}
    </div>
  );
}
