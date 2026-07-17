import { fetchData } from "@/utils/data";
import { Preferences } from "@capacitor/preferences";
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from "@tanstack/react-query";

export interface GroupConfig {
  displayName?: string;
  order?: number;
  visible?: boolean;
  visibleWhenEmpty?: boolean;
  isDefault?: boolean;
  excludeFromUpcoming?: boolean;
}

export interface Settings {
  lastNotification?: number;
  lastNoTasksDueNotificationAt?: number;
  hasRemindedToday?: boolean;
  sendDailyReminders?: boolean;
  sendDailyRemindersOverride?: boolean;
  sendDailyRemindersTime?: string;
  deliveredServerNotificationIds?: string[];
  groupsActive?: string[];
  apiKeys?: Record<string, string>;
  groupConfig?: Record<string, GroupConfig>;
  autoDeleteCompletedDays?: number;
  lastAutoDeleteAt?: number;
  showDeviceCalendarEvents?: boolean;
  deviceCalendarSyncEnabled?: boolean;
  notifyAtTaskTime?: boolean;
  scheduledDueNotificationTaskIds?: string[];
}

/* Gets the settings from the database */
export async function getSettings(): Promise<Settings> {
  const { value } = await Preferences.get({ key: "settings" });
  return value ? JSON.parse(value) : {};
}

/* Sets the settings from the database */
export async function setSettings(settings: Settings): Promise<void> {
  return await Preferences.set({
    key: "settings",
    value: JSON.stringify(settings),
  });
}

export function useSettings(): UseQueryResult<Settings> {
  return useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: Infinity
  });
}

export function useUpdateSettings(): UseMutationResult<void, Error, Partial<Settings>, unknown> {
  const queryClient = useQueryClient();

  const mutationFn = async (data: Partial<Settings>) => {
    const settings = await getSettings();
    await Preferences.set({ key: "settings", value: JSON.stringify({ ...settings, ...data }) });
  };

  const onSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
  }

  return useMutation({ mutationFn, onSuccess });
}

export async function getSync() {
  return await (await fetchData("/user/synced", {})).json()
}

export async function setSync(syncMode: boolean): Promise<void> {
  return await Preferences.set({
    key: "sync",
    value: new String(syncMode).valueOf(),
  });
}

export function useSync() {
  return useQuery({
    queryKey: ["sync"],
    queryFn: getSync,
    staleTime: Infinity
  })
}
