import { Injectable } from "@outwalk/firefly";
import { BadRequest } from "@outwalk/firefly/errors";
import { User } from "./user.entity";
import bcrypt from "bcrypt";
import { Task } from "@/task/task.entity";
import crypto from "crypto";

@Injectable()
export class UserService {

    private normalizeEmail(email: string): string {
        return String(email ?? "").trim().toLowerCase();
    }

    private escapeRegex(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    private emailQuery(email: string): { $regex: string; $options: string } {
        const normalized = this.normalizeEmail(email);
        return { $regex: `^${this.escapeRegex(normalized)}$`, $options: "i" };
    }

    async createUser(data: Partial<User>): Promise<User> {
        const email = this.normalizeEmail(data.email as string);
        if (!email) {
            throw new BadRequest("Email is required.");
        }

        if (await User.exists({ email: this.emailQuery(email) }).exec()) {
            throw new BadRequest("Email Already Exists.");
        }

        return User.create({ ...data, email });
    }

    async getUserById(id: string): Promise<User | null> {
        return User.findById(id).lean<User>().exec();
    }

    async getUserByEmail(email: string): Promise<User | null> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return null;
        return User.findOne({ email: this.emailQuery(normalized) }).lean<User>().exec();
    }

    async touchLastLoggedIn(id: string): Promise<void> {
        await User.findByIdAndUpdate(id, { lastLoggedIn: new Date() }).exec();
    }

    async getReadAnnouncementIds(id: string): Promise<string[]> {
        const user = await User.findById(id).select("readAnnouncementIds").lean<User>().exec();
        return (user?.readAnnouncementIds ?? []).map((value) => String(value));
    }

    async markAnnouncementsRead(id: string, announcementIds: string[]): Promise<string[]> {
        const ids = announcementIds
            .map((value) => value?.trim())
            .filter((value) => Boolean(value)) as string[];

        if (!ids.length) {
            return this.getReadAnnouncementIds(id);
        }

        await User.findByIdAndUpdate(id, {
            $addToSet: { readAnnouncementIds: { $each: ids } }
        }).exec();

        return this.getReadAnnouncementIds(id);
    }

    async updateUser(id: string, data: Partial<User>): Promise<User | null> {
        const nextData = { ...data } as any;
        if (typeof nextData.email === "string") {
            nextData.email = this.normalizeEmail(nextData.email);
        }
        if (typeof nextData.password === "string") {
            nextData.password = bcrypt.hashSync(nextData.password, 10);
        }

        return User.findByIdAndUpdate(id, nextData).lean<User>().exec();
    }

    async emailInUse(email: string, excludeId?: string): Promise<boolean> {
        const normalized = this.normalizeEmail(email);
        if (!normalized) return false;

        const query: any = { email: this.emailQuery(normalized) };
        if (excludeId) query._id = { $ne: excludeId };
        return Boolean(await User.exists(query).exec());
    }

    async validatePassword(id: string, password: string): Promise<boolean> {
        const user = await User.findById(id).select("password").lean<User>().exec();
        if (!user?.password) return false;
        return bcrypt.compare(password, user.password);
    }

    async changePassword(id: string, current: string, next: string): Promise<User | null> {
        const valid = await this.validatePassword(id, current);
        if (!valid) {
            throw new BadRequest("Current password is incorrect.");
        }

        return this.updateUser(id, { password: next });
    }

    async getApiKeys(id: string): Promise<Record<string, string>> {
        const user = await User.findById(id).select("apiKeys").lean<User>().exec();
        return user?.apiKeys ?? {};
    }

    async setApiKeys(id: string, apiKeys: Record<string, string>): Promise<Record<string, string>> {
        await User.findByIdAndUpdate(id, { apiKeys }).exec();
        return apiKeys;
    }

    async generateApiKey(id: string, name: string): Promise<{ name: string; value: string; apiKeys: Record<string, string> }> {
        const user = await User.findById(id).select("apiKeys").lean<User>().exec();
        const apiKeys = user?.apiKeys ?? {};
        const value = crypto.randomBytes(32).toString("hex");
        const nextKeys = { ...apiKeys, [name]: value };
        await User.findByIdAndUpdate(id, { apiKeys: nextKeys }).exec();
        return { name, value, apiKeys: nextKeys };
    }

    private sanitizeUser(user: any) {
        if (!user) return null;
        const { first, last, email, createdAt, updatedAt } = user;
        return { first, last, email, createdAt, updatedAt };
    }

    private sanitizeTask(task: any) {
        if (!task) return null;
        const {
            title,
            description,
            date,
            done,
            repeater,
            reminder,
            type,
            accordion,
            priority,
            group,
            tags,
            id
        } = task;
        return {
            id,
            title,
            description,
            date,
            done,
            repeater,
            reminder,
            type,
            accordion,
            priority,
            group,
            tags
        };
    }

    async exportUserData(id: string): Promise<{ user: any; tasks: any[] }> {
        const user = this.sanitizeUser(await this.getUserById(id));
        const tasksRaw = await Task.find({ users: id }).lean().exec();
        const tasks = tasksRaw.map((t) => this.sanitizeTask(t)).filter(Boolean);
        return { user, tasks };
    }

    async deleteUserData(id: string): Promise<{ deletedUser: boolean; removedFromTasks: number; deletedTasks: number }> {
        const pullResult = await Task.updateMany({ users: id }, { $pull: { users: id } }).exec();
        const cleanup = await Task.deleteMany({ users: { $size: 0 } }).exec();
        const deleted = await User.findByIdAndDelete(id).lean<User>().exec();

        return {
            deletedUser: Boolean(deleted),
            removedFromTasks: pullResult.modifiedCount ?? 0,
            deletedTasks: cleanup.deletedCount ?? 0
        };
    }
}
