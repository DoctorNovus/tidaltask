import { Injectable } from "@outwalk/firefly";
import { Task } from "./task.entity";
import { User } from "@/user/user.entity";
import { UpdateQuery } from "mongoose";
import mongoose from "mongoose";

@Injectable()
export class TaskService {

    private readonly ONE_DAY_MS = 1000 * 60 * 60 * 24;

    private normalizeDay(date: Date): Date {
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        return normalized;
    }

    private matchDay(a: string | Date | undefined, b: Date): boolean {
        if (!a) return false;
        const dayA = this.normalizeDay(new Date(a));
        const dayB = this.normalizeDay(b);
        if (Number.isNaN(dayA.getTime()) || Number.isNaN(dayB.getTime())) return false;
        return dayA.getTime() === dayB.getTime();
    }

    private occursOnDate(task: Task, target: Date): boolean {
        if (!task?.date) return false;
        const startDay = this.normalizeDay(new Date(task.date));
        const targetDay = this.normalizeDay(target);

        if (Number.isNaN(startDay.getTime()) || Number.isNaN(targetDay.getTime())) return false;
        if (targetDay < startDay) return false;

        if (!task.repeater) return startDay.getTime() === targetDay.getTime();

        switch (task.repeater) {
            case "daily":
                return true;
            case "weekly":
                return startDay.getDay() === targetDay.getDay();
            case "bi-weekly": {
                const diffDays = Math.floor(Math.abs(targetDay.getTime() - startDay.getTime()) / this.ONE_DAY_MS);
                return diffDays % 14 === 0;
            }
            case "monthly":
                return startDay.getDate() === targetDay.getDate();
            default:
                return false;
        }
    }

    private isCompletedOnDate(task: Task, target: Date): boolean {
        // For repeating tasks, ignore legacy boolean `done` and rely on per-day markers.
        if (task.repeater && !Array.isArray(task.done)) return false;

        if (Array.isArray(task.done)) {
            return task.done.some((entry) => this.matchDay(entry as any, target));
        }

        return Boolean(task.done);
    }

    private isPendingOnDate(task: Task, target: Date): boolean {
        return this.occursOnDate(task, target) && !this.isCompletedOnDate(task, target);
    }

    private hasPendingWithinDays(task: Task, start: Date, days: number): boolean {
        const startDay = this.normalizeDay(start);
        for (let i = 0; i < days; i++) {
            const checkDay = new Date(startDay);
            checkDay.setDate(startDay.getDate() + i);
            if (this.isPendingOnDate(task, checkDay)) return true;
        }
        return false;
    }

    private hasPendingBefore(task: Task, target: Date): boolean {
        if (!task?.date) return false;

        const targetDay = this.normalizeDay(target);
        const dayBefore = new Date(targetDay);
        dayBefore.setDate(targetDay.getDate() - 1);

        const startDay = this.normalizeDay(new Date(task.date));
        if (Number.isNaN(startDay.getTime()) || startDay > dayBefore) return false;

        const totalDays = Math.floor((dayBefore.getTime() - startDay.getTime()) / this.ONE_DAY_MS) + 1;
        for (let i = 0; i < totalDays; i++) {
            const checkDay = new Date(startDay);
            checkDay.setDate(startDay.getDate() + i);
            if (this.isPendingOnDate(task, checkDay)) return true;
        }

        return false;
    }

    normalizeTags(tags?: string[] | Array<{ title?: string }>): string[] | undefined {
        if (!Array.isArray(tags)) return undefined;

        const normalized = tags
            .map((tag) => {
                if (typeof tag === "string") return tag.trim().toLowerCase();
                if (tag && typeof tag.title === "string") return tag.title.trim().toLowerCase();
                return "";
            })
            .filter((tag) => tag.length > 0);

        return Array.from(new Set(normalized));
    }

    async addTask(data: Partial<Task>): Promise<Task> {
        const tags = this.normalizeTags(data.tags);
        return Task.create({
            ...data,
            ...(tags ? { tags } : {}),
        });
    }

    async addTasks(data: Partial<Task>[]): Promise<Task[]> {
        const withTags = data.map((task) => {
            const tags = this.normalizeTags(task.tags);
            return { ...task, ...(tags ? { tags } : {}) };
        });

        return Task.insertMany(withTags);
    }

