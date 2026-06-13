import { formatDateTime } from "@/utils/date";
import TaskInfoMenuItem from "./Shared/TaskInfoMenuItem";
import DateTimePicker from "./Shared/DateTimePicker";
import TaskInfoMenuUser from "./Shared/TaskInfoUser/TaskInfoMenuUser";
import TaskInfoMenuTags from "./Shared/TaskInfoMenuTags";
import TaskInfoMenuSelect from "./Shared/TaskInfoMenuSelect";
import ExpandableTextarea from "./Shared/ExpandableTextarea";
import { useTasks } from "@/hooks/tasks";
import { useMemo } from "react";
import GroupSelector from "./Shared/GroupSelector";


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
    validationError
}: MenuFieldsProps) {
    const tasks = useTasks();
    const existingGroups = useMemo(() => {
        if (!tasks.isSuccess) return [];
        const seen = new Set<string>();
        tasks.data.forEach((t) => {
            const g = (t.group ?? "").trim().toLowerCase();
            if (g) seen.add(g);
        });
        return Array.from(seen).sort();
    }, [tasks.isSuccess, tasks.data]);


    return (
        <div className={`flex flex-col gap-4 ${isDeleting && "blur-xs"}`}>
            {type === "add" && (
                <div className="flex flex-col gap-2 rounded-lg border border-accent-blue/15 bg-accent-blue-50/40 px-3 py-3 dark:bg-(--accent-subtle)">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-primary">Quick add</span>
                            <span className="text-xs text-muted">Create multiple tasks at once.</span>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-muted">
                            <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={isQuickAdd}
                                onChange={(e) => {
                                    setIsQuickAdd(e.target.checked);
                                    if (e.target.checked) {
                                        setTempData({ group: "", groupPublic: false });
                                    }
                                }}
                            />
                            Enable
                        </label>
                    </div>
                    {isQuickAdd && (
                        <TaskInfoMenuItem
                            name="Tasks (one per line)"
                            type="textarea"
                            placeholder="Pick up meds&#10;Email client&#10;Water plants"
                            value={quickTasksInput}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setQuickTasksInput(e.target.value)
                            }
                        />
                    )}
                    {isQuickAdd && (
                        <div className="md:grid md:grid-cols-2 md:gap-4 flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-primary px-1">Date &amp; Time</label>
                                <DateTimePicker
                                    value={formatDateTime(tempData.date instanceof Date && tempData.date.getTime() > 0 ? tempData.date : new Date())}
                                    onChange={(val) => setTempData({ date: new Date(val) })}
                                />
                            </div>
                            <GroupSelector
                                value={tempData.group ?? ""}
                                groups={existingGroups}
                                onChange={(val) => setTempData({ group: val })}
                            />
                        </div>
                    )}
                    {isQuickAdd && (
                        <TaskInfoMenuTags
                            tags={tempData.tags ?? []}
                            onChange={(tags) => setTempData({ tags })}
                            helperText="Tags will be applied to every task you add."
                        />
                    )}
                    {isQuickAdd && validationError && (
                        <span className="px-1 text-sm font-semibold text-accent-red-500">
                            {validationError}
                        </span>
                    )}
                </div>
            )}
            {!isQuickAdd && (
                <>
                    {/* Name — full width, prominent */}
                    <TaskInfoMenuItem
                        name="Name"
                        value={tempData?.title}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setTempData({ ...tempData, title: e.target.value })
                        }
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
                                        const restoredDate = appData.storedDate ?? new Date();
                                        setAppData({ ...appData, activeDate: restoredDate, storedDate: undefined });
                                        setTempData({ ...tempData, date: restoredDate });
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
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                setTempData({ repeater: e.target.value });
                            }}
                            options={[
                                { name: "Do Not Repeat", value: "" },
                                { name: "Every Day", value: "daily" },
                                { name: "Every Week", value: "weekly" },
                                { name: "Every 2 Weeks", value: "bi-weekly" },
                                { name: "Every Month", value: "monthly" },
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
