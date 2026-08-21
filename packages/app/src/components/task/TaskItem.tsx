import { Task, useUpdateTask } from "@/hooks/tasks";
import { completeTaskOccurrence } from "@/utils/taskCompletion";
import { useRef, useState } from "react";
import TaskItemShell from "./TaskItemShell";
import TaskItemCheckBox from "./TaskItemCheckbox";
import TaskItemTitle from "./TaskItemTitle";
import TaskItemDate from "./TaskItemDate";
import TaskItemQuickActions from "./TaskItemQuickActions";
import { isTaskDone } from "@/utils/data";
import { useApp } from "@/hooks/app";
import { useSettings } from "@/hooks/settings";

const LONG_PRESS_MS = 500;

interface TaskItemParams {
  skeleton?: boolean;
  item?: Task;
  setIsInspecting?: (open: boolean) => void;
  taskFilter?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isAnimating?: boolean;
  onComplete?: (task: Task) => void;
  /** Overrides the app's global active date for pending/completion checks — e.g. Home's Upcoming Tasks always uses today, regardless of the date selected elsewhere in the app. */
  activeDate?: Date;
}

export function TaskItem({ skeleton, item, setIsInspecting, taskFilter, selectionMode = false, isSelected = false, onToggleSelect, isAnimating = false, onComplete, activeDate }: TaskItemParams) {
  const { mutate: updateTask } = useUpdateTask();
  const [appData, setAppData] = useApp();
  const settings = useSettings();
  const showDates = settings.data?.showTaskDates !== false;
  const [isCompleting, setIsCompleting] = useState(false);
  const [quickActions, setQuickActions] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectiveDate = activeDate ?? appData.activeDate;

  if (skeleton) {
    return (
      <div className="w-full flex flex-col gap-2">
        <TaskItemShell skeleton={true}>
          <div className="w-full h-full flex flex-row items-center">
            <TaskItemCheckBox />
            <div className="w-full">
              <div className="w-full flex flex-row items-center justify-between">
                <TaskItemTitle text="Loading..." />
              </div>
              <div className="w-fit flex flex-row flex-end items-center justify-start px-2">
                <div className="w-full h-full flex items-center justify-evenly">
                  <TaskItemDate task={item!} />
                </div>
              </div>
            </div>
          </div>
        </TaskItemShell>
        <div className="w-full flex justify-end">
          <div className="w-full pl-10 flex flex-col justify-end gap-1"></div>
        </div>
      </div>
    )
  }


  // TODO: Remove Later
  if (!setIsInspecting) setIsInspecting = () => { };

  if (!item) item = { title: "", date: new Date(), done: false, tags: [] };


  const handleToggleSelect = () => {
    if (!onToggleSelect || !item?.id) return;
    onToggleSelect(item.id);
  };


  const handleMarkComplete = (e: React.ChangeEvent) => {
    e.stopPropagation();
    setIsCompleting(true);

    completeTaskOccurrence(item as Task, effectiveDate!, updateTask);

    if (onComplete) onComplete(item as Task);

    // allow fade-out before hiding when filtering incomplete
    setTimeout(() => setIsCompleting(false), 600);
  };

  const openEdit = () => {
    setAppData({
      ...appData,
      activeTask: item,
    });
    setIsInspecting!(true);
  };

  const toggleComplete = () => {
    completeTaskOccurrence(item as Task, effectiveDate!, updateTask);
    if (onComplete) onComplete(item as Task);
  };

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (selectionMode) return;
    e.preventDefault();
    e.stopPropagation();
    setQuickActions({ x: e.clientX, y: e.clientY });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (selectionMode || e.pointerType !== "touch") return;
    const { clientX, clientY } = e;
    clearLongPressTimer();
    longPressTimer.current = setTimeout(() => {
      setQuickActions({ x: clientX, y: clientY });
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => clearLongPressTimer();
  const handlePointerMove = () => clearLongPressTimer();

  const handleInteractive = (e: React.MouseEvent) => {
    if (selectionMode) {
      e.stopPropagation();
      handleToggleSelect();
      return;
    }

    e.stopPropagation();

    setAppData({
      ...appData,
      activeTask: item,
    });

    setIsInspecting(true);
  };

  const selectionClass = selectionMode
    ? isSelected
      ? "ring-2 ring-accent-blue/40"
      : "ring-1 ring-dashed ring-accent-blue/30"
    : "";

  const fadeClass =
    isCompleting || isAnimating
      ? "opacity-0 translate-y-1 scale-[0.98] pointer-events-none"
      : "";

  const isPending = isTaskDone(item!, effectiveDate!);

  return (
    <div
      className={`${taskFilter == "all" || (taskFilter == "incomplete" && (isPending || isCompleting))
        ? "flex"
        : "hidden"
        } w-full flex-col gap-2`}
    >
      <TaskItemShell
        task={item}
        activeDate={effectiveDate}
        className={`${fadeClass} ${selectionClass}`}
        onClick={handleInteractive}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerCancel={handlePointerUp}
      >
        <div className="w-full h-full flex flex-row items-center">
          <TaskItemCheckBox
            checked={!isTaskDone(item!, effectiveDate!)}
            onChange={(e: React.ChangeEvent) => {
              if (selectionMode) {
                handleToggleSelect();
                return;
              }
              handleMarkComplete(e);
            }}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              if (selectionMode) handleToggleSelect();
            }}
          />
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="w-full flex flex-row items-center gap-2">
              <div className="flex flex-row items-center min-w-0 flex-1 overflow-hidden">
                <TaskItemTitle text={item.title} />
              </div>
              {showDates && (
                <div className="shrink-0 w-20 overflow-hidden">
                  <TaskItemDate task={item} />
                </div>
              )}
              {!!item.priority && item.priority > 0 && (() => {
                const badge: Record<number, { label: string; cls: string }> = {
                  1: { label: "Low",  cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
                  2: { label: "Med",  cls: "bg-amber-100   text-amber-700   dark:bg-amber-900/30   dark:text-amber-400"   },
                  3: { label: "High", cls: "bg-rose-100    text-rose-700    dark:bg-rose-900/30    dark:text-rose-400"    },
                };
                const b = badge[item.priority!];
                return b ? (
                  <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide leading-none ${b.cls}`}>
                    {b.label}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      </TaskItemShell>
      {quickActions && (
        <TaskItemQuickActions
          x={quickActions.x}
          y={quickActions.y}
          isPending={isPending}
          onEdit={openEdit}
          onToggleComplete={toggleComplete}
          onClose={() => setQuickActions(null)}
        />
      )}
    </div>
  );
}
