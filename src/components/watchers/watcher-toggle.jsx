"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/button";

export default function WatcherToggle({ ticketId, currentUser }) {
  const [watchers, setWatchers] = useState([]);
  const [isWatching, setIsWatching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    async function fetchWatchers() {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/watchers`);
        if (res.ok) {
          const data = await res.json();
          setWatchers(data.watchers || []);
          setIsWatching(
            (data.watchers || []).some((w) => w.userId === currentUser?.id)
          );
        }
      } catch {
        // Silently fail
      }
    }
    if (currentUser) fetchWatchers();
  }, [ticketId, currentUser]);

  async function handleToggleWatch() {
    if (!currentUser) return;
    setLoading(true);
    try {
      if (isWatching) {
        const res = await fetch(
          `/api/tickets/${ticketId}/watchers?userId=${currentUser.id}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          setIsWatching(false);
          setWatchers((prev) =>
            prev.filter((w) => w.userId !== currentUser.id)
          );
        }
      } else {
        const res = await fetch(`/api/tickets/${ticketId}/watchers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUser.id }),
        });
        if (res.ok) {
          setIsWatching(true);
          setWatchers((prev) => [
            ...prev,
            {
              userId: currentUser.id,
              user: {
                id: currentUser.id,
                username: currentUser.username,
                role: currentUser.role,
              },
            },
          ]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">
            Watchers {watchers.length > 0 && `(${watchers.length})`}
          </h2>
          <p className="text-xs text-text-muted">
            Get notified about updates to this ticket
          </p>
        </div>
        <Button
          variant={isWatching ? "danger" : "secondary"}
          size="sm"
          onClick={handleToggleWatch}
          disabled={loading}
        >
          {loading ? "..." : isWatching ? "Unwatch" : "Watch"}
        </Button>
      </div>

      {watchers.length > 0 && (
        <div className="mt-4 space-y-2">
          <button
            onClick={() => setShowList(!showList)}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            {showList ? "Hide" : "Show"} watchers
          </button>
          {showList && (
            <div className="space-y-1">
              {watchers.map((w) => (
                <div
                  key={w.userId}
                  className="flex items-center gap-2 text-sm text-text-secondary"
                >
                  <span className="font-medium text-text">
                    {w.user?.username}
                  </span>
                  {w.user?.role && (
                    <span className="text-xs text-text-muted">
                      ({w.user.role})
                    </span>
                  )}
                  {w.userId === currentUser?.id && (
                    <span className="text-xs text-primary-600">(you)</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
