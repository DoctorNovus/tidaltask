import { useMutation, useQuery, useQueryClient, UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { fetchData } from "@/utils/data";

export interface AdminStats {
    totalUsers: number;
    newUsersLast7Days: number;
    activeUsersLast7Days: number;
    developerUsers: number;
    totalTasks: number;
    repeatingTasks: number;
    activeAnnouncements: number;
}

export interface AdminUser {
    id: string;
    first: string;
    last: string;
    email: string;
    developer: boolean;
    synced: boolean;
    twoFactorEnabled: boolean;
    lastLoggedIn: string | null;
    createdAt: string | null;
}

export interface AdminUserList {
    users: AdminUser[];
    total: number;
    page: number;
    limit: number;
}

export function useAdminStats(enabled: boolean): UseQueryResult<AdminStats> {
    return useQuery({
        queryKey: ["admin", "stats"],
        queryFn: async () => (await fetchData("/admin/stats", {})).json(),
        enabled,
        staleTime: 1000 * 30,
    });
}

export function useAdminUsers(search: string, page: number, enabled: boolean): UseQueryResult<AdminUserList> {
    return useQuery({
        queryKey: ["admin", "users", search, page],
        queryFn: async () => {
            const params = new URLSearchParams({ search, page: String(page), limit: "25" });
            return (await fetchData(`/admin/users?${params.toString()}`, {})).json();
        },
        enabled,
        staleTime: 1000 * 15,
    });
}

export function useSetDeveloper(): UseMutationResult<AdminUser, Error, { id: string; developer: boolean }> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, developer }) => {
            const res = await fetchData(`/admin/users/${id}/developer`, {
                method: "PATCH",
                body: { developer },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Failed to update developer access.");
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
            queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
        },
    });
}
