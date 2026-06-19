import { useMutation, useQuery, useQueryClient, UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { fetchData } from "@/utils/data";
import { SERVER_IP } from "@/hooks/app";
import { Capacitor } from "@capacitor/core";
import { Calendar } from "@/plugins/calendar";

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

export async function syncTaskToCalendar(taskId: string, title: string, date: string): Promise<string | null> {
    if (!isNative) return null;
    try {
        const { eventId } = await Calendar.syncTask({ taskId, title, date });
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
