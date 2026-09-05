import AppShell from "@/components/layout/app-shell";

export const metadata = {
  title: "Users — NIRNAYA",
};

export default function AdminUsersPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">User Management</h1>
          <p className="text-sm text-text-secondary">
            Manage organization users, roles, and access.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            User management will be implemented in Phase 10.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
