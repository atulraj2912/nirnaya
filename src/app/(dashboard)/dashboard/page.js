"use client";

import Card, { CardHeader, CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/tickets/status-badge";
import { useDashboardStats } from "@/hooks/use-dashboard-queries";

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

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-surface-secondary animate-pulse" />
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-surface-secondary animate-pulse" />
          <div className="h-6 w-10 rounded bg-surface-secondary animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonTable() {
  return (
    <Card>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-4">
              <div className="h-4 w-24 rounded bg-surface-secondary animate-pulse" />
              <div className="h-4 flex-1 rounded bg-surface-secondary animate-pulse" />
              <div className="h-4 w-16 rounded bg-surface-secondary animate-pulse" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const icons = {
  ticket: <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" /></svg>,
  progress: <svg className="h-6 w-6 text-warning-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" /></svg>,
  check: <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
  alert: <svg className="h-6 w-6 text-danger-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>,
  users: <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>,
  waiting: <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
};

function RecentTicketsTable({ tickets, title = "Recent Tickets" }) {
  if (!tickets?.length) return null;
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-text">{title}</h2>
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
              {tickets.map((t) => (
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
  );
}

function UserDashboard({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open Tickets" value={data.openTickets ?? 0} accent="bg-primary-50" icon={icons.ticket} />
        <StatCard label="In Progress" value={data.inProgressTickets ?? 0} accent="bg-warning-50" icon={icons.progress} />
        <StatCard label="Resolved Today" value={data.resolvedToday ?? 0} accent="bg-success-50" icon={icons.check} />
        <StatCard label="SLA Breached" value={data.slaBreached ?? 0} accent="bg-danger-50" icon={icons.alert} />
      </div>
      <RecentTicketsTable tickets={data.recentTickets} title="Your Recent Tickets" />
    </div>
  );
}

function AgentDashboard({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open Tickets" value={data.openTickets ?? 0} accent="bg-primary-50" icon={icons.ticket} />
        <StatCard label="Assigned to Me" value={data.assignedToMe ?? 0} accent="bg-blue-50" icon={icons.users} />
        <StatCard label="In Progress" value={data.inProgress ?? 0} accent="bg-warning-50" icon={icons.progress} />
        <StatCard label="Waiting for User" value={data.waitingForUser ?? 0} accent="bg-purple-50" icon={icons.waiting} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Resolved Today" value={data.resolvedToday ?? 0} accent="bg-success-50" icon={icons.check} />
        <StatCard label="SLA Breached" value={data.breachedSLA ?? 0} accent="bg-danger-50" icon={icons.alert} />
      </div>
      <RecentTicketsTable tickets={data.recentTickets} title="Recent Unassigned / Open Tickets" />
    </div>
  );
}

function AdminDashboard({ data }) {
  const stats = data.stats || data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open Tickets" value={(stats.tickets?.open || 0) + (stats.tickets?.assigned || 0)} accent="bg-primary-50" icon={icons.ticket} />
        <StatCard label="In Progress" value={stats.tickets?.inProgress || 0} accent="bg-warning-50" icon={icons.progress} />
        <StatCard label="Resolved Today" value={stats.tickets?.resolvedToday || 0} accent="bg-success-50" icon={icons.check} />
        <StatCard label="SLA Breached" value={stats.sla?.breached || 0} accent="bg-danger-50" icon={icons.alert} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Tickets" value={stats.tickets?.total || 0} accent="bg-surface-secondary" icon={icons.ticket} />
        <StatCard label="Closed" value={stats.tickets?.closed || 0} accent="bg-surface-secondary" icon={icons.check} />
        <StatCard label="SLA Warning" value={stats.sla?.warning || 0} accent="bg-warning-50" icon={icons.alert} />
        <StatCard label="Active Users" value={stats.users?.active || 0} accent="bg-blue-50" icon={icons.users} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-text-muted">Departments</p>
            <p className="text-2xl font-bold text-text">{stats.departments?.active || 0}</p>
            <p className="text-xs text-text-muted">{stats.departments?.total || 0} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-text-muted">Categories</p>
            <p className="text-2xl font-bold text-text">{stats.categories?.active || 0}</p>
            <p className="text-xs text-text-muted">{stats.categories?.total || 0} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-text-muted">Tags</p>
            <p className="text-2xl font-bold text-text">{stats.tags?.total || 0}</p>
          </CardContent>
        </Card>
      </div>
      <RecentTicketsTable tickets={stats.recentTickets} title="Recent Tickets" />
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text">Dashboard</h1>
        <Card>
          <CardContent>
            <p className="text-sm text-danger-600">Failed to load dashboard. Please try again.</p>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-2">Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine role from the response shape
  const isAgent = data.assignedToMe !== undefined;
  const isAdmin = data.stats !== undefined || data.tickets?.total !== undefined;
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text">Dashboard</h1>
        <p className="text-sm text-text-secondary">
          {isAdmin ? "Organization overview." : isAgent ? "Your agent workload." : "Your ticket overview."}
        </p>
      </div>
      {isAdmin ? <AdminDashboard data={data} /> : isAgent ? <AgentDashboard data={data} /> : <UserDashboard data={data} />}
    </div>
  );
}
