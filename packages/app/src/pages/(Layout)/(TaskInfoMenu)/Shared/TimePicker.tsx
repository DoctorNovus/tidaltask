import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ClockDial, { pad2 } from "./ClockDial";

interface TimePickerProps {
  /** "HH:mm" in 24-hour time. */
  value: string;
  onChange: (value: string) => void;
}

/** A compact "HH:mm" time picker backed by the same draggable clock dial as DateTimePicker — used wherever only a time-of-day (no date) is needed, e.g. group alarms. */
export default function TimePicker({ value, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});

  const [hoursStr, minutesStr] = value.split(":");
  const hours24 = Number(hoursStr) || 0;
  const minutes = Number(minutesStr) || 0;

  const displayLabel = new Date(2000, 0, 1, hours24, minutes)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      const overlay = document.getElementById("tp-overlay");
      if (overlay?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const openPicker = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const PICKER_H = 300;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const top = spaceBelow >= PICKER_H ? rect.bottom + 4 : rect.top - PICKER_H - 4;
      const left = Math.min(rect.left, window.innerWidth - 240 - 8);
      setOverlayStyle({ position: "fixed", top, left, zIndex: 9999, width: 240 });
    }
    setOpen(v => !v);
  };

  const handleChange = (h24: number, min: number) => {
    onChange(`${pad2(h24)}:${pad2(min)}`);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={openPicker}
        className="px-2 py-1 rounded-lg border border-accent-blue/20 bg-silver-200 dark:bg-[#253350] text-xs font-semibold text-primary shadow-inner focus:border-accent-blue focus:outline-none"
      >
        {displayLabel}
      </button>

      {open && createPortal(
        <div
          id="tp-overlay"
          style={overlayStyle}
          className="rounded-xl border border-(--surface-border) bg-silver-50 dark:bg-[#121720] p-3 shadow-2xl"
        >
          <ClockDial hours24={hours24} minutes={minutes} onChange={handleChange} />
        </div>,
        document.body
      )}
    </div>
  );
}
