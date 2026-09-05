import AppShell from "@/components/layout/app-shell";

export const metadata = {
  title: "Categories — NIRNAYA",
};

export default function AdminCategoriesPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Categories</h1>
          <p className="text-sm text-text-secondary">
            Manage ticket classification categories.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            Category management will be implemented in Phase 10.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
