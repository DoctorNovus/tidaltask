import { TaskItem } from "@/components/task/TaskItem"
import { Task, useTasksIncomplete } from "@/hooks/tasks";
import { useNavigate } from "react-router";
import { useApp } from "@/hooks/app";
import { useSettings } from "@/hooks/settings";
import { sortByDate, sortByPriority } from "@/utils/data";

interface UpcomingParams {
    skeleton?: boolean;
}

export default function HomeUpcoming({ skeleton }: UpcomingParams) {
    const incomplete = useTasksIncomplete();
    const navigate = useNavigate();
    const [appData, setAppData] = useApp();
    const settings = useSettings();

    const openTaskInTasks = (task: Task) => {
        setAppData({
            ...appData,
            activeTask: task,
            activeDate: task?.date ? new Date(task.date) : appData.activeDate,
        });
        navigate("/tasks");
    };

    if (skeleton)
        return (
            <div className="flex flex-col gap-3">
                <div className="px-1">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted">Upcoming Tasks</span>
                </div>
                <ul className="w-full flex flex-col gap-2.5">
                    <li className="w-full h-full">
                        <TaskItem skeleton={true} />
                    </li>
                </ul>
            </div>
        )

    return (
        <div className="flex flex-col gap-3">
            <div className="px-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">Upcoming Tasks</span>
            </div>
            <ul className="w-full flex flex-col gap-2.5">
                {incomplete.isSuccess && sortByPriority(sortByDate([...incomplete.data]))
                    .filter((task) => {
                        const group = (task.group ?? "").trim().toLowerCase();
                        if (!group) return true;
                        return !settings.data?.groupConfig?.[group]?.excludeFromUpcoming;
                    })
                    .map((task, key) => {
                    return (
                        <li key={key} className="w-full h-full">
                            <TaskItem
                                item={task}
                                taskFilter="all"
                                setIsInspecting={() => openTaskInTasks(task)}
                            />
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
