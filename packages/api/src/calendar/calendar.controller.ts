import { Controller, Delete, Get, Inject, Middleware, Post } from "@outwalk/firefly";
import { Unauthorized } from "@outwalk/firefly/errors";
import { UserService } from "@/user/user.service";
import { TaskService } from "@/task/task.service";
import { Task } from "@/task/task.entity";
import { session } from "@/_middleware/session";
import { Request, Response } from "express";

/* ── ICS helpers ── */

function icsEscape(text: string): string {
    return String(text ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n|\r\n/g, "\\n");
}

function icsLine(key: string, value: string): string {
    const line = `${key}:${value}`;
    if (line.length <= 75) return line;
    let result = line.slice(0, 75);
    let rest = line.slice(75);
    while (rest.length > 0) {
        result += "\r\n " + rest.slice(0, 74);
        rest = rest.slice(74);
    }
    return result;
}

function taskHasTime(dateStr: string): boolean {
    const d = new Date(dateStr);
    return d.getHours() !== 0 || d.getMinutes() !== 0;
}

function formatIcsDate(dateStr: string): string | null {
    const d = new Date(dateStr);
    if (isNaN(d.getTime()) || d.getTime() <= 0) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
}

function formatIcsDateTime(dateStr: string): string | null {
    const d = new Date(dateStr);
    if (isNaN(d.getTime()) || d.getTime() <= 0) return null;
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${y}${mo}${day}T${h}${mi}${s}`;
}

function nextIcsDate(icsDate: string): string {
    const y = parseInt(icsDate.slice(0, 4), 10);
    const m = parseInt(icsDate.slice(4, 6), 10) - 1;
    const d = parseInt(icsDate.slice(6, 8), 10);
    const next = new Date(y, m, d + 1);
    return `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}${String(next.getDate()).padStart(2, "0")}`;
}

function nextIcsDateTime(dateStr: string): string | null {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setHours(d.getHours() + 1);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${y}${mo}${day}T${h}${mi}${s}`;
}

function repeaterToRrule(repeater: string, repeatEnd?: string, timed?: boolean): string | null {
    let rule: string;
    switch (repeater) {
        case "daily":      rule = "RRULE:FREQ=DAILY"; break;
        case "weekly":     rule = "RRULE:FREQ=WEEKLY"; break;
        case "bi-weekly":  rule = "RRULE:FREQ=WEEKLY;INTERVAL=2"; break;
        case "monthly":    rule = "RRULE:FREQ=MONTHLY"; break;
        case "6-monthly":  rule = "RRULE:FREQ=MONTHLY;INTERVAL=6"; break;
        case "yearly":     rule = "RRULE:FREQ=YEARLY"; break;
        default:           return null;
    }

    if (repeatEnd) {
        // UNTIL must match DTSTART's value type: a bare DATE for all-day events,
        // a UTC DATE-TIME (trailing Z) when the task has a specific time.
        const until = timed
            ? formatIcsDateTime(`${repeatEnd}T23:59:59`)
            : formatIcsDate(repeatEnd);
        if (until) rule += `;UNTIL=${until}${timed ? "Z" : ""}`;
    }

    return rule;
}

function generateIcs(tasks: Task[], calName: string): string {
    const stamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";

    const events = tasks
        .filter(task => {
            // Exclude non-repeating tasks that are done.
            // Repeating tasks are always included — their RRULE handles recurrence.
            if (!task.repeater && task.done === true) return false;
            return Boolean(task.date);
        })
        .map(task => {
            const taskId = (task as any)._id?.toString() ?? (task as any).id;
            if (!taskId) return null;

            const timed = taskHasTime(task.date as string);
            const rrule = task.repeater ? repeaterToRrule(task.repeater, task.repeatEnd, timed) : null;

            const alarms = timed ? [
                "BEGIN:VALARM",
                "TRIGGER:PT0S",
                "ACTION:DISPLAY",
                icsLine("DESCRIPTION", icsEscape(task.title)),
                "END:VALARM",
                "BEGIN:VALARM",
                "TRIGGER:-PT1H",
                "ACTION:DISPLAY",
                icsLine("DESCRIPTION", icsEscape(task.title)),
                "END:VALARM",
            ] : [];

            let dtstart: string;
            let dtend: string;

            if (timed) {
                const dt = formatIcsDateTime(task.date as string);
                const dtNext = nextIcsDateTime(task.date as string);
                if (!dt || !dtNext) return null;
                dtstart = icsLine("DTSTART", dt);
                dtend = icsLine("DTEND", dtNext);
            } else {
                const d = formatIcsDate(task.date as string);
                if (!d) return null;
                dtstart = icsLine("DTSTART;VALUE=DATE", d);
                dtend = icsLine("DTEND;VALUE=DATE", nextIcsDate(d));
            }

            const lines = [
                "BEGIN:VEVENT",
                icsLine("UID", `task-${taskId}@tidaltask.app`),
                dtstart,
                dtend,
                icsLine("SUMMARY", icsEscape(task.title)),
                ...(rrule ? [rrule] : []),
                ...(task.description?.trim() ? [icsLine("DESCRIPTION", icsEscape(task.description))] : []),
                icsLine("DTSTAMP", stamp),
                ...(task.priority ? [`PRIORITY:${Math.max(1, Math.min(9, 9 - task.priority))}`] : []),
                ...alarms,
                "END:VEVENT",
            ];
            return lines.join("\r\n");
        })
        .filter(Boolean);

    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TidalTask//TidalTask//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        icsLine("X-WR-CALNAME", calName),
        "X-WR-TIMEZONE:UTC",
        ...events,
        "END:VCALENDAR",
    ].join("\r\n");
}

/* ── Controller ── */

@Controller()
export class CalendarController {

    @Inject()
    userService: UserService;

    @Inject()
    taskService: TaskService;

    /* ICS feed — token-authenticated, no session cookie needed */
    @Get("/:token/tasks.ics")
    async getIcs(req: Request, res: Response): Promise<void> {
        const token = req.params?.token as string;
        if (!token) throw new Unauthorized("Missing calendar token.");

        const user = await this.userService.getUserByCalendarToken(token);
        if (!user) throw new Unauthorized("Invalid calendar token.");

        const tasks = await this.taskService.getTasksByUserId(String((user as any)._id ?? user.id));
        const ics = generateIcs(tasks, `${user.first}'s Tasks`);

        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=\"tasks.ics\"");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.send(ics);
    }

    /* GET /calendar/token — returns the current token (generates one if absent) */
    @Middleware(session)
    @Get("/token")
    async getToken({ session: sess }: Request): Promise<{ token: string }> {
        let token = await this.userService.getCalendarToken(sess.user.id);
        if (!token) token = await this.userService.rotateCalendarToken(sess.user.id);
        return { token };
    }

    /* POST /calendar/token — rotates (regenerates) the token */
    @Middleware(session)
    @Post("/token")
    async rotateToken({ session: sess }: Request): Promise<{ token: string }> {
        const token = await this.userService.rotateCalendarToken(sess.user.id);
        return { token };
    }

    /* DELETE /calendar/token — removes the token (disables the feed) */
    @Middleware(session)
    @Delete("/token")
    async deleteToken({ session: sess }: Request): Promise<{ disabled: boolean }> {
        await this.userService.updateUser(sess.user.id, { calendarToken: undefined } as any);
        return { disabled: true };
    }
}
