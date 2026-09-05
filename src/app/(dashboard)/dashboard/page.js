import AppShell from "@/components/layout/app-shell";
import Card, { CardHeader, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Dashboard — NIRNAYA",
};

export default function DashboardPage() {
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
              <p className="mt-1 text-2xl font-bold text-text">—</p>
              <p className="text-xs text-text-muted">Phase 4</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-text-muted">Assigned</p>
              <p className="mt-1 text-2xl font-bold text-text">—</p>
              <p className="text-xs text-text-muted">Phase 4</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-text-muted">Resolved Today</p>
              <p className="mt-1 text-2xl font-bold text-text">—</p>
              <p className="text-xs text-text-muted">Phase 4</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-text-muted">SLA Breaches</p>
              <p className="mt-1 text-2xl font-bold text-text">—</p>
              <p className="text-xs text-text-muted">Phase 7</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-text">Recent Activity</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-muted">
              Activity timeline will be populated in Phase 9.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
