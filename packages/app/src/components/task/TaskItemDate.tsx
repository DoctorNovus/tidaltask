import { Task } from "@/hooks/tasks";
import { isOverdue } from "@/utils/date";
import { formatDigits } from "@/utils/math";

export default function TaskItemDate({ task }: { task: Task }) {

  if (!task?.date) return <></>;

  const taskDate: Date = new Date(task.date);
  if (Number.isNaN(taskDate.getTime()) || taskDate.getTime() <= 0) return <></>;
  let date: Date = taskDate;

  if (task.repeater) {
    const labels: Record<string, string> = {
      daily: "Daily",
      weekly: "Weekly",
      "bi-weekly": "Bi-weekly",
      monthly: "Monthly",
    };
    const label = labels[task.repeater] ?? task.repeater;
    return (
      <div className="w-full flex flex-row gap-2 justify-end items-center">
        <div className="w-full flex justify-end items-center h-6 text-muted">
          <h1 className="text-small text-right whitespace-nowrap">{label}</h1>
        </div>
      </div>
    );
  }

  const checkRelative = (date: Date) => {
    const today = new Date();
    const checkedDate = new Date(date);

    if (checkedDate.getTime() == 0) return;

    const diffMs = checkedDate.getTime() - today.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));

    if (diffMs > -24 * 60 * 60 * 1000 && diffMs < 24 * 60 * 60 * 1000) {
      // within 24 hours
      if (diffHours >= 1) return `${diffHours} hour${diffHours === 1 ? "" : "s"}`;
      if (diffHours <= -1) return `${Math.abs(diffHours)} hour${Math.abs(diffHours) === 1 ? "" : "s"} ago`;

      if (diffMinutes >= 1) return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"}`;
      if (diffMinutes <= -1) return `${Math.abs(diffMinutes)} min${Math.abs(diffMinutes) === 1 ? "" : "s"} ago`;

      return "Now";
    }

    return `${formatDigits(checkedDate.getMonth() + 1, 2)}/${formatDigits(
      checkedDate.getDate(),
      2
    )}`;
  };

  return (
    <div className="w-full flex flex-row gap-2 justify-end items-center">
      {checkRelative(date) != undefined && (
        <>
          <div
            className={`w-full flex justify-end items-center h-6 ${
              isOverdue(date, new Date()) ? "text-red-400" : "text-muted"
            }`}
          >
            <h1 className="text-small text-right whitespace-nowrap">{checkRelative(date)}</h1>
          </div>
          {/* <img
            src={today_icon}
            className="invert w-4 h-4"
            width="16"
            height="16"
          /> */}
        </>
      )}
    </div>
  );
}
