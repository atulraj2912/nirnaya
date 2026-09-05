import { NextResponse } from "next/server";
import { requireAuth, requireAgentOrAdmin } from "@/lib/authz";
import { getTicketById, updateTicket, TicketError } from "@/lib/services/ticket-service";

export async function GET(request, { params }) {
  try {
    const { user, error } = await requireAuth();
    if (error) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = await params;
    const ticket = await getTicketById(id, user);

    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof TicketError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Get ticket error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { user, error } = await requireAuth();
    if (error) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { user: agentUser, error: agentError } = await requireAgentOrAdmin();
    if (agentError) {
      return NextResponse.json({ error: agentError }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const ticket = await updateTicket(id, body, agentUser);

    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof TicketError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Update ticket error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
