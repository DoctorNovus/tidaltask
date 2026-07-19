import { useEffect, useMemo, useState } from "react";
import { TaskItem } from "../task/TaskItem";
import { isTaskDone } from "@/utils/data";
import { ChevronRightIcon, PencilSquareIcon } from "@heroicons/react/20/solid";
import { Task } from "@/hooks/tasks";
import { useSettings } from "@/hooks/settings";
import GroupEditorModal from "@/pages/(Layout)/(TaskInfoMenu)/Shared/GroupEditorModal";

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
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const settings = useSettings();

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
    const custom = settings.data?.groupConfig?.[name]?.displayName;
    if (custom) return custom;
    return name.replace(/\b\w/g, (ch) => ch.toUpperCase());
  };

  return (
    <div className="w-full flex flex-col">
      <div className="w-full pb-4 flex flex-col gap-3 py-4">
        {ungrouped.length > 0 && (
          <div className="flex flex-col gap-2">
            {ungrouped.map(renderTask)}
          </div>
        )}

        {groupedEntries.length > 0 && (
          <div className="grid gap-3 grid-cols-1">
            {groupedEntries.map(([groupName, list]) => {
              const isCollapsed = collapsedGroups.includes(groupName);

              return (
                <div key={groupName} className="w-full min-w-0 flex flex-col gap-2">
                  {/* Header card */}
                  <div className="w-full overflow-hidden flex flex-row items-center rounded-2xl bg-white dark:bg-(--surface-card) border border-slate-200 dark:border-(--surface-border) shadow-sm group/header transition-colors">
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupName)}
                      className="flex flex-1 items-center gap-1 px-3 py-3 text-left min-w-0 overflow-hidden"
                    >
                      <ChevronRightIcon className={`h-8 w-8 shrink-0 text-primary group-hover/header:text-accent-blue transition-colors ${!isCollapsed ? "rotate-90" : ""}`} />
                      <span className="text-xl font-semibold text-slate-950 dark:text-white truncate group-hover/header:text-accent-blue transition-colors">
                        {formatGroupName(groupName)}
                      </span>
                      {list.length > 0 && (
                        <span className="text-xl text-accent-blue-700 shrink-0 group-hover/header:text-accent-blue transition-colors">
                          ({list.length})
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingGroup(groupName)}
                      className="shrink-0 px-3 py-3 text-slate-300 dark:text-slate-600 hover:text-accent-blue opacity-0 group-hover/header:opacity-100 transition-all"
                      title="Edit group"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {!isCollapsed && (
                    <div className="flex flex-col gap-2">
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

      <GroupEditorModal
        open={editingGroup !== null}
        onClose={() => setEditingGroup(null)}
        groupKey={editingGroup ?? undefined}
        existingGroups={Object.keys(settings.data?.groupConfig ?? {})}
      />
    </div>
  );
}
