import { useApp } from "@/hooks/app";

import {
  Task,
  createInitialTaskData,
  useAddTask,
  useAddTasksBulk,
  useUpdateTask,
} from "@/hooks/tasks";

import { useSettings } from "@/hooks/settings";
import { createID } from "@/utils/id";
import { scheduleNotification } from "@/utils/notifs";
import { useAddAlarm } from "@/hooks/alarms";
import { reconcileAlarms } from "@/utils/alarmScheduler";
import { AlarmDraft, repeatDaysForTask, alarmTimeString } from "./(TaskInfoMenu)/Shared/TaskAlarmField";
import { formatDate } from "@/utils/date";

import {
  Dialog,
  DialogPanel,
  Transition,
} from "@headlessui/react";

import { Dispatch, SetStateAction, useEffect, useReducer, useRef, useState } from "react";


import MenuHeader from "./(TaskInfoMenu)/MenuHeader";
import MenuFields from "./(TaskInfoMenu)/MenuFields";
import MenuEdit from "./(TaskInfoMenu)/MenuEdit";
import MenuFooter from "./(TaskInfoMenu)/MenuFooter";
import { Logger } from "@/utils/logger";
import { CheckCircleIcon, PencilSquareIcon, SparklesIcon } from "@heroicons/react/24/solid";

interface TaskInfoMenuSettings {
  type?: string;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

export default function TaskInfoMenu({
  type,
  isOpen,
  setIsOpen,
}: TaskInfoMenuSettings) {
  const [appData, setAppData] = useApp();

  const [isDeleting, setIsDeleting] = useState(false);

  const reducer = (
    data: Record<string, any>,
    payload: Record<string, any>
  ) => ({ ...data, ...payload });

  const { mutate: addTask, mutateAsync: addTaskAsync } = useAddTask();
  const { mutateAsync: addTasksBulk } = useAddTasksBulk();
  const { mutate: updateTask } = useUpdateTask();
  const { mutateAsync: addAlarmFromDraft } = useAddAlarm();
  const [alarmDraft, setAlarmDraft] = useState<AlarmDraft | null>(null);
  const settings = useSettings();

  const getDefaultGroup = () => {
    const config = settings.data?.groupConfig ?? {};
    const defaults = Object.entries(config)
      .filter(([, c]) => c.isDefault)
      .sort(([, a], [, b]) => (a.order ?? Infinity) - (b.order ?? Infinity));
    return defaults[0]?.[0] ?? "";
  };

  const getDefaultDate = () => {
    const now = new Date();
    const selected = appData.activeDate ? new Date(appData.activeDate) : null;

    if (selected) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const selectedDay = new Date(selected);
      selectedDay.setHours(0, 0, 0, 0);

      const baseDate =
        selectedDay.getTime() === today.getTime()
          ? new Date(now.getTime() + 1000 * 60 * 60 * 24) // tomorrow
          : selected;

      baseDate.setHours(
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      );

      return baseDate;
    }

    const tomorrow = new Date(now.getTime() + 1000 * 60 * 60 * 24);
    tomorrow.setHours(
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds()
    );

    return tomorrow;
  };

  const initialData: Task = {
    ...createInitialTaskData(),
    id: createID(20),
    date: new Date(0),
    group: getDefaultGroup(),
  };

  const [tempData, setTempData] = useReducer(reducer, initialData);
  const [quickTasksInput, setQuickTasksInput] = useState("");
  const [isQuickAdd, setIsQuickAdd] = useState(false);
  const [toast, setToast] = useState<{ text: string; variant: "create" | "update" | "bulk" } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const quickLines = quickTasksInput
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const hasTitle = !!tempData.title?.trim();
  const isSubmitDisabled =
    type === "add" && isQuickAdd
      ? quickLines.length === 0
      : !hasTitle;

  useEffect(() => {
    if (!validationError) return;

    if ((isQuickAdd && quickLines.length > 0) || (!isQuickAdd && hasTitle)) {
      setValidationError(null);
    }
  }, [hasTitle, isQuickAdd, quickLines.length, validationError]);

