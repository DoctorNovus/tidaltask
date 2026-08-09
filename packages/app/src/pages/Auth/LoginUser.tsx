import { useNavigate, useLocation } from "react-router";
import ArrowBack from "../(Login)/ArrowBack";
import { reloadAuth, useBackupCodeLogin, useCompleteTwoFactorLogin, useLogin, usePasskeyLogin, passkeysUnsupportedReason } from "@/hooks/auth";
import { useState } from "react";
import { useApp } from "@/hooks/app";

export default function LoginUser() {

    const { mutateAsync: login } = useLogin();
    const { mutateAsync: completeTwoFactor, isPending: isTwoFactorPending } = useCompleteTwoFactorLogin();
    const { mutateAsync: backupCodeLogin, isPending: isBackupPending } = useBackupCodeLogin();
    const { mutateAsync: passkeyLogin, isPending: isPasskeyPending } = usePasskeyLogin();
    const [app, setApp] = useApp();

    const navigate = useNavigate();
    const location = useLocation();

    const [status, setStatus] = useState("");
    const [step, setStep] = useState<"credentials" | "2fa" | "backup">("credentials");
    const [twoFactorCode, setTwoFactorCode] = useState("");
    const [backupCode, setBackupCode] = useState("");
    const successMessage = (location.state as { status?: string } | null)?.status ?? "";

    const finishLogin = async () => {
        setApp({ ...app, authorized: true });
        await reloadAuth();
        await navigate("/");
        await navigate(0);
    };

    const loginUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus("");

        const form = e.currentTarget;
        const email = (form.elements[0] as HTMLInputElement).value;
        const password = (form.elements[1] as HTMLInputElement).value;

        const resp = await login({ email, password });

        if (resp?.requiresTwoFactor) {
            setStep("2fa");
        } else if (resp?.message) {
            setStatus(resp.message);
        } else {
            await finishLogin();
        }
    };

    const handleTwoFactor = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus("");
        try {
            await completeTwoFactor({ code: twoFactorCode });
            await finishLogin();
        } catch (err: any) {
            setStatus(err?.message || "Invalid code.");
        }
    };

    const handleBackupCode = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus("");
        try {
            await backupCodeLogin({ code: backupCode });
            await finishLogin();
        } catch (err: any) {
            setStatus(err?.message || "Invalid backup code.");
        }
    };

    const handlePasskeyLogin = async () => {
        setStatus("");
        try {
            await passkeyLogin();
            await finishLogin();
        } catch (err: any) {
            setStatus(err?.message || "Passkey authentication failed.");
        }
    };

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
                        onClick={() => step !== "credentials" ? (setStep("credentials"), setStatus("")) : navigate("/auth")}
                    >
                        <ArrowBack />
                    </button>
                    <span className="text-lg font-semibold">
                        {step === "credentials" ? "Login" : step === "backup" ? "Backup Code" : "Two-Factor Auth"}
                    </span>
                    <div className="w-10" />
                </div>

                {successMessage && <p className="text-green-600 text-sm mb-1">{successMessage}</p>}

                {step === "credentials" && (
                    <div className="flex flex-col gap-4">
                        <form className="flex flex-col gap-5 text-primary" onSubmit={loginUser}>
                            <div className="flex flex-col gap-4">
                                <label className="flex flex-col text-left text-sm font-semibold text-muted">
                                    Email
                                    <input required type="email" name="email" autoComplete="username" className="mt-1 w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-2 text-base shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]" placeholder="you@example.com" />
                                </label>
                                <label className="flex flex-col text-left text-sm font-semibold text-muted">
                                    Password
                                    <input required type="password" name="password" autoComplete="current-password" className="mt-1 w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-2 text-base shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]" placeholder="••••••••" />
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
                        <div className="flex items-center gap-3">
                            <div className="flex-1 border-t border-accent-blue/10" />
                            <span className="text-xs text-muted">or</span>
                            <div className="flex-1 border-t border-accent-blue/10" />
                        </div>
                        {passkeysUnsupportedReason() ? (
                            <p className="text-center text-xs text-muted">{passkeysUnsupportedReason()}</p>
                        ) : (
                            <button
                                type="button"
                                onClick={handlePasskeyLogin}
                                disabled={isPasskeyPending}
                                className="w-full rounded-xl border border-accent-blue/20 bg-white/60 py-3 text-base font-semibold text-primary shadow-sm transition hover:-translate-y-px dark:bg-white/5 disabled:opacity-60"
                            >
                                {isPasskeyPending ? "Authenticating..." : "Sign in with Passkey"}
                            </button>
                        )}
                    </div>
                )}

                {step === "2fa" && (
                    <form className="flex flex-col gap-5 text-primary" onSubmit={handleTwoFactor}>
                        <p className="text-sm text-muted">Enter the 6-digit code from your authenticator app.</p>
                        <input
                            required
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                            className="w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-3 text-center text-2xl font-mono tracking-widest shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]"
                            placeholder="000000"
                        />
                        {status && <span className="text-red-500 text-sm">{status}</span>}
                        <button
                            type="submit"
                            disabled={isTwoFactorPending || twoFactorCode.length < 6}
                            className="w-full rounded-xl bg-linear-to-r from-accent-blue-700 to-accent-blue-500 py-3 text-lg font-semibold text-white shadow-lg shadow-accent-blue/25 ring-1 ring-accent-blue/20 transition hover:-translate-y-px disabled:opacity-60"
                        >
                            {isTwoFactorPending ? "Verifying..." : "Verify"}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setStep("backup"); setStatus(""); }}
                            className="text-center text-sm font-semibold text-accent-blue hover:underline"
                        >
                            Use a backup code instead
                        </button>
                    </form>
                )}

                {step === "backup" && (
                    <form className="flex flex-col gap-5 text-primary" onSubmit={handleBackupCode}>
                        <p className="text-sm text-muted">Enter one of your 8-character backup codes.</p>
                        <input
                            required
                            type="text"
                            autoComplete="off"
                            value={backupCode}
                            onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                            className="w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-3 text-center text-xl font-mono tracking-widest shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]"
                            placeholder="XXXXX-XXXXX"
                        />
                        {status && <span className="text-red-500 text-sm">{status}</span>}
                        <button
                            type="submit"
                            disabled={isBackupPending}
                            className="w-full rounded-xl bg-linear-to-r from-accent-blue-700 to-accent-blue-500 py-3 text-lg font-semibold text-white shadow-lg shadow-accent-blue/25 ring-1 ring-accent-blue/20 transition hover:-translate-y-px disabled:opacity-60"
                        >
                            {isBackupPending ? "Verifying..." : "Use Backup Code"}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setStep("2fa"); setStatus(""); }}
                            className="text-center text-sm font-semibold text-accent-blue hover:underline"
                        >
                            Back to authenticator app
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
