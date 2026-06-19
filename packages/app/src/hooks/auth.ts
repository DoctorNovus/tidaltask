import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { reloadUser } from "./user";
import { queryClient } from "..";
import { fetchData } from "@/utils/data";
import { Logger } from "@/utils/logger";
import { Capacitor } from "@capacitor/core";
import { SecureToken } from "@/plugins/secureToken";
import { syncServerNotifications } from "@/utils/notifs";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

async function storeDeviceToken() {
    if (Capacitor.getPlatform() === "web") return;

    const response = await fetchData("/auth/device-token", {
        method: "POST",
        body: { label: "Siri" }
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || "Unable to issue device token.");
    }
    const data = await response.json().catch(() => ({}));
    const token = data?.token;
    if (typeof token === "string" && token.trim()) {
        await SecureToken.setToken({ token });
    }
}

async function ensureDeviceToken() {
    if (Capacitor.getPlatform() === "web") return;
    const existing = await SecureToken.getToken().catch(() => ({ token: null }));
    if (existing?.token) return;
    await storeDeviceToken();
}

export async function reloadAuth() {
    await queryClient.invalidateQueries({ queryKey: ['auth'] });
}

export interface AuthStatus {
    message?: string;
    statusCode?: number;
}

export async function getAuth(): Promise<AuthStatus> {
    return await (await fetchData("/auth", {})).json();
}

export function useAuth() {
    const query = useQuery<AuthStatus>({
        queryKey: ['auth'],
        queryFn: getAuth,
        staleTime: 1000 * 60 * 60 * 30
    });

    useEffect(() => {
        if (!query.isSuccess) return;
        const isAuthed = query.data?.message === "Logged In" || !query.data?.statusCode;
        if (isAuthed) {
            ensureDeviceToken().catch((err) => Logger.logWarning(String(err)));
            syncServerNotifications().catch((err) => Logger.logWarning(String(err)));
            const interval = window.setInterval(() => {
                syncServerNotifications().catch((err) => Logger.logWarning(String(err)));
            }, 60 * 1000);

            return () => window.clearInterval(interval);
        }
    }, [query.isSuccess, query.data]);

    return query;
}

export function useLogin() {
    return useMutation({
        mutationFn: async (body: { email: string, password: string }): Promise<{ requiresTwoFactor?: boolean; message?: string } | undefined> => {
            const response = await fetchData("/auth/login", {
                method: "POST",
                body
            });

            const data = await response.json();

            if (!response.ok) return data;

            if (data?.requiresTwoFactor) return { requiresTwoFactor: true };

            reloadUser(queryClient);
            reloadAuth();
            await storeDeviceToken().catch((err) => Logger.logWarning(String(err)));
        }
    })
}

export function useCompleteTwoFactorLogin() {
    return useMutation({
        mutationFn: async (body: { code: string }) => {
            const response = await fetchData("/auth/2fa/complete-login", {
                method: "POST",
                body
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data?.message || "Invalid code.");

            reloadUser(queryClient);
            reloadAuth();
            await storeDeviceToken().catch((err) => Logger.logWarning(String(err)));
            return data;
        }
    })
}

export function useBackupCodeLogin() {
    return useMutation({
        mutationFn: async (body: { code: string }) => {
            const response = await fetchData("/auth/2fa/backup-login", {
                method: "POST",
                body
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data?.message || "Invalid backup code.");

            reloadUser(queryClient);
            reloadAuth();
            await storeDeviceToken().catch((err) => Logger.logWarning(String(err)));
            return data;
        }
    })
}

export function useSetup2FA() {
    return useMutation({
        mutationFn: async (): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> => {
            const response = await fetchData("/auth/2fa/setup", { method: "POST" });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.message || "Failed to set up 2FA.");
            return data;
        }
    });
}

export function useVerifySetup2FA() {
    return useMutation({
        mutationFn: async (body: { code: string }): Promise<{ enabled: boolean }> => {
            const response = await fetchData("/auth/2fa/verify-setup", { method: "POST", body });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.message || "Failed to verify code.");
            queryClient.invalidateQueries({ queryKey: ["user"] });
            return data;
        }
    });
}

export function useDisable2FA() {
    return useMutation({
        mutationFn: async (body: { code?: string; password?: string }): Promise<{ disabled: boolean }> => {
            const response = await fetchData("/auth/2fa/disable", { method: "POST", body });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.message || "Failed to disable 2FA.");
            queryClient.invalidateQueries({ queryKey: ["user"] });
            return data;
        }
    });
}

