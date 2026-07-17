import { Injectable } from "@outwalk/firefly";
import { BadRequest } from "@outwalk/firefly/errors";
import { User } from "@/user/user.entity";
import { Task } from "@/task/task.entity";
import { Announcement } from "@/announcement/announcement.entity";

export interface AdminStats {
    totalUsers: number;
    newUsersLast7Days: number;
    activeUsersLast7Days: number;
    developerUsers: number;
    totalTasks: number;
    repeatingTasks: number;
    activeAnnouncements: number;
}

export interface AdminUserSummary {
    id: string;
    first: string;
    last: string;
    email: string;
    developer: boolean;
    synced: boolean;
    twoFactorEnabled: boolean;
    lastLoggedIn: Date | null;
    createdAt: Date | null;
}

export interface AdminUserList {
    users: AdminUserSummary[];
    total: number;
    page: number;
    limit: number;
}

@Injectable()
export class AdminService {

    private escapeRegex(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    async getStats(): Promise<AdminStats> {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            newUsersLast7Days,
            activeUsersLast7Days,
            developerUsers,
            totalTasks,
            repeatingTasks,
            activeAnnouncements,
        ] = await Promise.all([
            User.countDocuments({}).exec(),
            User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }).exec(),
            User.countDocuments({ lastLoggedIn: { $gte: sevenDaysAgo } }).exec(),
            User.countDocuments({ developer: true }).exec(),
            Task.countDocuments({}).exec(),
            Task.countDocuments({ repeater: { $nin: [null, ""] } }).exec(),
            Announcement.countDocuments({ active: true }).exec(),
        ]);

        return {
            totalUsers,
            newUsersLast7Days,
            activeUsersLast7Days,
            developerUsers,
            totalTasks,
            repeatingTasks,
            activeAnnouncements,
        };
    }

    async listUsers(search: string, page: number, limit: number): Promise<AdminUserList> {
        const safePage = Math.max(1, page);
        const safeLimit = Math.min(100, Math.max(1, limit));
        const term = search.trim();

        const filter = term
            ? {
                $or: [
                    { first: { $regex: this.escapeRegex(term), $options: "i" } },
                    { last: { $regex: this.escapeRegex(term), $options: "i" } },
                    { email: { $regex: this.escapeRegex(term), $options: "i" } },
                ],
            }
            : {};

        const [users, total] = await Promise.all([
            User.find(filter)
                .sort({ createdAt: -1 })
                .skip((safePage - 1) * safeLimit)
                .limit(safeLimit)
                .lean<AdminUserSummary[]>()
                .exec(),
            User.countDocuments(filter).exec(),
        ]);

        return {
            users: users.map((u: any) => ({
                id: u.id,
                first: u.first,
                last: u.last,
                email: u.email,
                developer: !!u.developer,
                synced: !!u.synced,
                twoFactorEnabled: !!u.twoFactorEnabled,
                lastLoggedIn: u.lastLoggedIn ?? null,
                createdAt: u.createdAt ?? null,
            })),
            total,
            page: safePage,
            limit: safeLimit,
        };
    }

    async setDeveloper(actingUserId: string, targetUserId: string, developer: boolean): Promise<AdminUserSummary> {
        if (!developer && actingUserId === targetUserId) {
            throw new BadRequest("You can't remove your own developer access.");
        }

        const updated = await User.findByIdAndUpdate(targetUserId, { developer }, { new: true }).lean<any>().exec();
        if (!updated) throw new BadRequest("User not found.");

        return {
            id: updated.id,
            first: updated.first,
            last: updated.last,
            email: updated.email,
            developer: !!updated.developer,
            synced: !!updated.synced,
            twoFactorEnabled: !!updated.twoFactorEnabled,
            lastLoggedIn: updated.lastLoggedIn ?? null,
            createdAt: updated.createdAt ?? null,
        };
    }
}
