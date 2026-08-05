import { Preferences } from "@capacitor/preferences";
import {
  useQueryClient,
  useQuery,
  useMutation,
  UseQueryResult,
  UseMutationResult,
  QueryClient,
} from "@tanstack/react-query";

import { Logger } from "@/utils/logger";

import { getSync } from "./settings";
import { fetchData } from "@/utils/data";
import { formatDateTime } from "@/utils/date";
import { reconcileDeviceCalendarSync } from "@/hooks/calendar";
import { reconcileTaskDueNotifications } from "@/utils/notifs";
import { reconcileAlarms } from "@/utils/alarmScheduler";

export type CountData = { count: number };

export interface Task {
  id?: string;
  title: string;
  description?: string;
  date: string | Date;
  done: boolean | string[];
  repeater?: string;
  /** "YYYY-MM-DD", inclusive last day the repeater occurs on. Empty/undefined means it never ends. */
  repeatEnd?: string;
  reminder?: string;
  type?: string;
  accordion?: boolean;
  priority?: number;
  users?: any[];
  tags: string[];
  group?: string;
  groupPublic?: boolean;
}

const normalizeTags = (tags?: Array<string | { title?: string; color?: string }>): string[] | undefined => {
  if (!Array.isArray(tags)) return undefined;

  const normalized = tags
    .map((tag) => {
      if (typeof tag === "string") return tag.trim().toLowerCase();
      if (tag && typeof tag.title === "string") return tag.title.trim().toLowerCase();
      return "";
    })
    .filter((tag) => tag.length > 0);

  return Array.from(new Set(normalized));
};

const normalizeTaskFromApi = (task: any): Task => ({
  ...task,
  tags: normalizeTags(task?.tags) ?? [],
  group: task?.group ? String(task.group).toLowerCase() : "",
});

const serializeTask = (task: Partial<Task>) => {
  const data: any = { ...task };
  if (task.date instanceof Date) {
    // Send null for "no due date" tasks (epoch sentinel) so the backend stores null
    // and we avoid 1969/1970 ghost dates from timezone-offset math.
    if (task.date.getTime() <= 0) {
      data.date = null;
    } else {
      // Send local time directly — no offset adjustment, which was double-applying
      // the timezone and shifting the date 5-6 hours early for US timezones.
      data.date = formatDateTime(task.date);
    }
  }
  const tags = normalizeTags(task.tags);
  if (tags !== undefined) data.tags = tags;
  return data;
};

export function createInitialTaskData(): Task {
  return {
    title: "",
    description: "",
    date: new Date(),
    done: false,
    repeater: "",
    repeatEnd: "",
    reminder: "",
    priority: 0,
    tags: [],
    group: ""
  };
}

export async function checkMigration(): Promise<void> {
  const synced = await getSync();
  if (!synced) await migrateTasks();
}

export async function migrateTasks(): Promise<void> {
  const { value } = await Preferences.get({ key: "tasks" });
  const tasks = JSON.parse(value ?? "[]");

  const response = await fetchData("/task/migrate", {
    method: "POST",
    body: tasks
  });

  const migration = await response.json();

  if (migration.isSynced) {
    Logger.log("Louding cloud data...");
    await Preferences.set({ key: "sync", value: "true" });
    await Preferences.set({ key: "tasks", value: JSON.stringify(migration.tasks) });
  }

  if (migration.sync) {
    Logger.log("Synced with the cloud.");
    await Preferences.set({ key: "sync", value: "true" });
  }
}

export function useMigrate() {
  return useMutation({
    mutationFn: checkMigration
  });
}

/* Filters out ghost tasks */
export function filterBroken(tasks: Task[]): Task[] {
  return tasks?.filter((task) => task.id != undefined);
}

/* Loads task array from Preferences database */
export async function loadTasks(): Promise<Task[]> {
  const response = await fetchData(`/task`, {});

  const raw = await response.json();
  if (!Array.isArray(raw)) return [];

  return raw.map(normalizeTaskFromApi);
}

/* Loads tasks and finds the task with given id */
export async function loadTaskById(id: string): Promise<Task | Partial<Task>> {
  const tasks = await loadTasks();
  const task = tasks.find((task) => task.id == id);

  if (!task) return {};
  return normalizeTaskFromApi(task);
}

/* returns query data */
export function useTasks(): UseQueryResult<Task[]> {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: loadTasks,
    staleTime: 1000 * 60 * 60,
  });
}

export async function getTasksToday(): Promise<CountData> {
  return await (await fetchData("/metrics/tasks/today", {})).json();
}

export function useTasksToday() {
  return useQuery({
    queryKey: ["tasks", "today"],
    queryFn: getTasksToday,
    staleTime: 1000 * 60 * 60
  });
}

export async function getTasksTomorrow(): Promise<CountData> {
  return await (await fetchData("/metrics/tasks/tomorrow", {})).json();
}

export function useTasksTomorrow(): UseQueryResult<CountData> {
  return useQuery({
    queryKey: ["tasks", "tomorrow"],
    queryFn: getTasksTomorrow,
    staleTime: 1000 * 60 * 60
  });
}

export async function getTasksWeek(): Promise<CountData> {
  return await (await fetchData("/metrics/tasks/week", {})).json();
}

