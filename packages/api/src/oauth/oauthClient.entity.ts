import { Entity, Model, Prop } from "@/_lib/mongoose";

@Entity({ timestamps: true })
export class OAuthClient extends Model {

    id: string;

    @Prop({ type: String, required: true, unique: true })
    clientId: string;

    @Prop({ type: String, required: true })
    clientName: string;

    @Prop({ type: [String], default: [] })
    redirectUris: string[];

    @Prop({ type: [String], default: ["authorization_code"] })
    grantTypes: string[];

    @Prop({ type: String, default: "none" })
    tokenEndpointAuthMethod: string;

    @Prop({ type: String, default: "mcp" })
    scope: string;
}