export function useRegenerateBackupCodes() {
    return useMutation({
        mutationFn: async (): Promise<{ backupCodes: string[] }> => {
            const response = await fetchData("/auth/2fa/regenerate-backup-codes", { method: "POST" });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.message || "Failed to regenerate backup codes.");
            return data;
        }
    });
}

export interface PasskeyInfo {
    id: string;
    label: string;
    deviceType?: string;
    backedUp: boolean;
    createdAt: string;
}

export function usePasskeys() {
    return useQuery<PasskeyInfo[]>({
        queryKey: ["passkeys"],
        queryFn: async () => {
            const response = await fetchData("/auth/passkeys", {});
            if (!response.ok) throw new Error("Failed to load passkeys.");
            return response.json();
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useRegisterPasskey() {
    return useMutation({
        mutationFn: async (label: string) => {
            const optRes = await fetchData("/auth/passkeys/register-options", { method: "POST" });
            const optData = await optRes.json();
            if (!optRes.ok) throw new Error(optData?.message || "Failed to start passkey registration.");

            let attResp;
            try {
                attResp = await startRegistration({ optionsJSON: optData });
            } catch (err: any) {
                throw new Error(err?.message || "Passkey registration was cancelled.");
            }

            const verifyRes = await fetchData("/auth/passkeys/register-verify", {
                method: "POST",
                body: { response: attResp, label }
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData?.message || "Failed to verify passkey.");

            queryClient.invalidateQueries({ queryKey: ["passkeys"] });
            return verifyData;
        }
    });
}

export function usePasskeyLogin() {
    return useMutation({
        mutationFn: async () => {
            const optRes = await fetchData("/auth/passkeys/authenticate-options", { method: "POST" });
            const optData = await optRes.json();
            if (!optRes.ok) throw new Error(optData?.message || "Failed to start passkey authentication.");

            let authResp;
            try {
                authResp = await startAuthentication({ optionsJSON: optData });
            } catch (err: any) {
                throw new Error(err?.message || "Passkey authentication was cancelled.");
            }

            const verifyRes = await fetchData("/auth/passkeys/authenticate-verify", {
                method: "POST",
                body: authResp
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData?.message || "Passkey authentication failed.");

            reloadUser(queryClient);
            reloadAuth();
            await storeDeviceToken().catch((err) => Logger.logWarning(String(err)));
            return verifyData;
        }
    });
}

export function useDeletePasskey() {
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await fetchData(`/auth/passkeys/${id}`, { method: "DELETE" });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.message || "Failed to delete passkey.");
            queryClient.invalidateQueries({ queryKey: ["passkeys"] });
            return data;
        }
    });
}

export function useRegister() {
    return useMutation({
        mutationFn: async (body: { first: string, last: string, email: string, password: string }) => {
            const response = await fetchData("/auth/register", {
                method: "POST",
                body
            });

            const data = await response.json();

            if (data.type == "ERROR") {
                return data.message;
            }

            reloadUser(queryClient);
            await storeDeviceToken().catch((err) => Logger.logWarning(String(err)));

            return data;
        }
    })
}

export function useRequestPasswordReset() {
    return useMutation({
        mutationFn: async (body: { email: string }) => {
            const response = await fetchData("/auth/forgot-password", {
                method: "POST",
                body
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || "Unable to send reset email.");
            }

            return data;
        }
    });
}

export function useValidateResetToken(token: string) {
    return useQuery<{ valid: boolean }>({
        queryKey: ["reset-token", token],
        queryFn: async () => {
            const response = await fetchData(`/auth/reset-password?token=${encodeURIComponent(token)}`, {});
            return response.json();
        },
        enabled: Boolean(token),
        staleTime: Infinity,
        retry: false,
    });
}

export function useCompletePasswordReset() {
    return useMutation({
        mutationFn: async (body: { token: string; password: string }) => {
            const response = await fetchData("/auth/reset-password", {
                method: "POST",
                body
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || "Unable to reset password.");
            }

            return data;
        }
    });
}

export async function signout() {
    queryClient.invalidateQueries({ queryKey: ["auth"] });
    queryClient.invalidateQueries({ queryKey: ["user"] });

    Logger.log("User Signed Out.");
}
