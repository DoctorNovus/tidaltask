import { useRef, useState } from "react";

export function pad2(n: number) {
  return String(n).padStart(2, "0");
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

interface ClockDialProps {
  hours24: number;
  minutes: number;
  onChange: (hours24: number, minutes: number) => void;
}

/** A draggable 12-hour clock face for picking a time — mounts fresh (hour ring first) each time its parent renders it. */
export default function ClockDial({ hours24, minutes, onChange }: ClockDialProps) {
  const [clockMode, setClockMode] = useState<"hour" | "minute">("hour");
  const dialRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const isPM = hours24 >= 12;
  const h12 = hours24 % 12 || 12;

  const activeDeg = clockMode === "hour" ? (h12 % 12) * 30 : minutes * 6;
  const tip = polarOffset(activeDeg, NUMBER_RADIUS);
  const numbers = clockMode === "hour" ? HOUR_NUMBERS : MINUTE_NUMBERS;
  const activeValue = clockMode === "hour" ? h12 : minutes;

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
      onChange(isPM ? (h % 12) + 12 : h % 12, minutes);
    } else {
      const m = Math.round(deg / 6) % 60;
      onChange(hours24, m);
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
    isDraggingRef.current = false;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Digital readout / mode switch */}
      <div className="flex items-center gap-1.5 select-none">
        <button
          type="button"
          onClick={() => setClockMode("hour")}
          className={`rounded-lg px-2 py-1 text-sm font-semibold tabular-nums transition ${
            clockMode === "hour" ? "bg-accent-blue text-white" : "text-primary hover:bg-(--surface-raised)"
          }`}
        >
          {pad2(h12)}
        </button>
        <span className="text-sm font-semibold text-muted">:</span>
        <button
          type="button"
          onClick={() => setClockMode("minute")}
          className={`rounded-lg px-2 py-1 text-sm font-semibold tabular-nums transition ${
            clockMode === "minute" ? "bg-accent-blue text-white" : "text-primary hover:bg-(--surface-raised)"
          }`}
        >
          {pad2(minutes)}
        </button>
        <button
          type="button"
          onClick={() => onChange(isPM ? hours24 - 12 : hours24 + 12, minutes)}
          className="ml-1.5 rounded-lg border border-(--surface-border) !bg-(--surface-raised) px-2 py-1 text-sm font-semibold text-primary hover:bg-(--accent-subtle) hover:text-accent-blue transition"
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
          className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent-blue text-sm font-medium text-white"
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
}
