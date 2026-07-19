import { Dialog, DialogPanel, Transition } from "@headlessui/react";
import { ChevronUpIcon, ChevronDownIcon, EyeIcon, EyeSlashIcon, XMarkIcon, PencilSquareIcon, MagnifyingGlassIcon, StarIcon } from "@heroicons/react/20/solid";
import { useEffect, useMemo, useState } from "react";
import { useSettings, useUpdateSettings, GroupConfig } from "@/hooks/settings";
import GroupEditorModal from "./GroupEditorModal";

interface GroupRow {
  key: string;
  displayName: string;
  visible: boolean;
  visibleWhenEmpty: boolean;
  isDefault: boolean;
  excludeFromUpcoming: boolean;
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

  const [rows, setRows] = useState<GroupRow[]>([]);
  const [query, setQuery] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const config: Record<string, GroupConfig> = settings.data?.groupConfig ?? {};

    const initial = groups.map((key, i) => {
      const c = config[key] ?? {};
      return {
        key,
        displayName: c.displayName ?? key.replace(/\b\w/g, (ch) => ch.toUpperCase()),
        visible: c.visible !== false,
        visibleWhenEmpty: c.visibleWhenEmpty ?? false,
        isDefault: c.isDefault ?? false,
        excludeFromUpcoming: c.excludeFromUpcoming ?? false,
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

  const move = (index: number, dir: -1 | 1) => {
    const next = [...rows];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next.map((r, i) => ({ ...r, order: i })));
  };

  const update = (index: number, patch: Partial<GroupRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
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
                <div key={row.key} className="flex flex-col gap-2 px-5 py-3">
                  {/* Name + reorder */}
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        className="rounded p-0.5 text-slate-400 hover:text-primary disabled:opacity-25 transition"
                      >
                        <ChevronUpIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={i === rows.length - 1}
                        onClick={() => move(i, 1)}
                        className="rounded p-0.5 text-slate-400 hover:text-primary disabled:opacity-25 transition"
                      >
                        <ChevronDownIcon className="h-4 w-4" />
                      </button>
                    </div>

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
    </>
  );
}
