import { formatDate, formatDateTime } from "@/utils/date";
import TaskInfoMenuItem from "./Shared/TaskInfoMenuItem";
import DateTimePicker from "./Shared/DateTimePicker";
import TaskInfoMenuUser from "./Shared/TaskInfoUser/TaskInfoMenuUser";
import TaskInfoMenuTags from "./Shared/TaskInfoMenuTags";
import TaskInfoMenuSelect from "./Shared/TaskInfoMenuSelect";
import ExpandableTextarea from "./Shared/ExpandableTextarea";
import ExpandableTitleInput from "./Shared/ExpandableTitleInput";
import { useTasks } from "@/hooks/tasks";
import { useSettings } from "@/hooks/settings";
import { useMemo, useState } from "react";
import GroupSelector from "./Shared/GroupSelector";
import TaskAlarmField, { AlarmDraft } from "./Shared/TaskAlarmField";
import { ChevronRightIcon } from "@heroicons/react/16/solid";


interface MenuFieldsProps {
    type: string | undefined;
    isDeleting: boolean;
    tempData: any;
    setTempData: any;
    appData: any;
    setAppData: any;
    quickTasksInput: string;
    setQuickTasksInput: any;
    isQuickAdd: boolean;
    setIsQuickAdd: any;
    validationError: string | null;
    alarmDraft?: AlarmDraft | null;
    setAlarmDraft?: (draft: AlarmDraft | null) => void;
}

