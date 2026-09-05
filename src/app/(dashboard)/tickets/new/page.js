import AppShell from "@/components/layout/app-shell";

export const metadata = {
  title: "Create Ticket — NIRNAYA",
};

export default function NewTicketPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Create Ticket</h1>
          <p className="text-sm text-text-secondary">
            Submit a new IT support request.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            Ticket creation form will be implemented in Phase 4.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
