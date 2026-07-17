import { useApp } from "@/hooks/app";

export default function TaskItemTitle({ text }: { text: string }) {
  const [appData] = useApp();
  const isCompact = appData.taskDensity === "compact";

  return (
    <div
      className="flex-1 min-w-0 overflow-hidden pl-2 pr-3"
      title={text || "No Title"}
    >
      <span className={`block truncate text-primary ${isCompact ? "text-sm" : "text-lg"}`}>
        {text || "No Title"}
      </span>
    </div>
  );
}