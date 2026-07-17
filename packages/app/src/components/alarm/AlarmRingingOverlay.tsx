import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogPanel, Transition } from "@headlessui/react";
import { BellAlertIcon, CheckIcon, SpeakerXMarkIcon } from "@heroicons/react/24/solid";
import { Capacitor } from "@capacitor/core";

import { useAlarms, useDismissAlarm, useSnoozeAlarm } from "@/hooks/alarms";
import { useTasksIncomplete, useUpdateTask, Task } from "@/hooks/tasks";
import { completeTaskOccurrence } from "@/utils/taskCompletion";
import { stopNativeAlarmRinging } from "@/plugins/alarm";
import { reconcileAlarms, clearRingingGuard } from "@/utils/alarmScheduler";

const SNOOZE_OPTIONS = [5, 10, 15, 20, 25, 30];

/** Beep-pause-beep pattern via Web Audio (no sound asset needed), looped until stopped. */
class AlarmBeeper {
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  start(): void {
    this.stopped = false;
    const AudioContextCtor = window.AudioContext ?? (window as any).webkitAudioContext;
    this.context = new AudioContextCtor();
    this.playBeep();
  }

  private playBeep(): void {
    if (this.stopped || !this.context) return;

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.15;
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + 0.35);

    this.timer = setTimeout(() => this.playBeep(), 700);
  }

  isSuspended(): boolean {
    return this.context?.state === "suspended";
  }

  resume(): Promise<void> {
    return this.context?.resume() ?? Promise.resolve();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.context?.close().catch(() => {});
    this.context = null;
  }
}

interface AlarmRingingOverlayProps {
  alarmId: string | null;
  onClose: () => void;
}

export default function AlarmRingingOverlay({ alarmId, onClose }: AlarmRingingOverlayProps) {
  const queryClient = useQueryClient();
  const { data: alarms } = useAlarms();
  const alarm = useMemo(() => alarms?.find((a) => a.id === alarmId), [alarms, alarmId]);

  const { data: incompleteTasks } = useTasksIncomplete();
  const { mutate: updateTask } = useUpdateTask();
  const { mutateAsync: dismissAlarmAsync } = useDismissAlarm();
  const { mutateAsync: snoozeAlarmAsync } = useSnoozeAlarm();

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [soundBlocked, setSoundBlocked] = useState(false);
  const beeperRef = useRef<AlarmBeeper | null>(null);

  const isOpen = !!alarmId && !!alarm;

  const groupTasks = useMemo(() => {
    if (!alarm || alarm.scope !== "group") return [];
    return (incompleteTasks ?? []).filter(
      (t) => (t.group ?? "").trim().toLowerCase() === (alarm.group ?? "").trim().toLowerCase()
    );
  }, [alarm, incompleteTasks]);

  const singleTask = useMemo(() => {
    if (!alarm || alarm.scope !== "task") return undefined;
    return (incompleteTasks ?? []).find((t) => t.id === alarm.task);
  }, [alarm, incompleteTasks]);

  // Loop the alarm sound on web while the overlay is open; native platforms ring via
  // AlarmKit/AlarmManager independently of this component being mounted.
  useEffect(() => {
    if (!isOpen || Capacitor.getPlatform() !== "web") return;

    const beeper = new AlarmBeeper();
    beeperRef.current = beeper;
    beeper.start();
    setSoundBlocked(beeper.isSuspended());

    return () => {
      beeper.stop();
      beeperRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setCompletedIds(new Set());
    // useTasksIncomplete() has a long staleTime; force a fresh fetch so a task created
    // or completed just before the alarm fired is actually reflected in this checklist.
    queryClient.invalidateQueries({ queryKey: ["tasks", "incomplete"] });
  }, [isOpen]);

  if (!isOpen || !alarm) return null;

  const enableSound = () => {
    beeperRef.current?.resume().then(() => setSoundBlocked(false));
  };

  const stopRingingEverywhere = async () => {
    beeperRef.current?.stop();
    await stopNativeAlarmRinging(alarm.id);
  };

  const finish = async () => {
    clearRingingGuard(alarm.id);
    await reconcileAlarms();
    onClose();
  };

  const handleDismiss = async () => {
    await stopRingingEverywhere();
    await dismissAlarmAsync(alarm.id);
    await finish();
  };

  const handleSnooze = async (minutes: number) => {
    await stopRingingEverywhere();
    await snoozeAlarmAsync({ id: alarm.id, minutes });
    await finish();
  };

  const handleCompleteTask = async (task: Task) => {
    if (!task.id) return;
    completeTaskOccurrence(task, new Date(), updateTask);
    setCompletedIds((prev) => new Set(prev).add(task.id!));

    if (alarm.scope === "task") {
      await handleDismiss();
    }
  };

  return (
    <Transition show={isOpen}>
      <Dialog onClose={() => {}} className="fixed inset-0 z-200">
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-5">
          <DialogPanel className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl bg-silver-50 dark:bg-[#121720] p-6 text-center shadow-2xl">
            <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-linear-to-br from-accent-red-500 to-rose-500 text-white">
              <BellAlertIcon className="h-8 w-8" />
            </div>

            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-primary">
                {alarm.label || (alarm.scope === "task" ? "Task Alarm" : "Group Alarm")}
              </h2>
              {alarm.scope === "task" && (
                <p className="text-sm text-muted">{singleTask?.title ?? "Tap to see your task."}</p>
              )}
              {alarm.scope === "group" && (
                <p className="text-sm text-muted">
                  {alarm.group ? alarm.group.replace(/\b\w/g, (c) => c.toUpperCase()) : "Group"} needs attention.
                </p>
              )}
            </div>

            {soundBlocked && (
              <button
                type="button"
                onClick={enableSound}
                className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400"
              >
                <SpeakerXMarkIcon className="h-4 w-4" />
                Sound blocked — tap to enable
              </button>
            )}

            {alarm.scope === "task" && singleTask && (
              <button
                type="button"
                onClick={() => handleCompleteTask(singleTask)}
                className="w-full rounded-xl bg-linear-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-xs transition hover:-translate-y-px"
              >
                Mark Complete
              </button>
            )}

            {alarm.scope === "group" && (
              <div className="flex w-full flex-col gap-2 max-h-56 overflow-y-auto">
                {groupTasks.length === 0 && (
                  <p className="text-sm text-muted">No incomplete tasks in this group.</p>
                )}
                {groupTasks.map((task) => {
                  const done = !!task.id && completedIds.has(task.id);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => handleCompleteTask(task)}
                      disabled={done}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                        done
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-silver-200 text-primary hover:ring-2 hover:ring-accent-blue/30 dark:bg-[#253350]"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-accent-blue/40"
                        }`}
                      >
                        {done && <CheckIcon className="h-3.5 w-3.5" />}
                      </span>
                      <span className={done ? "line-through opacity-70" : ""}>{task.title}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex w-full flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Snooze</span>
              <div className="grid grid-cols-6 gap-1.5">
                {SNOOZE_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => handleSnooze(minutes)}
                    className="rounded-lg bg-silver-200 py-2 text-xs font-bold text-primary transition hover:ring-2 hover:ring-accent-blue/30 dark:bg-[#253350]"
                  >
                    {minutes}m
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full rounded-xl bg-silver-200 px-4 py-3 text-sm font-bold text-primary transition hover:ring-2 hover:ring-accent-red-500/30 dark:bg-[#253350]"
            >
              Dismiss
            </button>
          </DialogPanel>
        </div>
      </Dialog>
    </Transition>
  );
}
