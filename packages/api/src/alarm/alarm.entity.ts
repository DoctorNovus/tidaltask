import { Entity, Index, Model, Prop } from "@/_lib/mongoose";
import { User } from "@/user/user.entity";
import { Task } from "@/task/task.entity";

@Entity({ timestamps: true })
@Index({ user: 1, scope: 1 })
@Index({ user: 1, group: 1 })
export class Alarm extends Model {
    id: string;

    @Prop({ type: User, required: true })
    user: User | string;

    @Prop({ type: String, enum: ["task", "group"], required: true })
    scope: "task" | "group";

    @Prop({ type: Task, default: null })
    task?: Task | string | null;

    @Prop({ type: String, default: "" })
    group?: string;

    /** Local time-of-day the alarm rings at, "HH:mm" */
    @Prop({ type: String, required: true })
    time: string;

    /** 0 (Sun) - 6 (Sat); empty array means "one-time" (uses `date`) */
    @Prop({ type: [Number], default: [] })
    repeatDays: number[];

    /** One-time fire date ("YYYY-MM-DD"), only used when repeatDays is empty */
    @Prop({ type: String, default: null })
    date?: string | null;

    @Prop({ type: String, default: "" })
    label: string;

    @Prop({ type: String, default: "default" })
    sound: string;

    @Prop({ type: Boolean, default: true })
    enabled: boolean;

    @Prop({ type: Date, default: null })
    snoozedUntil?: Date | null;

    @Prop({ type: Date, default: null })
    lastFiredAt?: Date | null;
}
