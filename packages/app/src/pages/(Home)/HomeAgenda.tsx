import { Task, useTasks } from "@/hooks/tasks";
import DueCapsule from "./DueCapsule";
import { useNavigate } from "react-router";
import { occursOnDate, isTaskDone, normalizeDay } from "@/utils/data";
import { useMemo } from "react";

type AgendaProps = {
    skeleton?: boolean;
};

export default function HomeAgenda({ skeleton }: AgendaProps) {
    const navigate = useNavigate();
    const tasks = useTasks();

    const today = normalizeDay(new Date());
    const tomorrow = normalizeDay(new Date(Date.now() + 24 * 60 * 60 * 1000));

    const isPendingOnDate = (task: Task, day: Date) => occursOnDate(task, day) && isTaskDone(task, day);
    const hasPendingWithinDays = (task: Task, startDay: Date, days: number) => {
        for (let i = 0; i < days; i++) {
            const check = new Date(startDay);
            check.setDate(startDay.getDate() + i);
            if (isPendingOnDate(task, check)) return true;
        }
        return false;
    };
    const hasPendingBefore = (task: Task, target: Date) => {
        const startDay = normalizeDay(task.date as any);
        if (Number.isNaN(startDay.getTime()) || startDay > target) return false;

        const totalDays = Math.floor((target.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000));
        for (let i = 0; i <= totalDays; i++) {
            const check = new Date(startDay);
            check.setDate(startDay.getDate() + i);
            if (isPendingOnDate(task, check) && check < target) return true;
        }
        return false;
    };

    const counts = useMemo(() => {
        if (!tasks.data) return { today: 0, tomorrow: 0, week: 0, overdue: 0 };
        const base = { today: 0, tomorrow: 0, week: 0, overdue: 0 };
        for (const task of tasks.data) {
            if (isPendingOnDate(task, today)) base.today += 1;
            if (isPendingOnDate(task, tomorrow)) base.tomorrow += 1;
            if (hasPendingWithinDays(task, today, 7)) base.week += 1;
            if (hasPendingBefore(task, today)) base.overdue += 1;
        }
        return base;
    }, [tasks.data, today, tomorrow]);

    if (skeleton)
        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted">Your Agenda</span>
                    <span className="rounded-full bg-accent-blue-50 px-2.5 py-0.5 text-xs font-semibold text-accent-blue-700 dark:bg-(--accent-subtle) dark:text-primary">
                        Updating...
                    </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <DueCapsule skeleton category="today" />
                    <DueCapsule skeleton category="tomorrow" />
                    <DueCapsule skeleton category="this week" />
                    <DueCapsule skeleton category="overdue-clear" label="Overdue" />
                </div>
            </div>
        )

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">Your Agenda</span>
                <span className="rounded-full bg-accent-blue-50 px-2.5 py-0.5 text-xs font-semibold text-accent-blue-700 dark:bg-(--accent-subtle) dark:text-primary">
                    Live sync
                </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <DueCapsule
                    count={tasks.isSuccess ? counts.today : 0}
                    category="today"
                    onClick={() => navigate("/calendar?scope=today&view=week")}
                />
                <DueCapsule
                    count={tasks.isSuccess ? counts.tomorrow : 0}
                    category="tomorrow"
                    onClick={() => navigate("/calendar?scope=tomorrow&view=week")}
                />
                <DueCapsule
                    count={tasks.isSuccess ? counts.week : 0}
                    category="this week"
                    onClick={() => navigate("/calendar?scope=week&view=week")}
                />
                <DueCapsule
                    count={tasks.isSuccess ? counts.overdue : 0}
                    category={tasks.isSuccess && counts.overdue > 0 ? "overdue-active" : "overdue-clear"}
                    label="Overdue"
                    onClick={() => navigate("/calendar?scope=overdue&view=week")}
                />
            </div>
        </div>
    )
}
