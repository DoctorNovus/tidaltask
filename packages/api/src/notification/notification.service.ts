import { Injectable } from "@outwalk/firefly";
import { BadRequest } from "@outwalk/firefly/errors";
import { NotificationMessage } from "./notificationMessage.entity";
import { NotificationPreference } from "./notificationPreference.entity";
import { Task } from "@/task/task.entity";
import { TaskService } from "@/task/task.service";
import { User } from "@/user/user.entity";

export interface NotificationPreferenceInput {
    pushEnabled?: boolean;
    remindersEnabled?: boolean;
    summaryCadence?: "off" | "daily" | "weekly";
    summaryTime?: string;
    weeklyDay?: number;
    utcOffsetMinutes?: number;
}

export interface PendingNotificationDTO {
    id: string;
    title: string;
    body: string;
    ctaAction?: string;
    type: string;
    scheduledFor: Date;
}

export interface NotificationQueueStatus {
    dueNow: number;
    upcoming: number;
    totalUndelivered: number;
    nextScheduledFor?: Date | null;
}

@Injectable()
export class NotificationService {

    private readonly taskService = new TaskService();

    async getPreferences(userId: string): Promise<NotificationPreference> {
        const existing = await NotificationPreference.findOne({ user: userId }).lean<NotificationPreference>().exec();
        if (existing) return existing;

        const created = await NotificationPreference.create({ user: userId });
        return created.toObject() as NotificationPreference;
    }

    async updatePreferences(userId: string, input: NotificationPreferenceInput): Promise<NotificationPreference> {
        const updates: NotificationPreferenceInput = {};

        if (typeof input.pushEnabled === "boolean") updates.pushEnabled = input.pushEnabled;
        if (typeof input.remindersEnabled === "boolean") updates.remindersEnabled = input.remindersEnabled;

        if (typeof input.summaryCadence === "string") {
            if (!["off", "daily", "weekly"].includes(input.summaryCadence)) {
                throw new BadRequest("summaryCadence must be off, daily, or weekly.");
            }
            updates.summaryCadence = input.summaryCadence;
        }

        if (typeof input.summaryTime === "string") {
            if (!/^\d{2}:\d{2}$/.test(input.summaryTime)) {
                throw new BadRequest("summaryTime must be in HH:mm format.");
            }
            updates.summaryTime = input.summaryTime;
        }

        if (typeof input.weeklyDay === "number") {
            if (input.weeklyDay < 0 || input.weeklyDay > 6) {
                throw new BadRequest("weeklyDay must be 0-6.");
            }
            updates.weeklyDay = input.weeklyDay;
        }

        if (typeof input.utcOffsetMinutes === "number") {
            updates.utcOffsetMinutes = Math.trunc(input.utcOffsetMinutes);
        }

        const updated = await NotificationPreference.findOneAndUpdate(
            { user: userId },
            { $set: updates, $setOnInsert: { user: userId } },
            { upsert: true, new: true }
        ).lean<NotificationPreference>().exec();

        if (!updated) {
            throw new BadRequest("Unable to update notification preferences.");
        }

        return updated;
    }

    async enqueueDeveloperMessage(options: {
        to: "user" | "all";
        targetUserId?: string;
        title: string;
        body: string;
        ctaAction?: string;
        scheduledFor?: Date;
        createdBy: string;
    }): Promise<{ count: number }> {
        const scheduledFor = options.scheduledFor ?? new Date();

        if (options.to === "user") {
            if (!options.targetUserId) throw new BadRequest("targetUserId is required when sending to user.");

            await NotificationMessage.create({
                user: options.targetUserId,
                createdBy: options.createdBy,
                title: options.title,
                body: options.body,
                ctaAction: options.ctaAction ?? "",
                type: "developer-broadcast",
                scheduledFor
            });

            return { count: 1 };
        }

        const users = await User.find().select("_id").lean<Array<{ _id: unknown }>>().exec();
        if (!users.length) return { count: 0 };

        const docs = users.map((user) => ({
            user: String(user._id),
            createdBy: options.createdBy,
            title: options.title,
            body: options.body,
            ctaAction: options.ctaAction ?? "",
            type: "developer-broadcast",
            scheduledFor
        }));

        await NotificationMessage.insertMany(docs);
        return { count: docs.length };
    }

