import AppShell from "@/components/layout/app-shell";

export const metadata = {
  title: "Settings — NIRNAYA",
};

export default function AdminSettingsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Organization Settings</h1>
          <p className="text-sm text-text-secondary">
            Configure your organization&apos;s general settings.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            Settings will be implemented in Phase 10.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
