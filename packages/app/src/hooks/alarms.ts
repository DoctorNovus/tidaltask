import {
  useQueryClient,
  useQuery,
  useMutation,
  UseQueryResult,
  UseMutationResult,
} from "@tanstack/react-query";

import { fetchData } from "@/utils/data";

export type AlarmScope = "task" | "group";

export interface Alarm {
  id: string;
  scope: AlarmScope;
  task?: string | null;
  group?: string;
  time: string; // "HH:mm"
  repeatDays: number[]; // 0 (Sun) - 6 (Sat); [] = one-time
  date?: string | null;
  label?: string;
  sound?: string;
  enabled: boolean;
  snoozedUntil?: string | null;
  lastFiredAt?: string | null;
}

export type AlarmInput = Partial<Omit<Alarm, "id" | "snoozedUntil" | "lastFiredAt">>;

const normalizeAlarmFromApi = (alarm: any): Alarm => ({
  ...alarm,
  task: alarm?.task ? String(typeof alarm.task === "object" ? alarm.task.id ?? alarm.task._id : alarm.task) : null,
  group: alarm?.group ? String(alarm.group).toLowerCase() : "",
  repeatDays: Array.isArray(alarm?.repeatDays) ? alarm.repeatDays : [],
});

export async function loadAlarms(): Promise<Alarm[]> {
  const response = await fetchData("/alarm", {});
  const raw = await response.json();
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeAlarmFromApi);
}

export function useAlarms(): UseQueryResult<Alarm[]> {
  return useQuery({
    queryKey: ["alarms"],
    queryFn: loadAlarms,
    staleTime: 1000 * 60,
  });
}

export function useAddAlarm(): UseMutationResult<Alarm, Error, AlarmInput, unknown> {
  const queryClient = useQueryClient();

  const mutationFn = async (alarm: AlarmInput) => {
    const response = await fetchData("/alarm", { method: "POST", body: alarm });
    return normalizeAlarmFromApi(await response.json());
  };

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alarms"] });
    },
  });
}

export function useUpdateAlarm(): UseMutationResult<
  Alarm,
  Error,
  { id: string; data: AlarmInput },
  unknown
> {
  const queryClient = useQueryClient();

  const mutationFn = async ({ id, data }: { id: string; data: AlarmInput }) => {
    const response = await fetchData(`/alarm/${id}`, { method: "PATCH", body: data });
    return normalizeAlarmFromApi(await response.json());
  };

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alarms"] });
    },
  });
}

export function useDeleteAlarm(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();

  const mutationFn = async (id: string) => {
    await fetchData(`/alarm/${id}`, { method: "DELETE" });
  };

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alarms"] });
    },
  });
}

export async function snoozeAlarm(id: string, minutes: number): Promise<Alarm> {
  const response = await fetchData(`/alarm/${id}/snooze`, { method: "POST", body: { minutes } });
  return normalizeAlarmFromApi(await response.json());
}

export function useSnoozeAlarm(): UseMutationResult<Alarm, Error, { id: string; minutes: number }, unknown> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, minutes }) => snoozeAlarm(id, minutes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alarms"] });
    },
  });
}

export async function dismissAlarm(id: string): Promise<Alarm> {
  const response = await fetchData(`/alarm/${id}/dismiss`, { method: "POST" });
  return normalizeAlarmFromApi(await response.json());
}

export function useDismissAlarm(): UseMutationResult<Alarm, Error, string, unknown> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => dismissAlarm(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alarms"] });
    },
  });
}
