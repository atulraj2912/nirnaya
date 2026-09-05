import { NextResponse } from "next/server";
import { requireAuth, requireAgentOrAdmin } from "@/lib/authz";
import { getTicketById, updateTicket, TicketError } from "@/lib/services/ticket-service";

export async function GET(request, { params }) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
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
  const { user, response: authResponse } = await requireAuth(request);
  if (authResponse) return authResponse;

  const { response: roleResponse } = await requireAgentOrAdmin(request);
  if (roleResponse) return roleResponse;

  try {
    const { id } = await params;
    const body = await request.json();
    const ticket = await updateTicket(id, body, user);

    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof TicketError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Update ticket error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
