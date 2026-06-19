import { registerPlugin } from "@capacitor/core";

export interface CalendarPlugin {
  requestPermission(): Promise<{ granted: boolean }>;
  syncTask(options: {
    taskId: string;
    title: string;
    date: string;
  }): Promise<{ eventId: string }>;
  removeEvent(options: { taskId: string }): Promise<void>;
  clearTidalTaskEvents(): Promise<void>;
}

export const Calendar = registerPlugin<CalendarPlugin>("Calendar");
