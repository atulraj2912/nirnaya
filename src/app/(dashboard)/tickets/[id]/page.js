import AppShell from "@/components/layout/app-shell";
import TicketDetail from "@/components/tickets/ticket-detail";

export default async function TicketDetailPage({ params }) {
  const { id } = await params;

  return (
    <AppShell>
      <div className="space-y-6">
        <TicketDetail ticketId={id} />
      </div>
    </AppShell>
  );
}
