import { useEffect, useMemo, useState } from "react";
import { TaskItem } from "../task/TaskItem";
import { isTaskDone } from "@/utils/data";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { Task } from "@/hooks/tasks";

interface TaskMenuProps {
  skeleton?: string;
  tasks?: Task[];
  setIsInspecting?: (state: boolean) => void;
  taskFilter?: any;
  selectionMode?: boolean;
  selectedTaskIds?: string[];
  toggleSelection?: any;
  animatingIds?: string[];
  activeDate?: Date;
  onTaskComplete?: any;
  disableGrouping?: boolean;
}

export default function TaskMenu({
  skeleton,
  tasks,
  setIsInspecting,
  taskFilter,
  selectionMode = false,
  selectedTaskIds = [],
  toggleSelection,
  animatingIds = [],
  activeDate,
  onTaskComplete,
  disableGrouping = false,
}: TaskMenuProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [orderedTasks, setOrderedTasks] = useState<any[]>([]);

  if (skeleton) {
    return (
      <div className="w-full h-full flex flex-col items-center ">
        <ul className="w-full h-full pb-4 gap-2 flex flex-col items-center justify-start py-0">
          <li className="w-full h-full">
            <TaskItem skeleton={true} />
          </li>
        </ul>
      </div>
    );
  }

  const visibleTasks = (tasks || [])
    .filter(Boolean)
    .filter((task) =>
      taskFilter === "incomplete"
        ? isTaskDone(task, activeDate!)
        : true
    );

  useEffect(() => {
    const sorted = [...visibleTasks].sort((a, b) => {
      const pa = Number(a.priority ?? 0);
      const pb = Number(b.priority ?? 0);
      if (pa === pb) return 0;
      return pb - pa;
    });
    setOrderedTasks(sorted);
  }, [tasks, taskFilter, activeDate]);

  const { grouped, ungrouped } = useMemo(() => {
    if (disableGrouping) {
      return { grouped: {} as Record<string, any[]>, ungrouped: orderedTasks };
    }

    const groupedTasks: Record<string, any[]> = {};
    const ungroupedTasks: any[] = [];

    orderedTasks.forEach((task) => {
      const groupName = (task.group || "").trim();
      if (groupName.length === 0) {
        ungroupedTasks.push(task);
        return;
      }

      if (!groupedTasks[groupName]) groupedTasks[groupName] = [];
      groupedTasks[groupName].push(task);
    });

    return { grouped: groupedTasks, ungrouped: ungroupedTasks };
  }, [orderedTasks]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const renderTask = (task: any) => (
    <div key={task.id || task.title} className="w-full rounded-2xl">
      <TaskItem
        item={task}
        setIsInspecting={setIsInspecting}
        taskFilter={taskFilter}
        selectionMode={selectionMode}
        isSelected={selectedTaskIds.includes(task.id)}
        onToggleSelect={toggleSelection}
        isAnimating={animatingIds.includes(task.id)}
        onComplete={onTaskComplete}
      />
    </div>
  );

  const groupedEntries = Object.entries(grouped).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const formatGroupName = (name: string) => {
    if (!name) return "";
    return name.replace(/\b\w/g, (ch) => ch.toUpperCase());
  };

  const renderGroupHeader = (groupName: string, isCollapsed: boolean, count: number) => (
    <div className="flex w-full items-center justify-between gap-2 px-1 py-1 rounded-xl">
      <div className="flex items-center gap-2">
        {isCollapsed ? (
          <ChevronRightIcon className="h-5 w-5 text-primary" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-primary" />
        )}
        <span className="text-sm font-semibold text-primary">{formatGroupName(groupName)}</span>
      </div>
      <span className="text-xs font-semibold text-muted">{count}</span>
    </div>
  );

  const numGroups = groupedEntries.length;
  const groupGridClass =
    numGroups <= 1
      ? "grid-cols-1"
      : numGroups <= 4
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-3";

  return (
    <div className="w-full h-full flex flex-col">
      <div className="w-full h-full pb-4 flex flex-col gap-3 py-4">
        {ungrouped.length > 0 && (
          <div className="flex flex-col gap-2">
            {ungrouped.map(renderTask)}
          </div>
        )}

        {groupedEntries.length > 0 && (
          <div className={`grid gap-3 ${groupGridClass}`}>
            {groupedEntries.map(([groupName, list]) => {
              const isCollapsed = collapsedGroups.includes(groupName);
              return (
                <div
                  key={groupName}
                  className="rounded-2xl surface-card border shadow-xs overflow-hidden flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupName)}
                    className="w-full px-3 pt-3 pb-2 text-left hover:bg-silver-100/60 dark:hover:bg-(--surface-raised) transition-colors"
                  >
                    {renderGroupHeader(groupName, isCollapsed, list.length)}
                  </button>
                  {!isCollapsed && (
                    <div className="px-3 pb-3 flex flex-col gap-2">
                      {list.map((task: any) => renderTask(task))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {visibleTasks.length === 0 && (
          <h1 className="text-lg text-accent-blue text-center">No Tasks</h1>
        )}
      </div>
    </div>
  );
}
