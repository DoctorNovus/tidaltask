import { BellAlertIcon } from "@heroicons/react/24/solid";
import { useAlarms, useAddAlarm, useUpdateAlarm, useDeleteAlarm, Alarm } from "@/hooks/alarms";
import { reconcileAlarms } from "@/utils/alarmScheduler";
import { formatDate, formatDateTime, getHoursHH, getMinutesMM } from "@/utils/date";
import DateTimePicker from "./DateTimePicker";

export interface AlarmDraft {
  enabled: boolean;
  when: Date;
}

/** Weekday repeat cadence an Alarm can model; other task repeaters (monthly and up) fall back to a one-time alarm on the picked date. */
export function repeatDaysForTask(repeater: string | undefined, when: Date): number[] {
  if (repeater === "daily") return [0, 1, 2, 3, 4, 5, 6];
  if (repeater === "weekly" || repeater === "bi-weekly") return [when.getDay()];
  return [];
}

/** "HH:mm" in LOCAL time — never toISOString(), which converts to UTC and can silently shift the calendar day/hour. */
export function alarmTimeString(date: Date): string {
  return `${getHoursHH(date)}:${getMinutesMM(date)}`;
}

function defaultWhen(taskDate: Date): Date {
  if (taskDate.getTime() > 0) return taskDate;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

interface TaskAlarmFieldProps {
  /** Set once the task is persisted (edit mode); the field manages its own Alarm CRUD. */
  taskId?: string;
  taskDate: Date;
  taskRepeater?: string;
  /** Add-task mode only: no task id exists yet, so the parent holds the draft until the task is created. */
  draft?: AlarmDraft | null;
  onDraftChange?: (draft: AlarmDraft | null) => void;
}

export default function TaskAlarmField({ taskId, taskDate, taskRepeater, draft, onDraftChange }: TaskAlarmFieldProps) {
  const { data: alarms } = useAlarms();
  const { mutateAsync: addAlarm } = useAddAlarm();
  const { mutateAsync: updateAlarm } = useUpdateAlarm();
  const { mutateAsync: deleteAlarm } = useDeleteAlarm();

  const existing: Alarm | undefined = taskId
    ? alarms?.find((a) => a.scope === "task" && a.task === taskId)
    : undefined;

  const enabled = taskId ? !!existing : !!draft?.enabled;

  const existingWhen = (): Date => {
    if (!existing) return defaultWhen(taskDate);
    const [hours, minutes] = existing.time.split(":").map(Number);
    const base = existing.date ? new Date(`${existing.date}T00:00:00`) : new Date(defaultWhen(taskDate));
    base.setHours(hours, minutes, 0, 0);
    return base;
  };

  const when = taskId ? existingWhen() : draft?.when ?? defaultWhen(taskDate);

  const handleToggle = async (next: boolean) => {
    if (!taskId) {
      onDraftChange?.(next ? { enabled: true, when } : null);
      return;
    }

    if (!next) {
      if (existing) {
        await deleteAlarm(existing.id);
        await reconcileAlarms();
      }
      return;
    }

    const repeatDays = repeatDaysForTask(taskRepeater, when);
    await addAlarm({
      scope: "task",
      task: taskId,
      time: alarmTimeString(when),
      repeatDays,
      date: repeatDays.length === 0 ? formatDate(when) : null,
      enabled: true,
    });
    await reconcileAlarms();
  };

  const handleWhenChange = async (nextWhen: Date) => {
    if (!taskId) {
      onDraftChange?.({ enabled: true, when: nextWhen });
      return;
    }

    if (existing) {
      const repeatDays = repeatDaysForTask(taskRepeater, nextWhen);
      await updateAlarm({
        id: existing.id,
        data: {
          time: alarmTimeString(nextWhen),
          repeatDays,
          date: repeatDays.length === 0 ? formatDate(nextWhen) : null,
        },
      });
      await reconcileAlarms();
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <label className="text-sm font-semibold text-primary flex items-center gap-1.5">
          <BellAlertIcon className="h-4 w-4 text-accent-blue" />
          Alarm
        </label>
        <button
          type="button"
          onClick={() => handleToggle(!enabled)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            enabled
              ? "bg-accent-blue text-white"
              : "bg-silver-200 text-primary ring-1 ring-accent-blue/20 hover:ring-accent-blue/40 dark:bg-[#253350]"
          }`}
        >
          {enabled ? "On" : "Off"}
        </button>
      </div>

      {enabled && (
        <DateTimePicker
          value={formatDateTime(when)}
          onChange={(val) => handleWhenChange(new Date(val))}
        />
      )}
    </div>
  );
}
