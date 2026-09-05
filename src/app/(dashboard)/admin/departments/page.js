import AppShell from "@/components/layout/app-shell";

export const metadata = {
  title: "Departments — NIRNAYA",
};

export default function AdminDepartmentsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Departments</h1>
          <p className="text-sm text-text-secondary">
            Manage organizational departments.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            Department management will be implemented in Phase 10.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
