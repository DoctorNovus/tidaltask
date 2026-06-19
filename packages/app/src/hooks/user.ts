import { QueryClient, UseMutationResult, UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData } from "@/utils/data";

export interface User {
    id: string;
    first: string;
    last: string;
    email: string;
    developer: boolean;
    synced: boolean;
    lastLoggedIn?: Date;
    twoFactorEnabled: boolean;
};

export type ApiKeys = Record<string, string>;

async function getUser(): Promise<User> {
    const response = await fetchData("/user", {});
    return await response.json();
}

export async function updateProfile(data: Partial<Pick<User, "first" | "last" | "email">>): Promise<void> {
    const response = await fetchData("/user", {
        method: "PATCH",
        body: data
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || "Unable to update profile");
    }
}

export async function updateName(first: string, last: string): Promise<void> {
    return updateProfile({ first, last });
}

export function useUser(): UseQueryResult<User> {
    return useQuery({
        queryKey: ["user"],
        queryFn: getUser,
        staleTime: Infinity
    });
}

export function useUpdateProfile(): UseMutationResult<void, Error, Partial<Pick<User, "first" | "last" | "email">>> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateProfile,
        onSuccess: () => reloadUser(queryClient)
    });
}

export function useChangePassword(): UseMutationResult<void, Error, { currentPassword: string; newPassword: string }> {
    return useMutation({
        mutationFn: async (body) => {
            const response = await fetchData("/user/password", {
                method: "PATCH",
                body
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err?.message || "Unable to update password");
            }
        }
    });
}

export async function exportUserData(): Promise<{ user: User | null; tasks: any[] }> {
    const response = await fetchData("/user/export", {});
    return await response.json();
}

export function useExportUserData() {
    return useMutation({ mutationFn: exportUserData });
}

export async function requestUserDeletion(): Promise<{ deletedUser: boolean; removedFromTasks: number; deletedTasks: number }> {
    const response = await fetchData("/user/delete", {
        method: "POST"
    });
    return await response.json();
}

export function useRequestUserDeletion() {
    return useMutation({
        mutationFn: requestUserDeletion
    });
}

async function getApiKeys(): Promise<ApiKeys> {
    const response = await fetchData("/user/api-keys", {});
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || "Unable to fetch API keys");
    }
    const data = await response.json().catch(() => ({}));
    return data?.apiKeys ?? {};
}

async function updateApiKeys(apiKeys: ApiKeys): Promise<void> {
    const response = await fetchData("/user/api-keys", {
        method: "PATCH",
        body: { apiKeys }
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || "Unable to update API keys");
    }
}

export function useApiKeys(): UseQueryResult<ApiKeys> {
    return useQuery({
        queryKey: ["user", "api-keys"],
        queryFn: getApiKeys,
        staleTime: Infinity
    });
}

export function useUpdateApiKeys(): UseMutationResult<void, Error, ApiKeys> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateApiKeys,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user", "api-keys"] })
    });
}

async function generateApiKey(name: string): Promise<{ name: string; value: string }> {
    const response = await fetchData("/user/api-keys/generate", {
        method: "POST",
        body: { name }
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || "Unable to generate API key");
    }

    return response.json();
}

export function useGenerateApiKey(): UseMutationResult<{ name: string; value: string }, Error, string> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: generateApiKey,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user", "api-keys"] })
    });
}

export function reloadUser(queryClient: QueryClient): Promise<void> {
    return queryClient.invalidateQueries({ queryKey: ["user"] });
}

export function reloadToken(queryClient: QueryClient): Promise<void> {
    return queryClient.invalidateQueries({ queryKey: ["token"] });
}
