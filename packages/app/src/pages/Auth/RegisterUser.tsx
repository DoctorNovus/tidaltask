import { useNavigate } from "react-router";
import ArrowBack from "../(Login)/ArrowBack";
import { reloadAuth, useRegister } from "@/hooks/auth";
import { useState } from "react";
import { useApp } from "@/hooks/app";

export default function RegisterUser() {
    const navigate = useNavigate();

    const { mutateAsync: register } = useRegister();
    const [app, setApp] = useApp();


    const [status, setStatus] = useState("");

    const registerUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const form = e.currentTarget;
        const first = (form.elements[0] as HTMLInputElement).value;
        const last = (form.elements[1] as HTMLInputElement).value;
        const email = (form.elements[2] as HTMLInputElement).value;
        const password = (form.elements[3] as HTMLInputElement).value;

        const response = await register({ first, last, email, password });

        if (response.statusCode == 500) {
            setStatus(response.message);
        } else {
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
                    <span className="text-lg font-semibold">Sign Up</span>
                    <div className="w-10" />
                </div>
                <form className="flex flex-col gap-5 text-primary" onSubmit={(e) => registerUser(e)}>
                    <div className="w-full flex flex-col gap-4">
                        <label className="flex flex-col text-left text-sm font-semibold text-muted">
                            First Name
                            <input required autoComplete="given-name" className="mt-1 w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-2 text-base shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]" placeholder="First Name" />
                        </label>
                        <label className="flex flex-col text-left text-sm font-semibold text-muted">
                            Last Name
                            <input required autoComplete="family-name" className="mt-1 w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-2 text-base shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]" placeholder="Last Name" />
                        </label>
                        <label className="flex flex-col text-left text-sm font-semibold text-muted">
                            Email
                            <input required type="email" autoComplete="username" className="mt-1 w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-2 text-base shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]" placeholder="Email Address" />
                        </label>
                        <label className="flex flex-col text-left text-sm font-semibold text-muted">
                            Password
                            <input required type="password" autoComplete="new-password" className="mt-1 w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-2 text-base shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]" placeholder="Password" />
                        </label>
                    </div>
                    <label htmlFor="terms-policy" className="w-full flex items-center text-left gap-2 rounded-md text-sm text-muted">
                        <input id="terms-policy" required type="checkbox" className="w-5 h-5 aspect-square rounded-md border border-accent-blue/50 dark:bg-[rgba(15,23,42,0.7)]" />
                        <span>By continuing, you agree to our <a href="https://www.ottegi.com/privacy" target="_blank" className="text-accent-blue underline">Privacy Policy</a>.</span>
                    </label>
                    {status.length > 0 && <span className="text-red-500 text-sm">{status}</span>}
                    <button type="submit" className="w-full rounded-xl bg-linear-to-r from-accent-blue-700 to-accent-blue-500 py-3 text-lg font-semibold text-white shadow-lg shadow-accent-blue/25 ring-1 ring-accent-blue/20 transition hover:-translate-y-px">Get Started</button>
                </form>
            </div>
        </div>
    )
}
