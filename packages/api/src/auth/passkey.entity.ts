import { Entity, Model, Prop, Index } from "@/_lib/mongoose";
import { User } from "@/user/user.entity";

@Entity({ timestamps: true })
@Index({ credentialId: 1 }, { unique: true })
export class Passkey extends Model {

    id: string;

    @Prop({ type: User, required: true })
    user: User;

    @Prop({ type: String, required: true })
    credentialId: string;

    @Prop({ type: String, required: true })
    publicKey: string;

    @Prop({ type: Number, required: true, default: 0 })
    counter: number;

    @Prop({ type: String })
    deviceType?: string;

    @Prop({ type: Boolean, default: false })
    backedUp: boolean;

    @Prop({ type: [String] })
    transports?: string[];

    @Prop({ type: String, default: "Passkey" })
    label?: string;
}