  useEffect(() => {
    if (type !== "add") return;

    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    // Only reset the form when the dialog first opens, not on every activeDate
    // change (which was erasing the task name whenever the due date was edited).
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setTempData({
      ...createInitialTaskData(),
      id: createID(20),
      date: new Date(0),
      group: getDefaultGroup(),
    });
    setQuickTasksInput("");
    setIsQuickAdd(false);
    setAlarmDraft(null);
  }, [isOpen, appData.activeDate, settings.data]);

  if (type == "edit") {
    if (
      appData.activeTask?.id != undefined &&
      tempData.id != appData.activeTask?.id
    ) {
      setTempData({
        ...appData.activeTask,
        date: new Date(appData.activeTask?.date),
        tags: appData.activeTask.tags ?? [],
      });

      Logger.log("SET TEMP DATA", appData.activeTask);
    }
  }

  const createNotification = async (task: Task) => {
    if (!task || task.reminder == "") return;

    const setDate: Date = new Date(task.date);

    const second = 1000;
    const minute = second * 60;
    const hour = minute * 60;
    const day = hour * 24;

    switch (task.reminder) {
      case "15":
        setDate.setTime(setDate.getTime() - 15 * minute);
        break;

      case "30":
        setDate.setTime(setDate.getTime() - 30 * minute);
        break;

      case "45":
        setDate.setTime(setDate.getTime() - 45 * minute);
        break;

      case "60":
        setDate.setTime(setDate.getTime() - 1 * hour);
        break;

      case "120":
        setDate.setTime(setDate.getTime() - 2 * hour);
        break;

      case "720":
        setDate.setTime(setDate.getTime() - 12 * hour);
        break;

      case "1440":
        setDate.setTime(setDate.getTime() - 1 * day);
        break;
    }

    const notif = await scheduleNotification({
      id: Math.floor(Math.random() * 2147483647),
      title: "TidalTask: Do Your Task",
      body: `Task: ${task.title}`,
      schedule: {
        at: setDate,
      },
    });

    Logger.log("NOTIFI", notif);
  };

  const resetForm = () => {
    setTempData({
      ...createInitialTaskData(),
      id: undefined,
      date: new Date(0)
    });
    setQuickTasksInput("");
    setIsQuickAdd(false);
    setValidationError(null);
    setAlarmDraft(null);
    setAppData({ ...appData, activeTask: undefined });
    setIsOpen(false);
  };

  const showToast = (text: string, variant: "create" | "update" | "bulk") => {
    setToast({ text, variant });
    setTimeout(() => setToast(null), 2400);
  };

  const validateBeforeSubmit = (isQuickAddMode: boolean) => {
    if (isQuickAddMode) {
      if (quickLines.length === 0) {
        setValidationError("Add at least one task title.");
        return false;
      }

      setValidationError(null);
      return true;
    }

    if (!tempData.title || tempData.title.trim().length === 0) {
      setValidationError("Title is required.");
      return false;
    }

    setValidationError(null);
    return true;
  };

  const saveAll = () => {
    if (!tempData.title || tempData.title.trim().length === 0) {
      alert("Please add a task title.");
      return;
    }

    if (!validateBeforeSubmit(false)) return;

    const cleanedTask = {
      ...tempData,
      title: tempData.title.trim(),
    };

    updateTask({
      id: tempData.id,
      data: {
        ...cleanedTask,
      },
    });

    Logger.log("Data To Add", {
      tempData
    });

    showToast("Task updated", "update");
  };

  const submitForm = () => {
    if (type === "add" && isQuickAdd) {
      if (!validateBeforeSubmit(true)) return;

      const taskDate = tempData.date instanceof Date && tempData.date.getTime() > 0
        ? tempData.date
        : getDefaultDate();

      const payload = quickLines.map((title) => ({
        title,
        date: taskDate,
        done: false,
        repeater: "",
        reminder: "",
        priority: 0,
        tags: tempData.tags ?? [],
        group: tempData.group ?? "",
      }));

      addTasksBulk(payload).then(() => {
        showToast("Tasks added", "bulk");
        resetForm();
      });
      return;
    }

    if (type == "edit") {
      saveAll();
      resetForm();
      return;
    }

    if (!validateBeforeSubmit(false)) return;
    if (!tempData.title || tempData.title.trim().length === 0) {
      alert("Please add a task title.");
      return;
    }

    if (!tempData.id) tempData.id = createID(20);

    if (appData.storedDate) {
      setAppData({
        ...appData,
        activeDate: appData.storedDate,
        storedDate: undefined
      });
    }

    const cleanedTask = {
      ...tempData,
      title: tempData.title.trim(),
    } as Task;

    if (alarmDraft?.enabled) {
      addTaskAsync(cleanedTask).then(async (createdTask) => {
        if (!createdTask?.id) return;
        const when = alarmDraft.when;
        const repeatDays = repeatDaysForTask(cleanedTask.repeater, when);
        await addAlarmFromDraft({
          scope: "task",
          task: createdTask.id,
          time: alarmTimeString(when),
          repeatDays,
          date: repeatDays.length === 0 ? formatDate(when) : null,
          enabled: true,
        });
        await reconcileAlarms();
      });
    } else {
      addTask(cleanedTask);
    }

    createNotification(cleanedTask);

    showToast("Task created", "create");
    resetForm();
  };

