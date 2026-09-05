import AppShell from "@/components/layout/app-shell";

export const metadata = {
  title: "Tickets — NIRNAYA",
};

export default function TicketsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Tickets</h1>
          <p className="text-sm text-text-secondary">
            Manage and track IT support tickets.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            Ticket list will be implemented in Phase 4.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
