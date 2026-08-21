import { Dialog, DialogPanel, Transition } from "@headlessui/react";
import { XMarkIcon, StarIcon } from "@heroicons/react/20/solid";
import { useEffect, useState } from "react";
import { useSettings, useUpdateSettings, GroupConfig } from "@/hooks/settings";
import { useTasks, useUpdateTask } from "@/hooks/tasks";
import { useAlarms, useUpdateAlarm } from "@/hooks/alarms";
import { reconcileAlarms } from "@/utils/alarmScheduler";
import GroupAlarmField from "./GroupAlarmField";

interface GroupEditorModalProps {
  open: boolean;
  onClose: () => void;
  /** Existing group key to edit, or undefined to create a new group. */
  groupKey?: string;
  existingGroups: string[];
  onSaved?: (key: string) => void;
}

/**
 * Standalone modal for creating a group or editing all of its settings in one
 * place — the single "edit group" surface reused everywhere a pencil icon
 * opens group settings, so renaming (which reassigns every task in the group)
 * and the rest of the config stay on identical logic no matter where it's opened from.
 */
export default function GroupEditorModal({ open, onClose, groupKey, existingGroups, onSaved }: GroupEditorModalProps) {
  const settings = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();
  const tasks = useTasks();
  const { mutateAsync: updateTask } = useUpdateTask();
  const { data: alarms } = useAlarms();
  const { mutateAsync: updateAlarm } = useUpdateAlarm();
  const isEditing = !!groupKey;

  const [name, setName] = useState("");
  const [visible, setVisible] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [excludeFromUpcoming, setExcludeFromUpcoming] = useState(false);
  const [excludeFromCalendar, setExcludeFromCalendar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const config: Record<string, GroupConfig> = settings.data?.groupConfig ?? {};
    setError(null);

    if (groupKey) {
      const c = config[groupKey] ?? {};
      setName(c.displayName ?? groupKey.replace(/\b\w/g, (ch) => ch.toUpperCase()));
      setVisible(c.visible !== false);
      setIsDefault(!!c.isDefault);
      setExcludeFromUpcoming(!!c.excludeFromUpcoming);
      setExcludeFromCalendar(!!c.excludeFromCalendar);
    } else {
      setName("");
      setVisible(true);
      setIsDefault(false);
      setExcludeFromUpcoming(false);
      setExcludeFromCalendar(false);
    }
  }, [open, groupKey, settings.data]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a group name.");
      return;
    }

    const newKey = trimmed.toLowerCase();
    const isRename = isEditing && groupKey !== newKey;

    if ((!isEditing || isRename) && existingGroups.includes(newKey)) {
      setError("A group with that name already exists.");
      return;
    }

    setIsSaving(true);
    try {
      if (isRename && groupKey) {
        // Reassign every task in the old group to the new key.
        const affected = (tasks.data ?? []).filter((t) => (t.group ?? "").trim().toLowerCase() === groupKey);
        await Promise.all(
          affected.map((t) => t.id ? updateTask({ id: t.id, data: { ...t, group: newKey } }) : Promise.resolve())
        );

        // Re-point the group's alarm (if any) so it doesn't orphan.
        const groupAlarm = alarms?.find((a) => a.scope === "group" && a.group === groupKey);
        if (groupAlarm) {
          await updateAlarm({ id: groupAlarm.id, data: { group: newKey } });
          await reconcileAlarms();
        }
      }

      const config: Record<string, GroupConfig> = { ...(settings.data?.groupConfig ?? {}) };
      const oldKey = isRename ? groupKey : undefined;
      const previous = (oldKey ? config[oldKey] : config[newKey]) ?? {};
      if (oldKey) delete config[oldKey];
      config[newKey] = {
        ...previous,
        displayName: trimmed,
        visible,
        isDefault,
        excludeFromUpcoming,
        excludeFromCalendar,
        order: previous.order ?? Object.keys(config).length,
      };

      updateSettings({ groupConfig: config });
      onSaved?.(newKey);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Transition show={open}>
      <Dialog onClose={onClose} className="relative z-70">
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px]" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-sm rounded-2xl bg-silver-50 dark:bg-[#121720] border border-accent-blue/15 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-accent-blue/10">
              <h2 className="text-base font-semibold text-primary">
                {isEditing ? "Edit group" : "New group"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:text-primary hover:bg-accent-blue/8 transition"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted px-1">Name</label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                  placeholder="e.g. Work, NASA, Home"
                  className="px-3 py-2 rounded-lg border border-accent-blue/20 bg-silver-200 dark:bg-[#253350] text-sm text-primary shadow-inner focus:border-accent-blue focus:outline-none"
                />
                <span className="text-[11px] text-muted px-1">Any casing is preserved exactly as typed.</span>
                {error && <span className="text-xs font-semibold text-accent-red-500 px-1">{error}</span>}
              </div>

              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <div
                  onClick={() => setIsDefault((v) => !v)}
                  className={`relative w-8 h-4 rounded-full transition cursor-pointer ${isDefault ? "bg-accent-blue" : "bg-slate-300 dark:bg-slate-600"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${isDefault ? "translate-x-4" : "translate-x-0"}`} />
                </div>
                <span className="text-xs text-muted select-none flex items-center gap-1">
                  <StarIcon className="h-3.5 w-3.5" />
                  Default group for new tasks
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <div
                  onClick={() => setExcludeFromUpcoming((v) => !v)}
                  className={`relative w-8 h-4 rounded-full transition cursor-pointer ${excludeFromUpcoming ? "bg-accent-blue" : "bg-slate-300 dark:bg-slate-600"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${excludeFromUpcoming ? "translate-x-4" : "translate-x-0"}`} />
                </div>
                <span className="text-xs text-muted select-none">Hide from Upcoming Tasks on Home</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <div
                  onClick={() => setExcludeFromCalendar((v) => !v)}
                  className={`relative w-8 h-4 rounded-full transition cursor-pointer ${excludeFromCalendar ? "bg-accent-blue" : "bg-slate-300 dark:bg-slate-600"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${excludeFromCalendar ? "translate-x-4" : "translate-x-0"}`} />
                </div>
                <span className="text-xs text-muted select-none">Hide from Calendar</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <div
                  onClick={() => setVisible((v) => !v)}
                  className={`relative w-8 h-4 rounded-full transition cursor-pointer ${visible ? "bg-accent-blue" : "bg-slate-300 dark:bg-slate-600"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${visible ? "translate-x-4" : "translate-x-0"}`} />
                </div>
                <span className="text-xs text-muted select-none">Visible</span>
              </label>

              {isEditing && groupKey && (
                <div className="pt-1 border-t border-accent-blue/10">
                  <GroupAlarmField group={groupKey} />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-accent-blue/10">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-primary hover:bg-accent-blue/8 transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent-blue text-white hover:-translate-y-px transition shadow-xs disabled:opacity-60"
              >
                {isSaving ? "Saving..." : isEditing ? "Save" : "Create group"}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </Transition>
  );
}
