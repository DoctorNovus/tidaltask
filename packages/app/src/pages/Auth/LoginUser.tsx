import { useNavigate, useLocation } from "react-router";
import ArrowBack from "../(Login)/ArrowBack";
import { reloadAuth, useLogin } from "@/hooks/auth";
import { useState } from "react";
import { useApp } from "@/hooks/app";

export default function LoginUser() {

    const { mutateAsync: login } = useLogin();
    const [app, setApp] = useApp();

    const navigate = useNavigate();
    const location = useLocation();

    const [status, setStatus] = useState("");
    const successMessage = (location.state as { status?: string } | null)?.status ?? "";

    const loginUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const form = e.currentTarget;
        const email = (form.elements[0] as HTMLInputElement).value;
        const password = (form.elements[1] as HTMLInputElement).value;

        const resp = await login({ email, password });

        if (resp)
            setStatus(resp.message);
        else {
            setApp({
                ...app,
                authorized: true
            });
            await reloadAuth();
            await navigate("/");
            await navigate(0);
        }
    }

    return (
        <div
            className="relative flex h-screen w-full items-center justify-center px-5 py-10 overflow-hidden"
            style={{ background: "var(--app-background)" }}
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_5%_10%,rgba(48,122,207,0.12),transparent_35%),radial-gradient(circle_at_90%_0%,rgba(48,122,207,0.1),transparent_30%)] dark:bg-[radial-gradient(circle_at_10%_20%,rgba(99,102,241,0.18),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(14,165,233,0.18),transparent_35%)]" />
            <div className="relative z-10 w-full max-w-md rounded-3xl surface-card border p-6 shadow-2xl ring-1 ring-accent-blue/10 backdrop-blur-sm">
                <div className="flex flex-row items-center justify-between mb-4 text-primary">
                    <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-blue-50 text-accent-blue"
                        onClick={() => navigate("/auth")}
                    >
                        <ArrowBack />
                    </button>
                    <span className="text-lg font-semibold">Login</span>
                    <div className="w-10" />
                </div>
                {successMessage && <p className="text-green-600 text-sm mb-1">{successMessage}</p>}
                <form className="flex flex-col gap-5 text-primary" onSubmit={(e) => loginUser(e)}>
                    <div className="flex flex-col gap-4">
                        <label className="flex flex-col text-left text-sm font-semibold text-muted">
                            Email
                            <input required type="email" name="email" className="mt-1 w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-2 text-base shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]" placeholder="you@example.com" />
                        </label>
                        <label className="flex flex-col text-left text-sm font-semibold text-muted">
                            Password
                            <input required type="password" name="password" className="mt-1 w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-2 text-base shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]" placeholder="••••••••" />
                        </label>
                    </div>
                    {status.length > 0 && <span className="text-red-500 text-sm">{status}</span>}
                    <button type="submit" className="w-full rounded-xl bg-linear-to-r from-accent-blue-700 to-accent-blue-500 py-3 text-lg font-semibold text-white shadow-lg shadow-accent-blue/25 ring-1 ring-accent-blue/20 transition hover:-translate-y-px">Sign In</button>
                    <div className="flex w-full justify-center">
                        <button
                            type="button"
                            onClick={() => navigate("/auth/forgotPassword")}
                            className="text-center text-sm font-semibold text-accent-blue hover:underline"
                        >
                            Forgot Password?
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