export default function MenuFields({
    type,
    isDeleting,
    tempData,
    setTempData,
    appData,
    setAppData,
    quickTasksInput,
    setQuickTasksInput,
    isQuickAdd,
    setIsQuickAdd,
    validationError,
    alarmDraft,
    setAlarmDraft
}: MenuFieldsProps) {
    const tasks = useTasks();
    const settings = useSettings();
    const [showMoreQuickOptions, setShowMoreQuickOptions] = useState(false);
    const existingGroups = useMemo(() => {
        const seen = new Set<string>();
        if (tasks.isSuccess) {
            tasks.data.forEach((t) => {
                const g = (t.group ?? "").trim().toLowerCase();
                if (g) seen.add(g);
            });
        }
        const groupConfig = settings.data?.groupConfig ?? {};
        // Groups created via the group editor but not yet assigned to a task still belong in the list.
        Object.keys(groupConfig).forEach((g) => seen.add(g));
        return Array.from(seen).sort((a, b) => {
            const oa = groupConfig[a]?.order ?? Infinity;
            const ob = groupConfig[b]?.order ?? Infinity;
            return oa !== ob ? oa - ob : a.localeCompare(b);
        });
    }, [tasks.isSuccess, tasks.data, settings.data]);


    return (
        <div className={`flex flex-col gap-4 ${isDeleting && "blur-xs"}`}>
            {type === "add" && (
                <>
                    <div className="flex items-center justify-between px-1">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-primary">Quick add</span>
                            <span className="text-xs text-muted">Create multiple tasks at once.</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const next = !isQuickAdd;
                                setIsQuickAdd(next);
                                if (next) setTempData({ group: "", groupPublic: false });
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                isQuickAdd
                                    ? "bg-accent-blue text-white"
                                    : "bg-silver-200 text-primary ring-1 ring-accent-blue/20 hover:ring-accent-blue/40 dark:bg-[#253350]"
                            }`}
                        >
                            {isQuickAdd ? "On" : "Off"}
                        </button>
                    </div>

                    {isQuickAdd && (
                        <>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-semibold text-primary px-1">Tasks (one per line)</label>
                                <textarea
                                    className="resize-none text-sm px-3 py-2 rounded-lg border border-accent-blue/30 bg-silver-200 text-primary shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[#253350] dark:border-accent-blue/40 min-h-[96px]"
                                    placeholder={"Pick up meds\nEmail client\nWater plants"}
                                    value={quickTasksInput}
                                    onChange={(e) => setQuickTasksInput(e.target.value)}
                                />
                                {validationError && (
                                    <span className="px-1 text-sm font-semibold text-accent-red-500">{validationError}</span>
                                )}
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-semibold text-primary px-1">Date &amp; Time</label>
                                <DateTimePicker
                                    value={formatDateTime(tempData.date instanceof Date && tempData.date.getTime() > 0 ? tempData.date : new Date())}
                                    onChange={(val) => setTempData({ date: new Date(val) })}
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowMoreQuickOptions((v) => !v)}
                                className="flex items-center gap-1 px-1 text-xs font-semibold text-muted hover:text-accent-blue transition w-fit"
                            >
                                <ChevronRightIcon className={`h-3.5 w-3.5 transition-transform ${showMoreQuickOptions ? "rotate-90" : ""}`} />
                                {showMoreQuickOptions ? "Fewer options" : "Add more options"}
                            </button>

                            {showMoreQuickOptions && (
                                <div className="flex flex-col gap-4">
                                    <GroupSelector
                                        value={tempData.group ?? ""}
                                        groups={existingGroups}
                                        onChange={(val) => setTempData({ group: val })}
                                    />
                                    <TaskInfoMenuTags
                                        tags={tempData.tags ?? []}
                                        onChange={(tags) => setTempData({ tags })}
                                        helperText="Tags will be applied to every task you add."
                                    />
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
            {!isQuickAdd && (
                <>
                    {/* Name — full width, prominent */}
                    <ExpandableTitleInput
                        name="Name"
                        value={tempData?.title ?? ""}
                        onChange={(val) => setTempData({ ...tempData, title: val })}
                    />

                    {!isQuickAdd && validationError && (
                        <span className="px-1 text-sm font-semibold text-accent-red-500">
                            {validationError}
                        </span>
                    )}

                    {/* Details — full width */}
                    <ExpandableTextarea
                        name="Details"
                        value={tempData.description ?? ""}
                        onChange={(val) => setTempData({ ...tempData, description: val })}
                    />

                    {/* Group + Due Date — side by side on desktop */}
                    <div className="md:grid md:grid-cols-2 md:gap-4 flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <GroupSelector
                                value={tempData.group ?? ""}
                                groups={existingGroups}
                                onChange={(val) => setTempData({ ...tempData, group: val })}
                            />
                            {tempData?.group?.trim() && (
                                <label className="flex items-center gap-2 px-1 mt-1 cursor-pointer w-fit">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded"
                                        checked={!!tempData.groupPublic}
                                        onChange={(e) => setTempData({ ...tempData, groupPublic: e.target.checked })}
                                    />
                                    <span className="text-xs font-semibold text-muted">Team-wide</span>
                                </label>
                            )}
                        </div>

                        {tempData.date.getTime() > 0 ? (
                            <TaskInfoMenuItem
                                name="Due Date"
                                type="datetime-local"
                                value={formatDateTime(tempData.date)}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setTempData({ ...tempData, date: new Date(e.target.value) });
                                }}
                            />
                        ) : (
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-semibold text-primary px-1 opacity-0 select-none">Due Date</label>
                                <button
                                    onClick={() => {
                                        if (appData.storedDate) {
                                            const restoredDate = appData.storedDate;
                                            setAppData({ ...appData, activeDate: restoredDate, storedDate: undefined });
                                            setTempData({ ...tempData, date: restoredDate });
                                            return;
                                        }

                                        const now = new Date();
                                        const nextDate = appData.activeDate
                                            ? new Date(appData.activeDate)
                                            : new Date(now.getTime() + 1000 * 60 * 60 * 24);
                                        nextDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
                                        setTempData({ ...tempData, date: nextDate });
                                    }}
                                    className="h-10 w-full text-center rounded-lg px-3 py-2 text-sm font-semibold shadow-xs transition bg-accent-blue text-white hover:-translate-y-px"
                                >
                                    Add Due Date
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Repeating + Remove Due Date — side by side on desktop */}
                    <div className="md:grid md:grid-cols-2 md:gap-4 flex flex-col gap-4">
                        <TaskInfoMenuSelect
                            name="Repeating"
                            value={tempData.repeater}
                            onChange={(value) => {
                                setTempData({ repeater: value, ...(value ? {} : { repeatEnd: "" }) });
                            }}
                            options={[
                                { name: "Do Not Repeat", value: "" },
                                { name: "Every Day", value: "daily" },
                                { name: "Every Week", value: "weekly" },
                                { name: "Every 2 Weeks", value: "bi-weekly" },
                                { name: "Every Month", value: "monthly" },
                                { name: "Every 6 Months", value: "6-monthly" },
                                { name: "Every Year", value: "yearly" },
                            ]}
                        />

                        {tempData.date.getTime() > 0 && (
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-semibold text-primary px-1 opacity-0 select-none">Remove</label>
                                <button
                                    onClick={() => {
                                        setAppData({ ...appData, storedDate: tempData.date });
                                        setTempData({ ...tempData, date: new Date(0) });
                                    }}
                                    className="h-10 w-full text-center rounded-lg px-3 py-2 text-sm font-semibold shadow-xs transition bg-accent-red-500 text-white hover:-translate-y-px"
                                >
                                    Remove Due Date
                                </button>
                            </div>
                        )}
                    </div>

                    <span className="text-xs text-muted px-1 -mt-2">
                        Repeating tasks can be completed once per due day; completion is tracked per occurrence.
                    </span>

                    {/* End Repeat */}
                    {tempData.repeater && (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-sm font-semibold text-primary">End Repeat</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = tempData.repeatEnd
                                            ? ""
                                            : formatDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30));
                                        setTempData({ repeatEnd: next });
                                    }}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                        tempData.repeatEnd
                                            ? "bg-accent-blue text-white"
                                            : "bg-silver-200 text-primary ring-1 ring-accent-blue/20 hover:ring-accent-blue/40 dark:bg-[#253350]"
                                    }`}
                                >
                                    {tempData.repeatEnd ? "On" : "Off"}
                                </button>
                            </div>
                            {tempData.repeatEnd && (
                                <DateTimePicker
                                    value={tempData.repeatEnd}
                                    onChange={(val) => setTempData({ repeatEnd: val })}
                                    dateOnly
                                />
                            )}
                        </div>
                    )}

                    {/* Alarm */}
                    <TaskAlarmField
                        taskId={type === "edit" ? tempData.id : undefined}
                        taskDate={tempData.date instanceof Date ? tempData.date : new Date(tempData.date)}
                        taskRepeater={tempData.repeater}
                        draft={alarmDraft}
                        onDraftChange={setAlarmDraft}
                    />

                    {/* Priority */}
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-primary px-1">Priority</span>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { label: "High", value: 3, color: "from-rose-500 to-rose-400" },
                                { label: "Medium", value: 2, color: "from-amber-500 to-amber-400" },
                                { label: "Low", value: 1, color: "from-emerald-500 to-emerald-400" },
                                { label: "None", value: 0, color: "from-slate-400 to-slate-300" },
                            ].map((opt) => {
                                const isActive = Number(tempData.priority ?? 0) === opt.value;
                                return (
                                    <button
                                        key={opt.label}
                                        type="button"
                                        className={`rounded-lg px-3 py-2 text-sm font-semibold shadow-xs ring-1 transition ${
                                            isActive
                                                ? `bg-linear-to-r ${opt.color} text-white ring-transparent`
                                                : "bg-silver-200 text-primary ring-accent-blue/20 hover:ring-accent-blue/40 dark:bg-[#253350]"
                                        }`}
                                        onClick={() => setTempData({ ...tempData, priority: opt.value })}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tags — full width */}
                    <TaskInfoMenuTags
                        tags={tempData.tags ?? []}
                        onChange={(tags) => setTempData({ ...tempData, tags })}
                    />

                    {type == "edit" && <TaskInfoMenuUser data={tempData} />}
                </>
            )}
        </div>
    )
}
