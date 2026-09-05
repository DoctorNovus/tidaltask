import { User } from "@/user/user.entity";
import { DeviceToken } from "@/auth/deviceToken.entity";
import { OAuthToken } from "@/oauth/oauthToken.entity";
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

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
        $expr: {
            $in: [
                tokenHash,
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

    const oauthToken = await OAuthToken.findOne({
        accessTokenHash: tokenHash,
        accessTokenExpiresAt: { $gt: new Date() },
        revokedAt: null,
    }).lean<OAuthToken>().exec();

    if (oauthToken) {
        const oauthUser = await User.findById(oauthToken.userId).lean<User>().exec();
        if (oauthUser) return { userId: oauthUser.id, first: oauthUser.first };
    }

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
