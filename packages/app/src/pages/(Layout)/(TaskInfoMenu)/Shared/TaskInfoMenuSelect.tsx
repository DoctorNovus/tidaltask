import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface TaskInfoSelect {
    name: string;
    value: string | number;
    onChange: (value: string) => void;
    options: TaskInfoSelectOption[];
}

export interface TaskInfoSelectOption {
    name: string;
    value: string;
}

export default function TaskInfoMenuSelect({ name, value, onChange, options }: TaskInfoSelect) {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});

    const selected = options.find((o) => o.value === String(value));

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (buttonRef.current?.contains(target)) return;
            if (overlayRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const openDropdown = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const DROPDOWN_H = options.length * 40 + 8;
            const spaceBelow = window.innerHeight - rect.bottom - 8;
            const top = spaceBelow >= DROPDOWN_H ? rect.bottom + 4 : rect.top - DROPDOWN_H - 4;
            const left = Math.min(rect.left, window.innerWidth - rect.width - 8);
            setOverlayStyle({ position: "fixed", top, left, width: rect.width, zIndex: 9999 });
        }
        setOpen((v) => !v);
    };

    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-primary px-1">{name}</label>
            <button
                ref={buttonRef}
                type="button"
                onClick={openDropdown}
                className="flex items-center justify-between px-3 py-2 text-sm text-primary w-full rounded-lg border border-accent-blue/30 bg-silver-200 shadow-inner dark:bg-[#253350] dark:border-accent-blue/40 focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 focus:outline-hidden"
            >
                <span>{selected?.name ?? "—"}</span>
                <svg
                    className={`h-4 w-4 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
            </button>
            {open && createPortal(
                <div
                    ref={overlayRef}
                    style={overlayStyle}
                    className="flex flex-col rounded-xl border border-(--surface-border) bg-silver-50 dark:bg-[#121720] py-1 shadow-2xl"
                >
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => { onChange(option.value); setOpen(false); }}
                            className={`px-3 py-2.5 text-sm text-left transition hover:bg-(--surface-raised) ${
                                option.value === String(value)
                                    ? "font-semibold text-accent-blue"
                                    : "text-primary"
                            }`}
                        >
                            {option.name}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}
