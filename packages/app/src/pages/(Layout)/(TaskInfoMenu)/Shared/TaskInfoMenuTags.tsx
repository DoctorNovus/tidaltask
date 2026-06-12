import { KeyboardEvent, useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";

interface TaskInfoMenuTagsProps {
  label?: string;
  helperText?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TaskInfoMenuTags({
  label = "Tags",
  helperText = "Press enter to add a tag. Tags are matched case-insensitively.",
  tags,
  onChange,
}: TaskInfoMenuTagsProps) {
  const [input, setInput] = useState("");

  const normalizedExisting = useMemo(
    () => tags.map((tag) => tag.toLowerCase()),
    [tags]
  );

  const addTag = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    if (normalizedExisting.includes(normalized)) {
      setInput("");
      return;
    }

    onChange([...tags, normalized]);
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    }

    if (e.key === "Backspace" && input === "" && tags.length > 0) {
      e.preventDefault();
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-primary px-1">
          {label}
        </label>
        {tags.length > 0 && (
          <button
            type="button"
            className="text-xs font-semibold text-accent-blue hover:text-accent-blue-700"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-blue/20 bg-silver-200 p-2 shadow-inner focus-within:border-accent-blue dark:bg-(--surface-raised) dark:border-(--surface-border)">
        {tags.length === 0 && (
          <span className="text-sm text-muted px-1">No tags yet</span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-accent-blue/10 px-2 py-1 text-xs font-semibold text-accent-blue-800 ring-1 ring-accent-blue/20 dark:text-accent-blue-300 dark:ring-accent-blue/30"
          >
            <span>#{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full p-0.5 text-accent-blue-700 hover:bg-accent-blue/20 dark:text-accent-blue-300"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          className="min-w-[120px] flex-1 border-none !bg-transparent text-sm text-primary placeholder:text-slate-400 focus:outline-hidden"
          placeholder={tags.length === 0 ? "Add a tag…" : "Add another tag…"}
        />
      </div>
      <span className="px-1 text-xs text-muted">{helperText}</span>
    </div>
  );
}
