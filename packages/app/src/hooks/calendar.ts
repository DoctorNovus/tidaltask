import { useMutation, useQuery, useQueryClient, UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { fetchData } from "@/utils/data";
import { SERVER_IP } from "@/hooks/app";
import { Capacitor } from "@capacitor/core";
import { Calendar, DeviceCalendarEvent } from "@/plugins/calendar";
import { getSettings } from "@/hooks/settings";
import type { Task } from "@/hooks/tasks";

export type { DeviceCalendarEvent };

/* ── API helpers ── */

async function getCalendarToken(): Promise<string | null> {
    const response = await fetchData("/calendar/token", {});
    if (!response.ok) return null;
    const data = await response.json();
    return data?.token ?? null;
}

async function rotateCalendarToken(): Promise<string> {
    const response = await fetchData("/calendar/token", { method: "POST" });
    if (!response.ok) throw new Error("Failed to generate calendar link.");
    const data = await response.json();
    return data.token;
}

async function deleteCalendarToken(): Promise<void> {
    await fetchData("/calendar/token", { method: "DELETE" });
}

/* ── Hooks ── */

export function useCalendarToken(): UseQueryResult<string | null> {
    return useQuery({
        queryKey: ["calendar", "token"],
        queryFn: getCalendarToken,
        staleTime: Infinity,
    });
}

export function useRotateCalendarToken(): UseMutationResult<string, Error, void> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: rotateCalendarToken,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar", "token"] }),
    });
}

export function useDeleteCalendarToken(): UseMutationResult<void, Error, void> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteCalendarToken,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar", "token"] }),
    });
}

export function buildIcsUrl(token: string): string {
    return `${SERVER_IP}/calendar/${token}/tasks.ics`;
}

/* ── EventKit (iOS native calendar) ── */

export const isNative = Capacitor.isNativePlatform();

export async function requestCalendarPermission(): Promise<boolean> {
    if (!isNative) return false;
    const { granted } = await Calendar.requestPermission();
    return granted;
}

export async function syncTaskToCalendar(taskId: string, title: string, date: string, description?: string): Promise<string | null> {
    if (!isNative) return null;
    try {
        const { eventId } = await Calendar.syncTask({ taskId, title, date, description });
        return eventId;
    } catch {
        return null;
    }
}

export async function removeTaskFromCalendar(taskId: string): Promise<void> {
    if (!isNative) return;
    try {
        await Calendar.removeEvent({ taskId });
    } catch {
        // silently ignore if event doesn't exist
    }
}

export async function clearAllTidalTaskEvents(): Promise<void> {
    if (!isNative) return;
    await Calendar.clearTidalTaskEvents();
}

const hasSyncableDueDate = (task: Task): boolean => {
    const d = new Date(task.date);
    // Treat epoch (no due date) as unscheduled — mirrors occursOnDate's guard in utils/data.ts.
    return !Number.isNaN(d.getTime()) && d.getFullYear() >= 2000;
};

/**
 * Rebuilds the device calendar's TidalTask events from scratch to match the current task
 * list. The EventKit plugin only supports one event per task (anchored on its `date`
 * field), so repeating tasks — which can have many pending occurrences — are skipped here.
 */
export async function reconcileDeviceCalendarSync(tasks: Task[]): Promise<void> {
    if (!isNative) return;
    const settings = await getSettings();
    if (!settings.deviceCalendarSyncEnabled) return;

    await clearAllTidalTaskEvents();

    const eligible = tasks.filter(
        (task) => task.id && !task.repeater && task.done !== true && hasSyncableDueDate(task)
    );

    for (const task of eligible) {
        // Round-trip through Date so the instant matches exactly what the rest of the
        // app (e.g. the Calendar page's hasTime/formatTime) already resolves task.date to.
        const date = new Date(task.date).toISOString();
        await syncTaskToCalendar(task.id!, task.title, date, task.description);
    }
}

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

export function useDeviceCalendarEvents(start: Date, end: Date, enabled: boolean): UseQueryResult<DeviceCalendarEvent[]> {
    return useQuery({
        queryKey: ["calendar", "device-events", dayKey(start), dayKey(end)],
        queryFn: async () => {
            const { events } = await Calendar.getEvents({ start: dayKey(start), end: dayKey(end) });
            return events;
        },
        enabled: isNative && enabled,
        staleTime: 5 * 60 * 1000,
    });
}
