import { Injectable } from "@outwalk/firefly";
import { BadRequest, NotFound } from "@outwalk/firefly/errors";
import { Alarm } from "./alarm.entity";
import { Task } from "@/task/task.entity";

const SNOOZE_MINUTES = [5, 10, 15, 20, 25, 30];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface AlarmInput {
    scope?: "task" | "group";
    task?: string | null;
    group?: string;
    time?: string;
    repeatDays?: number[];
    date?: string | null;
    label?: string;
    sound?: string;
    enabled?: boolean;
}

@Injectable()
export class AlarmService {

    async getAlarmsForUser(userId: string): Promise<Alarm[]> {
        return Alarm.find({ user: userId }).sort({ time: 1 }).lean<Alarm[]>().exec();
    }

    async createAlarm(userId: string, input: AlarmInput): Promise<Alarm> {
        const scope = input.scope === "task" || input.scope === "group" ? input.scope : undefined;
        if (!scope) throw new BadRequest("scope must be 'task' or 'group'.");

        if (!input.time || !TIME_PATTERN.test(input.time)) {
            throw new BadRequest("time must be in HH:mm format.");
        }

        const repeatDays = this.validateRepeatDays(input.repeatDays);

        let task: string | undefined;
        let group = "";

        if (scope === "task") {
            if (!input.task) throw new BadRequest("task is required when scope is 'task'.");
            const owned = await Task.findOne({ _id: input.task, users: userId }).select("_id").lean().exec();
            if (!owned) throw new BadRequest("Task not found.");
            task = input.task;
        } else {
            group = (input.group ?? "").trim().toLowerCase();
            if (!group) throw new BadRequest("group is required when scope is 'group'.");
        }

        const created = await Alarm.create({
            user: userId,
            scope,
            task: task ?? null,
            group,
            time: input.time,
            repeatDays,
            date: repeatDays.length === 0 ? (input.date ?? null) : null,
            label: input.label?.trim() ?? "",
            sound: input.sound?.trim() || "default",
            enabled: input.enabled !== false,
        });

        // Non-lean documents don't carry the `id` virtual — re-fetch lean so callers
        // (and the client, which reads .id from the create response) get it consistently.
        return Alarm.findById(created._id).lean<Alarm>().exec() as Promise<Alarm>;
    }

    async updateAlarm(userId: string, id: string, input: AlarmInput): Promise<Alarm> {
        const alarm = await this.getOwnedAlarm(userId, id);

        if (input.time !== undefined) {
            if (!TIME_PATTERN.test(input.time)) throw new BadRequest("time must be in HH:mm format.");
            alarm.time = input.time;
        }

        if (input.repeatDays !== undefined) {
            alarm.repeatDays = this.validateRepeatDays(input.repeatDays);
        }

        if (input.date !== undefined) alarm.date = input.date;
        if (input.label !== undefined) alarm.label = input.label.trim();
        if (input.sound !== undefined) alarm.sound = input.sound.trim() || "default";
        if (input.enabled !== undefined) alarm.enabled = !!input.enabled;

        if (input.group !== undefined) {
            if (alarm.scope !== "group") throw new BadRequest("group can only be changed on a group-scoped alarm.");
            const group = input.group.trim().toLowerCase();
            if (!group) throw new BadRequest("group cannot be empty.");
            alarm.group = group;
        }

        await Alarm.updateOne({ _id: id }, {
            $set: {
                time: alarm.time,
                repeatDays: alarm.repeatDays,
                date: alarm.date,
                label: alarm.label,
                sound: alarm.sound,
                enabled: alarm.enabled,
                group: alarm.group,
            }
        }).exec();

        return (await Alarm.findById(id).lean<Alarm>().exec())!;
    }

    async deleteAlarm(userId: string, id: string): Promise<{ success: boolean }> {
        await this.getOwnedAlarm(userId, id);
        await Alarm.deleteOne({ _id: id }).exec();
        return { success: true };
    }

    async snoozeAlarm(userId: string, id: string, minutes: number): Promise<Alarm> {
        await this.getOwnedAlarm(userId, id);

        if (!SNOOZE_MINUTES.includes(minutes)) {
            throw new BadRequest(`minutes must be one of ${SNOOZE_MINUTES.join(", ")}.`);
        }

        const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);
        await Alarm.updateOne({ _id: id }, { $set: { snoozedUntil } }).exec();
        return (await Alarm.findById(id).lean<Alarm>().exec())!;
    }

    async dismissAlarm(userId: string, id: string): Promise<Alarm> {
        await this.getOwnedAlarm(userId, id);

        await Alarm.updateOne({ _id: id }, { $set: { snoozedUntil: null, lastFiredAt: new Date() } }).exec();
        return (await Alarm.findById(id).lean<Alarm>().exec())!;
    }

    private async getOwnedAlarm(userId: string, id: string): Promise<Alarm> {
        const alarm = await Alarm.findOne({ _id: id, user: userId }).lean<Alarm>().exec();
        if (!alarm) throw new NotFound("Alarm not found.");
        return alarm;
    }

    private validateRepeatDays(days: number[] | undefined): number[] {
        if (!Array.isArray(days)) return [];
        const cleaned = days.map((d) => Math.trunc(Number(d)));
        if (cleaned.some((d) => Number.isNaN(d) || d < 0 || d > 6)) {
            throw new BadRequest("repeatDays must contain values 0-6.");
        }
        return Array.from(new Set(cleaned)).sort();
    }
}
