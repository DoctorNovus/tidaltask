import { Task, useUpdateTask } from "@/hooks/tasks";
import { matchDate } from "@/utils/date";
import { useState } from "react";
import TaskItemShell from "./TaskItemShell";
import TaskItemCheckBox from "./TaskItemCheckbox";
import TaskItemTitle from "./TaskItemTitle";
import TaskItemDate from "./TaskItemDate";
import { isTaskDone } from "@/utils/data";
import { useApp } from "@/hooks/app";

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
}

export function TaskItem({ skeleton, item, setIsInspecting, taskFilter, selectionMode = false, isSelected = false, onToggleSelect, isAnimating = false, onComplete }: TaskItemParams) {
  const { mutate: updateTask } = useUpdateTask();
  const [appData, setAppData] = useApp();
  const [isCompleting, setIsCompleting] = useState(false);

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

  const tags = Array.isArray(item.tags) ? item.tags.map((tag) => (typeof tag === "string" ? tag : null)).filter(Boolean) as string[] : [];

  const handleToggleSelect = () => {
    if (!onToggleSelect || !item?.id) return;
    onToggleSelect(item.id);
  };


  const handleMarkComplete = (e: React.ChangeEvent) => {
    e.stopPropagation();
    setIsCompleting(true);

    if (item.repeater && item.repeater.length != 0) {
      const activeDate = appData.activeDate;
      const newDone = Array.isArray(item.done) ? [...item.done] : [];

      let rawDate = new Date(activeDate!);
      rawDate.setHours(0, 0, 0, 0);

      const foundIdx = newDone.findIndex((entry) => matchDate(new Date(entry), rawDate));

      if (foundIdx === -1) {
        newDone.push(rawDate.toString());
      } else {
        newDone.splice(foundIdx, 1);
      }

      updateTask({ id: item.id!, data: { ...item, done: newDone } });
    } else {
      updateTask({ id: item.id!, data: { ...item, done: !item.done } });
    }

    if (onComplete) onComplete(item as Task);

    // allow fade-out before hiding when filtering incomplete
    setTimeout(() => setIsCompleting(false), 600);
  };

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

  const isPending = isTaskDone(item!, appData.activeDate!);

  return (
    <div
      className={`${taskFilter == "all" || (taskFilter == "incomplete" && (isPending || isCompleting))
        ? "flex"
        : "hidden"
        } w-full flex-col gap-2`}
    >
      <TaskItemShell
        task={item}
        activeDate={appData.activeDate}
        className={`${fadeClass} ${selectionClass}`}
        onClick={handleInteractive}
      >
        <div className="w-full h-full flex flex-row items-center">
          <TaskItemCheckBox
            checked={!isTaskDone(item!, appData.activeDate!)}
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
          <div className="w-full">
            <div className="w-full flex flex-row items-center justify-between gap-2">
              <div className="flex flex-row items-center min-w-0 flex-1">
                <TaskItemTitle text={item.title} />
                {!!item.priority && item.priority > 0 && (
                  <span className="ml-1 flex-shrink-0 text-xs font-bold text-red-500">
                    {"!".repeat(item.priority)}
                  </span>
                )}
              </div>
              <div className="flex-shrink-0 w-20">
                <TaskItemDate task={item} />
              </div>
            </div>
            {tags.length > 0 && isPending && (
              <div className="mt-1 flex flex-wrap gap-2 px-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-accent-blue/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-blue-800 ring-1 ring-accent-blue/20"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </TaskItemShell>
    </div>
  );
}
