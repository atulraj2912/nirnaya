import AppShell from "@/components/layout/app-shell";

export const metadata = {
  title: "SLA Configuration — NIRNAYA",
};

export default function AdminSlaPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">SLA Configuration</h1>
          <p className="text-sm text-text-secondary">
            Configure priority-based SLA response and resolution targets.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            SLA configuration will be implemented in Phase 7.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