    async updateTask(id: string, data: Partial<Task> | UpdateQuery<Task>): Promise<Task | null> {
        // Operator updates ($push, $pull, etc.) — pass through directly.
        const hasOperators = Object.keys(data as object).some(k => k.startsWith("$"));
        if (hasOperators) {
            return Task.findByIdAndUpdate(id, data).lean<Task>().exec();
        }

        const payload = data as Partial<Task>;
        const tags = this.normalizeTags(payload.tags);
        const { subtasks: _, ...rest } = payload as any;

        return Task.findByIdAndUpdate(id, {
            $set: {
                ...rest,
                ...(tags !== undefined ? { tags } : {}),
            },
        }).lean<Task>().exec();
    }

    async getTasksByUserId(userId: string, tags: string[] = []): Promise<Task[]> {
        const normalizedTags = this.normalizeTags(tags) ?? [];
        const query: Record<string, unknown> = { users: userId };

        if (normalizedTags.length > 0) {
            query.tags = { $all: normalizedTags };
        }

        return Task.find(query)
            .populate({ path: "users", select: "first last email id" })
            .lean<Task[]>()
            .exec();
    }

    getTaskDateFormat(date: Date): RegExp {
        const year = `${date.getFullYear()}`;
        const month = (date.getMonth() + 1) < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
        const day = (date.getDate() < 10) ? `0${date.getDate()}` : date.getDate();

        return new RegExp(`${year}-${month}-${day}`);
    }

    getTaskDateWeekFormat(date: Date): RegExp {
        let dates = `^(?:`;

        for (let i = 0; i < 7; i++) {
            const year = `${date.getFullYear()}`;
            const month = (date.getMonth() + 1) < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
            const day = (date.getDate() < 10) ? `0${date.getDate()}` : date.getDate();

            dates += `${year}-${month}-${day}`;
            if (i != 6) dates += "|";

            date.setDate(date.getDate() + 1);
        }

        dates += ")";

        return new RegExp(dates);
    }

    async getTasksToday(userId: string): Promise<Task[]> {
        const today = this.normalizeDay(new Date());

        const tasks = await Task.find({ users: userId })
            .populate({ path: "users", select: "first last email id" })
            .lean<Task[]>()
            .exec();

        return tasks.filter((task) => this.isPendingOnDate(task, today));
    }

    async getTasksTomorrow(userId: string): Promise<Task[]> {
        const tomorrow = this.normalizeDay(new Date());
        tomorrow.setDate(tomorrow.getDate() + 1);

        const tasks = await Task.find({ users: userId })
            .populate({ path: "users", select: "first last email id" })
            .lean<Task[]>()
            .exec();

        return tasks.filter((task) => this.isPendingOnDate(task, tomorrow));
    }

    async getTasksWeek(userId: string): Promise<Task[]> {
        const startDay = this.normalizeDay(new Date());

        const tasks = await Task.find({ users: userId })
            .populate({ path: "users", select: "first last email id" })
            .lean<Task[]>()
            .exec();

        return tasks.filter((task) => this.hasPendingWithinDays(task, startDay, 7));
    }

    async getTasksOverdue(userId: string): Promise<Task[]> {
        const today = this.normalizeDay(new Date());

        const tasks = await Task.find({ users: userId })
            .populate({ path: "users", select: "first last email id" })
            .lean<Task[]>()
            .exec();

        return tasks.filter((task) => this.hasPendingBefore(task, today));
    }

    async getTasksIncomplete(userId: string): Promise<Task[]> {
        const today = this.normalizeDay(new Date());

        const tasks = await Task.find({ users: userId })
            .populate({ path: "users", select: "first last email id" })
            .sort({ priority: -1 })
            .lean<Task[]>()
            .exec();

        // Consider tasks that are pending today, within the next 90 days, or overdue.
        return tasks.filter((task) =>
            this.isPendingOnDate(task, today) ||
            this.hasPendingWithinDays(task, today, 90) ||
            this.hasPendingBefore(task, today)
        );
    }

    async deleteTask(id: string): Promise<Task | null> {
        return Task.findByIdAndDelete(id).lean<Task>().exec();
    }

    async getUsersByTaskId(id: string): Promise<User[] | null> {
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return [];
        const populated = await Task.findById(id)
            .select("users")
            .populate({ path: "users", select: "first last email id" })
            .lean<{ users: User[] }>()
            .exec();

        return populated?.users ?? [];
    }
}
