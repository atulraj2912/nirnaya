import AppShell from "@/components/layout/app-shell";
import TicketForm from "@/components/tickets/ticket-form";

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
        <div className="rounded-xl border border-border bg-surface p-6">
          <TicketForm />
        </div>
      </div>
    </AppShell>
  );
}
