"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusBadge, PriorityBadge } from "./status-badge";
import { useTicketList } from "@/hooks/use-ticket-queries";

const ACTIVE_STATUSES = ["ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "REOPENED"];

const ALL_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED", "REOPENED"];

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function TicketList({ scope }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isActiveScope = scope === "my-active";
  const allowedStatuses = isActiveScope ? ACTIVE_STATUSES : ALL_STATUSES;

  const initialStatus = searchParams.get("status") || "";
  const sanitizedStatus = initialStatus && allowedStatuses.includes(initialStatus)
    ? initialStatus
    : "";

  const [filters, setFilters] = useState({
    status: sanitizedStatus,
    priority: searchParams.get("priority") || "",
    search: searchParams.get("search") || "",
    page: Number(searchParams.get("page")) || 1,
  });

  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const { data, isLoading, error } = useTicketList({
    scope,
    status: filters.status,
    priority: filters.priority,
    search: debouncedSearch,
    page: filters.page,
  });

  const tickets = data?.tickets ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  function updateFilter(key, value) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key !== "page" ? { page: 1 } : {}),
    }));
  }

  const errorMessage = error
    ? error.message === "Failed to load tickets"
      ? "Failed to load tickets. Please try again."
      : "Network error. Please check your connection."
    : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search tickets..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="w-full rounded-lg border border-border bg-surface pl-10 pr-3 py-2 text-sm text-text placeholder:text-text-muted transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          {isActiveScope ? (
            <>
              <option value="">All Active</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_USER">Waiting for User</option>
              <option value="REOPENED">Reopened</option>
            </>
          ) : (
            <>
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_USER">Waiting for User</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
              <option value="REOPENED">Reopened</option>
            </>
          )}
        </select>
        <select
          value={filters.priority}
          onChange={(e) => updateFilter("priority", e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-text-muted">Loading tickets...</div>
      ) : errorMessage ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-6 text-center">
          <p className="text-sm text-danger-700">{errorMessage}</p>
          <button
            onClick={() => setFilters((prev) => ({ ...prev }))}
            className="mt-3 text-sm font-medium text-danger-600 hover:text-danger-800"
          >
            Retry
          </button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex justify-center py-12 text-text-muted">
          {scope === "my-active" ? "No active tickets." : "No tickets found"}
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface shadow-sm">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/tickets/${ticket.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-surface-secondary/50 transition-colors"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-muted">{ticket.ticketNumber}</span>
                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <p className="text-sm font-medium text-text truncate">{ticket.title}</p>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span>{ticket.requester?.username}</span>
                  {ticket.department?.name && <span>{ticket.department.name}</span>}
                  {ticket.category?.name && <span>{ticket.category.name}</span>}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-muted ml-4 shrink-0">
                {ticket.assignedAgent && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                    </svg>
                    {ticket.assignedAgent.username}
                  </span>
                )}
                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
            Showing {(filters.page - 1) * 20 + 1}–{Math.min(filters.page * 20, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => updateFilter("page", filters.page - 1)}
              disabled={filters.page <= 1}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text hover:bg-surface-secondary disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => updateFilter("page", filters.page + 1)}
              disabled={filters.page >= totalPages}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text hover:bg-surface-secondary disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
