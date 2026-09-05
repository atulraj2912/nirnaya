import { Suspense } from "react";
import AppShell from "@/components/layout/app-shell";
import TicketList from "@/components/tickets/ticket-list";

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
            Tickets you have submitted.
          </p>
        </div>
        <Suspense fallback={<div className="flex justify-center py-12 text-text-muted">Loading...</div>}>
          <TicketList />
        </Suspense>
      </div>
    </AppShell>
  );
}
