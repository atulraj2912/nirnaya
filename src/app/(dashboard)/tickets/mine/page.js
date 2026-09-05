import AppShell from "@/components/layout/app-shell";

export const metadata = {
  title: "My Tickets — NIRNAYA",
};

export default function MyTicketsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">My Tickets</h1>
          <p className="text-sm text-text-secondary">
            Tickets you have submitted or are assigned to.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            My tickets view will be implemented in Phase 4.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
