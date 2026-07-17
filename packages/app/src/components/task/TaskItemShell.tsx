import { Task } from "@/hooks/tasks";
import { isTaskDone } from "@/utils/data";
import { useApp } from "@/hooks/app";

interface TaskItemShellProps {
  skeleton?: boolean;
  className?: string;
  task?: Task;
  activeDate?: Date;
  onClick?: (e: React.MouseEvent) => void;
}

export default function TaskItemShell({ skeleton, children, task, activeDate, className = "", ...props }: React.PropsWithChildren<TaskItemShellProps>) {
  const [appData] = useApp();
  const isCompact = appData.taskDensity === "compact";
  const isBlocky = appData.taskShape === "blocky";

  if (skeleton) {
    return (
      <div className="group flex flex-col w-full h-full my-2 px-0 md:px-0">
        {children}
      </div>
    )
  }

  const isCompleted = !isTaskDone(task!, activeDate!);

  const shapeClass = isBlocky
    ? "rounded-md border-2 shadow-none"
    : "rounded-2xl border shadow-sm hover:shadow-md";
  const densityClass = isCompact ? "px-2.5 py-1.5" : "px-3.5 py-3";

  return (
    <div
      {...props}
      data-completed={isCompleted}
      className={`group flex flex-col w-full overflow-hidden bg-slate-50 dark:bg-(--surface-raised) border-slate-200 dark:border-(--surface-border) backdrop-blur-xs transition-all duration-300 ease-out hover:border-accent-blue/30 text-primary cursor-pointer ${shapeClass} ${densityClass} ${isCompleted ? "opacity-30 translate-y-1 scale-[0.99]" : "opacity-100"} ${className}`}
    >
      {children}
    </div>
  );
}
