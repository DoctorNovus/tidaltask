import { useUser } from "@/hooks/user";
import { signout } from "@/hooks/auth";
import { useNavigate } from "react-router";
import { fetchData } from "@/utils/data";

export default function UserLogin() {
    const user = useUser();
    const navigate = useNavigate();

    const logoutUser = () => {
        fetchData("/auth/logout", {
            method: "POST"
        });

        signout()

        navigate("/auth");
    }

    return (
        <div className="flex flex-col gap-2">
            {user.isLoading && <span className="text-muted text-sm">Loading user...</span>}
            {user.isSuccess && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h1 className="text-lg font-semibold text-primary">Sync Status</h1>
                        <span className="text-xs rounded-full bg-accent-blue-50 px-2 py-1 text-accent-blue-700 dark:bg-(--accent-subtle)">
                            {user.data?.id ? "Signed in" : "Signed out"}
                        </span>
                    </div>
                    {
                        user.data?.id ?
                            (
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="text-primary text-sm">Logged in as <span className="font-semibold">{user.data.email}</span></div>
                                    <button onClick={logoutUser} className="rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition">
                                        Sign Out
                                    </button>
                                </div>
                            ) :
                            (
                                <div className="flex flex-col gap-2 rounded-xl border border-dashed border-accent-blue/30 px-3 py-2">
                                    <span className="text-muted text-sm">Not signed in.</span>
                                    <button className="w-fit rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition" onClick={() => navigate("/auth")}>
                                        Sign In
                                    </button>
                                </div>
                            )
                    }
                </div>
            )}
        </div>
    )
}
