import { useState } from "react";
import { useNavigate } from "react-router";
import { useAdminStats, useAdminUsers, useSetDeveloper } from "@/hooks/admin";
import { fetchData } from "@/utils/data";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";

function StatTile({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="flex flex-col gap-1 rounded-xl surface-card border px-3 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</span>
            <span className="text-xl font-bold text-primary">{value}</span>
        </div>
    );
}

function formatDate(value: string | null) {
    return value ? new Date(value).toLocaleDateString() : "—";
}

export default function AdminPanel() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [message, setMessage] = useState("");

    const stats = useAdminStats(true);
    const users = useAdminUsers(search, page, true);
    const setDeveloper = useSetDeveloper();

    const loginAsUser = async (id: string) => {
        setMessage("");
        const res = await fetchData("/auth/loginAsUser", { method: "POST", body: { id } });
        if (res.ok) {
            navigate(0);
        } else {
            setMessage("Failed to log in as that user.");
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">Stats</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <StatTile label="Users" value={stats.data?.totalUsers ?? "—"} />
                    <StatTile label="New (7d)" value={stats.data?.newUsersLast7Days ?? "—"} />
                    <StatTile label="Active (7d)" value={stats.data?.activeUsersLast7Days ?? "—"} />
                    <StatTile label="Developers" value={stats.data?.developerUsers ?? "—"} />
                    <StatTile label="Tasks" value={stats.data?.totalTasks ?? "—"} />
                    <StatTile label="Repeating" value={stats.data?.repeatingTasks ?? "—"} />
                    <StatTile label="Announcements" value={stats.data?.activeAnnouncements ?? "—"} />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">Users</span>
                <div className="flex items-center gap-2 rounded-xl border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2">
                    <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search users by name or email…"
                        className="w-full bg-transparent text-sm text-primary outline-hidden placeholder:text-slate-400"
                    />
                </div>

                {message && <span className="text-xs font-semibold text-accent-red-500">{message}</span>}

                <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                    {users.isLoading && <span className="text-sm text-muted">Loading users...</span>}
                    {users.isSuccess && users.data.users.length === 0 && (
                        <span className="text-sm text-muted">No users match "{search}".</span>
                    )}
                    {users.isSuccess && users.data.users.map((u) => (
                        <div
                            key={u.id}
                            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between rounded-xl bg-silver-200 dark:bg-(--surface-raised) px-3 py-2.5"
                        >
                            <div className="flex min-w-0 flex-col">
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-primary truncate">
                                    {u.first} {u.last}
                                    {u.developer && (
                                        <span className="rounded-full bg-accent-blue/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-blue-700 dark:text-accent-blue-300">
                                            Dev
                                        </span>
                                    )}
                                </span>
                                <span className="text-xs text-muted truncate">{u.email}</span>
                                <span className="text-[11px] text-muted">
                                    Joined {formatDate(u.createdAt)} · Last login {formatDate(u.lastLoggedIn)}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    disabled={setDeveloper.isPending}
                                    onClick={() =>
                                        setDeveloper.mutate(
                                            { id: u.id, developer: !u.developer },
                                            { onError: (err) => setMessage(err.message) }
                                        )
                                    }
                                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                                        u.developer
                                            ? "border border-(--surface-border) text-muted hover:text-primary"
                                            : "bg-accent-blue text-white hover:-translate-y-px"
                                    }`}
                                >
                                    {u.developer ? "Revoke dev" : "Make dev"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => loginAsUser(u.id)}
                                    className="rounded-lg border border-(--surface-border) px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-primary transition"
                                >
                                    Login as
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {users.isSuccess && users.data.total > users.data.limit && (
                    <div className="flex items-center justify-between text-xs text-muted">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="font-semibold disabled:opacity-40"
                        >
                            ← Prev
                        </button>
                        <span>Page {users.data.page} of {Math.ceil(users.data.total / users.data.limit)}</span>
                        <button
                            type="button"
                            disabled={page * users.data.limit >= users.data.total}
                            onClick={() => setPage((p) => p + 1)}
                            className="font-semibold disabled:opacity-40"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
