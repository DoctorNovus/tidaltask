import { Controller, Get, Inject, Middleware, Patch, Post } from "@outwalk/firefly";
import { UserService } from "./user.service";
import { session } from "@/_middleware/session";
import { Request } from "express";
import { User } from "./user.entity";
import { BadRequest } from "@outwalk/firefly/errors";
import sendToWebhook from "@/logging/webhook";

@Controller()
@Middleware(session)
export class UserController {

    @Inject()
    userService: UserService;

    @Get()
    async getUser({ session }: Request): Promise<User | null> {
        await this.userService.touchLastLoggedIn(session.user.id);
        return this.userService.getUserById(session.user.id);
    }

    @Patch()
    async updateName({ session, body }: Request): Promise<User | null> {
        const { first, last, email } = body ?? {};

        if (!first && !last && !email) {
            throw new BadRequest("No profile fields provided.");
        }

        if (email && await this.userService.emailInUse(email, session.user.id)) {
            throw new BadRequest("Email already in use.");
        }

        return this.userService.updateUser(session.user.id, { first, last, email });
    }

    @Patch("/password")
    async changePassword({ session, body }: Request): Promise<User | null> {
        const { currentPassword, newPassword } = body ?? {};

        if (!currentPassword || !newPassword) {
            throw new BadRequest("Current and new passwords are required.");
        }

        return this.userService.changePassword(session.user.id, currentPassword, newPassword);
    }

    @Get("/export")
    async exportData({ session }: Request): Promise<Record<string, unknown>> {
        const data = await this.userService.exportUserData(session.user.id);
        await sendToWebhook({
            embeds: [
                {
                    title: "User Data Exported",
                    description: `User **${session.user.id}** exported their data.`,
                    timestamp: new Date()
                }
            ]
        });
        return data;
    }

    @Post("/delete")
    async deleteData({ session }: Request): Promise<{ deletedUser: boolean; removedFromTasks: number; deletedTasks: number }> {
        const result = await this.userService.deleteUserData(session.user.id);
        await sendToWebhook({
            embeds: [
                {
                    title: "User Requested Deletion",
                    description: `User **${session.user.id}** requested account deletion. Removed from ${result.removedFromTasks} tasks; deleted ${result.deletedTasks} tasks.`,
                    timestamp: new Date()
                }
            ]
        });
        // Destroy the session immediately after account deletion.
        await new Promise<void>((resolve) => session.destroy(() => resolve()));
        return result;
    }

    @Get("/synced")
    async getSynced({ session }: Request): Promise<boolean> {
        const user = await this.userService.getUserById(session.user.id);
        return user?.synced ?? false;
    }

    @Get("/api-keys")
    async getApiKeys({ session }: Request): Promise<{ apiKeys: Record<string, string> }> {
        const apiKeys = await this.userService.getApiKeys(session.user.id);
        return { apiKeys };
    }

    @Patch("/api-keys")
    async updateApiKeys({ session, body }: Request): Promise<{ apiKeys: Record<string, string> }> {
        const apiKeys = body?.apiKeys;
        if (!apiKeys || typeof apiKeys !== "object" || Array.isArray(apiKeys)) {
            throw new BadRequest("apiKeys must be an object.");
        }

        for (const [name, value] of Object.entries(apiKeys)) {
            if (typeof name !== "string" || !name.trim()) {
                throw new BadRequest("API key names must be non-empty strings.");
            }
            if (typeof value !== "string" || !value.trim()) {
                throw new BadRequest("API key values must be non-empty strings.");
            }
        }

        const saved = await this.userService.setApiKeys(session.user.id, apiKeys);
        return { apiKeys: saved };
    }

    @Post("/api-keys/generate")
    async generateApiKey({ session, body }: Request): Promise<{ name: string; value: string }> {
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        if (!name) {
            throw new BadRequest("API key name is required.");
        }

        const { value } = await this.userService.generateApiKey(session.user.id, name);
        return { name, value };
    }
}
