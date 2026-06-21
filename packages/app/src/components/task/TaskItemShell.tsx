import { Task } from "@/hooks/tasks";
import { isTaskDone } from "@/utils/data";

interface TaskItemShellProps {
  skeleton?: boolean;
  className?: string;
  task?: Task;
  activeDate?: Date;
  onClick?: (e: React.MouseEvent) => void;
}

export default function TaskItemShell({ skeleton, children, task, activeDate, className = "", ...props }: React.PropsWithChildren<TaskItemShellProps>) {
  if (skeleton) {
    return (
      <div className="group flex flex-col w-full h-full my-2 px-0 md:px-0">
        {children}
      </div>
    )
  }

  const isCompleted = !isTaskDone(task!, activeDate!);

  return (
    <div
      {...props}
      data-completed={isCompleted}
      className={`group flex flex-col w-full overflow-hidden rounded-2xl bg-slate-50 dark:bg-(--surface-raised) border border-slate-200 dark:border-(--surface-border) px-3.5 py-3 shadow-sm backdrop-blur-xs transition-all duration-300 ease-out hover:shadow-md hover:border-accent-blue/30 text-primary cursor-pointer ${isCompleted ? "opacity-30 translate-y-1 scale-[0.99]" : "opacity-100"} ${className}`}
    >
      {children}
    </div>
  );
}
