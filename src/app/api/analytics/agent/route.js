import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { getAgentAnalytics } from "@/lib/services/agent-analytics-service";
import {
  agentAnalyticsQuerySchema,
  resolveDateRange,
} from "@/lib/validation/analytics";

/**
 * GET /api/analytics/agent
 *
 * Agent self-scoped analytics endpoint.
 * Returns analytics for the authenticated agent's own tickets only.
 *
 * Query params:
 *   timeWindow: "today" | "7d" | "30d" | "month"
 *   start: ISO date string
 *   end: ISO date string
 *   granularity: "hour" | "day" | "week" | "month" (default: "day")
 *
 * Authorization: AGENT or ADMIN role required.
 * agentId and organizationId are ALWAYS derived from the authenticated session.
 * Client-provided agentId or organizationId parameters are IGNORED.
 */
export async function GET(request) {
  const { user, response } = await requireRole(request, ["AGENT", "ADMIN"]);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const parsed = agentAnalyticsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { start, end, granularity } = parsed.data;

  try {
    const dateRange = resolveDateRange({ start, end, timeWindow: parsed.data.timeWindow });

    const analytics = await getAgentAnalytics(user.id, user.organizationId, {
      startDate: dateRange.start,
      endDate: dateRange.end,
      granularity,
    });

    return NextResponse.json(analytics);
  } catch (err) {
    console.error("Agent analytics error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
