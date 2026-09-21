import { NextResponse } from "next/server";
import { requireAgentOrAdmin } from "@/lib/authz";
import { getAgentDashboardStats } from "@/lib/services/agent-dashboard-service";

export async function GET(request) {
  const { user, response } = await requireAgentOrAdmin(request);
  if (response) return response;

  try {
    const stats = await getAgentDashboardStats(user.id, user.organizationId);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("Agent dashboard stats error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
