export default function TaskItemTitle({ text }: { text: string }) {
  return (
    <div
      className="flex-1 min-w-0 overflow-hidden pl-2 pr-3"
      title={text || "No Title"}
    >
      <span className="block truncate text-lg text-primary">
        {text || "No Title"}
      </span>
    </div>
  );
}