  const ref = useRef(null);
  const wasOpenRef = useRef(false);

  return (
    <>
      <Transition
        show={isOpen}
        enter="transition-opacity duration-200 ease-out"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-150 ease-in"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Dialog
          onClose={() => resetForm()}
          initialFocus={ref}
          ref={ref}
          className="fixed inset-0 z-50"
        >
          {/* Desktop backdrop */}
          <div className="fixed inset-0 hidden md:block bg-slate-900/20 backdrop-blur-[1px]" aria-hidden="true" />

          {/* Mobile: full screen. Desktop: right-side panel */}
          <div className="fixed inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-[520px] flex h-full z-10">
            <DialogPanel className="flex flex-1 min-w-0 flex-col overflow-y-auto text-primary p-6 md:p-8 bg-silver-50 dark:bg-[#121720] md:border-l md:[box-shadow:-8px_0_40px_rgba(0,0,0,0.12)]" style={{ borderColor: "var(--surface-border)" }}>
              <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto md:max-w-none">
                <MenuHeader
                  type={type!}
                  isDeleting={isDeleting}
                  tempData={tempData as Task}
                />
                <MenuFields
                  type={type}
                  isDeleting={isDeleting}

                  tempData={tempData}
                  setTempData={setTempData}
                  quickTasksInput={quickTasksInput}
                  setQuickTasksInput={setQuickTasksInput}
                  isQuickAdd={isQuickAdd}
                  setIsQuickAdd={setIsQuickAdd}
                  appData={appData}
                  setAppData={setAppData}
                  validationError={validationError}
                  alarmDraft={alarmDraft}
                  setAlarmDraft={setAlarmDraft}
                />
                <MenuEdit
                  type={type!}
                  isDeleting={isDeleting}
                  setIsDeleting={setIsDeleting}
                  tempData={tempData as Task}
                  closeMenu={resetForm}
                />
                <MenuFooter
                  type={type}
                  isDeleting={isDeleting}

                  resetForm={resetForm}
                  submitForm={submitForm}
                  isSubmitDisabled={isSubmitDisabled}
                />
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      </Transition>
      <Transition
        show={!!toast}
        enter="transition duration-200 ease-out"
        enterFrom="translate-y-2 opacity-0"
        enterTo="translate-y-0 opacity-100"
        leave="transition duration-500 ease-in"
        leaveFrom="translate-y-0 opacity-100"
        leaveTo="translate-y-2 opacity-0"
      >
        <div className="pointer-events-none fixed inset-x-0 top-6 z-60 flex justify-center px-6">
          <div
            className={`pointer-events-auto flex items-center gap-4 w-full max-w-md rounded-2xl px-5 py-4 text-white shadow-2xl shadow-slate-900/30 ring-1 ring-slate-800/70 ${
              toast?.variant === "create"
                ? "bg-linear-to-r from-accent-blue-700 to-accent-blue-500"
                : toast?.variant === "update"
                  ? "bg-linear-to-r from-emerald-600 to-emerald-500"
                  : "bg-linear-to-r from-indigo-600 to-accent-blue-500"
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              {toast?.variant === "create" && <SparklesIcon className="h-5 w-5" />}
              {toast?.variant === "update" && <PencilSquareIcon className="h-5 w-5" />}
              {toast?.variant === "bulk" && <CheckCircleIcon className="h-5 w-5" />}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">{toast?.text}</span>
            </div>
          </div>
        </div>
      </Transition>
    </>
  );
}
