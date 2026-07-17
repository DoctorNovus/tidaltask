import { Controller, Delete, Get, Inject, Middleware, Patch, Post } from "@outwalk/firefly";
import { BadRequest } from "@outwalk/firefly/errors";
import { Request } from "express";
import { session } from "@/_middleware/session";
import { AlarmService } from "./alarm.service";
import { Alarm } from "./alarm.entity";

@Controller()
@Middleware(session)
export class AlarmController {

    @Inject()
    alarmService: AlarmService;

    @Get()
    async getAlarms({ session }: Request): Promise<Alarm[]> {
        return this.alarmService.getAlarmsForUser(session.user.id);
    }

    @Post()
    async createAlarm({ session, body }: Request): Promise<Alarm> {
        return this.alarmService.createAlarm(session.user.id, body ?? {});
    }

    @Patch("/:id")
    async updateAlarm({ session, params, body }: Request): Promise<Alarm> {
        return this.alarmService.updateAlarm(session.user.id, params.id, body ?? {});
    }

    @Delete("/:id")
    async deleteAlarm({ session, params }: Request): Promise<{ success: boolean }> {
        return this.alarmService.deleteAlarm(session.user.id, params.id);
    }

    @Post("/:id/snooze")
    async snoozeAlarm({ session, params, body }: Request): Promise<Alarm> {
        const minutes = Number(body?.minutes);
        if (!Number.isFinite(minutes)) throw new BadRequest("minutes is required.");
        return this.alarmService.snoozeAlarm(session.user.id, params.id, minutes);
    }

    @Post("/:id/dismiss")
    async dismissAlarm({ session, params }: Request): Promise<Alarm> {
        return this.alarmService.dismissAlarm(session.user.id, params.id);
    }
}
