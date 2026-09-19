import { Suspense } from "react";
import Link from "next/link";
import TicketList from "@/components/tickets/ticket-list";

export const metadata = {
  title: "Tickets — NIRNAYA",
};

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Tickets</h1>
          <p className="text-sm text-text-secondary">
            Manage and track IT support tickets.
          </p>
        </div>
        <Link
          href="/tickets/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 hover:shadow-md transition-all"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Ticket
        </Link>
      </div>
      <Suspense fallback={<div className="flex justify-center py-12 text-text-muted">Loading...</div>}>
        <TicketList />
      </Suspense>
    </div>
  );
}
