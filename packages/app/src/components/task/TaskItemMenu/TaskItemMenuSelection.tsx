import { Dialog } from "@headlessui/react";
import TaskItemMenuPiece from "./TaskItemMenuPiece";
import { Task, useUpdateTask } from "@/hooks/tasks";
import { useNavigate } from "react-router";
import { useApp } from "@/hooks/app";
import { matchDate } from "@/utils/date";
import { isTaskDone } from "@/utils/data";

interface TaskItemMenuSelectionProps {
  item: Task;
  isManaging: boolean;
  setIsManaging: (state: boolean) => void;
  setIsDeleting: (state: boolean) => void;
}

export default function TaskItemMenuSelection({
  item,
  isManaging,
  setIsManaging,
  setIsDeleting,
}: TaskItemMenuSelectionProps) {
  const navigate = useNavigate();
  const [appData] = useApp();

  const { mutate: updateTask } = useUpdateTask();

  const handleMarkComplete = (e: React.MouseEvent) => {
    e.stopPropagation();

    let newDone: boolean | string[];
    if (item.repeater && item.repeater.length > 0) {
      const newDoneArr = Array.isArray(item.done) ? [...item.done] : [];
      const rawDate = new Date(appData.activeDate ?? new Date());
      rawDate.setHours(0, 0, 0, 0);
      const foundIdx = newDoneArr.findIndex((entry) => matchDate(new Date(entry), rawDate));
      if (foundIdx === -1) {
        newDoneArr.push(rawDate.toString());
      } else {
        newDoneArr.splice(foundIdx, 1);
      }
      newDone = newDoneArr;
    } else {
      newDone = !item.done;
    }

    updateTask({ id: item.id!, data: { ...item, done: newDone } });
    setIsManaging(false);
  };

  const handleInteractive = () => {
    navigate(`/task/view/${item.id}`);
  };

  return (
    <Dialog open={isManaging} onClose={() => setIsManaging(false)}>
      <div className="fixed inset-0 flex w-screen items-center justify-center">
        <Dialog.Panel className="bg-accent-black-700 p-2 rounded-lg border border-accent-white text-white">
          <div className="flex flex-col justify-center items-center gap-2 py-4 px-4">
            <Dialog.Title className="text-lg">Manage Task</Dialog.Title>
            <div className="w-full h-full flex flex-col justify-evenly items-center px-2 py-2 rounded-md gap-2">
              <TaskItemMenuPiece
                text="View/Edit"
                color="bg-accent-blue"
                onClick={handleInteractive}
              />
              <TaskItemMenuPiece
                text="Delete"
                color="bg-accent-red-500"
                onClick={() => setIsDeleting(true)}
              />
              <TaskItemMenuPiece
                text={`Mark ${isTaskDone(item, appData.activeDate ?? new Date()) ? "Complete" : "Incomplete"}`}
                color="bg-accent-purple-400"
                onClick={handleMarkComplete}
              />
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
