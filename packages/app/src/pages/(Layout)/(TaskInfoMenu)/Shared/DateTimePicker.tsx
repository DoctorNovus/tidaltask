import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function buildGrid(year: number, month: number): Array<Date | null> {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const grid: Array<Date | null> = [];
  for (let i = 0; i < first.getDay(); i++) grid.push(null);
  for (let d = 1; d <= last.getDate(); d++) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function toLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const DIAL_SIZE = 208;
const DIAL_RADIUS = DIAL_SIZE / 2;
const NUMBER_RADIUS = 82;

/** Position of a point at `deg` clockwise from 12 o'clock, `r` px out from the dial center. */
function polarOffset(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad) };
}

const HOUR_NUMBERS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_NUMBERS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  dateOnly?: boolean;
  /** When true the calendar expands inline (pushes content down). Default: floating overlay via portal. */
  inline?: boolean;
}

export default function DateTimePicker({ value, onChange, dateOnly = false, inline = false }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
  const [clockMode, setClockMode] = useState<"hour" | "minute">("hour");
  const dialRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const parsed = value ? new Date(value) : null;
  const isValid = !!parsed && !isNaN(parsed.getTime());

  const now = new Date();
  const [viewYear, setViewYear] = useState(isValid ? parsed!.getFullYear() : now.getFullYear());
  const [viewMonth, setViewMonth] = useState(isValid ? parsed!.getMonth() : now.getMonth());

  useEffect(() => {
    if (isValid) {
      setViewYear(parsed!.getFullYear());
      setViewMonth(parsed!.getMonth());
    }
  }, [value]);

  // Always land on the hour ring when the picker is (re)opened
  useEffect(() => {
    if (open) setClockMode("hour");
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      const overlay = document.getElementById("dtp-overlay");
      if (overlay?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const openPicker = () => {
    if (!inline && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const PICKER_H = dateOnly ? 280 : 560;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const top = spaceBelow >= PICKER_H ? rect.bottom + 4 : rect.top - PICKER_H - 4;
      const left = Math.min(rect.left, window.innerWidth - 288 - 8);
      setOverlayStyle({ position: "fixed", top, left, zIndex: 9999, width: 288 });
    }
    setOpen(v => !v);
  };

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const grid = buildGrid(viewYear, viewMonth);

  const selHours = isValid ? parsed!.getHours() : 12;
  const selMinutes = isValid ? parsed!.getMinutes() : 0;
  const isPM = selHours >= 12;
  const h12 = selHours % 12 || 12;

  const displayLabel = isValid
    ? dateOnly
      ? parsed!.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : parsed!.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
        "  ·  " +
        parsed!.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "Pick a date…";

  const pickDay = (day: Date) => {
    if (dateOnly) {
      onChange(`${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`);
      setOpen(false);
      return;
    }
    const next = new Date(day);
    next.setHours(selHours, selMinutes, 0, 0);
    onChange(toLocal(next));
  };

  const updateTime = (h24: number, min: number) => {
    const base = isValid ? new Date(parsed!) : new Date();
    base.setHours(h24, min, 0, 0);
    onChange(toLocal(base));
  };

  /** Angle (degrees, clockwise from 12 o'clock) of a pointer relative to the dial's center. */
  const angleFromPointer = (clientX: number, clientY: number) => {
    const rect = dialRef.current!.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  };

  const applyDialAngle = (deg: number) => {
    if (clockMode === "hour") {
      let h = Math.round(deg / 30) % 12;
      if (h === 0) h = 12;
      updateTime(isPM ? (h % 12) + 12 : h % 12, selMinutes);
    } else {
      const m = Math.round(deg / 6) % 60;
      updateTime(selHours, m);
    }
  };

  const handleDialPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    applyDialAngle(angleFromPointer(e.clientX, e.clientY));
  };
  const handleDialPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    applyDialAngle(angleFromPointer(e.clientX, e.clientY));
  };
  const handleDialPointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (clockMode === "hour") setClockMode("minute");
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const pickerBody = (
    <div
      id={inline ? undefined : "dtp-overlay"}
      className={`flex flex-col gap-3 rounded-xl border border-(--surface-border) bg-silver-50 dark:bg-[#121720] p-3 shadow-2xl ${inline ? "border-t border-accent-blue/20 rounded-t-none" : ""}`}
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth}
          className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-(--surface-raised) hover:text-primary transition">
          ←
        </button>
        <span className="text-sm font-semibold text-primary">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth}
          className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-(--surface-raised) hover:text-primary transition">
          →
        </button>
      </div>

      {/* Day-name header */}
      <div className="grid grid-cols-7 text-center">
        {DAY_NAMES.map(d => (
          <span key={d} className="text-[10px] font-bold text-muted">{d}</span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {grid.map((day, i) => {
          if (!day) return <div key={i} />;
          const isSel = isValid &&
            day.getFullYear() === parsed!.getFullYear() &&
            day.getMonth() === parsed!.getMonth() &&
            day.getDate() === parsed!.getDate();
          const isTod = day.getTime() === todayMidnight.getTime();
          return (
            <button
              key={i}
              type="button"
              onClick={() => pickDay(day)}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition ${
                isSel
                  ? "bg-accent-blue text-white"
                  : isTod
                  ? "ring-1 ring-accent-blue text-accent-blue"
                  : "text-primary hover:bg-(--surface-raised)"
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {/* Time: clock dial */}
      {!dateOnly && (() => {
        const activeDeg = clockMode === "hour" ? (h12 % 12) * 30 : selMinutes * 6;
        const tip = polarOffset(activeDeg, NUMBER_RADIUS);
        const numbers = clockMode === "hour" ? HOUR_NUMBERS : MINUTE_NUMBERS;
        const activeValue = clockMode === "hour" ? h12 : selMinutes;
        return (
          <div className="flex flex-col items-center gap-3 border-t border-(--surface-border) pt-3">
            {/* Digital readout / mode switch */}
            <div className="flex items-center gap-1.5 select-none">
              <button
                type="button"
                onClick={() => setClockMode("hour")}
                className={`rounded-lg px-2 py-1 text-xl font-bold tabular-nums transition ${
                  clockMode === "hour" ? "bg-accent-blue text-white" : "text-primary hover:bg-(--surface-raised)"
                }`}
              >
                {pad2(h12)}
              </button>
              <span className="text-xl font-bold text-muted">:</span>
              <button
                type="button"
                onClick={() => setClockMode("minute")}
                className={`rounded-lg px-2 py-1 text-xl font-bold tabular-nums transition ${
                  clockMode === "minute" ? "bg-accent-blue text-white" : "text-primary hover:bg-(--surface-raised)"
                }`}
              >
                {pad2(selMinutes)}
              </button>
              <button
                type="button"
                onClick={() => updateTime(isPM ? selHours - 12 : selHours + 12, selMinutes)}
                className="ml-1.5 rounded-lg border border-(--surface-border) !bg-(--surface-raised) px-2 py-1 text-xs font-bold text-primary hover:bg-(--accent-subtle) hover:text-accent-blue transition"
              >
                {isPM ? "PM" : "AM"}
              </button>
            </div>

            {/* Dial */}
            <div
              ref={dialRef}
              onPointerDown={handleDialPointerDown}
              onPointerMove={handleDialPointerMove}
              onPointerUp={handleDialPointerUp}
              onPointerCancel={handleDialPointerUp}
              style={{ height: DIAL_SIZE, width: DIAL_SIZE, touchAction: "none" }}
              className="relative select-none rounded-full bg-(--surface-raised)"
            >
              {/* Hand */}
              <div
                style={{
                  height: NUMBER_RADIUS,
                  transform: `translateX(-50%) rotate(${activeDeg}deg)`,
                }}
                className="absolute bottom-1/2 left-1/2 w-0.5 origin-bottom bg-accent-blue/60"
              />
              {/* Center dot */}
              <div className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-blue" />
              {/* Selected value bubble */}
              <div
                style={{ left: DIAL_RADIUS + tip.x, top: DIAL_RADIUS + tip.y }}
                className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent-blue text-xs font-bold text-white"
              >
                {clockMode === "hour" ? activeValue : pad2(activeValue)}
              </div>
              {/* Number labels */}
              {numbers.map(n => {
                const deg = clockMode === "hour" ? (n % 12) * 30 : n * 6;
                const pos = polarOffset(deg, NUMBER_RADIUS);
                const isActive = n === activeValue;
                return (
                  <span
                    key={n}
                    style={{ left: DIAL_RADIUS + pos.x, top: DIAL_RADIUS + pos.y }}
                    className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-sm font-semibold tabular-nums ${
                      isActive ? "opacity-0" : "text-primary"
                    }`}
                  >
                    {clockMode === "hour" ? n : pad2(n)}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );

  return (
    <div className={`flex flex-col ${inline ? "rounded-lg border border-accent-blue/30 bg-silver-200 shadow-inner dark:bg-[#253350] dark:border-accent-blue/40 overflow-hidden" : "relative"}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={openPicker}
        className={`flex items-center justify-between px-3 py-2 text-sm text-primary ${inline ? "" : "w-full rounded-lg border border-accent-blue/30 bg-silver-200 shadow-inner dark:bg-[#253350] dark:border-accent-blue/40 focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 focus:outline-hidden"}`}
      >
        <span className={isValid ? "text-primary" : "text-muted"}>{displayLabel}</span>
        <svg
          className={`h-4 w-4 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && inline && pickerBody}
      {open && !inline && createPortal(
        <div style={overlayStyle}>{pickerBody}</div>,
        document.body
      )}
    </div>
  );
}
