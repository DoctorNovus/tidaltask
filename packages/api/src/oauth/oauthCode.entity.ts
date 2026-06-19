import { Entity, Model, Prop } from "@/_lib/mongoose";

@Entity({ timestamps: true })
export class OAuthCode extends Model {

    id: string;

    @Prop({ type: String, required: true, unique: true })
    code: string;

    @Prop({ type: String, required: true })
    clientId: string;

    @Prop({ type: String, required: true })
    userId: string;

    @Prop({ type: String, required: true })
    redirectUri: string;

    @Prop({ type: String, required: true })
    codeChallenge: string;

    @Prop({ type: String, default: "S256" })
    codeChallengeMethod: string;

    @Prop({ type: String, default: "mcp" })
    scope: string;

    @Prop({ type: Date, required: true, expires: 0 })
    expiresAt: Date;

    @Prop({ type: Boolean, default: false })
    used: boolean;
}