export function useTasksWeek(): UseQueryResult<CountData> {
  return useQuery({
    queryKey: ["tasks", "week"],
    queryFn: getTasksWeek,
    staleTime: 1000 * 60 * 60
  });
}

export async function getTasksOverdue(): Promise<CountData> {
  return await (await fetchData("/metrics/tasks/overdue", {})).json();
}

export function useTasksOverdue(): UseQueryResult<CountData> {
  return useQuery({
    queryKey: ["tasks", "overdue"],
    queryFn: getTasksOverdue,
    staleTime: 1000 * 60 * 60
  });
}

export async function getTasksIncomplete(): Promise<Task[]> {
  const resp = await (await fetchData("/task/incomplete", {})).json();
  if (!Array.isArray(resp)) return [];
  return resp.map(normalizeTaskFromApi);
}

export function useTasksIncomplete(): UseQueryResult<Task[]> {
  return useQuery({
    queryKey: ["tasks", "incomplete"],
    queryFn: getTasksIncomplete,
    staleTime: 1000 * 60 * 60
  });
}

/* Return query data of tasks, and finds specific task from given id */
export function useTaskById(id: string): UseQueryResult {
  return useQuery({
    queryKey: ["tasks", id],
    queryFn: () => loadTaskById(id),
    staleTime: Infinity,
  });
}

/* Refetches tasks and pushes the fresh list to the device calendar (no-op unless enabled). */
async function refreshAndSyncCalendar(queryClient: QueryClient): Promise<void> {
  const tasks = await queryClient.fetchQuery({ queryKey: ["tasks"], queryFn: loadTasks, staleTime: 0 });
  // "incomplete" is a separately-cached query (used by Home's Upcoming Tasks) — invalidate it too so
  // completion changes show up there immediately instead of waiting out its own staleTime.
  await queryClient.invalidateQueries({ queryKey: ["tasks", "incomplete"] });
  await reconcileDeviceCalendarSync(tasks);
  await reconcileTaskDueNotifications(tasks);
  await reconcileAlarms();
}

/* Adds a task to the tasks database */
export function useAddTask(): UseMutationResult<Task, Error, Task, unknown> {
  const queryClient = useQueryClient();

  const mutationFn = async (task: Task) => {
    const response = await fetchData("/task", {
      method: "POST",
      body: serializeTask(task)
    });
    return normalizeTaskFromApi(await response.json());
  };

  const onSuccess = async () => {
    await refreshAndSyncCalendar(queryClient);
  };

  return useMutation({ mutationFn, onSuccess });
}

export async function addTasksBulk(tasks: Partial<Task>[]) {
  await fetchData("/task/bulk", {
    method: "POST",
    body: { tasks: tasks.map((t) => serializeTask(t)) }
  });
}

export function useAddTasksBulk(): UseMutationResult<void, Error, Partial<Task>[], unknown> {
  const queryClient = useQueryClient();

  const onSuccess = async () => {
    await refreshAndSyncCalendar(queryClient);
  };

  return useMutation({ mutationFn: addTasksBulk, onSuccess });
}

/* Updates specific task */
export function useUpdateTask(): UseMutationResult<
  void,
  Error,
  { id: string; data: Partial<Task> },
  unknown
> {
  const queryClient = useQueryClient();

  const mutationFn = async ({ data }: { id: string; data: Partial<Task> }) => {
    // Users are managed via dedicated invite/remove endpoints; omit them to avoid clobbering membership.
    const { users: _omitUsers, ...rest } = data ?? {};

    await fetchData("/task", {
      method: "PATCH",
      body: serializeTask(rest)
    });
  };

  const onSuccess = async () => {
    await refreshAndSyncCalendar(queryClient);
  };

  return useMutation({ mutationFn, onSuccess });
}

/* Delete specific task */
export function useDeleteTask(): UseMutationResult<void, Error, Task, unknown> {
  const queryClient = useQueryClient();

  const mutationFn = async (task: Task) => {
    await fetchData("/task", {
      method: "DELETE",
      body: task
    });
  };

  const onSuccess = async () => {
    await refreshAndSyncCalendar(queryClient);
  };

  return useMutation({ mutationFn, onSuccess });
}

export function useDeleteCompletedTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (olderThanDays?: number) => {
      const url = olderThanDays != null && olderThanDays > 0
        ? `/task/completed?olderThanDays=${olderThanDays}`
        : `/task/completed`;
      const response = await fetchData(url, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Failed to delete tasks.");
      return data as { deleted: number };
    },
    onSuccess: async () => {
      await refreshAndSyncCalendar(queryClient);
    },
  });
}

export async function getTaskUsers(id: string) {
  const resp = await fetchData(`/task/${id}/users`, {});

  if (resp.ok)
    return await resp.json();

  Logger.logError(await resp.text());
}

export function useTaskUsers(taskId: string) {
  return useQuery({
    queryKey: ["tasks", taskId, "users"],
    queryFn: () => getTaskUsers(taskId),
    staleTime: 1000 * 60 * 60
  });
}

export async function removeUser({ taskId, userEmail }: { taskId: string, userEmail: string }) {
  return await fetchData(`/task/${taskId}/users/${userEmail}/remove`, {
    method: "DELETE"
  });
}

export function useRemoveUser() {
  return useMutation({
    mutationFn: removeUser
  });
}
