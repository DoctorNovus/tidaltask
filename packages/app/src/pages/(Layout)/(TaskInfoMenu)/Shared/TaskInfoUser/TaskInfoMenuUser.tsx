import { MinusIcon, PlusIcon } from "@heroicons/react/20/solid";
import { useState } from "react";
import TaskInfoMenuUserInvite from "./TaskInfoMenuUserInvite";
import { Task, useRemoveUser, useTaskUsers } from "@/hooks/tasks";
import { queryClient } from "@/index";
import { User, useUser } from "@/hooks/user";
import { Logger } from "@/utils/logger";

export default function TaskInfoMenuUser({ data }: { data: Task }) {
    const host = useUser();

    const [addingUser, setAddingUser] = useState(false);
    const [status, setStatus] = useState({ status: "Error", message: "" });

    const { mutate: removeUser } = useRemoveUser();

    const users = useTaskUsers(data.id!);

    if (users.isLoading)
        return "Loading...";

    if (users.isError)
        Logger.logError(users.error.message);

    if (users.isSuccess) {
        const raw = users.data;
        const userList: User[] = Array.isArray(raw) ? raw : (raw?.users ?? []);

        return (
            <div className="flex flex-col gap-3">
                <div className="flex flex-row justify-between items-center">
                    <label className="text-sm font-semibold text-primary">Users</label>
                    <div className="flex w-8 h-8 justify-center items-center">
                        {!addingUser && <PlusIcon className="w-5 h-5 cursor-pointer text-accent-blue" onClick={() => setAddingUser(true)} />}
                        {addingUser && <MinusIcon className="w-5 h-5 cursor-pointer text-accent-blue" onClick={() => setAddingUser(false)} />}
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    {userList.length === 0 && (
                        <span className="text-sm text-muted">No users yet.</span>
                    )}
                    {userList.map((user, key) => {
                        const fullName = [user.first, user.last].filter(Boolean).join(" ").trim();
                        const displayName = fullName.length > 0 ? fullName : user.email;
                        const isSelf = host.data?.email === user.email;

                        return (
                            <div key={key} className="flex flex-row items-center gap-2 rounded-xl border border-accent-blue/20 bg-accent-blue-50/50 px-3 py-2 dark:bg-(--accent-subtle)">
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-primary">{displayName}</span>
                                    <span className="text-xs text-muted">{user.email}</span>
                                </div>
                                <div className="ml-auto flex items-center">
                                    <MinusIcon
                                        className={`w-5 h-5 ${isSelf ? "opacity-30" : "cursor-pointer text-red-500 hover:text-red-600"}`}
                                        onClick={async () => {
                                            if (isSelf) {
                                                setStatus({ status: "Error", message: "You cannot delete yourself." });
                                                return;
                                            }

                                            removeUser({ taskId: data.id!, userEmail: user.email });
                                            setStatus({ status: "Success", message: "User removed" });
                                            setTimeout(() => {
                                                queryClient.invalidateQueries({ queryKey: ["tasks", data.id, "users"] });
                                            }, 500);
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}

                    {addingUser && (
                        <div>
                            <TaskInfoMenuUserInvite task={data} setStatus={setStatus} />
                        </div>
                    )}

                    <span className={`text-sm ${status.status == "Success" ? "text-accent-blue" : "text-red-500"}`}>{status.message}</span>
                </div>
            </div>
        )
    }
}
