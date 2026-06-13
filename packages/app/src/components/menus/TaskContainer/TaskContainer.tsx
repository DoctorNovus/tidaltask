import { useState } from "react";
import TaskMenu from "../../tasks/TaskMenu";
import { ChevronRightIcon } from "@heroicons/react/20/solid";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import { matchDate, formatDateTime } from "@/utils/date";
import { sortByDate, sortByPriority } from "@/utils/data";
import { Task } from "@/hooks/tasks";
import { useUpdateSettings, useSettings } from "@/hooks/settings";
import { useApp } from "@/hooks/app";
import { UseQueryResult } from "@tanstack/react-query";
import { useUpdateTask } from "@/hooks/tasks";
import { EllipsisHorizontalIcon, CheckCircleIcon } from "@heroicons/react/24/solid";
import DateTimePicker from "@/pages/(Layout)/(TaskInfoMenu)/Shared/DateTimePicker";

interface ContainerSettings {
  skeleton?: boolean | string;
  identifier?: string;
  title?: string;
  tasks?: UseQueryResult<Task[]> | Task[];
  activeFilter?: string;
  setIsInspecting?: (value: boolean) => void;
  disableGrouping?: boolean;
}

export default function TaskContainer({
  skeleton,
  identifier,
  title,
  tasks,
  setIsInspecting,
  disableGrouping = false,
}: ContainerSettings) {
  const [appData] = useApp();
  const [taskFilter, setTaskFilter] = useState("incomplete");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [animatingIds, setAnimatingIds] = useState<string[]>([]);
  const [bulkGroup, setBulkGroup] = useState("");
  const [bulkTag, setBulkTag] = useState("");
  const [workingTags, setWorkingTags] = useState<string[]>([]);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkPriority, setBulkPriority] = useState(0);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkAction, setBulkAction] = useState<"" | "group" | "tags" | "date" | "priority">("");
  const [completionToast, setCompletionToast] = useState<string | null>(null);
  const { mutate: setSettings } = useUpdateSettings();
  const settings = useSettings();
  const { mutateAsync: updateTask } = useUpdateTask();

  if (skeleton) {
    return (
      <div className="group flex flex-col items-center w-full h-full my-2">
        <div className="w-full flex flex-row items-center rounded-2xl bg-white dark:bg-(--surface-card) border border-slate-200 dark:border-(--surface-border) px-3 py-3 text-primary shadow-sm">
          <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-row items-center py-1">
              <ChevronRightIcon
                className=""
                width="32"
              />
              <div className="flex flex-row gap-2">
                <h1 className="text-xl font-semibold dark:font-bold text-slate-950 dark:text-white">{title}</h1>
                <h1 className="text-xl text-accent-blue-700">(0/0)</h1>
              </div>
            </div>
            <div className="flex flex-row items-center sm:justify-end">
              <div className="flex w-full justify-start sm:justify-end">
                <div className="flex rounded-full bg-white/70 dark:bg-(--surface-raised) border border-accent-blue/20 overflow-hidden">
                  <span className="px-2 py-1 text-xs text-accent-blue-700">All</span>
                  <span className="px-2 py-1 text-xs text-slate-500 dark:text-muted">Incomplete</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full h-full">
          <TaskMenu skeleton="true" />
        </div>
      </div>
    )
  }

  let baseTasks: Task[];

  if (Array.isArray(tasks))
    baseTasks = tasks;
  else
    baseTasks = tasks?.isSuccess ? sortByDate(tasks?.data) : [];

  baseTasks = baseTasks.filter(Boolean);

  baseTasks = sortByPriority(baseTasks);

  const activeTags = appData.activeTags ?? [];

  const matchesTags = (task: Task) => {
    if (activeTags.length === 0) return true;

    const ownTags = Array.isArray(task.tags)
      ? task.tags
        .map((tag) => {
          if (typeof tag === "string") return tag.toLowerCase();
          if (tag && typeof (tag as any).title === "string") return (tag as any).title.toLowerCase();
          return "";
        })
        .filter(Boolean)
      : [];
    return activeTags.every((tag) => ownTags.includes(tag));
  };

  if (activeTags.length > 0) {
    baseTasks = baseTasks.filter(matchesTags);
  }

  const toggleSelection = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedTaskIds([]);
    setBulkGroup("");
    setBulkTag("");
    setBulkAction("");
  };

  const completeSelected = async () => {
    if (selectedTaskIds.length === 0) return;

    setIsBulkUpdating(true);
    setAnimatingIds(selectedTaskIds);

    setTimeout(async () => {
      const activeDay = new Date(appData.activeDate ?? new Date());
      activeDay.setHours(0, 0, 0, 0);

      const toUpdate = baseTasks.filter((task) => selectedTaskIds.includes(task.id!));

      const updates = toUpdate.map((task) => {
        if (task.repeater && task.repeater.length > 0) {
          const doneList = Array.isArray(task.done) ? [...task.done] : [];
          const alreadyMarked = doneList.find((d) => matchDate(new Date(d), activeDay));
          if (!alreadyMarked) doneList.push(activeDay.toString());

          return { id: task.id!, data: { ...task, done: doneList } };
        }

        return { id: task.id!, data: { ...task, done: true } };
      });

    try {
      await Promise.all(updates.map((payload) => updateTask(payload)));
      showCompletionToast(`Marked ${selectedTaskIds.length} task${selectedTaskIds.length === 1 ? "" : "s"} complete`);
      exitSelection();
    } finally {
      setAnimatingIds([]);
      setIsBulkUpdating(false);
    }
    }, 240);
  };

  const normalizeTag = (value: string) => value.trim().toLowerCase();
  const normalizeGroup = (value: string) => value.trim().toLowerCase();

  const selectedTasks = baseTasks.filter((task) => selectedTaskIds.includes(task.id!));
  const uniqueTags = Array.from(
    new Set(
      selectedTasks.flatMap((task) =>
        Array.isArray(task.tags)
          ? task.tags.map((tag) =>
              typeof tag === "string" ? normalizeTag(tag) : ""
            )
          : []
      ).filter(Boolean)
    )
  );

  const sharedGroup = (() => {
    const groups = new Set(
      selectedTasks
        .map((task) => normalizeGroup(task.group ?? ""))
        .filter((g) => g.length > 0)
    );
    if (groups.size === 1) return Array.from(groups)[0];
    return "";
  })();

  const startBulkAction = (action: "" | "group" | "tags" | "date" | "priority") => {
    setBulkAction(action);

    if (action === "group") {
      setBulkGroup(sharedGroup);
    } else if (action === "tags") {
      setWorkingTags(uniqueTags);
      setBulkTag("");
    } else if (action === "date") {
      const ref = appData.activeDate ?? new Date();
      setBulkDate(formatDateTime(ref instanceof Date ? ref : new Date(ref)));
    }
  };

  const clearBulkAction = () => {
    setBulkAction("");
    setBulkGroup("");
    setBulkTag("");
    setWorkingTags([]);
    setBulkDate("");
    setBulkPriority(0);
  };

  const showCompletionToast = (text: string) => {
    setCompletionToast(text);
    setTimeout(() => setCompletionToast(null), 2200);
  };

  const bulkUpdateSelected = async (build: (task: Task) => Partial<Task> | null | undefined) => {
    if (selectedTaskIds.length === 0) return;
    setIsBulkUpdating(true);

    const toUpdate = baseTasks.filter((task) => selectedTaskIds.includes(task.id!));
    const updates = toUpdate
      .map((task) => {
        const changes = build(task);
        if (!changes) return null;
        return updateTask({ id: task.id!, data: { id: task.id, ...changes } });
      })
      .filter(Boolean) as Promise<void>[];

    if (updates.length === 0) {
      setIsBulkUpdating(false);
      return;
    }

    try {
      await Promise.all(updates);
      exitSelection();
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const addGroupToSelected = async () => {
    const groupName = normalizeGroup(bulkGroup);
    await bulkUpdateSelected((task) => {
      if ((task.group ?? "").toLowerCase() === groupName) return null;
      return { group: groupName };
    });

    setBulkGroup("");
  };

  const addTagToSelected = async () => {
    const normalized = Array.from(
      new Set(
        workingTags
          .map((tag) => normalizeTag(tag))
          .filter((tag) => tag.length > 0)
      )
    );

    await bulkUpdateSelected((task) => {
      const tags = Array.isArray(task.tags)
        ? task.tags.map((tag) => (typeof tag === "string" ? normalizeTag(tag) : ""))
        : [];

      const existing = Array.from(new Set(tags.filter(Boolean)));
      const equal =
        existing.length === normalized.length &&
        existing.every((tag) => normalized.includes(tag));

      if (equal) return null;
      return { tags: normalized };
    });

    setBulkTag("");
  };

  const applyDateToSelected = async () => {
    if (!bulkDate) return;
    await bulkUpdateSelected(() => ({ date: new Date(bulkDate) }));
    setBulkDate("");
  };

  const applyPriorityToSelected = async () => {
    await bulkUpdateSelected((task) => {
      if ((task.priority ?? 0) === bulkPriority) return null;
      return { priority: bulkPriority };
    });
  };

  const handleClick = async (open: boolean) => {
    let groupsActive = settings.data?.groupsActive;

    if (typeof groupsActive == "undefined") groupsActive = [];

    if (open) {
      groupsActive?.splice(groupsActive.indexOf(identifier!), 1);
    } else {
      groupsActive?.push(identifier!);
    }

    setSettings({ groupsActive });
  };

  // TODO: Fix this bandaid
  baseTasks = baseTasks.map((task) => {
    if (typeof task.done == "undefined") task.done = false;

    return task;
  });

  const hasSelection = selectedTaskIds.length > 0;

  const renderBulkActionCard = () => {
    if (!selectionMode || !bulkAction) return null;

    const normalizedTags = Array.from(
      new Set(workingTags.map((tag) => normalizeTag(tag)).filter(Boolean))
    );

    const groupSummary =
      sharedGroup && hasSelection
        ? `Current group: ${sharedGroup}`
        : hasSelection
          ? "Group: mixed or none"
          : "No selection";

    const tagSummary =
      uniqueTags.length > 0 && hasSelection
        ? `Tags: ${uniqueTags.join(", ")}`
        : hasSelection
          ? "No tags yet"
          : "No selection";

    const tagInputChip = (tag: string) => (
      <span
        key={tag}
        className="flex items-center gap-1 rounded-full bg-accent-blue/10 px-2 py-1 text-xs font-semibold text-accent-blue-800 ring-1 ring-accent-blue/20"
      >
        <span>#{tag}</span>
        <button
          type="button"
          onClick={() => setWorkingTags((prev) => prev.filter((t) => t !== tag))}
          className="rounded-full p-0.5 text-accent-blue-700 hover:bg-accent-blue/20"
        >
          ×
        </button>
      </span>
    );

    return (
      <div
        className="fixed inset-x-0 bottom-0 top-24 z-140 flex items-start justify-center bg-slate-900/20 px-4 py-8 backdrop-blur-xs"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
        }}
      >
        <div className="w-full max-w-xl rounded-2xl bg-white px-4 py-4 shadow-2xl ring-1 ring-accent-blue/10 dark:bg-(--surface-card) dark:ring-(--surface-border)">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-primary">
              {bulkAction === "group" ? "Update group" : "Edit tags"}
            </span>
            <button
              type="button"
              className="text-xs font-semibold text-accent-blue hover:text-accent-blue-700"
              onClick={(e) => {
                e.stopPropagation();
                clearBulkAction();
              }}
            >
              Close
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {bulkAction === "group" && (
              <>
                <div className="flex items-center justify-between rounded-lg bg-accent-blue/5 px-3 py-2 text-xs font-semibold text-primary ring-1 ring-accent-blue/20">
                  <span>{groupSummary}</span>
                  {hasSelection && (
                    <span className="text-muted">Selected: {selectedTaskIds.length}</span>
                  )}
                </div>
                <input
                  type="text"
                  value={bulkGroup}
                  onChange={(e) => setBulkGroup(e.target.value)}
                  placeholder="Set a group or leave blank to clear"
                  className="w-full rounded-lg border border-accent-blue/20 bg-white px-3 py-2 text-sm text-primary shadow-inner focus:outline-hidden focus:ring-2 focus:ring-accent-blue/40 dark:bg-(--surface-raised)"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-accent-blue px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:shadow-md hover:ring-2 hover:ring-accent-blue/30 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!hasSelection || isBulkUpdating}
                    onClick={(e) => {
                      e.stopPropagation();
                      addGroupToSelected();
                    }}
                  >
                    Apply group
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white dark:bg-(--surface-raised) dark:border-(--surface-border) dark:text-primary px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:shadow-md hover:ring-2 hover:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!hasSelection || isBulkUpdating}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBulkGroup("");
                      addGroupToSelected();
                    }}
                  >
                    Clear group
                  </button>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Applies the same group to all selected tasks.
                </span>
              </>
            )}

            {bulkAction === "tags" && (
              <>
                <div className="flex items-center justify-between rounded-lg bg-accent-blue/5 px-3 py-2 text-xs font-semibold text-primary ring-1 ring-accent-blue/20">
                  <span>{tagSummary}</span>
                  {hasSelection && (
                    <span className="text-muted">Selected: {selectedTaskIds.length}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent-blue/20 bg-white/90 p-2 shadow-inner focus-within:border-accent-blue dark:bg-(--surface-raised)">
                  {normalizedTags.length === 0 && (
                    <span className="text-sm text-muted px-1">No tags yet</span>
                  )}
                  {normalizedTags.map(tagInputChip)}
                  <input
                    type="text"
                    value={bulkTag}
                    onChange={(e) => setBulkTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const normalized = normalizeTag(bulkTag);
                        if (!normalized) return;
                        setWorkingTags((prev) =>
                          Array.from(new Set([...prev, normalized]))
                        );
                        setBulkTag("");
                      }
                    }}
                    placeholder="Add tag…"
                    className="min-w-[140px] flex-1 border-none bg-transparent text-sm text-primary placeholder:text-slate-400 focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {uniqueTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        normalizedTags.includes(tag)
                          ? "bg-accent-blue text-white shadow-xs shadow-accent-blue/30"
                          : "bg-white dark:bg-(--surface-raised) text-primary ring-1 ring-accent-blue/20 hover:ring-accent-blue/40"
                      }`}
                      onClick={() => {
                        setWorkingTags((prev) =>
                          normalizedTags.includes(tag)
                            ? prev.filter((t) => t !== tag)
                            : [...prev, tag]
                        );
                      }}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-accent-blue px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:shadow-md hover:ring-2 hover:ring-accent-blue/30 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!hasSelection || isBulkUpdating}
                    onClick={(e) => {
                      e.stopPropagation();
                      addTagToSelected();
                    }}
                  >
                    Apply tags
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white dark:bg-(--surface-raised) dark:border-(--surface-border) dark:text-primary px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:shadow-md hover:ring-2 hover:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!hasSelection || isBulkUpdating}
                    onClick={(e) => {
                      e.stopPropagation();
                      setWorkingTags([]);
                      addTagToSelected();
                    }}
                  >
                    Clear tags
                  </button>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Sets this tag list on every selected task.
                </span>
              </>
            )}

            {bulkAction === "date" && (
              <>
                <DateTimePicker
                  value={bulkDate}
                  onChange={(val) => setBulkDate(val)}
                  inline
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    className="rounded-lg bg-accent-blue px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:shadow-md hover:ring-2 hover:ring-accent-blue/30 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!hasSelection || !bulkDate || isBulkUpdating}
                    onClick={(e) => {
                      e.stopPropagation();
                      applyDateToSelected();
                    }}
                  >
                    Apply date
                  </button>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Sets the due date on every selected task.
                </span>
              </>
            )}

            {bulkAction === "priority" && (
              <>
                <div className="flex items-center gap-2">
                  {[0, 1, 2, 3].map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        bulkPriority === level
                          ? "border-accent-blue bg-accent-blue text-white"
                          : "border-slate-200 bg-white dark:bg-(--surface-raised) dark:border-(--surface-border) dark:text-primary text-slate-700 hover:ring-1 hover:ring-accent-blue/30"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setBulkPriority(level);
                      }}
                    >
                      {level === 0 ? "None" : "!".repeat(level)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    className="rounded-lg bg-accent-blue px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:shadow-md hover:ring-2 hover:ring-accent-blue/30 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!hasSelection || isBulkUpdating}
                    onClick={(e) => {
                      e.stopPropagation();
                      applyPriorityToSelected();
                    }}
                  >
                    Apply priority
                  </button>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Sets priority on every selected task.
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="group flex flex-col items-center w-full h-full my-2 px-0 md:px-0">
      {/* Migrate to dynamic loading content */}
      {settings.isLoading && <span>Loading...</span>}
      {settings.isError && <span>Error: {settings.error.message}</span>}
      {settings.isSuccess && (
        <Disclosure
          defaultOpen={settings.data.groupsActive?.includes(identifier!)}
        >
          {({ open }) => (
            <>
              <Disclosure.Button
                onClick={async () => await handleClick(open)}
                as="div"
                className="w-full overflow-hidden flex flex-row items-center rounded-2xl bg-white dark:bg-(--surface-card) border border-slate-200 dark:border-(--surface-border) px-3 py-3 text-primary shadow-sm"
              >
                <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-row items-center min-w-0 py-1">
                    <ChevronRightIcon
                      className={`shrink-0 ${open ? "rotate-90 transform" : ""}`}
                      width="32"
                    />
                    <div className="flex flex-row gap-2 min-w-0">
                      <h1 className="text-xl font-semibold dark:font-bold text-slate-950 dark:text-white truncate">{title}</h1>
                      {baseTasks.filter((task) => !task.done).length > 0 && (
                        <h1 className="text-xl text-accent-blue-700">
                          ({baseTasks.filter((task) => !task.done).length}/
                          {baseTasks.length})
                        </h1>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-row items-center sm:justify-end">
                    <div className="flex w-full flex-wrap items-center justify-start sm:justify-end gap-2">
                      <div className="flex rounded-full bg-white/70 dark:bg-(--surface-raised) border border-accent-blue/20 overflow-hidden">
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs font-semibold transition ${taskFilter === "all"
                            ? "bg-accent-blue text-white"
                            : "text-slate-600 dark:text-muted"
                            }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTaskFilter("all");
                          }}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs font-semibold transition ${taskFilter === "incomplete"
                            ? "bg-accent-blue text-white"
                            : "text-slate-600 dark:text-muted"
                            }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTaskFilter("incomplete");
                          }}
                        >
                          Incomplete
                        </button>
                      </div>
                      {!selectionMode && (
                        <button
                          type="button"
                          className="rounded-lg border border-accent-blue/30 bg-white dark:bg-(--surface-raised) dark:border-(--surface-border) px-3 py-1.5 text-xs font-semibold text-accent-blue shadow-xs transition hover:shadow-md hover:ring-1 hover:ring-accent-blue/30"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectionMode(true);
                          }}
                        >
                          Select
                        </button>
                      )}
                      {selectionMode && (
                        <>
                          <button
                            type="button"
                            className="rounded-lg border border-accent-blue/30 bg-white dark:bg-(--surface-raised) dark:border-(--surface-border) px-3 py-1.5 text-xs font-semibold text-accent-blue shadow-xs transition hover:shadow-md hover:ring-1 hover:ring-accent-blue/30"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTaskIds(baseTasks.map((t) => t.id!).filter(Boolean));
                            }}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-emerald-300 bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:shadow-md hover:ring-1 hover:ring-emerald-300 disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={!hasSelection || isBulkUpdating}
                            onClick={(e) => {
                              e.stopPropagation();
                              completeSelected();
                            }}
                          >
                            Complete ({selectedTaskIds.length})
                          </button>
                          <Menu as="div" className="relative z-110 inline-block text-left">
                            <Menu.Button
                              disabled={!hasSelection || isBulkUpdating}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white dark:bg-(--surface-raised) dark:border-(--surface-border) dark:text-primary px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:shadow-md hover:ring-1 hover:ring-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <EllipsisHorizontalIcon className="h-4 w-4" />
                              <span>Actions</span>
                            </Menu.Button>
                            <Menu.Items className="absolute left-0 right-auto z-130 mt-2 w-52 max-w-[90vw] origin-top-left rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-hidden dark:bg-(--surface-raised) dark:ring-(--surface-border) md:left-auto md:right-0 md:origin-top-right">
                              {[
                                { key: "group", label: "Edit group" },
                                { key: "date", label: "Edit date" },
                                { key: "priority", label: "Edit priority" },
                                { key: "tags", label: "Edit tags" },
                              ].map((item) => (
                                <Menu.Item key={item.key}>
                                  {({ active }) => (
                                    <button
                                      type="button"
                                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                                        active
                                          ? "bg-accent-blue/10 text-slate-900 dark:bg-(--accent-subtle) dark:text-primary"
                                          : "text-slate-800 dark:text-primary"
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startBulkAction(item.key as "group" | "tags" | "date" | "priority");
                                      }}
                                    >
                                      <span>{item.label}</span>
                                      {item.key === "group" && sharedGroup && (
                                        <span className="text-[11px] text-slate-500 dark:text-muted">#{sharedGroup}</span>
                                      )}
                                      {item.key === "tags" && uniqueTags.length > 0 && (
                                        <span className="text-[11px] text-slate-500 dark:text-muted">{uniqueTags.length} tags</span>
                                      )}
                                    </button>
                                  )}
                                </Menu.Item>
                              ))}
                            </Menu.Items>
                          </Menu>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white dark:bg-(--surface-raised) dark:border-(--surface-border) dark:text-primary px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:shadow-md hover:ring-1 hover:ring-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={isBulkUpdating}
                            onClick={(e) => {
                              e.stopPropagation();
                              exitSelection();
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Disclosure.Button>
              <Disclosure.Panel className="w-full">
                {renderBulkActionCard()}
                {/* {!settings.data.groupsActive?.includes(identifier) && ( */}
                <TaskMenu
                  tasks={baseTasks}
                  setIsInspecting={setIsInspecting}
                  taskFilter={taskFilter}
                  selectionMode={selectionMode}
                  selectedTaskIds={selectedTaskIds}
                  toggleSelection={toggleSelection}
                  animatingIds={animatingIds}
                  activeDate={appData.activeDate}
                  onTaskComplete={(task: Task) => showCompletionToast(`Task completed: ${task.title || "Untitled"}`)}
                  disableGrouping={disableGrouping}
                />
                {/* )} */}
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>
      )}
      <Transition
        show={!!completionToast}
        enter="transition duration-200 ease-out"
        enterFrom="translate-y-2 opacity-0"
        enterTo="translate-y-0 opacity-100"
        leave="transition duration-300 ease-in"
        leaveFrom="translate-y-0 opacity-100"
        leaveTo="translate-y-2 opacity-0"
      >
        <div
          className="pointer-events-none fixed inset-x-0 z-150 flex justify-center px-4"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 2.5rem)",
          }}
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-accent-blue text-white px-4 py-3 text-sm font-semibold shadow-lg shadow-accent-blue/30 ring-1 ring-accent-blue/30">
            <CheckCircleIcon className="h-5 w-5" />
            <span>{completionToast}</span>
          </div>
        </div>
      </Transition>
    </div>
  );
}
