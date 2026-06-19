import { Entity, Model, Prop } from "@/_lib/mongoose";
import bcrypt from "bcrypt";

@Entity({ timestamps: true })
export class User extends Model {

    id: string;

    @Prop({ type: String, required: true })
    first: string;

    @Prop({ type: String, required: true })
    last: string;

    @Prop({ type: String, required: true, set: (value: string) => String(value ?? "").trim().toLowerCase() })
    email: string;

    @Prop({ type: String, select: false, set: (value) => bcrypt.hashSync(value, 10) })
    password: string;

    @Prop({ type: Boolean, default: false })
    developer: boolean;

    @Prop({ type: Boolean, default: false })
    synced: boolean;

    @Prop({ type: Date, default: null })
    lastLoggedIn?: Date;

    @Prop({ type: [String], default: [], select: false })
    readAnnouncementIds?: string[];

    @Prop({ type: Object, default: {}, select: false })
    apiKeys?: Record<string, string>;

    @Prop({ type: Boolean, default: false })
    twoFactorEnabled: boolean;

    @Prop({ type: String, select: false })
    twoFactorSecret?: string;

    @Prop({ type: [String], select: false })
    twoFactorBackupCodes?: string[];

    @Prop({ type: String, select: false })
    calendarToken?: string;
}
