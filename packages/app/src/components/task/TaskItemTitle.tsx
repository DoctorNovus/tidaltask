export default function TaskItemTitle({ text }: { text: string }) {
  return (
    <div
      className="w-full text-lg mx-3 ml-2 mr-6 truncate text-primary"
      title={text || "No Title"}
    >
      {text || "No Title"}
    </div>
  );
}
