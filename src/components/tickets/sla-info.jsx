"use client";

import { useState, useEffect } from "react";

const slaStatusColorClasses = {
  ON_TRACK: "bg-success-50 text-success-700 ring-success-600/10",
  WARNING: "bg-warning-50 text-warning-700 ring-warning-600/10",
  BREACHED: "bg-danger-50 text-danger-700 ring-danger-600/10",
  PAUSED: "bg-gray-50 text-gray-700 ring-gray-600/10",
  COMPLETED: "bg-success-50 text-success-700 ring-success-600/10",
};

const slaStatusLabels = {
  ON_TRACK: "On Track",
  WARNING: "Warning",
  BREACHED: "Breached",
  PAUSED: "Paused",
  COMPLETED: "Completed",
};

function formatRemaining(ms) {
  if (ms === null || ms === undefined) return null;
  if (ms < 0) return "Overdue";

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function SLARow({ label, status, dueAt, remainingMs, met }) {
  const colorClasses = slaStatusColorClasses[status] || "bg-gray-50 text-gray-700 ring-gray-600/10";
  const statusLabel = slaStatusLabels[status] || status;

  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-text">{label}</p>
        {dueAt && (
          <p className="text-xs text-text-muted">
            Due: {new Date(dueAt).toLocaleString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {remainingMs !== null && remainingMs !== undefined && (
          <span className="text-xs text-text-muted font-mono">
            {formatRemaining(remainingMs)}
          </span>
        )}
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${colorClasses}`}
        >
          {met ? "Met" : statusLabel}
        </span>
      </div>
    </div>
  );
}

export default function SLAInfo({ ticketId }) {
  const [sla, setSla] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchSLA() {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/sla`);
        if (res.ok) {
          const data = await res.json();
          setSla(data.sla);
        } else {
          setError("Failed to load SLA info");
        }
      } catch {
        setError("Failed to load SLA info");
      } finally {
        setLoading(false);
      }
    }
    fetchSLA();
  }, [ticketId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-text">SLA Status</h2>
        <p className="text-sm text-text-muted">Loading...</p>
      </div>
    );
  }

  if (error || !sla) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-text">SLA Status</h2>
      <p className="mb-3 text-xs text-text-muted">
        Elapsed time only — business hours not applied
      </p>
      <div className="divide-y divide-border">
        <SLARow
          label="Response SLA"
          status={sla.response.status}
          dueAt={sla.response.dueAt}
          remainingMs={sla.response.remainingMs}
          met={sla.response.met}
        />
        <SLARow
          label="Resolution SLA"
          status={sla.resolution.status}
          dueAt={sla.resolution.dueAt}
          remainingMs={sla.resolution.remainingMs}
          met={sla.resolution.met}
        />
      </div>
    </div>
  );
}
