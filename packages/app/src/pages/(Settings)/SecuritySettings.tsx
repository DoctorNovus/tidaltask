import { useState } from "react";
import { useUser } from "@/hooks/user";
import {
    useSetup2FA,
    useVerifySetup2FA,
    useDisable2FA,
    useRegenerateBackupCodes,
    usePasskeys,
    useRegisterPasskey,
    useDeletePasskey,
} from "@/hooks/auth";
import { XMarkIcon, KeyIcon, ShieldCheckIcon, DevicePhoneMobileIcon } from "@heroicons/react/24/solid";

function TwoFactorSection() {
    const user = useUser();
    const setup2FA = useSetup2FA();
    const verifySetup = useVerifySetup2FA();
    const disable2FA = useDisable2FA();
    const regenerateCodes = useRegenerateBackupCodes();

    const [showSetup, setShowSetup] = useState(false);
    const [setupData, setSetupData] = useState<{ secret: string; qrCode: string; backupCodes: string[] } | null>(null);
    const [verifyCode, setVerifyCode] = useState("");
    const [disableCode, setDisableCode] = useState("");
    const [showDisable, setShowDisable] = useState(false);
    const [showBackupCodes, setShowBackupCodes] = useState(false);
    const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);
    const [message, setMessage] = useState("");

    const enabled = user.data?.twoFactorEnabled ?? false;

    const handleStartSetup = async () => {
        setMessage("");
        try {
            const data = await setup2FA.mutateAsync();
            setSetupData(data);
            setShowSetup(true);
        } catch (err: any) {
            setMessage(err?.message || "Failed to start 2FA setup.");
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage("");
        try {
            await verifySetup.mutateAsync({ code: verifyCode });
            setMessage("Two-factor authentication enabled.");
            setShowSetup(false);
            setSetupData(null);
            setVerifyCode("");
        } catch (err: any) {
            setMessage(err?.message || "Invalid code.");
        }
    };

    const handleDisable = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage("");
        try {
            await disable2FA.mutateAsync({ code: disableCode });
            setMessage("Two-factor authentication disabled.");
            setShowDisable(false);
            setDisableCode("");
        } catch (err: any) {
            setMessage(err?.message || "Failed to disable 2FA.");
        }
    };

    const handleRegenerateCodes = async () => {
        setMessage("");
        try {
            const data = await regenerateCodes.mutateAsync();
            setNewBackupCodes(data.backupCodes);
            setShowBackupCodes(true);
        } catch (err: any) {
            setMessage(err?.message || "Failed to regenerate backup codes.");
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${enabled ? "bg-green-100 dark:bg-green-500/15" : "bg-silver-200 dark:bg-(--surface-raised)"}`}>
                        <ShieldCheckIcon className={`h-5 w-5 ${enabled ? "text-green-600 dark:text-green-400" : "text-muted"}`} />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-primary">Authenticator App (TOTP)</div>
                        <div className="text-xs text-muted">{enabled ? "Enabled" : "Not enabled"}</div>
                    </div>
                </div>
                {!enabled ? (
                    <button
                        type="button"
                        onClick={handleStartSetup}
                        disabled={setup2FA.isPending}
                        className="rounded-lg bg-accent-blue px-3 py-2 text-xs font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition disabled:opacity-70"
                    >
                        {setup2FA.isPending ? "Loading..." : "Set up"}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => { setShowDisable(true); setMessage(""); }}
                        className="rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-xs font-semibold text-primary hover:-translate-y-px transition"
                    >
                        Disable
                    </button>
                )}
            </div>

            {enabled && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleRegenerateCodes}
                        disabled={regenerateCodes.isPending}
                        className="rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-xs font-semibold text-primary hover:-translate-y-px transition disabled:opacity-70"
                    >
                        {regenerateCodes.isPending ? "Generating..." : "New backup codes"}
                    </button>
                </div>
            )}

            {message && <span className="text-sm text-muted">{message}</span>}

            {showSetup && setupData && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs px-4 overflow-y-auto"
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowSetup(false); setMessage(""); } }}
                >
                    <div className="w-full max-w-md my-6 rounded-2xl surface-card border shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-(--surface-border)">
                            <h3 className="text-base font-semibold text-primary">Set up two-factor auth</h3>
                            <button type="button" onClick={() => setShowSetup(false)} className="rounded-lg p-1.5 text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/10 transition">
                                <XMarkIcon className="h-5 w-5 brightness-0 invert" />
                            </button>
                        </div>
                        <div className="flex flex-col gap-5 p-5">
                            <div className="flex flex-col gap-2">
                                <p className="text-sm text-primary font-semibold">1. Scan this QR code</p>
                                <p className="text-xs text-muted">Open your authenticator app (Authy, Google Authenticator, etc.) and scan the code below.</p>
                                <div className="flex justify-center py-2">
                                    <img src={setupData.qrCode} alt="QR code" className="h-44 w-44 rounded-xl border border-(--surface-border) bg-white p-1" />
                                </div>
                                <p className="text-xs text-muted text-center">Or enter the secret manually:</p>
                                <code className="w-full rounded-lg bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-xs font-mono text-primary break-all text-center">{setupData.secret}</code>
                            </div>

                            <div className="flex flex-col gap-2">
                                <p className="text-sm text-primary font-semibold">2. Save your backup codes</p>
                                <p className="text-xs text-muted">Store these somewhere safe. Each can be used once if you lose access to your authenticator.</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {setupData.backupCodes.map((code) => (
                                        <code key={code} className="rounded-lg bg-silver-200 dark:bg-(--surface-raised) px-3 py-1.5 text-xs font-mono text-primary text-center">{code}</code>
                                    ))}
                                </div>
                            </div>

                            <form className="flex flex-col gap-3" onSubmit={handleVerify}>
                                <p className="text-sm text-primary font-semibold">3. Verify the code</p>
                                <input
                                    required
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    value={verifyCode}
                                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                                    placeholder="Enter 6-digit code"
                                    className="w-full rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-sm text-center font-mono tracking-widest text-primary focus:border-accent-blue focus:outline-hidden"
                                />
                                {message && <span className="text-sm text-red-500">{message}</span>}
                                <button
                                    type="submit"
                                    disabled={verifySetup.isPending || verifyCode.length < 6}
                                    className="w-full rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition disabled:opacity-70"
                                >
                                    {verifySetup.isPending ? "Verifying..." : "Enable 2FA"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showDisable && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs px-4"
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowDisable(false); setMessage(""); } }}
                >
                    <div className="w-full max-w-md rounded-2xl surface-card border shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-(--surface-border)">
                            <h3 className="text-base font-semibold text-primary">Disable two-factor auth</h3>
                            <button type="button" onClick={() => setShowDisable(false)} className="rounded-lg p-1.5 text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/10 transition">
                                <XMarkIcon className="h-5 w-5 brightness-0 invert" />
                            </button>
                        </div>
                        <form className="flex flex-col gap-4 p-5" onSubmit={handleDisable}>
                            <p className="text-sm text-muted">Enter your current authenticator code to disable two-factor authentication.</p>
                            <input
                                required
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                value={disableCode}
                                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                                placeholder="000000"
                                className="w-full rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-center font-mono tracking-widest text-sm text-primary focus:border-accent-blue focus:outline-hidden"
                            />
                            {message && <span className="text-sm text-red-500">{message}</span>}
                            <button
                                type="submit"
                                disabled={disable2FA.isPending || disableCode.length < 6}
                                className="w-full rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:-translate-y-px transition disabled:opacity-70"
                            >
                                {disable2FA.isPending ? "Disabling..." : "Disable 2FA"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showBackupCodes && newBackupCodes && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs px-4"
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowBackupCodes(false); setNewBackupCodes(null); } }}
                >
                    <div className="w-full max-w-md rounded-2xl surface-card border shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-(--surface-border)">
                            <h3 className="text-base font-semibold text-primary">New backup codes</h3>
                            <button type="button" onClick={() => { setShowBackupCodes(false); setNewBackupCodes(null); }} className="rounded-lg p-1.5 text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/10 transition">
                                <XMarkIcon className="h-5 w-5 brightness-0 invert" />
                            </button>
                        </div>
                        <div className="flex flex-col gap-4 p-5">
                            <p className="text-sm text-muted">Your old backup codes have been replaced. Save these somewhere safe.</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {newBackupCodes.map((code) => (
                                    <code key={code} className="rounded-lg bg-silver-200 dark:bg-(--surface-raised) px-3 py-1.5 text-xs font-mono text-primary text-center">{code}</code>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => { setShowBackupCodes(false); setNewBackupCodes(null); }}
                                className="w-full rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PasskeysSection() {
    const passkeys = usePasskeys();
    const registerPasskey = useRegisterPasskey();
    const deletePasskey = useDeletePasskey();

    const [labelInput, setLabelInput] = useState("");
    const [message, setMessage] = useState("");
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const handleAdd = async () => {
        setMessage("");
        const label = labelInput.trim() || "Passkey";
        try {
            await registerPasskey.mutateAsync(label);
            setLabelInput("");
            setMessage("Passkey registered.");
        } catch (err: any) {
            setMessage(err?.message || "Failed to register passkey.");
        }
    };

    const handleDelete = async (id: string) => {
        setMessage("");
        try {
            await deletePasskey.mutateAsync(id);
            setConfirmDelete(null);
        } catch (err: any) {
            setMessage(err?.message || "Failed to delete passkey.");
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <p className="text-xs text-muted">Passkeys let you sign in with Face ID, Touch ID, or a hardware key — no password needed.</p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                        type="text"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        placeholder="Passkey name (e.g. MacBook)"
                        className="flex-1 rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-sm text-primary focus:border-accent-blue focus:outline-hidden"
                    />
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={registerPasskey.isPending}
                        className="rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition disabled:opacity-70"
                    >
                        {registerPasskey.isPending ? "Registering..." : "Add passkey"}
                    </button>
                </div>
            </div>

            {message && <span className="text-sm text-muted">{message}</span>}

            {passkeys.isLoading && <span className="text-sm text-muted">Loading passkeys...</span>}
            {passkeys.isSuccess && passkeys.data.length === 0 && (
                <span className="text-sm text-muted">No passkeys registered yet.</span>
            )}
            {passkeys.isSuccess && passkeys.data.length > 0 && (
                <div className="flex flex-col gap-2">
                    {passkeys.data.map((pk) => (
                        <div key={pk.id} className="flex items-center justify-between gap-3 rounded-xl bg-silver-200 dark:bg-(--surface-raised) px-3 py-2.5">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-blue/10">
                                    {pk.deviceType === "singleDevice"
                                        ? <DevicePhoneMobileIcon className="h-4 w-4 text-accent-blue" />
                                        : <KeyIcon className="h-4 w-4 text-accent-blue" />
                                    }
                                </div>
                                <div className="flex min-w-0 flex-col">
                                    <span className="text-sm font-semibold text-primary truncate">{pk.label}</span>
                                    <span className="text-xs text-muted">{pk.backedUp ? "Synced" : "Device-only"} · {new Date(pk.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            {confirmDelete === pk.id ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(pk.id)}
                                        disabled={deletePasskey.isPending}
                                        className="rounded-lg bg-red-500 px-2 py-1 text-xs font-semibold text-white shadow-xs hover:-translate-y-px transition disabled:opacity-70"
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(null)}
                                        className="rounded-lg border border-(--surface-border) px-2 py-1 text-xs font-semibold text-muted hover:text-primary transition"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(pk.id)}
                                    className="shrink-0 rounded-lg bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:-translate-y-px transition"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function SecuritySettings() {
    return (
        <div className="flex flex-col gap-6 pt-1">
            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-primary">Two-Factor Authentication</h3>
                <TwoFactorSection />
            </div>
            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-primary">Passkeys</h3>
                <PasskeysSection />
            </div>
        </div>
    );
}
