import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { getPredictions } from "@/lib/services/ai-classification-service";

/**
 * GET /api/tickets/[id]/ai
 *
 * Get AI predictions for a ticket.
 * Organization-scoped. Any authenticated user with ticket access can view.
 */
export async function GET(request, { params }) {
  try {
    const { user, error } = await requireAuth();
    if (error) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { id } = await params;
    const predictions = await getPredictions(id, user);

    return NextResponse.json({ predictions });
  } catch (err) {
    console.error("Get AI predictions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
