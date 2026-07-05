import { useEffect } from "react";
import { useTasks } from "./tasks";
import { occursOnDate, normalizeDay, isTaskDone } from "@/utils/data";
import { pushWidgetData, type WidgetTask } from "@/plugins/widgetData";
import type { Task } from "./tasks";

function isOverdue(task: Task, today: Date): boolean {
    if (!task.date) return false;
    const d = normalizeDay(task.date);
    if (isNaN(d.getTime()) || d.getTime() <= 0) return false;
    if (task.repeater) return false;
    return d < today && isTaskDone(task, today);
}

function formatDateLabel(date: Date): string {
    const d = normalizeDay(date);
    if (isNaN(d.getTime()) || d.getTime() <= 0) return "";
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function toWidgetTask(task: Task): WidgetTask {
    return {
        id: task.id ?? task.title,
        title: task.title,
        date: task.date ? formatDateLabel(new Date(task.date as string)) : undefined,
        priority: typeof task.priority === "number" ? task.priority : 0,
    };
}

export function useWidgetSync() {
    const tasks = useTasks();

    useEffect(() => {
        if (!tasks.isSuccess || !tasks.data) return;

        const today = normalizeDay(new Date());
        const all = tasks.data.filter(Boolean);

        const todayTasks = all.filter((t) => occursOnDate(t, today));
        const completedToday = todayTasks.filter((t) => !isTaskDone(t, today)).length;
        const todayPending = todayTasks.filter((t) => isTaskDone(t, today)).length;

        const overdueTasks = all.filter((t) => isOverdue(t, today));

        const incomplete = all.filter((t) => isTaskDone(t, today));

        // upcoming: incomplete tasks sorted by date, limit 7
        const upcoming: WidgetTask[] = incomplete
            .filter((t) => !isOverdue(t, today))
            .sort((a, b) => {
                const da = new Date(a.date as string).getTime();
                const db = new Date(b.date as string).getTime();
                const pa = typeof a.priority === "number" ? a.priority : 0;
                const pb = typeof b.priority === "number" ? b.priority : 0;
                if (pa !== pb) return pb - pa;
                return da - db;
            })
            .slice(0, 7)
            .map(toWidgetTask);

        const now = new Date();
        const lastUpdated = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;

        pushWidgetData({
            todayCount: todayPending,
            overdueCount: overdueTasks.length,
            totalIncomplete: incomplete.length,
            completedToday,
            upcomingTasks: upcoming,
            lastUpdated,
        });
    }, [tasks.isSuccess, tasks.data]);
}
