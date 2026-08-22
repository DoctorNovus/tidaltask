import { Injectable } from "@outwalk/firefly";
import { BadRequest } from "@outwalk/firefly/errors";
import { User } from "./user.entity";
import bcrypt from "bcrypt";
import { Task } from "@/task/task.entity";
import { DeviceToken } from "@/auth/deviceToken.entity";
import { Passkey } from "@/auth/passkey.entity";
import { PasswordReset } from "@/auth/passwordReset.entity";
import { NotificationMessage } from "@/notification/notificationMessage.entity";
import { NotificationPreference } from "@/notification/notificationPreference.entity";
import { Announcement } from "@/announcement/announcement.entity";
import { Review } from "@/review/review.entity";
import { OAuthCode } from "@/oauth/oauthCode.entity";
import crypto from "crypto";
import mongoose from "mongoose";

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

        // The password schema path already has a `set` transform that hashes on
        // findByIdAndUpdate (Mongoose applies setters when casting update payloads),
        // so hashing it here too would bcrypt an already-bcrypted value.
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

    // Returns key names with masked values — never returns the actual key or its hash.
    async getApiKeys(id: string): Promise<Record<string, string>> {
        const user = await User.findById(id).select("apiKeys").lean<User>().exec();
        const keys = user?.apiKeys ?? {};
        return Object.fromEntries(Object.keys(keys).map((name) => [name, "••••••••"]));
    }

    async setApiKeys(id: string, apiKeys: Record<string, string>): Promise<Record<string, string>> {
        const hashed = Object.fromEntries(
            Object.entries(apiKeys).map(([name, value]) => [
                name,
                crypto.createHash("sha256").update(value).digest("hex"),
            ])
        );
        await User.findByIdAndUpdate(id, { apiKeys: hashed }).exec();
        return Object.fromEntries(Object.keys(hashed).map((name) => [name, "••••••••"]));
    }

    async generateApiKey(id: string, name: string): Promise<{ name: string; value: string; apiKeys: Record<string, string> }> {
        const user = await User.findById(id).select("apiKeys").lean<User>().exec();
        const existing = user?.apiKeys ?? {};
        const value = crypto.randomBytes(32).toString("hex");
        const hash = crypto.createHash("sha256").update(value).digest("hex");
        const nextKeys = { ...existing, [name]: hash };
        await User.findByIdAndUpdate(id, { apiKeys: nextKeys }).exec();
        const maskedKeys = Object.fromEntries(Object.keys(nextKeys).map((k) => [k, "••••••••"]));
        return { name, value, apiKeys: maskedKeys };
    }

    async exportUserData(id: string): Promise<Record<string, unknown>> {
        const user = await User.findById(id)
            .select("first last email createdAt updatedAt lastLoggedIn twoFactorEnabled synced")
            .lean<User>()
            .exec();

        const tasks = await Task.find({ users: id })
            .select("title description date done repeater repeatEnd reminder type priority group tags createdAt updatedAt")
            .lean()
            .exec();

        const notificationPrefs = await NotificationPreference.findOne({ user: id })
            .select("pushEnabled remindersEnabled summaryCadence summaryTime weeklyDay utcOffsetMinutes")
            .lean()
            .exec();

        const notifications = await NotificationMessage.find({ user: id })
            .select("title body type scheduledFor deliveredAt createdAt")
            .sort({ createdAt: -1 })
            .lean()
            .exec();

        const passkeys = await Passkey.find({ user: id })
            .select("label deviceType backedUp createdAt")
            .lean()
            .exec();

        const deviceTokens = await DeviceToken.find({ user: id })
            .select("label expiresAt createdAt")
            .lean()
            .exec();

        const reviews = await Review.find({ user: id })
            .select("rating message createdAt")
            .lean()
            .exec();

        return {
            exportedAt: new Date().toISOString(),
            profile: user,
            tasks,
            notificationPreferences: notificationPrefs,
            notificationHistory: notifications,
            passkeys,
            deviceTokens,
            reviews,
        };
    }

    async getCalendarToken(id: string): Promise<string | null> {
        const user = await User.findById(id).select("calendarToken").lean<User>().exec();
        return (user as any)?.calendarToken ?? null;
    }

    async rotateCalendarToken(id: string): Promise<string> {
        const token = crypto.randomBytes(32).toString("hex");
        await User.findByIdAndUpdate(id, { calendarToken: token }).exec();
        return token;
    }

    async getUserByCalendarToken(token: string): Promise<User | null> {
        return User.findOne({ calendarToken: token } as any).lean<User>().exec();
    }

    async deleteUserData(id: string): Promise<{ deletedUser: boolean; removedFromTasks: number; deletedTasks: number }> {
        // Cascade-delete / anonymize all records linked to this user before removing the account,
        // satisfying GDPR Art. 17 (right to erasure) and CCPA right-to-delete.

        // 1. Tasks: pull user from shared tasks, then remove tasks they owned alone.
        const pullResult = await Task.updateMany({ users: id }, { $pull: { users: id } }).exec();
        const cleanup = await Task.deleteMany({ users: { $size: 0 } }).exec();

        // 2. Auth records.
        await PasswordReset.deleteMany({ user: id }).exec();
        await DeviceToken.deleteMany({ user: id }).exec();
        await Passkey.deleteMany({ user: id }).exec();

        // 3. Notification records.
        await NotificationMessage.deleteMany({ user: id }).exec();
        await NotificationPreference.deleteOne({ user: id }).exec();

        // 4. OAuth codes still pending for this user.
        await OAuthCode.deleteMany({ userId: id }).exec();

        // 5. Announcement engagement: remove user's ObjectId from all viewedBy / clickedBy arrays.
        await (Announcement as any).updateMany(
            {},
            { $pull: { viewedBy: new mongoose.Types.ObjectId(id), clickedBy: new mongoose.Types.ObjectId(id) } }
        ).exec();

        // 6. Reviews: anonymize rather than delete (preserves aggregate feedback while removing PII).
        await Review.updateMany({ user: id }, { $unset: { userEmail: 1, user: 1 } }).exec();

        // 7. Active sessions: find and delete any session documents belonging to this user.
        //    Sessions are stored as JSON strings; we match on the serialized user id.
        const sessionCollection = mongoose.connection.collection("session");
        await sessionCollection.deleteMany({ session: { $regex: `"id":"${id}"` } });

        // 8. Finally, hard-delete the user document itself.
        const deleted = await User.findByIdAndDelete(id).lean<User>().exec();

        return {
            deletedUser: Boolean(deleted),
            removedFromTasks: pullResult.modifiedCount ?? 0,
            deletedTasks: cleanup.deletedCount ?? 0
        };
    }
}
