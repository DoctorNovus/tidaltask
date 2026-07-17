import { Controller, Get, Inject, Middleware, Patch } from "@outwalk/firefly";
import { BadRequest, Unauthorized } from "@outwalk/firefly/errors";
import { Request } from "express";
import { session } from "@/_middleware/session";
import { UserService } from "@/user/user.service";
import { AdminService, AdminStats, AdminUserList, AdminUserSummary } from "./admin.service";

@Controller()
@Middleware(session)
export class AdminController {

    @Inject()
    adminService: AdminService;

    @Inject()
    userService: UserService;

    @Get("/stats")
    async getStats({ session }: Request): Promise<AdminStats> {
        await this.assertDeveloper(session.user.id);
        return this.adminService.getStats();
    }

    @Get("/users")
    async listUsers({ session, query }: Request): Promise<AdminUserList> {
        await this.assertDeveloper(session.user.id);

        const search = typeof query?.search === "string" ? query.search : "";
        const page = Number.parseInt(String(query?.page ?? "1"), 10) || 1;
        const limit = Number.parseInt(String(query?.limit ?? "25"), 10) || 25;

        return this.adminService.listUsers(search, page, limit);
    }

    @Patch("/users/:id/developer")
    async setDeveloper({ session, params, body }: Request): Promise<AdminUserSummary> {
        await this.assertDeveloper(session.user.id);
        if (!params?.id) throw new BadRequest("User id is required.");
        if (typeof body?.developer !== "boolean") throw new BadRequest("developer must be a boolean.");

        return this.adminService.setDeveloper(session.user.id, params.id, body.developer);
    }

    private async assertDeveloper(userId: string): Promise<void> {
        const user = await this.userService.getUserById(userId);
        if (!user?.developer) {
            throw new Unauthorized("Developer access required.");
        }
    }
}
