import { Suspense } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/app-shell";
import TicketList from "@/components/tickets/ticket-list";

export const metadata = {
  title: "Tickets — NIRNAYA",
};

export default function TicketsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">Tickets</h1>
            <p className="text-sm text-text-secondary">
              Manage and track IT support tickets.
            </p>
          </div>
          <Link
            href="/tickets/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            New Ticket
          </Link>
        </div>
        <Suspense fallback={<div className="flex justify-center py-12 text-text-muted">Loading...</div>}>
          <TicketList />
        </Suspense>
      </div>
    </AppShell>
  );
}
