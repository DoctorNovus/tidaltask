import { Controller, Delete, Get, Inject, Middleware, Patch, Post } from "@outwalk/firefly";
import { BadRequest } from "@outwalk/firefly/errors";
import { UserService } from "@/user/user.service";
import { TaskService } from "./task.service";
import { User } from "@/user/user.entity";
import { Task } from "./task.entity";
import { session } from "@/_middleware/session";
import { Request } from "express";

@Controller()
@Middleware(session)
export class TaskController {

    @Inject()
    userService: UserService;

    @Inject()
    taskService: TaskService;

    @Get()
    async getTasks({ session, query }: Request): Promise<Task[]> {
        const tagsQuery = Array.isArray(query?.tags)
            ? query.tags
            : typeof query?.tags === "string"
                ? query.tags.split(",")
                : [];

        const tags = tagsQuery
            .flatMap((tag) => tag.toString().split(","))
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);

        return this.taskService.getTasksByUserId(session.user.id, tags as string[]);
    }

    @Get("/:id/users")
    async getUsers({ params }: Request): Promise<User[] | null> {
        if (!params || !params.id) return null;
        return this.taskService.getUsersByTaskId(params.id);
    }


    @Get("/today")
    async getTasksToday({ session }: Request): Promise<Task[]> {
        return this.taskService.getTasksToday(session.user.id);
    }

    @Get("/tomorrow")
    async getTasksTomorrow({ session }: Request): Promise<Task[]> {
        return this.taskService.getTasksTomorrow(session.user.id);
    }

    @Get("/week")
    async getTasksWeek({ session }: Request): Promise<Task[]> {
        return this.taskService.getTasksWeek(session.user.id);
    }

    @Get("/overdue")
    async getTasksOverdue({ session }: Request): Promise<Task[]> {
        return this.taskService.getTasksOverdue(session.user.id);
    }

    @Get("/incomplete")
    async getTasksIncomplete({ session }: Request): Promise<Task[]> {
        return this.taskService.getTasksIncomplete(session.user.id);
    }

    @Post()
    async addTask({ session, body }: Request): Promise<Task> {
        return this.taskService.addTask({ ...body, users: [session.user.id] });
    }

    @Post("/bulk")
    async addTasks({ session, body }: Request): Promise<Task[]> {
        const tasks = Array.isArray(body?.tasks) ? body.tasks : [];
        const mapped = tasks.map((task: Task) => ({
            ...task,
            users: [session.user.id],
            date: task.date ? task.date : new Date().toString(),
        }));

        return this.taskService.addTasks(mapped);
    }

    @Patch()
    async updateTask({ body }: Request): Promise<Task | null> {
        return this.taskService.updateTask(body.id, body);
    }

    @Delete()
    async deleteTask({ body }: Request): Promise<Task | null> {
        return this.taskService.deleteTask(body.id);
    }

    @Delete("/completed")
    async deleteCompletedTasks({ session, query }: Request): Promise<{ deleted: number }> {
        const raw = typeof query.olderThanDays === "string" ? parseInt(query.olderThanDays, 10) : undefined;
        const olderThanDays = raw != null && !isNaN(raw) && raw > 0 ? raw : undefined;
        return this.taskService.deleteCompletedTasks(session.user.id, olderThanDays);
    }

    @Post("/invite")
    async inviteUser({ session, body }: Request): Promise<{ success: boolean }> {
        const user = await this.userService.getUserByEmail(body.email);
        if (!user) throw new BadRequest("User does not exist.");
        if (user.id == session.user.id) throw new BadRequest("Cannot add yourself.");

        await this.taskService.updateTask(body.task.id, { $push: { users: user.id } });
        return { success: true };
    }

    @Delete("/:id/users/:email/remove")
    async removeUser({ session, params }: Request): Promise<{ success: boolean }> {
        const user = await this.userService.getUserByEmail(params.email);
        if (!user) throw new BadRequest("User does not exist.");
        if (user.id == session.user.id) throw new BadRequest("Cannot delete yourself.");

        await this.taskService.updateTask(params.id, { $pull: { users: user.id } });
        return { success: true };
    }
}
