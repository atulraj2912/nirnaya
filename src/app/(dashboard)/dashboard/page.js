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

function StatCard({ label, value, icon, accent }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-text-muted">{label}</p>
          <p className="text-2xl font-bold text-text">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
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
        <h1 className="text-2xl font-bold tracking-tight text-text">Dashboard</h1>
        <p className="text-sm text-text-secondary">
          Overview of your IT service management.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open Tickets"
          value={stats?.openTickets ?? 0}
          accent="bg-primary-50"
          icon={
            <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
            </svg>
          }
        />
        <StatCard
          label="In Progress"
          value={stats?.inProgressTickets ?? 0}
          accent="bg-warning-50"
          icon={
            <svg className="h-6 w-6 text-warning-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
            </svg>
          }
        />
        <StatCard
          label="Resolved Today"
          value={stats?.resolvedToday ?? 0}
          accent="bg-success-50"
          icon={
            <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <StatCard
          label="SLA Breached"
          value={stats?.slaBreached ?? 0}
          accent="bg-danger-50"
          icon={
            <svg className="h-6 w-6 text-danger-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          }
        />
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
