export default function TaskItemTitle({ text }: { text: string }) {
  return (
    <div
      className="min-w-0 truncate text-lg mx-3 ml-2 text-primary"
      style={{ width: "var(--title-w, 48vw)" }}
      title={text || "No Title"}
    >
      {text || "No Title"}
    </div>
  );
}