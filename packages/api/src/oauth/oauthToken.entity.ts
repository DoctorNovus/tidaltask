import { Entity, Model, Prop } from "@/_lib/mongoose";

@Entity({ timestamps: true })
export class OAuthToken extends Model {

    id: string;

    @Prop({ type: String, required: true, unique: true })
    accessTokenHash: string;

    @Prop({ type: String, unique: true, default: null })
    refreshTokenHash?: string | null;

    @Prop({ type: String, required: true })
    clientId: string;

    @Prop({ type: String, required: true })
    userId: string;

    @Prop({ type: String, default: "mcp" })
    scope: string;

    @Prop({ type: Date, required: true, index: true })
    accessTokenExpiresAt: Date;

    @Prop({ type: Date, required: true, index: true })
    refreshTokenExpiresAt: Date;

    @Prop({ type: Date, default: null })
    revokedAt?: Date | null;
}
