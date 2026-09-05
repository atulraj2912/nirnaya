import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { transitionStatus, TicketError } from "@/lib/services/ticket-service";

export async function POST(request, { params }) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { id } = await params;
    const body = await request.json();
    const ticket = await transitionStatus(id, body.status, user);

    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof TicketError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Transition status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
