import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { createTicket, listTickets, TicketError } from "@/lib/services/ticket-service";
import { classifyTicket } from "@/lib/services/ai-classification-service";

export async function GET(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());

    const result = await listTickets(query, user);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TicketError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("List tickets error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/tickets
 *
 * Create a new ticket. After successful creation, triggers async
 * AI classification in the background (fire-and-forget).
 * Classification failure must NOT prevent ticket creation.
 *
 * Per spec §17: "The implementation should support an actual AI
 * provider when configured."
 */
export async function POST(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const body = await request.json();
    const ticket = await createTicket(body, user);

    // Fire-and-forget: trigger AI classification after ticket creation.
    // Classification failure must not affect ticket creation response.
    classifyTicket(ticket.id, user).catch((err) => {
      console.error("Auto-classification failed for ticket", ticket.id, ":", err.message);
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    if (error instanceof TicketError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Create ticket error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
