"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function buildTicketListParams({ scope, status, priority, search, page, limit = 20 }) {
  const params = new URLSearchParams();
  if (scope) params.set("scope", scope);
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  if (search) params.set("search", search);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return params.toString();
}

export function useTicketList({ scope, status, priority, search, page }) {
  return useQuery({
    queryKey: ["tickets", { scope, status, priority, search, page }],
    queryFn: async () => {
      const qs = buildTicketListParams({ scope, status, priority, search, page });
      const res = await fetch(`/api/tickets?${qs}`);
      if (!res.ok) throw new Error("Failed to load tickets");
      return res.json();
    },
  });
}

export function useTicket(ticketId) {
  return useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (res.status === 404) throw new Error("NOT_FOUND");
      if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
      if (!res.ok) throw new Error("SERVER_ERROR");
      return res.json();
    },
    enabled: !!ticketId,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      if (!res.ok) throw new Error("Failed to load departments");
      return res.json();
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error("Failed to load tags");
      return res.json();
    },
  });
}

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to load agents");
      return res.json();
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Failed to load user");
      return res.json();
    },
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ticketData) => {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ticketData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create ticket");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useTransitionStatus(ticketId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status) => {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["ticket", ticketId], data);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useAssignTicket(ticketId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ agentId }) => {
      const res = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign ticket");
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["ticket", ticketId], data);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}
