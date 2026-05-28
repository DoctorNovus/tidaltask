import { useEffect, useMemo, useState } from "react";
import { useTasks } from "@/hooks/tasks";

import DayTasks from "../components/calendar/DayTasks";
import ActiveCalendar from "../components/calendar/ActiveCalendar";
import TaskContainer from "@/components/menus/TaskContainer/TaskContainer";
import { useApp } from "@/hooks/app";
import TaskInfoMenu from "@/pages/(Layout)/TaskInfoMenu";
import { Logger } from "@/utils/logger";
import TagFilterBar from "@/components/tasks/TagFilterBar";

export default function Task() {
  const [appData, setAppData] = useApp();
  const [isInspecting, setIsInspecting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const tasks = useTasks();

  if (tasks.isError)
    Logger.logError(tasks.error.message);

  useEffect(() => {
    if (appData.activeTask && !isInspecting) {
      setIsInspecting(true);

      if (appData.activeTask.date) {
        const targetDate = new Date(appData.activeTask.date);
        setAppData({
          ...appData,
          activeDate: targetDate,
        });
      }
    }
  }, [appData, isInspecting, setAppData]);

  // Close the TaskInfoMenu if the active task no longer exists (e.g., after deletion).
  useEffect(() => {
    if (!isInspecting) return;
    if (!appData.activeTask?.id) return;
    if (!tasks.isSuccess) return;

    const exists = tasks.data?.some((task) => task?.id === appData.activeTask?.id);
    if (!exists) {
      setIsInspecting(false);
      setAppData({ activeTask: undefined });
    }
  }, [isInspecting, appData.activeTask?.id, tasks.isSuccess, tasks.data, setAppData]);

  const filteredTasks = useMemo(() => {
    if (!tasks.isSuccess) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return tasks.data;

    return tasks.data.filter((task) => {
      const title = (task.title ?? "").toLowerCase();
      const description = (task.description ?? "").toLowerCase();
      const group = (task.group ?? "").toLowerCase();
      const tags = Array.isArray(task.tags)
        ? task.tags
            .map((tag) =>
              typeof tag === "string"
                ? tag.toLowerCase()
                : tag && typeof (tag as any).title === "string"
                  ? (tag as any).title.toLowerCase()
                  : ""
            )
            .join(" ")
        : "";

      return (
        title.includes(term) ||
        description.includes(term) ||
        group.includes(term) ||
        tags.includes(term)
      );
    });
  }, [tasks.isSuccess, tasks.data, searchTerm]);

  const tasksForDay = tasks.isSuccess ? { ...tasks, data: filteredTasks } : tasks;

  if (tasks.isLoading) {
    return (
      <div className="w-full h-full text-accent-black">
        <div className="h-full">
          <div className="flex flex-col items-center gap-6 px-3 md:px-6">
            <ActiveCalendar skeleton={true} />
            <DayTasks skeleton={true} />
            <TaskContainer title="All Tasks" skeleton={true} />
          </div>
          <div>
            {/* <TaskInfoMenu skeleton="true" /> */}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full text-accent-black">
      <div className="h-full pb-28">
        <div className="flex w-full justify-center">
          <div className="flex w-full max-w-4xl flex-col items-center gap-6 px-3 md:px-6">
            <ActiveCalendar />
            <div className="w-full flex flex-col gap-2">
              <div className="flex w-full items-center gap-2 rounded-xl bg-silver-200 dark:bg-[#253350] border border-(--surface-border) px-3 py-2 shadow-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-slate-400"
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
                  placeholder="Search tasks by title, details, or tag..."
                  className="w-full bg-transparent text-sm text-primary outline-hidden placeholder:text-slate-400"
                />
              </div>
              {tasks.isSuccess && (
                <TagFilterBar tasks={filteredTasks ?? []} />
              )}
            </div>
            <DayTasks
              setIsInspecting={setIsInspecting}
              tasks={tasksForDay}
            />
            <TaskContainer
              identifier="all"
              setIsInspecting={setIsInspecting}
              title="All Tasks"
              tasks={filteredTasks}
              activeFilter="dailyTasks"
            />
          </div>
        </div>
        <div>
          <TaskInfoMenu
            type="edit"
            isOpen={isInspecting}
            setIsOpen={setIsInspecting}
          />
        </div>
      </div>
    </div>
  );
}
