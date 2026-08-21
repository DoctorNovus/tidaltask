import { useEffect, useRef } from "react";
import { PencilSquareIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

interface TaskItemQuickActionsProps {
  x: number;
  y: number;
  isPending: boolean;
  onEdit: () => void;
  onToggleComplete: () => void;
  onClose: () => void;
}

export default function TaskItemQuickActions({ x, y, isPending, onEdit, onToggleComplete, onClose }: TaskItemQuickActionsProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Keep the menu on-screen near the trigger point.
  const menuWidth = 176;
  const menuHeight = 88;
  const left = Math.min(x, window.innerWidth - menuWidth - 8);
  const top = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <div
      ref={ref}
      className="fixed z-70 w-44 rounded-xl border bg-white dark:bg-[#1a2230] shadow-2xl ring-1 ring-black/5 p-1.5 flex flex-col gap-0.5"
      style={{ left, top, borderColor: "var(--surface-border)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-accent-blue/10 transition"
        onClick={() => {
          onEdit();
          onClose();
        }}
      >
        <PencilSquareIcon className="h-4 w-4" />
        Edit
      </button>
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-accent-blue/10 transition"
        onClick={() => {
          onToggleComplete();
          onClose();
        }}
      >
        <CheckCircleIcon className="h-4 w-4" />
        {isPending ? "Mark complete" : "Mark incomplete"}
      </button>
    </div>
  );
}
