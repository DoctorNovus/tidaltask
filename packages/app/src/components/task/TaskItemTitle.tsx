export default function TaskItemTitle({ text }: { text: string }) {
  return (
    <div
      className="w-[48vw] truncate text-lg mx-3 ml-2 text-primary"
      title={text || "No Title"}
    >
      {text || "No Title"}
    </div>
  );
}