import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTasks, Task, useUpdateTask } from "@/hooks/tasks";
import { occursOnDate, isTaskDone } from "@/utils/data";
import { completeTaskOccurrence } from "@/utils/taskCompletion";
import TaskInfoMenu from "@/pages/(Layout)/TaskInfoMenu";
import { useApp } from "@/hooks/app";
import { useSettings } from "@/hooks/settings";
import { useDeviceCalendarEvents, DeviceCalendarEvent } from "@/hooks/calendar";
import { CheckIcon } from "@heroicons/react/20/solid";

type Scope = "today" | "tomorrow" | "week" | "month" | "overdue" | "all";
type ViewMode = "week" | "month";

const MAX_WEEK_TASKS = 6;
const MAX_MONTH_TASKS = 3;
const MAX_WEEK_EVENTS = 3;
const MAX_MONTH_EVENTS = 2;

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

const formatEventTime = (event: DeviceCalendarEvent) =>
  new Date(event.startDate).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const sortEventsByTime = (list: DeviceCalendarEvent[]) =>
  [...list].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

function groupEventsByDay(events: DeviceCalendarEvent[], start: Date, end: Date) {
  const grouped: Record<string, DeviceCalendarEvent[]> = {};

  for (const event of events) {
    const eventStart = normalizeDay(new Date(event.startDate));
    // All-day event end dates are exclusive (midnight of the following day) — back off
    // by a moment before normalizing so a single all-day event doesn't spill into the next day.
    const rawEnd = new Date(event.endDate);
    const eventEnd = normalizeDay(event.isAllDay ? new Date(rawEnd.getTime() - 1) : rawEnd);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = new Date(d);
      if (day >= eventStart && day <= eventEnd) {
        const key = dayKey(day);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(event);
      }
    }
  }

  return grouped;
}

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
  const settings = useSettings();
  const [appState, setAppState] = useApp();
  const [isTaskMenuOpen, setIsTaskMenuOpen] = useState(false);
  const showDeviceCalendarEvents = !!settings.data?.showDeviceCalendarEvents;

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

  const [searchTerm, setSearchTerm] = useState("");

  const searchedTasks = useMemo(() => {
    const all = tasks.data || [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return all;

    return all.filter((task) => {
      const title = (task.title ?? "").toLowerCase();
      const description = (task.description ?? "").toLowerCase();
      const group = (task.group ?? "").toLowerCase();
      const tags = Array.isArray(task.tags)
        ? task.tags
            .map((tag) => (typeof tag === "string" ? tag.toLowerCase() : ""))
            .join(" ")
        : "";

      return (
        title.includes(term) ||
        description.includes(term) ||
        group.includes(term) ||
        tags.includes(term)
      );
    });
  }, [tasks.data, searchTerm]);

  const grouped = useMemo(() => groupTasksByDay(searchedTasks, start, end), [searchedTasks, start, end]);

  const deviceEvents = useDeviceCalendarEvents(start, end, showDeviceCalendarEvents);
  const eventsGrouped = useMemo(
    () => groupEventsByDay(deviceEvents.data || [], start, end),
    [deviceEvents.data, start, end]
  );

  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const monthDays = useMemo(() => buildMonthDays(monthAnchor), [monthAnchor]);
  const monthWeeks = useMemo(() => {
    const weeks: Array<Array<Date | null>> = [];
    for (let i = 0; i < monthDays.length; i += 7) {
      weeks.push(monthDays.slice(i, i + 7));
    }
    return weeks;
  }, [monthDays]);

  const [windowH, setWindowH] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 932
  );
  useEffect(() => {
    const handler = () => setWindowH(window.innerHeight);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // containerH is the explicit height we assign to the mobile month container.
  // windowH (window.innerHeight) minus overhead: DataContainer padding (~96px),
  // page title + combined mobile nav + gaps (~160px), day-name row + gap (~30px) = ~286px.
  // Use 320 as a conservative buffer that also covers safe-area insets.
  const mobileMontContainerH = Math.max(300, windowH - 320);
  const maxMobileTasks = useMemo(() => {
    const gridH = mobileMontContainerH - 30; // 30 = day-name row (22px) + gap-2 (8px)
    const rowH = Math.max(40, gridH / monthWeeks.length);
    // 18 = date number; 17 = pill height (16px) + gap-px (1px)
    return Math.max(1, Math.floor((rowH - 18) / 17));
  }, [mobileMontContainerH, monthWeeks.length]);

  const overdueList = useMemo(() => {
    return searchedTasks.filter((task) => isOverdue(task, today));
  }, [searchedTasks, today]);

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

  const shiftWeekStartByDay = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + delta);
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

  const priorityBadge = (priority: number | undefined, compact = false) => {
    if (!priority || priority <= 0) return null;
    const cfg: Record<number, { label: string; short: string; cls: string }> = {
      1: { label: "Low",  short: "L", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
      2: { label: "Med",  short: "M", cls: "bg-amber-100   text-amber-700   dark:bg-amber-900/30   dark:text-amber-400"   },
      3: { label: "High", short: "H", cls: "bg-rose-100    text-rose-700    dark:bg-rose-900/30    dark:text-rose-400"    },
    };
    const c = cfg[priority];
    if (!c) return null;
    return (
      <span className={`shrink-0 rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wide leading-none ${compact ? "text-[9px]" : "text-[10px]"} ${c.cls}`}>
        {compact ? c.short : c.label}
      </span>
    );
  };

  const openTask = (task: Task, activeDay?: Date) => {
    setAppState({
      ...appState,
      activeTask: task,
      activeDate: activeDay ?? new Date(task.date),
    });
    setIsTaskMenuOpen(true);
  };

  const { mutate: updateTaskMutation } = useUpdateTask();

  const isActiveDay = (day: Date) => dayKey(day) === dayKey(normalizeDay(appState.activeDate ?? today));

  const selectDate = (day: Date) => {
    setAppState({ ...appState, activeDate: day });
  };

  const toggleTaskComplete = (task: Task, day: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    completeTaskOccurrence(task, day, updateTaskMutation);
  };

  const completeToggle = (task: Task, day: Date, compact = false) => {
    const pending = isPendingOnDate(task, day);
    return (
      <button
        type="button"
        onClick={(e) => toggleTaskComplete(task, day, e)}
        title={pending ? "Mark complete" : "Mark incomplete"}
        aria-label={pending ? "Mark complete" : "Mark incomplete"}
        className={`shrink-0 flex items-center justify-center rounded-md border-2 transition ${compact ? "h-4 w-4" : "h-5 w-5"} ${
          pending
            ? "border-accent-blue/50 bg-white hover:border-accent-blue dark:bg-[rgba(15,23,42,0.7)]"
            : "border-accent-blue bg-linear-to-br from-accent-blue-600 to-accent-blue-500"
        }`}
      >
        {!pending && <CheckIcon className={compact ? "h-3 w-3 text-white" : "h-3.5 w-3.5 text-white"} />}
      </button>
    );
  };

  // Trackpad two-finger swipe fires as wheel events with a horizontal delta.
  // Debounce so one physical swipe gesture only advances the range once.
  const wheelCooldown = useRef(false);
  const handleWheelNav = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) < 24 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    if (wheelCooldown.current) return;

    wheelCooldown.current = true;
    if (view === "week") changeWeek(e.deltaX > 0 ? 1 : -1);
    else changeMonth(e.deltaX > 0 ? 1 : -1);

    window.setTimeout(() => { wheelCooldown.current = false; }, 450);
  };

  // Touch swipe: the range visually tracks the finger in real time (with
  // rubber-band resistance, so it gets progressively harder to drag further).
  // Releasing past a distance/velocity threshold slides the range fully off
  // and commits the change (a full swipe advances the week/month, a shorter
  // "half" swipe just nudges the week's first day by one); releasing early
  // springs back to where it started.
  const swipeContainerRef = useRef<HTMLDivElement | null>(null);
  const swipeStateRef = useRef<{ x: number; y: number; t: number; active: boolean | null } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragPhase, setDragPhase] = useState<"idle" | "dragging" | "settling">("idle");

  useEffect(() => {
    const el = swipeContainerRef.current;
    if (!el) return;

    const ACTIVATE_PX = 10; // min movement before we decide this is a horizontal drag
    const RESISTANCE = 0.55; // lower = more rubber-band resistance
    const RATIO_RANGE = 0.4; // raw drag distance (as a fraction of width) that commits a full week/month
    const RATIO_DAY = 0.15; // raw drag distance that commits a 1-day nudge (week view only)
    const VELOCITY_FAST = 0.6; // px/ms — a deliberate flick
    const VELOCITY_VERY_FAST = 1.1; // px/ms — a hard flick commits a full range jump outright

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      swipeStateRef.current = { x: t.screenX, y: t.screenY, t: e.timeStamp, active: null };
    };

    const onMove = (e: TouchEvent) => {
      const drag = swipeStateRef.current;
      if (!drag) return;
      const t = e.touches[0];
      const dx = t.screenX - drag.x;
      const dy = t.screenY - drag.y;

      if (drag.active === null) {
        if (Math.abs(dx) < ACTIVATE_PX && Math.abs(dy) < ACTIVATE_PX) return;
        drag.active = Math.abs(dx) > Math.abs(dy);
        if (drag.active) setDragPhase("dragging");
      }
      if (!drag.active) return; // vertical intent — let the page scroll normally

      e.preventDefault();
      const width = el.clientWidth || window.innerWidth;
      const damped = Math.sign(dx) * width * (1 - Math.exp(-Math.abs(dx) / (width * RESISTANCE)));
      setDragX(damped);
    };

    const onEnd = (e: TouchEvent) => {
      const drag = swipeStateRef.current;
      swipeStateRef.current = null;
      if (!drag || !drag.active) {
        setDragPhase("idle");
        setDragX(0);
        return;
      }

      const t = e.changedTouches[0] ?? e.touches[0];
      const dx = t.screenX - drag.x;
      const dt = Math.max(1, e.timeStamp - drag.t);
      const velocity = dx / dt;
      const width = el.clientWidth || window.innerWidth;
      const ratio = Math.abs(dx) / width;
      const direction = dx < 0 ? 1 : -1;
      const fastFlick = Math.abs(velocity) >= VELOCITY_FAST;
      const veryFastFlick = Math.abs(velocity) >= VELOCITY_VERY_FAST;

      let tier: "range" | "day" | null = null;
      if (ratio >= RATIO_RANGE || veryFastFlick) {
        tier = "range";
      } else if (view === "week" && (ratio >= RATIO_DAY || fastFlick)) {
        tier = "day";
      } else if (view !== "week" && fastFlick && ratio >= RATIO_DAY) {
        tier = "range";
      }

      setDragPhase("settling");
      if (!tier) {
        setDragX(0);
        window.setTimeout(() => setDragPhase("idle"), 260);
        return;
      }

      setDragX(direction * width);
      window.setTimeout(() => {
        if (view === "week") {
          if (tier === "range") changeWeek(direction);
          else shiftWeekStartByDay(direction);
        } else {
          changeMonth(direction);
        }
        setDragPhase("idle");
        setDragX(0);
      }, 220);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [view, weekStart, monthAnchor]);

  const renderTask = (task: Task, day?: Date) => {
    const effectiveDay = day ?? normalizeDay(new Date(task.date));
    return (
      <div
        key={task.id ?? task.title}
        className="flex items-start gap-2 rounded-xl surface-card border px-3 py-2 xl:px-2 xl:py-1.5 shadow-xs transition hover:border-accent-blue/40"
      >
        <div className="pt-0.5">{completeToggle(task, effectiveDay)}</div>
        <button
          type="button"
          onClick={() => openTask(task, day)}
          className="flex flex-1 min-w-0 flex-col text-left"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm xl:text-xs font-semibold text-primary xl:truncate">{task.title}</span>
            {priorityBadge(task.priority)}
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
      </div>
    );
  };

  const renderEventChip = (event: DeviceCalendarEvent, compact = false) => (
    <div
      key={event.id}
      title={event.title}
      className={`flex items-center gap-1.5 rounded-md border-l-2 bg-(--surface-raised)/60 px-2 py-1 ${compact ? "text-[10px]" : "text-xs"}`}
      style={{ borderLeftColor: event.color }}
    >
      {!event.isAllDay && (
        <span className="shrink-0 font-semibold text-muted">{formatEventTime(event)}</span>
      )}
      <span className="truncate italic text-muted">{event.title}</span>
    </div>
  );

  const renderWeek = () => (
    <>
      {/* ── Desktop: 7-column strip with vertical dividers ── */}
      <div className="hidden md:grid md:grid-cols-7 md:grid-rows-1 md:flex-1 md:min-h-0 divide-x divide-(--surface-border) border border-(--surface-border) rounded-2xl overflow-hidden">
        {weekDays.map((day, dayIdx) => {
          const key = dayKey(day);
          const dayTasks = sortByTime(grouped[key] || []);
          const dayEvents = sortEventsByTime(eventsGrouped[key] || []);
          const isToday = dayKey(day) === dayKey(today);
          const visible = dayTasks.slice(0, MAX_WEEK_TASKS);
          const overflow = dayTasks.length - MAX_WEEK_TASKS;
          const visibleEvents = dayEvents.slice(0, MAX_WEEK_EVENTS);
          const eventOverflow = dayEvents.length - MAX_WEEK_EVENTS;
          const cornerClass = dayIdx === 0 ? "rounded-tl-2xl" : dayIdx === weekDays.length - 1 ? "rounded-tr-2xl" : "";

          return (
            <div key={key} className="flex flex-col">
              {/* Column header */}
              <button
                type="button"
                onClick={() => selectDate(day)}
                title={`Set active date to ${formatLabel(day, { month: "long", day: "numeric" })}`}
                className={`flex flex-col shrink-0 items-center gap-1 w-full px-2 py-3 border-b border-(--surface-border) transition hover:bg-(--accent-subtle) ${cornerClass} ${isToday ? "bg-(--accent-subtle)" : ""} ${isActiveDay(day) ? "ring-2 ring-inset ring-accent-blue/50" : ""}`}
              >
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${isToday ? "text-accent-blue" : "text-muted"}`}>
                  {formatLabel(day, { weekday: "short" })}
                </span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${
                  isToday ? "bg-accent-blue-700 text-white" : "text-primary"
                }`}>
                  {day.getDate()}
                </div>
              </button>
              {/* Tasks */}
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto gap-2 p-2">
                {visible.length === 0 && (
                  <span className="text-center text-xs text-muted py-3">—</span>
                )}
                {visible.map((task) => (
                  <div
                    key={task.id ?? task.title}
                    className="relative flex items-start gap-1.5 w-full rounded-lg bg-(--surface-card) border border-(--surface-border) px-2 py-1.5 transition hover:border-accent-blue/40"
                  >
                    <div className="pt-0.5">{completeToggle(task, day, true)}</div>
                    <button
                      type="button"
                      onClick={() => openTask(task, day)}
                      className="relative flex flex-1 min-w-0 flex-col items-start text-left"
                    >
                      {task.priority ? (
                        <span className="absolute top-0 right-1 leading-none">
                          {priorityBadge(task.priority, true)}
                        </span>
                      ) : null}
                      {hasTime(task) && (
                        <span className="text-[10px] font-bold text-accent-blue leading-none mb-0.5">
                          {formatTime(task)}
                        </span>
                      )}
                      <span className="w-full text-xs font-semibold text-primary leading-snug line-clamp-2 pr-6 break-words">
                        {task.title}
                      </span>
                    </button>
                  </div>
                ))}
                {overflow > 0 && (
                  <span className="text-xs font-semibold text-accent-blue px-1">+{overflow} more</span>
                )}
                {visibleEvents.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-(--surface-border)/60">
                    {visibleEvents.map((event) => renderEventChip(event))}
                    {eventOverflow > 0 && (
                      <span className="text-[10px] font-semibold text-muted px-1">+{eventOverflow} more</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Mobile: compact day list ── */}
      <div className="md:hidden rounded-2xl surface-card border overflow-hidden shadow-xs">
        {weekDays.map((day, idx) => {
          const key = dayKey(day);
          const dayTasks = sortByTime(grouped[key] || []);
          const dayEvents = sortEventsByTime(eventsGrouped[key] || []);
          const isToday = dayKey(day) === dayKey(today);
          const overflow = dayTasks.length - 3;
          const eventOverflow = dayEvents.length - 2;
          return (
            <div key={key} className={idx > 0 ? "border-t border-(--surface-border)" : ""}>
              <button
                type="button"
                onClick={() => selectDate(day)}
                title={`Set active date to ${formatLabel(day, { month: "long", day: "numeric" })}`}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition ${isToday ? "bg-(--accent-subtle)" : ""} ${isActiveDay(day) ? "ring-2 ring-inset ring-accent-blue/50" : ""}`}
              >
                <span className={`shrink-0 w-8 text-xs font-bold ${isToday ? "text-accent-blue" : "text-muted"}`}>
                  {formatLabel(day, { weekday: "short" })}
                </span>
                <span className={`text-sm font-semibold ${isToday ? "text-accent-blue" : "text-primary"}`}>
                  {formatLabel(day, { month: "short", day: "numeric" })}
                </span>
                {dayTasks.length > 0 && (
                  <span className="ml-auto shrink-0 rounded-full bg-accent-blue/10 px-2 py-0.5 text-[11px] font-bold text-accent-blue-700 dark:bg-(--accent-subtle) dark:text-accent-blue-300">
                    {dayTasks.length}
                  </span>
                )}
              </button>
              {dayTasks.length > 0 && (
                <div className="flex flex-col px-4 pb-2.5 pt-0.5 gap-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div key={task.id ?? task.title} className="flex items-center gap-2 w-full py-0.5">
                      {completeToggle(task, day, true)}
                      <button
                        type="button"
                        onClick={() => openTask(task, day)}
                        className="flex flex-1 min-w-0 items-center gap-2 text-left"
                      >
                        {hasTime(task) && (
                          <span className="shrink-0 text-[10px] font-bold text-accent-blue">{formatTime(task)}</span>
                        )}
                        <span className="flex-1 min-w-0 text-sm text-primary truncate">{task.title}</span>
                        {priorityBadge(task.priority, true)}
                      </button>
                    </div>
                  ))}
                  {overflow > 0 && (
                    <span className="text-xs font-semibold text-accent-blue pt-0.5">+{overflow} more</span>
                  )}
                </div>
              )}
              {dayEvents.length > 0 && (
                <div className="flex flex-col px-4 pb-2.5 pt-0.5 gap-1">
                  {dayEvents.slice(0, 2).map((event) => renderEventChip(event, true))}
                  {eventOverflow > 0 && (
                    <span className="text-[10px] font-semibold text-muted pt-0.5">+{eventOverflow} more</span>
                  )}
                </div>
              )}
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
                const dayEvents = sortEventsByTime(eventsGrouped[key] || []);
                const isToday = dayKey(day) === dayKey(today);
                const isCurrentMonth = day.getMonth() === monthAnchor.getMonth();
                const visible = dayTasks.slice(0, MAX_MONTH_TASKS);
                const overflow = dayTasks.length - MAX_MONTH_TASKS;
                const visibleEvents = dayEvents.slice(0, MAX_MONTH_EVENTS);
                const eventOverflow = dayEvents.length - MAX_MONTH_EVENTS;

                return (
                  <div
                    key={key}
                    className={`flex flex-col p-2 gap-1 ${!isCurrentMonth ? "opacity-40" : ""}`}
                  >
                    <div className="flex justify-end mb-0.5">
                      <button
                        type="button"
                        onClick={() => selectDate(day)}
                        title={`Set active date to ${formatLabel(day, { month: "long", day: "numeric" })}`}
                        className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold transition hover:bg-(--accent-subtle) ${
                          isToday ? "ring-2 ring-accent-blue/70 text-accent-blue" : "text-primary"
                        } ${isActiveDay(day) && !isToday ? "ring-2 ring-accent-blue/50" : ""}`}
                      >
                        {day.getDate()}
                      </button>
                    </div>
                    {visible.map((task) => (
                      <div
                        key={task.id ?? task.title}
                        className="flex items-center gap-1 w-full rounded-md bg-(--surface-raised) px-1.5 py-1 transition hover:bg-(--accent-subtle)"
                      >
                        {completeToggle(task, day, true)}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openTask(task, day); }}
                          className="flex-1 min-w-0 truncate text-left text-[11px] font-semibold text-primary hover:text-accent-blue"
                        >
                          {hasTime(task) && (
                            <span className="text-accent-blue mr-1">{formatTime(task)}</span>
                          )}
                          {task.title}
                        </button>
                      </div>
                    ))}
                    {overflow > 0 && (
                      <span className="text-[11px] font-semibold text-accent-blue pl-1">+{overflow} more</span>
                    )}
                    {visibleEvents.map((event) => renderEventChip(event, true))}
                    {eventOverflow > 0 && (
                      <span className="text-[10px] font-semibold text-muted pl-1">+{eventOverflow} more</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Mobile: full-height dot grid ── */}
      <div className="md:hidden flex flex-col gap-2 -mx-3 px-1.5" style={{ height: `${mobileMontContainerH}px` }}>
        <div className="grid grid-cols-7 shrink-0 border-b border-(--surface-border) pb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-muted py-1">{d.slice(0, 1)}</div>
          ))}
        </div>
        <div
          className="grid flex-1 min-h-0 overflow-hidden"
          style={{ gridTemplateRows: `repeat(${monthWeeks.length}, minmax(0, 1fr))` }}
        >
          {monthWeeks.map((week, idx) => (
            <div key={idx} className="flex flex-row overflow-hidden">
              {week.map((day, dayIdx) => {
                if (!day) return <div key={`empty-${idx}-${dayIdx}`} className="flex-1" />;
                const key = dayKey(day);
                const dayTasks = sortByTime(grouped[key] || []);
                const dayEvents = sortEventsByTime(eventsGrouped[key] || []);
                const isToday = dayKey(day) === dayKey(today);
                const isCurrentMonth = day.getMonth() === monthAnchor.getMonth();
                const overflow = dayTasks.length - maxMobileTasks;
                return (
                  <div
                    key={key}
                    onClick={() => selectDate(day)}
                    title={`Set active date to ${formatLabel(day, { month: "long", day: "numeric" })}`}
                    className={`flex flex-col flex-1 overflow-hidden pt-1 cursor-pointer ${
                      isToday ? "bg-(--accent-subtle)" : ""
                    } ${!isCurrentMonth ? "opacity-40" : ""} ${isActiveDay(day) ? "ring-2 ring-inset ring-accent-blue/50" : ""}`}
                  >
                    <span className={`text-center text-xs font-semibold leading-none mb-1 shrink-0 block ${isToday ? "text-accent-blue" : "text-primary"}`}>
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="flex shrink-0 justify-center gap-0.5 pb-0.5" title={dayEvents.map((e) => e.title).join(", ")}>
                        {dayEvents.slice(0, 3).map((event) => (
                          <span
                            key={event.id}
                            className="h-1 w-1 rounded-full"
                            style={{ backgroundColor: event.color }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex-1 flex flex-col gap-px px-0.5 min-h-0 overflow-hidden">
                      {dayTasks.slice(0, maxMobileTasks).map((task) => (
                        <button
                          key={task.id ?? task.title}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openTask(task, day); }}
                          className="w-full shrink-0 text-left truncate rounded-sm bg-accent-blue px-1 text-[9px] font-bold text-white leading-[1.5] py-px"
                        >
                          {task.title}
                        </button>
                      ))}
                      {overflow > 0 && (
                        <span className="mt-auto text-[11px] font-bold text-accent-blue pl-0.5 pb-0.5 block">+{overflow} more</span>
                      )}
                    </div>
                  </div>
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
          <div className="hidden sm:flex items-center gap-2 rounded-full surface-card border px-3 py-1.5 shadow-xs">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 shrink-0 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.65" y1="16.65" x2="21" y2="21" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks…"
              className="w-32 lg:w-44 !bg-transparent text-sm text-primary outline-hidden placeholder:text-slate-400"
            />
          </div>

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

      {/* Mobile search — full width below the header */}
      <div className="sm:hidden flex items-center gap-2 rounded-xl surface-card border px-3 py-2 shadow-xs">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 shrink-0 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.65" y1="16.65" x2="21" y2="21" />
        </svg>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search tasks…"
          className="w-full !bg-transparent text-sm text-primary outline-hidden placeholder:text-slate-400"
        />
      </div>

      {/* Mobile navigation (week + month) */}
      <div className="flex md:hidden items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => view === "week" ? changeWeek(-1) : changeMonth(-1)}
          className="rounded-full surface-card border px-3 py-1.5 text-sm font-semibold text-primary shadow-xs transition hover:border-accent-blue/40"
          aria-label={view === "week" ? "Previous week" : "Previous month"}
        >←</button>
        <span className="flex-1 text-center text-base font-semibold text-primary truncate">
          {view === "week"
            ? `Week of ${formatLabel(weekStart, { month: "short", day: "numeric" })}`
            : formatLabel(monthAnchor, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => view === "week" ? changeWeek(1) : changeMonth(1)}
          className="rounded-full surface-card border px-3 py-1.5 text-sm font-semibold text-primary shadow-xs transition hover:border-accent-blue/40"
          aria-label={view === "week" ? "Next week" : "Next month"}
        >→</button>
      </div>

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
        <div
          key={view === "week" ? `week-${dayKey(weekStart)}` : `month-${monthAnchor.getFullYear()}-${monthAnchor.getMonth()}`}
          className="flex flex-col flex-1 min-h-0 calendar-range-shift"
        >
          <div
            ref={swipeContainerRef}
            onWheel={handleWheelNav}
            style={{
              transform: `translateX(${dragX}px)`,
              transition: dragPhase === "dragging" ? "none" : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
              touchAction: "pan-y",
            }}
            className="flex flex-col flex-1 min-h-0"
          >
            {view === "week" ? renderWeek() : renderMonth()}
          </div>
          <TaskInfoMenu type="edit" isOpen={isTaskMenuOpen} setIsOpen={setIsTaskMenuOpen} />
        </div>
      )}
    </div>
  );
}
