import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { listTickets, TicketError } from "@/lib/services/ticket-service";

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
