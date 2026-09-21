import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { getTicketById, TicketError } from "@/lib/services/ticket-service";
import { computeSLAInfo } from "@/lib/services/sla-service";

export async function GET(request, { params }) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { id } = await params;
    const ticket = await getTicketById(id, user);
    const slaInfo = computeSLAInfo(ticket);

    return NextResponse.json({ sla: slaInfo });
  } catch (error) {
    if (error instanceof TicketError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Get SLA info error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
