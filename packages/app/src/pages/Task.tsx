import { useEffect, useMemo, useState } from "react";
import { useTasks } from "@/hooks/tasks";
import { isTaskDone } from "@/utils/data";

import DayTasks from "../components/calendar/DayTasks";
import ActiveCalendar from "../components/calendar/ActiveCalendar";
import TaskContainer from "@/components/menus/TaskContainer/TaskContainer";
import { useApp } from "@/hooks/app";
import TaskInfoMenu from "@/pages/(Layout)/TaskInfoMenu";
import { Logger } from "@/utils/logger";
import TagFilterBar from "@/components/tasks/TagFilterBar";
import { useSettings } from "@/hooks/settings";

function capitalize(s: string) {
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function Task() {
  const [appData, setAppData] = useApp();
  const [isInspecting, setIsInspecting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const settings = useSettings();

  const tasks = useTasks();

  if (tasks.isError)
    Logger.logError(tasks.error.message);

  useEffect(() => {
    if (appData.activeTask && !isInspecting) {
      setIsInspecting(true);

      if (appData.activeTask.date) {
        const targetDate = new Date(appData.activeTask.date);
        setAppData({ ...appData, activeDate: targetDate });
      }
    }
  }, [appData, isInspecting, setAppData]);

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

  // Split filteredTasks into ungrouped and named groups
  const { ungroupedTasks, taskGroups } = useMemo(() => {
    const ungrouped: typeof filteredTasks = [];
    const groups: Record<string, typeof filteredTasks> = {};

    filteredTasks.forEach((task) => {
      const g = (task.group ?? "").trim();
      if (!g) {
        ungrouped.push(task);
      } else {
        if (!groups[g]) groups[g] = [];
        groups[g].push(task);
      }
    });

    const sortedGroups = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    return { ungroupedTasks: ungrouped, taskGroups: sortedGroups };
  }, [filteredTasks]);

  const tasksForDay = tasks.isSuccess ? { ...tasks, data: filteredTasks } : tasks;
  const hasActiveFilters = (appData.activeTags ?? []).length > 0;

  const searchBar = (
    <div className="flex w-full items-center gap-2 rounded-xl bg-silver-200 dark:bg-(--app-background) border border-(--surface-border) px-3 py-2 shadow-xs">
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
        placeholder="Search tasks by title, details, or tag..."
        className="w-full !bg-transparent text-sm text-primary outline-hidden placeholder:text-slate-400"
      />
      <button
        type="button"
        onClick={() => setShowFilters((v) => !v)}
        aria-label="Toggle tag filters"
        className={`shrink-0 rounded-lg p-0.5 transition ${
          showFilters || hasActiveFilters
            ? "text-accent-blue"
            : "text-slate-400 hover:text-primary"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="11" y1="18" x2="13" y2="18" />
        </svg>
      </button>
    </div>
  );

  if (tasks.isLoading) {
    return (
      <div className="w-full h-full text-accent-black">
        <div className="h-full pb-28 md:pb-4 flex flex-col gap-6">
          <ActiveCalendar skeleton={true} searchSlot={searchBar} />
          <div className="grid gap-6 md:grid-cols-1">
            <DayTasks skeleton={true} />
            <TaskContainer title="All Tasks" skeleton={true} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full text-accent-black">
      <div className="h-full pb-28 md:pb-4 flex flex-col gap-6">

        {/* Full-width calendar strip with search integrated in the card */}
        <ActiveCalendar searchSlot={searchBar} />

        {/* Tag filter bar — always visible on mobile, toggled on desktop */}
        {tasks.isSuccess && (
          <div className={showFilters || hasActiveFilters ? "block" : "hidden"}>
            <TagFilterBar tasks={filteredTasks ?? []} />
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <DayTasks
            setIsInspecting={setIsInspecting}
            tasks={tasksForDay}
          />

          {ungroupedTasks.length > 0 && (
            <TaskContainer
              identifier="ungrouped"
              title="All Tasks"
              tasks={ungroupedTasks}
              setIsInspecting={setIsInspecting}
              activeFilter="dailyTasks"
              disableGrouping
            />
          )}
        </div>

        {taskGroups.length > 0 && (() => {
          const groupConfig = settings.data?.groupConfig ?? {};
          const visibleGroups = taskGroups
            .filter(([groupName, groupTasks]) => {
              if (groupConfig[groupName]?.visible === false) return false;
              const hasIncomplete = groupTasks.some((t) => isTaskDone(t, appData.activeDate ?? new Date()));
              if (!hasIncomplete && !groupConfig[groupName]?.visibleWhenEmpty) return false;
              return true;
            })
            .sort(([a], [b]) => {
              const oa = groupConfig[a]?.order ?? Infinity;
              const ob = groupConfig[b]?.order ?? Infinity;
              return oa !== ob ? oa - ob : a.localeCompare(b);
            });

          if (visibleGroups.length === 0) return null;

          return (
            <div className="grid gap-6 md:grid-cols-1">
              {visibleGroups.map(([groupName, groupTasks]) => {
                const cfg = groupConfig[groupName];
                const displayName = cfg?.displayName || capitalize(groupName);
                return (
                  <TaskContainer
                    key={groupName}
                    identifier={`group-${groupName}`}
                    title={displayName}
                    tasks={groupTasks}
                    setIsInspecting={setIsInspecting}
                    activeFilter="dailyTasks"
                    disableGrouping
                  />
                );
              })}
            </div>
          );
        })()}
      </div>

      <div>
        <TaskInfoMenu
          type="edit"
          isOpen={isInspecting}
          setIsOpen={setIsInspecting}
        />
      </div>
    </div>
  );
}
