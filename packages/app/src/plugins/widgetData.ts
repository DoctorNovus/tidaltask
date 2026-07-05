import { registerPlugin } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";

export interface WidgetTask {
    id: string;
    title: string;
    date?: string;
    priority?: number;
}

export interface WidgetDataPayload {
    todayCount: number;
    overdueCount: number;
    totalIncomplete: number;
    completedToday: number;
    upcomingTasks: WidgetTask[];
    lastUpdated: string;
}

export interface WidgetDataPlugin {
    update(options: { data: WidgetDataPayload }): Promise<void>;
}

const WidgetData = registerPlugin<WidgetDataPlugin>("WidgetData");

export async function pushWidgetData(payload: WidgetDataPayload): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
    try {
        await WidgetData.update({ data: payload });
    } catch {
        // Non-fatal: widget data is best-effort
    }
}
