import { BellAlertIcon } from "@heroicons/react/24/solid";
import { useAlarms, useAddAlarm, useUpdateAlarm, useDeleteAlarm } from "@/hooks/alarms";
import { reconcileAlarms } from "@/utils/alarmScheduler";

const WEEKDAYS = [
  { label: "S", value: 0 },
  { label: "M", value: 1 },
  { label: "T", value: 2 },
  { label: "W", value: 3 },
  { label: "T", value: 4 },
  { label: "F", value: 5 },
  { label: "S", value: 6 },
];

interface GroupAlarmFieldProps {
  group: string;
}

/** One alarm shared by every task in this group — rings once, independent of any single task's due date. */
export default function GroupAlarmField({ group }: GroupAlarmFieldProps) {
  const { data: alarms } = useAlarms();
  const { mutateAsync: addAlarm } = useAddAlarm();
  const { mutateAsync: updateAlarm } = useUpdateAlarm();
  const { mutateAsync: deleteAlarm } = useDeleteAlarm();

  const alarm = alarms?.find((a) => a.scope === "group" && a.group === group);
  const enabled = !!alarm;

  const handleToggle = async (next: boolean) => {
    if (!next) {
      if (alarm) await deleteAlarm(alarm.id);
    } else {
      await addAlarm({
        scope: "group",
        group,
        time: "09:00",
        repeatDays: [1, 2, 3, 4, 5],
        enabled: true,
      });
    }
    await reconcileAlarms();
  };

  const handleTimeChange = async (time: string) => {
    if (!alarm) return;
    await updateAlarm({ id: alarm.id, data: { time } });
    await reconcileAlarms();
  };

  const toggleDay = async (day: number) => {
    if (!alarm) return;
    const repeatDays = alarm.repeatDays.includes(day)
      ? alarm.repeatDays.filter((d) => d !== day)
      : [...alarm.repeatDays, day];
    await updateAlarm({ id: alarm.id, data: { repeatDays } });
    await reconcileAlarms();
  };

  return (
    <div className="flex flex-col gap-2 pl-8">
      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <div
          onClick={() => handleToggle(!enabled)}
          className={`relative w-8 h-4 rounded-full transition cursor-pointer ${enabled ? "bg-accent-blue" : "bg-slate-300 dark:bg-slate-600"}`}
        >
          <div className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
        </div>
        <span className="text-xs text-muted select-none flex items-center gap-1">
          <BellAlertIcon className="h-3.5 w-3.5" />
          Group alarm
        </span>
      </label>

      {enabled && alarm && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="time"
            value={alarm.time}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="px-2 py-1 rounded-lg border border-accent-blue/20 bg-silver-200 dark:bg-[#253350] text-xs text-primary shadow-inner focus:border-accent-blue focus:outline-none"
          />
          <div className="flex gap-1">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={`h-6 w-6 rounded-full text-[10px] font-bold transition ${
                  alarm.repeatDays.includes(day.value)
                    ? "bg-accent-blue text-white"
                    : "bg-silver-200 text-muted dark:bg-[#253350]"
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
