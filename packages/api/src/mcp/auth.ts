import { User } from "@/user/user.entity";
import { DeviceToken } from "@/auth/deviceToken.entity";
import crypto from "crypto";

export interface McpAuthResult {
    userId: string;
    first: string;
}

export async function resolveBearer(authHeader: string | undefined): Promise<McpAuthResult | null> {
    const match = (authHeader ?? "").match(/^Bearer\s+(.+)$/i);
    if (!match) return null;

    const token = match[1].trim();
    if (!token) return null;

    const user = await User.findOne({
        $expr: {
            $in: [
                token,
                {
                    $map: {
                        input: { $objectToArray: { $ifNull: ["$apiKeys", {}] } },
                        as: "kv",
                        in: "$$kv.v",
                    },
                },
            ],
        },
    })
        .lean<User>()
        .exec();

    if (user) return { userId: user.id, first: user.first };

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const deviceToken = await DeviceToken.findOne({
        tokenHash,
        expiresAt: { $gt: new Date() },
    })
        .populate({ path: "user", select: "first id" })
        .lean<DeviceToken>()
        .exec();

    if (!deviceToken?.user) return null;

    const du = deviceToken.user as any;
    return { userId: du.id, first: du.first };
}
