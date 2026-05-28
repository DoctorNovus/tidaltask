import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { reloadUser } from "./user";
import { queryClient } from "..";
import { fetchData } from "@/utils/data";
import { Logger } from "@/utils/logger";
import { Capacitor } from "@capacitor/core";
import { SecureToken } from "@/plugins/secureToken";
import { syncServerNotifications } from "@/utils/notifs";

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
        mutationFn: async (body: { email: string, password: string }) => {
            const response = await fetchData("/auth/login", {
                method: "POST",
                body
            });

            if (!response.ok)
                return await response.json();

            if (response.ok){
                reloadUser(queryClient);
                reloadAuth();
                await storeDeviceToken().catch((err) => Logger.logWarning(String(err)));
            }
        }
    })
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
