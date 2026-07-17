import { Capacitor } from "@capacitor/core";
import { TrashIcon, BellAlertIcon } from "@heroicons/react/24/solid";
import { useAlarms, useUpdateAlarm, useDeleteAlarm, Alarm } from "@/hooks/alarms";
import { useTasks } from "@/hooks/tasks";
import { reconcileAlarms } from "@/utils/alarmScheduler";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function repeatSummary(alarm: Alarm): string {
  if (alarm.repeatDays.length === 0) return alarm.date ? `Once, ${alarm.date}` : "Once";
  if (alarm.repeatDays.length === 7) return "Every day";
  return alarm.repeatDays.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

export default function AlarmSettings() {
  const { data: alarms, isLoading } = useAlarms();
  const { data: tasks } = useTasks();
  const { mutateAsync: updateAlarm } = useUpdateAlarm();
  const { mutateAsync: deleteAlarm } = useDeleteAlarm();

  const label = (alarm: Alarm): string => {
    if (alarm.label) return alarm.label;
    if (alarm.scope === "task") {
      const task = tasks?.find((t) => t.id === alarm.task);
      return task?.title ?? "Task alarm";
    }
    return alarm.group ? `${alarm.group.replace(/\b\w/g, (c) => c.toUpperCase())} (group)` : "Group alarm";
  };

  const handleToggle = async (alarm: Alarm) => {
    await updateAlarm({ id: alarm.id, data: { enabled: !alarm.enabled } });
    await reconcileAlarms();
  };

  const handleDelete = async (alarm: Alarm) => {
    await deleteAlarm(alarm.id);
    await reconcileAlarms();
  };

  return (
    <div className="flex flex-col gap-3">
      {Capacitor.getPlatform() === "web" && (
        <p className="text-xs text-muted">
          On the web, alarms only sound while TidalTask is open in this browser tab. Install the app or keep a tab open to make sure you don't miss one.
        </p>
      )}

      {isLoading && <p className="text-sm text-muted">Loading alarms…</p>}
      {!isLoading && (alarms?.length ?? 0) === 0 && (
        <p className="text-sm text-muted">No alarms yet. Add one from a task or a group.</p>
      )}

      {alarms?.map((alarm) => (
        <div
          key={alarm.id}
          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 bg-silver-200 dark:bg-[#253350]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <BellAlertIcon className={`h-5 w-5 shrink-0 ${alarm.enabled ? "text-accent-blue" : "text-slate-400"}`} />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-primary truncate">{label(alarm)}</span>
              <span className="text-xs text-muted">{alarm.time} · {repeatSummary(alarm)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleToggle(alarm)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                alarm.enabled
                  ? "bg-accent-blue text-white"
                  : "ring-1 ring-accent-blue/20 text-primary hover:ring-accent-blue/40"
              }`}
            >
              {alarm.enabled ? "On" : "Off"}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(alarm)}
              className="rounded-lg p-1.5 text-slate-400 hover:text-accent-red-500 hover:bg-accent-red-500/10 transition"
              aria-label="Delete alarm"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
