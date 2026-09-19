"use client";

import { useState, useEffect } from "react";

const ACTIVITY_ICONS = {
  TICKET_CREATED: "bg-primary-50 text-primary-600",
  STATUS_CHANGED: "bg-warning-50 text-warning-600",
  ASSIGNMENT_CHANGED: "bg-success-50 text-success-600",
  COMMENT_ADDED: "bg-primary-50 text-primary-600",
  SLA_RESPONDED: "bg-warning-50 text-warning-600",
  TICKET_RESOLVED: "bg-success-50 text-success-600",
  TICKET_CLOSED: "bg-gray-50 text-gray-600",
  PRIORITY_CHANGED: "bg-warning-50 text-warning-600",
  WATCHER_ADDED: "bg-surface-secondary text-text-secondary",
  WATCHER_REMOVED: "bg-surface-secondary text-text-secondary",
};

const ACTIVITY_LABELS = {
  TICKET_CREATED: "Created",
  STATUS_CHANGED: "Status",
  ASSIGNMENT_CHANGED: "Assigned",
  COMMENT_ADDED: "Comment",
  SLA_RESPONDED: "SLA",
  TICKET_RESOLVED: "Resolved",
  TICKET_CLOSED: "Closed",
  PRIORITY_CHANGED: "Priority",
  WATCHER_ADDED: "Watch",
  WATCHER_REMOVED: "Unwatch",
};

export default function ActivityTimeline({ ticketId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/activity`);
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        } else {
          setError("Failed to load activity");
        }
      } catch {
        setError("Failed to load activity");
      }
      setLoading(false);
    }
    fetchActivity();
  }, [ticketId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-text">
          Activity Timeline
        </h2>
        <p className="text-sm text-text-muted">Loading activity...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-text">
        Activity Timeline
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm font-medium text-danger-700 ring-1 ring-inset ring-danger-200">
          {error}
        </div>
      )}

      {activities.length === 0 ? (
        <p className="text-sm text-text-muted">No activity yet.</p>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex gap-3 text-sm"
            >
              <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${ACTIVITY_ICONS[activity.type] || "bg-surface-secondary text-text-secondary"}`}>
                {ACTIVITY_LABELS[activity.type]?.charAt(0) || "?"}
              </div>
              <div className="flex-1">
                <p className="text-text">{activity.description}</p>
                <p className="text-xs text-text-muted">
                  {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
