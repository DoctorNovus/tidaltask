import { registerPlugin } from "@capacitor/core";

export interface DeviceCalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  calendarTitle: string;
  color: string;
}

export interface CalendarPlugin {
  requestPermission(): Promise<{ granted: boolean }>;
  syncTask(options: {
    taskId: string;
    title: string;
    date: string;
    description?: string;
  }): Promise<{ eventId: string }>;
  removeEvent(options: { taskId: string }): Promise<void>;
  clearTidalTaskEvents(): Promise<void>;
  getEvents(options: { start: string; end: string }): Promise<{ events: DeviceCalendarEvent[] }>;
}

export const Calendar = registerPlugin<CalendarPlugin>("Calendar");
