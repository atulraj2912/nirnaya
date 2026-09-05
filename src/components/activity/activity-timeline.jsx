"use client";

import { useState, useEffect } from "react";

const ACTIVITY_ICONS = {
  TICKET_CREATED: "📝",
  STATUS_CHANGED: "🔄",
  ASSIGNMENT_CHANGED: "👤",
  COMMENT_ADDED: "💬",
  SLA_RESPONDED: "⏱",
  TICKET_RESOLVED: "✅",
  TICKET_CLOSED: "🔒",
  PRIORITY_CHANGED: "🔺",
  WATCHER_ADDED: "👁",
  WATCHER_REMOVED: "👁",
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
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-text">
          Activity Timeline
        </h2>
        <p className="text-sm text-text-muted">Loading activity...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-semibold text-text">
        Activity Timeline
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {activities.length === 0 ? (
        <p className="text-sm text-text-muted">No activity yet.</p>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex gap-3 text-sm"
            >
              <span className="mt-0.5 text-base">
                {ACTIVITY_ICONS[activity.type] || "📋"}
              </span>
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
