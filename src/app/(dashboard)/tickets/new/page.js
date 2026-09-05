import TicketForm from "@/components/tickets/ticket-form";

export const metadata = {
  title: "New Ticket — NIRNAYA",
};

export default function NewTicketPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Create Ticket</h1>
        <p className="text-sm text-text-secondary">
          Submit a new IT support request.
        </p>
      </div>
      <TicketForm />
    </div>
  );
}
