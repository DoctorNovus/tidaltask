import { Dialog, DialogPanel, Transition } from "@headlessui/react";
import { XMarkIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/20/solid";
import { useEffect, useState } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/settings";
import { Task, useUpdateTask } from "@/hooks/tasks";

interface GroupEditDialogProps {
  open: boolean;
  onClose: () => void;
  groupKey: string;
  tasks: Task[];
}

export default function GroupEditDialog({ open, onClose, groupKey, tasks }: GroupEditDialogProps) {
  const settings = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();
  const { mutateAsync: updateTask } = useUpdateTask();

  const [name, setName] = useState("");
  const [visible, setVisible] = useState(true);
  const [visibleWhenEmpty, setVisibleWhenEmpty] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cfg = settings.data?.groupConfig?.[groupKey] ?? {};
    setName(cfg.displayName ?? groupKey.replace(/\b\w/g, (c) => c.toUpperCase()));
    setVisible(cfg.visible !== false);
    setVisibleWhenEmpty(cfg.visibleWhenEmpty ?? false);
  }, [open, groupKey, settings.data]);

  const save = async () => {
    const newKey = name.trim().toLowerCase();
    const existing = settings.data?.groupConfig ?? {};

    // Rename tasks if the key changed
    if (newKey && newKey !== groupKey) {
      await Promise.all(
        tasks.map((t) =>
          t.id ? updateTask({ id: t.id, data: { ...t, group: newKey } }) : Promise.resolve()
        )
      );
      // Move config from old key to new key
      const { [groupKey]: old, ...rest } = existing;
      updateSettings({
        groupConfig: {
          ...rest,
          [newKey]: { ...old, displayName: name.trim(), visible, visibleWhenEmpty },
        },
      });
    } else {
      updateSettings({
        groupConfig: {
          ...existing,
          [groupKey]: { ...existing[groupKey], displayName: name.trim(), visible, visibleWhenEmpty },
        },
      });
    }

    onClose();
  };

  return (
    <Transition show={open}>
      <Dialog onClose={onClose} className="relative z-[60]">
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px]" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-sm rounded-2xl bg-silver-50 dark:bg-[#121720] border border-accent-blue/15 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-accent-blue/10">
              <div>
                <h2 className="text-base font-semibold text-primary">Edit Group</h2>
                <p className="text-xs text-muted mt-0.5">Update name and display settings.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:text-primary hover:bg-accent-blue/8 transition"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-5 px-5 py-5">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-primary">Name</label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose(); }}
                  className="w-full px-3 py-2 rounded-lg border border-accent-blue/20 bg-silver-200 dark:bg-[#253350] text-sm text-primary shadow-inner focus:border-accent-blue focus:outline-none"
                />
              </div>

              {/* Visible */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">Visible</p>
                  <p className="text-xs text-muted">Show this group on the task page.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    visible
                      ? "bg-accent-blue text-white"
                      : "bg-silver-200 dark:bg-[#253350] text-muted"
                  }`}
                >
                  {visible ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
                  {visible ? "Shown" : "Hidden"}
                </button>
              </div>

              {/* Visible when empty */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">Show when empty</p>
                  <p className="text-xs text-muted">Keep the group visible with no tasks.</p>
                </div>
                <div
                  onClick={() => setVisibleWhenEmpty((v) => !v)}
                  className={`relative w-10 h-5 rounded-full cursor-pointer transition ${visibleWhenEmpty ? "bg-accent-blue" : "bg-slate-300 dark:bg-slate-600"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${visibleWhenEmpty ? "translate-x-5" : "translate-x-0"}`} />
                </div>
              </div>
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
  );
}
