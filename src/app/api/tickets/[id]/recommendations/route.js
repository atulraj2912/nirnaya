import { NextResponse } from "next/server";
import { requireAgentOrAdmin } from "@/lib/authz";
import { getRecommendations } from "@/lib/services/agent-recommendation-service";

/**
 * GET /api/tickets/[id]/recommendations
 *
 * Get AI agent assignment recommendations for a ticket.
 * Per spec §18: "Recommendation is NOT the same thing as assignment."
 *
 * Only AGENT/ADMIN can request recommendations (per spec §7).
 * Organization-scoped. Deterministic scoring from database data.
 */
export async function GET(request, { params }) {
  const { user, response } = await requireAgentOrAdmin(request);
  if (response) return response;

  try {
    const { id } = await params;
    const result = await getRecommendations(id, user);

    if (result.error) {
      const status = result.error === "Ticket not found" ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Get recommendations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
