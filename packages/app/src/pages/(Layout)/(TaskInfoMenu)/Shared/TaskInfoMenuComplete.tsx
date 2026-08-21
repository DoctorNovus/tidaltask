import { Task, useUpdateTask } from "@/hooks/tasks";
import { useApp } from "@/hooks/app";
import { isTaskDone } from "@/utils/data";
import { completeTaskOccurrence } from "@/utils/taskCompletion";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleIconSolid } from "@heroicons/react/24/solid";

interface TaskInfoMenuCompleteProps {
  task: Task;
  closeMenu?: () => void;
}

export function TaskInfoMenuComplete({ task, closeMenu }: TaskInfoMenuCompleteProps) {
  const [appData] = useApp();
  const { mutate: updateTask } = useUpdateTask();

  const activeDate = appData.activeDate ? new Date(appData.activeDate) : new Date();
  const isPending = isTaskDone(task, activeDate);

  const toggleComplete = () => {
    completeTaskOccurrence(task, activeDate, updateTask);
    closeMenu?.();
  };

  return (
    <button
      type="button"
      className={`w-full h-11 rounded-xl border text-base font-semibold shadow-xs transition hover:-translate-y-px flex items-center justify-center gap-2 ${
        isPending
          ? "border-emerald-300/70 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/50 dark:bg-[rgba(52,211,153,0.12)] dark:text-emerald-200"
          : "border-accent-blue/30 bg-silver-200 text-accent-blue hover:bg-accent-blue hover:text-white dark:bg-[#253350]"
      }`}
      onClick={toggleComplete}
    >
      {isPending
        ? <CheckCircleIcon className="h-5 w-5" />
        : <CheckCircleIconSolid className="h-5 w-5" />
      }
      {isPending ? "Mark complete" : "Mark incomplete"}
    </button>
  );
}