    async getPendingForUser(userId: string): Promise<PendingNotificationDTO[]> {
        await this.ensureGeneratedNotifications(userId);

        const now = new Date();
        const pending = await NotificationMessage.find({
            user: userId,
            deliveredAt: null,
            scheduledFor: { $lte: now }
        })
            .sort({ scheduledFor: 1 })
            .limit(25)
            .lean<NotificationMessage[]>()
            .exec();

        return pending.map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            ctaAction: item.ctaAction,
            type: item.type,
            scheduledFor: item.scheduledFor
        }));
    }

    async getQueueStatus(userId: string): Promise<NotificationQueueStatus> {
        await this.ensureGeneratedNotifications(userId);

        const now = new Date();
        const [dueNow, upcoming, totalUndelivered, nextItem] = await Promise.all([
            NotificationMessage.countDocuments({
                user: userId,
                deliveredAt: null,
                scheduledFor: { $lte: now }
            }).exec(),
            NotificationMessage.countDocuments({
                user: userId,
                deliveredAt: null,
                scheduledFor: { $gt: now }
            }).exec(),
            NotificationMessage.countDocuments({
                user: userId,
                deliveredAt: null
            }).exec(),
            NotificationMessage.findOne({
                user: userId,
                deliveredAt: null,
                scheduledFor: { $gt: now }
            }).sort({ scheduledFor: 1 }).select("scheduledFor").lean<{ scheduledFor?: Date }>().exec()
        ]);

        return {
            dueNow,
            upcoming,
            totalUndelivered,
            nextScheduledFor: nextItem?.scheduledFor ?? null
        };
    }

    async acknowledgeDelivered(userId: string, ids: string[]): Promise<{ acknowledged: number }> {
        const validIds = ids
            .map((value) => value?.trim())
            .filter((value): value is string => Boolean(value));

        if (!validIds.length) return { acknowledged: 0 };

        const result = await NotificationMessage.updateMany(
            { user: userId, _id: { $in: validIds }, deliveredAt: null },
            { $set: { deliveredAt: new Date() } }
        ).exec();

        return { acknowledged: result.modifiedCount ?? 0 };
    }

    private async ensureGeneratedNotifications(userId: string): Promise<void> {
        const prefs = await this.getPreferences(userId);

        if (prefs.pushEnabled !== false) {
            await this.generateReminderNotifications(userId, prefs);
            await this.generateSummaryNotifications(userId, prefs);
        }
    }

    private async generateReminderNotifications(userId: string, prefs: NotificationPreference): Promise<void> {
        if (!prefs.remindersEnabled) return;

        const now = new Date();
        const horizon = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
        const oldest = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const tasks = await Task.find({ users: userId }).lean<Task[]>().exec();

        for (const task of tasks) {
            const leadMinutes = this.parseLeadMinutes(task.reminder);
            if (!leadMinutes) continue;

            const occurrences = this.getTaskOccurrences(task, oldest, horizon);
            for (const dueAt of occurrences) {
                const scheduledFor = new Date(dueAt.getTime() - leadMinutes * 60 * 1000);
                if (scheduledFor < oldest || scheduledFor > horizon) continue;

                const dedupeKey = `reminder:${userId}:${task.id}:${dueAt.toISOString()}:${leadMinutes}`;
                await this.upsertMessageByDedupe({
                    dedupeKey,
                    user: userId,
                    title: "Task Reminder",
                    body: `Upcoming: ${task.title}`,
                    type: "task-reminder",
                    scheduledFor,
                    ctaAction: "/tasks"
                });
            }
        }
    }

    private async generateSummaryNotifications(userId: string, prefs: NotificationPreference): Promise<void> {
        if (!prefs.summaryCadence || prefs.summaryCadence === "off") return;

        const nowUtc = new Date();
        const summaryAt = this.getScheduledUtcForNow(prefs, nowUtc);
        if (!summaryAt || nowUtc < summaryAt) return;

        if (prefs.summaryCadence === "daily") {
            const localNow = this.toLocalTime(nowUtc, prefs.utcOffsetMinutes ?? 0);
            const key = `daily:${userId}:${this.formatDateKey(localNow)}`;
            const todayCount = (await this.taskService.getTasksToday(userId)).length;

            await this.upsertMessageByDedupe({
                dedupeKey: key,
                user: userId,
                title: "Today in TidalTask",
                body: todayCount === 0
                    ? "Nothing is due today."
                    : `${todayCount} task${todayCount === 1 ? " is" : "s are"} due today.`,
                type: "daily-summary",
                scheduledFor: summaryAt,
                ctaAction: "/tasks"
            });

            return;
        }

        const localNow = this.toLocalTime(nowUtc, prefs.utcOffsetMinutes ?? 0);
        const weekStart = this.getWeekStart(localNow, prefs.weeklyDay ?? 1);
        const key = `weekly:${userId}:${this.formatDateKey(weekStart)}`;
        const weekCount = (await this.taskService.getTasksWeek(userId)).length;

        await this.upsertMessageByDedupe({
            dedupeKey: key,
            user: userId,
            title: "Weekly Outlook",
            body: weekCount === 0
                ? "No tasks due in the next 7 days."
                : `${weekCount} task${weekCount === 1 ? " is" : "s are"} due in the next 7 days.`,
            type: "weekly-summary",
            scheduledFor: summaryAt,
            ctaAction: "/calendar"
        });
    }

    private async upsertMessageByDedupe(options: {
        dedupeKey: string;
        user: string;
        title: string;
        body: string;
        type: NotificationMessage["type"];
        scheduledFor: Date;
        ctaAction?: string;
    }): Promise<void> {
        await NotificationMessage.findOneAndUpdate(
            { dedupeKey: options.dedupeKey },
            {
                $setOnInsert: {
                    dedupeKey: options.dedupeKey,
                    user: options.user,
                    title: options.title,
                    body: options.body,
                    type: options.type,
                    scheduledFor: options.scheduledFor,
                    deliveredAt: null,
                    ctaAction: options.ctaAction ?? ""
                }
            },
            { upsert: true, new: false }
        ).exec();
    }

    private parseLeadMinutes(value: string | undefined): number | null {
        if (!value) return null;
        const minutes = Number(value);
        if (!Number.isFinite(minutes) || minutes <= 0) return null;
        return Math.floor(minutes);
    }

    private getTaskOccurrences(task: Task, from: Date, to: Date): Date[] {
        const start = new Date(task.date);
        if (Number.isNaN(start.getTime()) || start.getTime() === 0) return [];

        const occurrences: Date[] = [];
        const max = 64;

        if (!task.repeater) {
            if (start >= from && start <= to) occurrences.push(start);
            return occurrences;
        }

        let effectiveTo = to;
        if (task.repeatEnd) {
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(task.repeatEnd);
            if (match) {
                const [, y, m, d] = match;
                const endOfDay = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999);
                if (endOfDay < effectiveTo) effectiveTo = endOfDay;
            }
        }

        let cursor = new Date(start);
        let attempts = 0;

        while (cursor < from && attempts < max * 4) {
            cursor = this.nextOccurrence(cursor, task.repeater || "");
            attempts++;
        }

        while (cursor <= effectiveTo && occurrences.length < max) {
            if (cursor >= from) occurrences.push(new Date(cursor));
            cursor = this.nextOccurrence(cursor, task.repeater || "");
        }

        return occurrences;
    }

    private nextOccurrence(date: Date, repeater: string): Date {
        const next = new Date(date);
        switch (repeater) {
            case "daily":
                next.setDate(next.getDate() + 1);
                break;
            case "weekly":
                next.setDate(next.getDate() + 7);
                break;
            case "bi-weekly":
                next.setDate(next.getDate() + 14);
                break;
            case "monthly":
                next.setMonth(next.getMonth() + 1);
                break;
            default:
                next.setDate(next.getDate() + 3650);
                break;
        }
        return next;
    }

    private getScheduledUtcForNow(prefs: NotificationPreference, nowUtc: Date): Date | null {
        const [rawHour, rawMinute] = (prefs.summaryTime || "08:00").split(":");
        const hour = Number(rawHour);
        const minute = Number(rawMinute);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

        const offset = prefs.utcOffsetMinutes ?? 0;
        const localNow = this.toLocalTime(nowUtc, offset);

        const localScheduled = new Date(localNow);
        localScheduled.setHours(hour, minute, 0, 0);

        if (prefs.summaryCadence === "weekly") {
            const day = prefs.weeklyDay ?? 1;
            if (localNow.getDay() !== day) return null;
        }

        return this.toUtcTime(localScheduled, offset);
    }

    private toLocalTime(dateUtc: Date, offsetMinutes: number): Date {
        return new Date(dateUtc.getTime() - offsetMinutes * 60 * 1000);
    }

    private toUtcTime(localDate: Date, offsetMinutes: number): Date {
        return new Date(localDate.getTime() + offsetMinutes * 60 * 1000);
    }

    private formatDateKey(date: Date): string {
        const y = date.getFullYear();
        const m = `${date.getMonth() + 1}`.padStart(2, "0");
        const d = `${date.getDate()}`.padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    private getWeekStart(localDate: Date, weekStartDay: number): Date {
        const start = new Date(localDate);
        const diff = (start.getDay() - weekStartDay + 7) % 7;
        start.setDate(start.getDate() - diff);
        start.setHours(0, 0, 0, 0);
        return start;
    }
}
