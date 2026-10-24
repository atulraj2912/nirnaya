"use client";

import { useQuery } from "@tanstack/react-query";

export function useDashboardStats() {
  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Not authenticated");
      }

      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const user = userQuery.data?.user;

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "stats", user?.id, user?.role],
    enabled: Boolean(user?.id && user?.role),
    queryFn: async () => {
      let endpoint;

      if (user.role === "ADMIN") {
        endpoint = "/api/admin/dashboard";
      } else if (user.role === "AGENT") {
        endpoint = "/api/dashboard/agent";
      } else {
        endpoint = "/api/dashboard/user";
      }

      const res = await fetch(endpoint, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to load dashboard");
      }

      return res.json();
    },
  });

  return {
    ...dashboardQuery,
    isLoading: userQuery.isLoading || dashboardQuery.isLoading,
    error: userQuery.error || dashboardQuery.error,
    refetch: dashboardQuery.refetch,
  };
}

export function useAnalytics(timeWindow = "30d") {
  return useQuery({
    queryKey: ["analytics", timeWindow],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics?timeWindow=${timeWindow}`);
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
  });
}

export function useSavedReplies({ page = 1, limit = 20, search = "" } = {}) {
  return useQuery({
    queryKey: ["saved-replies", { page, limit, search }],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/saved-replies?${params}`);
      if (!res.ok) throw new Error("Failed to load saved replies");
      return res.json();
    },
  });
}
