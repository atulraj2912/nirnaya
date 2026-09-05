import { NextResponse } from "next/server";
import { requireAgentOrAdmin } from "@/lib/authz";
import { classifyTicket } from "@/lib/services/ai-classification-service";

/**
 * POST /api/tickets/[id]/classify
 *
 * Trigger AI classification for a ticket.
 * Only AGENT/ADMIN can trigger classification (per spec §7).
 *
 * Returns the new prediction on success.
 */
export async function POST(request, { params }) {
  try {
    const { user, response: authError } = await requireAgentOrAdmin(request);
    if (authError) {
      return authError;
    }

    const { id } = await params;
    const { prediction, error: classifyError } = await classifyTicket(id, user);

    if (classifyError) {
      return NextResponse.json({ error: classifyError }, { status: 400 });
    }

    return NextResponse.json({ prediction }, { status: 201 });
  } catch (err) {
    console.error("Classify ticket error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
