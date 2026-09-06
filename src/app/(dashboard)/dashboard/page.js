"use client";

import { useState, useEffect } from "react";
import Card, { CardHeader, CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/tickets/status-badge";

function normalizeStats(data) {
  if (data.openTickets !== undefined) {
    return {
      openTickets: data.openTickets,
      inProgressTickets: data.inProgressTickets,
      resolvedToday: data.resolvedToday,
      slaBreached: data.slaBreached,
      recentTickets: data.recentTickets || [],
    };
  }
  if (data.stats) {
    const s = data.stats;
    return {
      openTickets: (s.tickets?.open || 0) + (s.tickets?.assigned || 0),
      inProgressTickets: (s.tickets?.inProgress || 0),
      resolvedToday: s.tickets?.resolvedToday || 0,
      slaBreached: s.sla?.breached || 0,
      recentTickets: s.recentTickets || [],
    };
  }
  return { openTickets: 0, inProgressTickets: 0, resolvedToday: 0, slaBreached: 0, recentTickets: [] };
}

async function fetchDashboardData(setStats, setError, setLoading) {
  try {
    const userRes = await fetch("/api/auth/me");
    if (!userRes.ok) {
      setError("Unable to load dashboard. Please try again.");
      return;
    }
    const { user } = await userRes.json();
    const endpoint = user.role === "ADMIN" ? "/api/admin/dashboard" : "/api/dashboard/user";
    const res = await fetch(endpoint);
    if (!res.ok) {
      setError("Unable to load dashboard statistics. Please try again.");
      return;
    }
    const data = await res.json();
    setStats(normalizeStats(data));
  } catch (err) {
    console.error("Failed to fetch dashboard stats:", err);
    setError("Unable to load dashboard. Please try again.");
  } finally {
    setLoading(false);
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData(setStats, setError, setLoading);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text">Dashboard</h1>
        <p className="text-sm text-text-muted">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text">Dashboard</h1>
        <Card>
          <CardContent>
            <p className="text-sm text-danger-600">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLoading(true);
                setError(null);
                fetchDashboardData(setStats, setError, setLoading);
              }}
              className="mt-2"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Dashboard</h1>
        <p className="text-sm text-text-secondary">
          Overview of your IT service management.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-text-muted">Open Tickets</p>
            <p className="mt-1 text-3xl font-bold text-text">{stats?.openTickets ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-text-muted">In Progress</p>
            <p className="mt-1 text-3xl font-bold text-text">{stats?.inProgressTickets ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-text-muted">Resolved Today</p>
            <p className="mt-1 text-3xl font-bold text-text">{stats?.resolvedToday ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-text-muted">SLA Breached</p>
            <p className="mt-1 text-3xl font-bold text-danger-600">{stats?.slaBreached ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {stats?.recentTickets?.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-text">Recent Tickets</h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 font-medium text-text-muted">Ticket #</th>
                    <th className="pb-2 pr-4 font-medium text-text-muted">Title</th>
                    <th className="pb-2 pr-4 font-medium text-text-muted">Status</th>
                    <th className="pb-2 font-medium text-text-muted">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTickets.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-text">{t.ticketNumber}</td>
                      <td className="py-2 pr-4 text-text">{t.title}</td>
                      <td className="py-2 pr-4"><StatusBadge status={t.status} /></td>
                      <td className="py-2"><PriorityBadge priority={t.priority} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
