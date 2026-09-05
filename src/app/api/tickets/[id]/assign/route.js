import { NextResponse } from "next/server";
import { requireAuth, requireAgentOrAdmin } from "@/lib/authz";
import { assignTicket, TicketError } from "@/lib/services/ticket-service";

export async function POST(request, { params }) {
  const { user, response: authResponse } = await requireAuth(request);
  if (authResponse) return authResponse;

  const { response: roleResponse } = await requireAgentOrAdmin(request);
  if (roleResponse) return roleResponse;

  try {
    const { id } = await params;
    const body = await request.json();
    const ticket = await assignTicket(id, body, user);

    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof TicketError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Assign ticket error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
