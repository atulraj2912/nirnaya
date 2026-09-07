"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusBadge, PriorityBadge } from "./status-badge";

const ACTIVE_STATUSES = ["ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "REOPENED"];

const ALL_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED", "REOPENED"];

export default function TicketList({ scope }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isActiveScope = scope === "my-active";
  const allowedStatuses = isActiveScope ? ACTIVE_STATUSES : ALL_STATUSES;

  const initialStatus = searchParams.get("status") || "";
  const sanitizedStatus = initialStatus && allowedStatuses.includes(initialStatus)
    ? initialStatus
    : "";

  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    status: sanitizedStatus,
    priority: searchParams.get("priority") || "",
    search: searchParams.get("search") || "",
    page: Number(searchParams.get("page")) || 1,
  });

  useEffect(() => {
    async function fetchTickets() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (scope) params.set("scope", scope);
      if (filters.status) params.set("status", filters.status);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.search) params.set("search", filters.search);
      params.set("page", String(filters.page));
      params.set("limit", "20");

      try {
        const res = await fetch(`/api/tickets?${params}`);
        if (res.ok) {
          const data = await res.json();
          setTickets(data.tickets);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        } else {
          setError("Failed to load tickets. Please try again.");
        }
      } catch {
        setError("Network error. Please check your connection.");
      }
      setLoading(false);
    }
    fetchTickets();
  }, [filters, scope]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search tickets..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <select
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-text-muted">Loading tickets...</div>
      ) : error ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-6 text-center">
          <p className="text-sm text-danger-700">{error}</p>
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
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/tickets/${ticket.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-surface-secondary transition-colors"
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
                  <span>→ {ticket.assignedAgent.username}</span>
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
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text hover:bg-surface-secondary disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => updateFilter("page", filters.page + 1)}
              disabled={filters.page >= totalPages}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text hover:bg-surface-secondary disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
