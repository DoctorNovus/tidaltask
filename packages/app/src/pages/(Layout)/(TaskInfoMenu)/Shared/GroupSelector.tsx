import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronUpDownIcon, PlusIcon, Cog6ToothIcon } from "@heroicons/react/20/solid";
import ManageGroupsDialog from "./ManageGroupsDialog";

interface GroupSelectorProps {
  value: string;
  groups: string[];
  onChange: (val: string) => void;
}

function capitalize(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const NEW_SENTINEL = "__new__";

export default function GroupSelector({ value, groups, onChange }: GroupSelectorProps) {
  const current = (value ?? "").trim().toLowerCase();
  const isNew = current !== "" && !groups.includes(current);

  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [mode, setMode] = useState<"select" | "new">(isNew ? "new" : "select");
  const [newInput, setNewInput] = useState(isNew ? current : "");
  const containerRef = useRef<HTMLDivElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (mode === "new" && newInputRef.current) {
      newInputRef.current.focus();
    }
  }, [mode]);

  const selectOption = (val: string) => {
    if (val === NEW_SENTINEL) {
      setMode("new");
      setNewInput("");
      onChange("");
      setOpen(false);
    } else {
      setMode("select");
      onChange(val);
      setOpen(false);
    }
  };

  const displayLabel =
    mode === "new"
      ? newInput || ""
      : current
      ? capitalize(current)
      : "";

  return (
    <>
    <ManageGroupsDialog open={manageOpen} onClose={() => setManageOpen(false)} groups={groups} />
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <label className="text-sm font-semibold text-primary">Group</label>
        {groups.length > 0 && (
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="flex items-center gap-1 text-xs text-muted hover:text-accent-blue transition"
          >
            <Cog6ToothIcon className="h-3.5 w-3.5" />
            Manage
          </button>
        )}
      </div>

      <div ref={containerRef} className="relative">
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-accent-blue/20 bg-silver-200 dark:bg-[#253350] text-sm text-primary shadow-inner transition focus:border-accent-blue focus:outline-none"
        >
          <span className={displayLabel ? "text-primary" : "text-slate-400"}>
            {displayLabel || "No group"}
          </span>
          <ChevronUpDownIcon className="h-4 w-4 shrink-0 text-slate-400" />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-accent-blue/15 bg-silver-50 dark:bg-[#1a2236] shadow-lg overflow-hidden">
            <div className="py-1 max-h-52 overflow-y-auto">
              {/* No group */}
              <button
                type="button"
                onClick={() => selectOption("")}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-accent-blue/8 dark:hover:bg-white/5 transition text-left"
              >
                <CheckIcon className={`h-4 w-4 shrink-0 text-accent-blue ${current === "" && mode === "select" ? "opacity-100" : "opacity-0"}`} />
                <span className="text-slate-400">No group</span>
              </button>

              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => selectOption(g)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-accent-blue/8 dark:hover:bg-white/5 transition text-left"
                >
                  <CheckIcon className={`h-4 w-4 shrink-0 text-accent-blue ${current === g && mode === "select" ? "opacity-100" : "opacity-0"}`} />
                  <span>{capitalize(g)}</span>
                </button>
              ))}
            </div>

            {/* New group option */}
            <div className="border-t border-accent-blue/10">
              <button
                type="button"
                onClick={() => selectOption(NEW_SENTINEL)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent-blue hover:bg-accent-blue/8 dark:hover:bg-white/5 transition text-left"
              >
                <PlusIcon className="h-4 w-4 shrink-0" />
                New group…
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New group text input */}
      {mode === "new" && (
        <input
          ref={newInputRef}
          type="text"
          value={newInput}
          onChange={(e) => {
            const val = e.target.value.toLowerCase();
            setNewInput(val);
            onChange(val);
          }}
          placeholder="Group name"
          className="px-3 py-2 rounded-lg border border-accent-blue/20 bg-silver-200 dark:bg-[#253350] text-sm text-primary shadow-inner focus:border-accent-blue focus:outline-none"
        />
      )}
    </div>
    </>
  );
}
