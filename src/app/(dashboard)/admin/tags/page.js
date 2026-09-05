import AppShell from "@/components/layout/app-shell";

export const metadata = {
  title: "Tags — NIRNAYA",
};

export default function AdminTagsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Tags</h1>
          <p className="text-sm text-text-secondary">
            Manage ticket tags for flexible classification.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            Tag management will be implemented in Phase 10.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
