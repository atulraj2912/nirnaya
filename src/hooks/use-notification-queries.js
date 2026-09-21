"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useNotifications({ page = 1, limit = 20, unreadOnly = false } = {}) {
  return useQuery({
    queryKey: ["notifications", { page, limit, unreadOnly }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (unreadOnly) params.set("unreadOnly", "true");
      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) throw new Error("Failed to load notifications");
      return res.json();
    },
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/unread-count");
      if (!res.ok) throw new Error("Failed to load unread count");
      return res.json();
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId) => {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark as read");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark all as read");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
