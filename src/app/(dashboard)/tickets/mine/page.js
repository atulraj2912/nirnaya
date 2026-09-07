import { Suspense } from "react";
import TicketList from "@/components/tickets/ticket-list";

export const metadata = {
  title: "My Active Tickets — NIRNAYA",
};

export default function MyTicketsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">My Active Tickets</h1>
        <p className="text-sm text-text-secondary">
          Tickets you are currently working on.
        </p>
      </div>
      <Suspense fallback={<div className="flex justify-center py-12 text-text-muted">Loading...</div>}>
        <TicketList scope="my-active" />
      </Suspense>
    </div>
  );
}
