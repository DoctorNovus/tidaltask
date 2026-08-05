import { useEffect, useRef, useState } from "react";
import { ArrowsPointingOutIcon, ArrowsPointingInIcon } from "@heroicons/react/16/solid";

interface ExpandableTitleInputProps {
    name: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function ExpandableTitleInput({ name, value, onChange, placeholder }: ExpandableTitleInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [expanded, setExpanded] = useState(false);

    const resize = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    };

    useEffect(() => {
        if (expanded) resize();
    }, [expanded, value]);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-1">
                <label htmlFor={name.toLowerCase()} className="text-sm font-semibold text-primary">
                    {name}
                </label>
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="flex items-center gap-1 text-xs font-semibold text-accent-blue hover:text-accent-blue-700 transition"
                >
                    {expanded
                        ? <><ArrowsPointingInIcon className="h-3.5 w-3.5" /> Collapse</>
                        : <><ArrowsPointingOutIcon className="h-3.5 w-3.5" /> Expand</>
                    }
                </button>
            </div>
            {expanded ? (
                <textarea
                    ref={textareaRef}
                    id={name.toLowerCase()}
                    name={name.toLowerCase()}
                    className="w-full resize-none overflow-hidden text-base px-3 py-2 rounded-lg border border-accent-blue/20 bg-silver-200 text-primary shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[#253350]"
                    placeholder={placeholder ?? `${name}...`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoFocus={false}
                />
            ) : (
                <input
                    id={name.toLowerCase()}
                    name={name.toLowerCase()}
                    type="text"
                    className="text-base px-3 py-2 rounded-lg border border-accent-blue/20 bg-silver-200 text-primary shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[#253350]"
                    placeholder={placeholder ?? `${name}...`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoFocus={false}
                />
            )}
        </div>
    );
}
