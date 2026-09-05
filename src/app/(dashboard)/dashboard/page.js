"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/app-shell";
import Card, { CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/tickets/status-badge";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/dashboard");
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
        }
      } catch {
        // Silently fail
      }
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-text">Dashboard</h1>
            <p className="text-sm text-text-secondary">
              Overview of your IT service management activity.
            </p>
          </div>
          <p className="text-sm text-text-muted">Loading dashboard...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-sm text-text-secondary">
            Overview of your IT service management activity.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-text-muted">Open Tickets</p>
              <p className="mt-1 text-2xl font-bold text-text">
                {stats?.tickets?.open ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-text-muted">In Progress</p>
              <p className="mt-1 text-2xl font-bold text-text">
                {stats?.tickets?.inProgress ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-text-muted">Resolved Today</p>
              <p className="mt-1 text-2xl font-bold text-success-600">
                {stats?.tickets?.resolvedToday ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-text-muted">SLA Breaches</p>
              <p className="mt-1 text-2xl font-bold text-danger-600">
                {stats?.sla?.breached ?? "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-text-muted">Total Tickets</p>
              <p className="mt-1 text-lg font-bold text-text">
                {stats?.tickets?.total ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-text-muted">Active Users</p>
              <p className="mt-1 text-lg font-bold text-text">
                {stats?.users?.active ?? "—"} / {stats?.users?.total ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-text-muted">SLA Warnings</p>
              <p className="mt-1 text-lg font-bold text-warning-600">
                {stats?.sla?.warning ?? "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-text">Recent Tickets</h2>
          </CardHeader>
          <CardContent>
            {!stats?.recentTickets?.length ? (
              <p className="text-sm text-text-muted">No tickets yet.</p>
            ) : (
              <div className="space-y-3">
                {stats.recentTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text-muted">
                          {ticket.ticketNumber}
                        </span>
                        <StatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                      </div>
                      <p className="mt-0.5 truncate text-sm text-text">
                        {ticket.title}
                      </p>
                    </div>
                    <span className="ml-4 whitespace-nowrap text-xs text-text-muted">
                      {ticket.requester?.username}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
