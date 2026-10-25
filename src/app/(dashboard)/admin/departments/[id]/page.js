"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Card, { CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";

const STATUS_LABELS = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_USER: "Waiting for User",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
};

function displayName(user) {
  if (!user) return "—";
  return user.fullName || user.username || "—";
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatCard({ label, value, hint }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-text">{value}</p>
        {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function DepartmentDetailsPage() {
  const params = useParams();
  const departmentId = params.id;
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadDepartment() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/departments/${departmentId}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load department.");
        if (!cancelled) setDepartment(data.department);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load department.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (departmentId) loadDepartment();
    return () => { cancelled = true; };
  }, [departmentId]);

  if (loading) {
    return <div className="p-6 text-sm text-text-muted">Loading department details...</div>;
  }

  if (error || !department) {
    return (
      <div className="space-y-4">
        <Link href="/admin/departments" className="text-sm text-primary-600 hover:underline">← Back to Departments</Link>
        <Card><CardContent><p className="text-sm text-danger-600">{error || "Department not found."}</p></CardContent></Card>
      </div>
    );
  }

  const { stats, users, tickets } = department;
  const ticketStats = stats.ticketStats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/admin/departments" className="text-sm text-primary-600 hover:underline">← Back to Departments</Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-text">{department.name}</h1>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${department.isActive ? "bg-success-50 text-success-700" : "bg-surface-secondary text-text-muted"}`}>
                {department.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-1 text-sm text-text-secondary">Department code: <span className="font-mono">{department.code}</span></p>
          </div>
        </div>
        <Link href="/admin/departments"><Button variant="secondary">Back to list</Button></Link>
      </div>

      <Card>
        <CardContent>
          <h2 className="mb-4 text-base font-semibold text-text">Department Overview</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-text-muted">Manager</dt><dd className="mt-1 text-sm font-medium text-text">{displayName(department.manager)}</dd><dd className="text-xs text-text-secondary">{department.manager?.email || "No manager email"}</dd></div>
            <div><dt className="text-xs text-text-muted">Total Employees</dt><dd className="mt-1 text-sm font-medium text-text">{stats.totalEmployees}</dd></div>
            <div><dt className="text-xs text-text-muted">Active Employees</dt><dd className="mt-1 text-sm font-medium text-text">{stats.activeEmployees}</dd></div>
            <div><dt className="text-xs text-text-muted">Active Agents</dt><dd className="mt-1 text-sm font-medium text-text">{stats.activeAgents}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Ticket Statistics</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Tickets" value={ticketStats.total} />
          <StatCard label="Open" value={ticketStats.open} />
          <StatCard label="Assigned" value={ticketStats.assigned} />
          <StatCard label="In Progress" value={ticketStats.inProgress} />
          <StatCard label="Waiting for User" value={ticketStats.waitingForUser} />
          <StatCard label="Resolved" value={ticketStats.resolved} />
          <StatCard label="Closed" value={ticketStats.closed} />
          <StatCard label="Reopened" value={ticketStats.reopened} />
          <StatCard label="SLA Breaches" value={ticketStats.slaBreaches} hint="Tickets breached on response or resolution SLA" />
        </div>
      </section>

      <Card>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-base font-semibold text-text">Team Members</h2><p className="text-sm text-text-secondary">Employees and agents assigned to this department.</p></div>
            <span className="text-sm text-text-muted">{users.length} members</span>
          </div>
          {users.length === 0 ? <p className="text-sm text-text-muted">No team members found.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-border"><th className="pb-2 pr-4 font-medium text-text-muted">Name</th><th className="pb-2 pr-4 font-medium text-text-muted">Email</th><th className="pb-2 pr-4 font-medium text-text-muted">Role</th><th className="pb-2 pr-4 font-medium text-text-muted">Designation</th><th className="pb-2 font-medium text-text-muted">Status</th></tr></thead>
                <tbody>{users.map((member) => (
                  <tr key={member.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4"><div className="font-medium text-text">{displayName(member)}</div><div className="text-xs text-text-muted">{member.employeeId || member.username}</div></td>
                    <td className="py-3 pr-4 text-text-secondary">{member.email}</td>
                    <td className="py-3 pr-4 text-text-secondary">{member.role}</td>
                    <td className="py-3 pr-4 text-text-secondary">{member.designation || "—"}</td>
                    <td className="py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${member.status === "ACTIVE" ? "bg-success-50 text-success-700" : "bg-surface-secondary text-text-muted"}`}>{member.status}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-text">Recent Department Tickets</h2><p className="text-sm text-text-secondary">Latest 20 tickets for this department.</p></div><span className="text-sm text-text-muted">{tickets.length} shown</span></div>
          {tickets.length === 0 ? <p className="text-sm text-text-muted">No tickets found for this department.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-border"><th className="pb-2 pr-4 font-medium text-text-muted">Ticket</th><th className="pb-2 pr-4 font-medium text-text-muted">Status</th><th className="pb-2 pr-4 font-medium text-text-muted">Priority</th><th className="pb-2 pr-4 font-medium text-text-muted">Requester</th><th className="pb-2 pr-4 font-medium text-text-muted">Assigned Agent</th><th className="pb-2 pr-4 font-medium text-text-muted">Category</th><th className="pb-2 font-medium text-text-muted">Created</th></tr></thead>
                <tbody>{tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4"><div className="font-mono text-xs text-text-secondary">{ticket.ticketNumber}</div><div className="mt-1 max-w-xs font-medium text-text">{ticket.title}</div></td>
                    <td className="py-3 pr-4 text-text-secondary">{STATUS_LABELS[ticket.status] || ticket.status}</td>
                    <td className="py-3 pr-4 text-text-secondary">{ticket.priority}</td>
                    <td className="py-3 pr-4 text-text-secondary">{displayName(ticket.requester)}</td>
                    <td className="py-3 pr-4 text-text-secondary">{displayName(ticket.assignedAgent)}</td>
                    <td className="py-3 pr-4 text-text-secondary">{ticket.category?.name || "—"}</td>
                    <td className="py-3 text-text-secondary">{formatDate(ticket.createdAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
