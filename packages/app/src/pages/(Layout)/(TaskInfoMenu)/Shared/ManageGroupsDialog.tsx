import { Dialog, DialogPanel, Transition } from "@headlessui/react";
import { Bars3Icon, EyeIcon, EyeSlashIcon, XMarkIcon, PencilSquareIcon, MagnifyingGlassIcon, StarIcon, TrashIcon } from "@heroicons/react/20/solid";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSettings, useUpdateSettings, GroupConfig } from "@/hooks/settings";
import { useTasks, useUpdateTask } from "@/hooks/tasks";
import { useAlarms, useDeleteAlarm } from "@/hooks/alarms";
import { reconcileAlarms } from "@/utils/alarmScheduler";
import GroupEditorModal from "./GroupEditorModal";

interface GroupRow {
  key: string;
  displayName: string;
  visible: boolean;
  visibleWhenEmpty: boolean;
  isDefault: boolean;
  excludeFromUpcoming: boolean;
  excludeFromCalendar: boolean;
  order: number;
}

interface ManageGroupsDialogProps {
  open: boolean;
  onClose: () => void;
  groups: string[];
}

export default function ManageGroupsDialog({ open, onClose, groups }: ManageGroupsDialogProps) {
  const settings = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();
  const tasks = useTasks();
  const { mutateAsync: updateTask } = useUpdateTask();
  const { data: alarms } = useAlarms();
  const { mutateAsync: deleteAlarm } = useDeleteAlarm();

  const [rows, setRows] = useState<GroupRow[]>([]);
  const [query, setQuery] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Only re-seed `rows` from settings on the closed -> open transition. Re-running
  // this on every settings change (e.g. the group editor being saved on top of this
  // dialog) used to blow away any reordering the user hadn't hit Save on yet — this
  // mirrors the same fix already applied to TaskInfoMenu.tsx for the same reason.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    const config: Record<string, GroupConfig> = settings.data?.groupConfig ?? {};

    if (wasOpenRef.current) {
      // Already open — merge in field changes made through the nested group editor
      // (rename, visibility, etc.) without touching current positions.
      setRows((prev) => prev.map((r) => {
        const c = config[r.key];
        if (!c) return r;
        return {
          ...r,
          displayName: c.displayName ?? r.displayName,
          visible: c.visible !== false,
          visibleWhenEmpty: c.visibleWhenEmpty ?? false,
          isDefault: c.isDefault ?? false,
          excludeFromUpcoming: c.excludeFromUpcoming ?? false,
          excludeFromCalendar: c.excludeFromCalendar ?? false,
        };
      }));
      return;
    }
    wasOpenRef.current = true;

    const initial = groups.map((key, i) => {
      const c = config[key] ?? {};
      return {
        key,
        displayName: c.displayName ?? key.replace(/\b\w/g, (ch) => ch.toUpperCase()),
        visible: c.visible !== false,
        visibleWhenEmpty: c.visibleWhenEmpty ?? false,
        isDefault: c.isDefault ?? false,
        excludeFromUpcoming: c.excludeFromUpcoming ?? false,
        excludeFromCalendar: c.excludeFromCalendar ?? false,
        order: c.order ?? i,
      };
    });

    initial.sort((a, b) => a.order - b.order);
    setRows(initial);
  }, [open, groups, settings.data]);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows.map((row, i) => ({ row, i }));
    return rows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => row.key.includes(term) || row.displayName.toLowerCase().includes(term));
  }, [rows, query]);

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  // Pointer-based drag (not HTML5 dragstart/dragover, which doesn't support touch):
  // once a drag starts on a handle, track the pointer at the document level and
  // figure out which row it's over via elementFromPoint, since setPointerCapture
  // would otherwise route every event to the handle that started the drag.
  useEffect(() => {
    if (dragIndex === null) return;

    const handleMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-row-index]");
      if (!el) return;
      const index = Number(el.dataset.rowIndex);
      if (Number.isNaN(index) || index === dragIndex) return;
      reorder(dragIndex, index);
      setDragIndex(index);
    };

    const endDrag = () => setDragIndex(null);

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", endDrag);
      document.removeEventListener("pointercancel", endDrag);
    };
  }, [dragIndex, rows.length]);

  const update = (index: number, patch: Partial<GroupRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const confirmDelete = async () => {
    if (!deletingKey) return;
    setIsDeleting(true);
    try {
      const affected = (tasks.data ?? []).filter((t) => (t.group ?? "").trim().toLowerCase() === deletingKey);
      await Promise.all(
        affected.map((t) => t.id ? updateTask({ id: t.id, data: { ...t, group: "" } }) : Promise.resolve())
      );

      const groupAlarm = alarms?.find((a) => a.scope === "group" && a.group === deletingKey);
      if (groupAlarm) {
        await deleteAlarm(groupAlarm.id);
        await reconcileAlarms();
      }

      setRows((prev) => prev.filter((r) => r.key !== deletingKey));
      setDeletingKey(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const save = () => {
    const config: Record<string, GroupConfig> = {};
    rows.forEach((r, i) => {
      config[r.key] = {
        displayName: r.displayName,
        visible: r.visible,
        visibleWhenEmpty: r.visibleWhenEmpty,
        isDefault: r.isDefault,
        excludeFromUpcoming: r.excludeFromUpcoming,
        excludeFromCalendar: r.excludeFromCalendar,
        order: i,
      };
    });
    updateSettings({ groupConfig: config });
    onClose();
  };

  return (
    <>
    <GroupEditorModal
      open={editingKey !== null}
      groupKey={editingKey ?? undefined}
      existingGroups={groups}
      onClose={() => setEditingKey(null)}
      onSaved={() => setEditingKey(null)}
    />
    <Transition show={open}>
      <Dialog onClose={onClose} className="relative z-[60]">
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px]" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-2xl bg-silver-50 dark:bg-[#121720] border border-accent-blue/15 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-accent-blue/10">
              <div>
                <h2 className="text-base font-semibold text-primary">Manage Groups</h2>
                <p className="text-xs text-muted mt-0.5">Edit names, order, and visibility.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:text-primary hover:bg-accent-blue/8 transition"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            {rows.length > 4 && (
              <div className="flex items-center gap-2 px-5 py-2.5 border-b border-accent-blue/10">
                <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search groups…"
                  className="flex-1 min-w-0 !bg-transparent text-sm text-primary placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            )}

            {/* Rows */}
            <div className="flex flex-col divide-y divide-accent-blue/8 max-h-[60vh] overflow-y-auto">
              {rows.length === 0 && (
                <p className="px-5 py-6 text-sm text-muted text-center">No groups yet.</p>
              )}
              {rows.length > 0 && filteredRows.length === 0 && (
                <p className="px-5 py-6 text-sm text-muted text-center">No groups match "{query}".</p>
              )}
              {filteredRows.map(({ row, i }) => (
                <div
                  key={row.key}
                  data-row-index={i}
                  className={`flex flex-col gap-2 px-5 py-3 transition ${dragIndex === i ? "bg-accent-blue/8" : ""}`}
                >
                  {/* Name + reorder */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!!query.trim()}
                      title={query.trim() ? "Clear search to reorder" : "Drag to reorder"}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setDragIndex(i);
                      }}
                      style={{ touchAction: "none" }}
                      className="shrink-0 rounded p-1 text-slate-400 hover:text-primary disabled:opacity-25 disabled:cursor-not-allowed cursor-grab active:cursor-grabbing transition"
                    >
                      <Bars3Icon className="h-4 w-4" />
                    </button>

                    {row.isDefault && (
                      <StarIcon className="h-4 w-4 shrink-0 text-amber-400" title="Default group" />
                    )}

                    <input
                      type="text"
                      value={row.displayName}
                      onChange={(e) => update(i, { displayName: e.target.value })}
                      className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-accent-blue/20 bg-silver-200 dark:bg-[#253350] text-sm text-primary focus:border-accent-blue focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => setEditingKey(row.key)}
                      title="Edit group settings"
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-primary hover:bg-accent-blue/8 transition"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => update(i, { visible: !row.visible })}
                      title={row.visible ? "Hide group" : "Show group"}
                      className={`shrink-0 rounded-lg p-1.5 transition ${row.visible ? "text-accent-blue hover:bg-accent-blue/10" : "text-slate-400 hover:text-primary hover:bg-accent-blue/8"}`}
                    >
                      {row.visible ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingKey(row.key)}
                      title="Delete group"
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-accent-red-500 hover:bg-accent-red-500/8 transition"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Show when empty toggle */}
                  <label className="flex items-center gap-2 pl-8 cursor-pointer w-fit">
                    <div
                      onClick={() => update(i, { visibleWhenEmpty: !row.visibleWhenEmpty })}
                      className={`relative w-8 h-4 rounded-full transition cursor-pointer ${row.visibleWhenEmpty ? "bg-accent-blue" : "bg-slate-300 dark:bg-slate-600"}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${row.visibleWhenEmpty ? "translate-x-4" : "translate-x-0"}`} />
                    </div>
                    <span className="text-xs text-muted select-none">Show when empty</span>
                  </label>

                  {row.excludeFromUpcoming && (
                    <span className="pl-8 text-[11px] font-semibold text-muted">Hidden from Upcoming Tasks</span>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-accent-blue/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-primary hover:bg-accent-blue/8 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent-blue text-white hover:-translate-y-px transition shadow-xs"
              >
                Save
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </Transition>

    {deletingKey && (() => {
      const row = rows.find((r) => r.key === deletingKey);
      const affectedCount = (tasks.data ?? []).filter((t) => (t.group ?? "").trim().toLowerCase() === deletingKey).length;
      return (
        <div className="fixed inset-0 z-80 flex items-end justify-center px-3 pb-12 md:items-center md:pb-0">
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs"
            onClick={() => !isDeleting && setDeletingKey(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border p-5 text-center shadow-2xl ring-1 ring-red-300/60
            border-red-300/70 bg-red-50/85 text-red-700
            dark:border-red-400/50 dark:bg-[rgba(248,113,113,0.12)] dark:text-red-100">
            <div className="mb-3 flex flex-col gap-1">
              <h1 className="text-lg font-semibold">Delete "{row?.displayName ?? deletingKey}"?</h1>
              <p className="text-sm text-red-700 dark:text-red-100">
                {affectedCount > 0
                  ? `${affectedCount} task${affectedCount === 1 ? "" : "s"} in this group will be moved to ungrouped.`
                  : "This group has no tasks in it."}
              </p>
            </div>
            <div className="flex flex-row gap-3">
              <button
                type="button"
                disabled={isDeleting}
                className="h-11 w-full rounded-xl border border-accent-blue/20 bg-white text-sm font-semibold text-primary shadow-xs transition hover:bg-slate-50 dark:bg-[rgba(15,23,42,0.7)] disabled:opacity-60"
                onClick={() => setDeletingKey(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                className="h-11 w-full rounded-xl bg-linear-to-r from-accent-red-600 to-accent-red-500 text-sm font-semibold text-white shadow-md shadow-red-200/80 ring-1 ring-red-200 transition hover:-translate-y-px disabled:opacity-60"
                onClick={confirmDelete}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}
