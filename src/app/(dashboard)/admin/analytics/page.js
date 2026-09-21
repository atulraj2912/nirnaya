"use client";

import { useState } from "react";
import Card, { CardHeader, CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";
import { useAnalytics } from "@/hooks/use-dashboard-queries";
import { BarChart, HorizontalBarChart } from "@/components/ui/bar-chart";

const TIME_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "month", label: "This Month" },
];

const STATUS_COLORS = {
  OPEN: "bg-primary-500",
  ASSIGNED: "bg-blue-500",
  IN_PROGRESS: "bg-warning-500",
  WAITING_FOR_USER: "bg-purple-500",
  RESOLVED: "bg-success-500",
  CLOSED: "bg-gray-500",
  REOPENED: "bg-danger-500",
};

const PRIORITY_COLORS = {
  LOW: "bg-gray-400",
  MEDIUM: "bg-blue-500",
  HIGH: "bg-warning-500",
  CRITICAL: "bg-danger-500",
};

function StatCard({ label, value, accent }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-text-muted">{label}</p>
        <p className={`text-2xl font-bold ${accent || "text-text"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map(i => (
        <Card key={i}>
          <CardContent>
            <div className="h-3 w-20 rounded bg-surface-secondary animate-pulse mb-2" />
            <div className="h-6 w-12 rounded bg-surface-secondary animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <Card>
      <CardContent>
        <div className="h-4 w-32 rounded bg-surface-secondary animate-pulse mb-4" />
        <div className="flex items-end gap-2 h-48">
          {[45, 30, 55, 20, 65, 35, 50].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-surface-secondary animate-pulse" style={{ height: `${h}%` }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [timeWindow, setTimeWindow] = useState("30d");
  const { data, isLoading, error, refetch } = useAnalytics(timeWindow);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Analytics</h1>
          <p className="text-sm text-text-secondary">Loading analytics...</p>
        </div>
        <SkeletonGrid />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text">Analytics</h1>
        <Card>
          <CardContent>
            <p className="text-sm text-danger-600">Failed to load analytics.</p>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-2">Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusData = (data.statusBreakdown || []).map(s => ({
    label: s.status.replace(/_/g, " "),
    value: s.count,
    color: STATUS_COLORS[s.status] || "bg-gray-400",
  }));

  const priorityData = (data.priorityBreakdown || []).map(p => ({
    label: p.priority,
    value: p.count,
    color: PRIORITY_COLORS[p.priority] || "bg-gray-400",
  }));

  const deptData = (data.departmentBreakdown || []).map(d => ({
    label: d.name,
    value: d.count,
  }));

  const catData = (data.categoryBreakdown || []).map(c => ({
    label: c.name,
    value: c.count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Analytics</h1>
          <p className="text-sm text-text-secondary">
            Ticket analytics for your organization.
            {data.startDate && (
              <> {new Date(data.startDate).toLocaleDateString()} - {new Date(data.endDate).toLocaleDateString()}</>
            )}
          </p>
        </div>
        <div className="flex gap-1">
          {TIME_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              variant={timeWindow === opt.value ? "primary" : "ghost"}
              size="sm"
              onClick={() => setTimeWindow(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Tickets" value={data.totalTickets || 0} />
        <StatCard label="SLA Breached" value={data.slaMetrics?.breached || 0} accent="text-danger-600" />
        <StatCard label="SLA Warning" value={data.slaMetrics?.warning || 0} accent="text-warning-600" />
        <StatCard label="Avg Resolution" value={data.avgResolutionTime !== null ? `${data.avgResolutionTime}h` : "N/A"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-text">Tickets by Status</h2>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <HorizontalBarChart data={statusData} labelKey="label" valueKey="value" />
            ) : (
              <p className="text-sm text-text-muted">No data for this period.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-text">Tickets by Priority</h2>
          </CardHeader>
          <CardContent>
            {priorityData.length > 0 ? (
              <HorizontalBarChart data={priorityData} labelKey="label" valueKey="value" />
            ) : (
              <p className="text-sm text-text-muted">No data for this period.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-text">Tickets by Department</h2>
          </CardHeader>
          <CardContent>
            {deptData.length > 0 ? (
              <HorizontalBarChart data={deptData} labelKey="label" valueKey="value" />
            ) : (
              <p className="text-sm text-text-muted">No data for this period.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-text">Tickets by Category</h2>
          </CardHeader>
          <CardContent>
            {catData.length > 0 ? (
              <HorizontalBarChart data={catData} labelKey="label" valueKey="value" />
            ) : (
              <p className="text-sm text-text-muted">No data for this period.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {data.ticketsByDay?.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-text">Ticket Trend</h2>
          </CardHeader>
          <CardContent>
            <BarChart
              data={data.ticketsByDay.map(d => ({ label: d.date.slice(5), value: d.created }))}
              labelKey="label"
              valueKey="value"
              height={160}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
