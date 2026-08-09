import { Description, DialogTitle } from "@headlessui/react";
import { useState } from "react";
import { ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/20/solid";
import { Task } from "@/hooks/tasks";

interface MenuHeaderProps {
    isDeleting: boolean;
    type: string;
    tempData?: Task;
}

export default function MenuHeader({ isDeleting, type, tempData }: MenuHeaderProps) {
    const [copied, setCopied] = useState(false);

    const copyTask = async () => {
        const text = [tempData?.title, tempData?.description]
            .filter((part) => !!part?.trim())
            .join("\n\n");

        if (!text) return;

        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className={`flex items-start justify-between gap-3 pb-4 border-b border-(--surface-border) ${isDeleting && "blur-xs"}`}>
            <div className="flex flex-col gap-1">
                <DialogTitle className="text-2xl font-bold text-primary">
                    {type == "add" ? "New Task" : "Update Task"}
                </DialogTitle>
                <Description className="text-sm text-muted">
                    {type == "add"
                        ? "Capture the essentials and set a reminder."
                        : "Edit details, dates, or reminders, then save."}
                </Description>
            </div>
            {type == "edit" && (
                <button
                    type="button"
                    onClick={copyTask}
                    disabled={!tempData?.title?.trim()}
                    title="Copy title and description"
                    aria-label="Copy title and description"
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-primary hover:bg-accent-blue/8 transition disabled:opacity-40 disabled:pointer-events-none"
                >
                    {copied
                        ? <CheckIcon className="h-5 w-5 text-emerald-500" />
                        : <ClipboardDocumentIcon className="h-5 w-5" />
                    }
                </button>
            )}
        </div>
    )
}
