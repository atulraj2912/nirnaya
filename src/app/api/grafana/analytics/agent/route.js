import { NextResponse } from "next/server";
import { getAgentAnalytics } from "@/lib/services/agent-analytics-service";
import {
  extractGrafanaToken,
  validateGrafanaToken,
  grafanaAgentQuerySchema,
} from "@/lib/validation/grafana";

/**
 * GET /api/grafana/analytics/agent
 *
 * Grafana-proxied agent analytics endpoint.
 * Returns agent-scoped analytics for the agent Grafana dashboard.
 *
 * SECURITY:
 *   - agentId and organizationId are derived from the validated service token
 *   - Never accepted from client/Grafana query parameters
 *   - Token maps to a fixed agent user + organization via env vars
 *   - Agent can only see their own ticket data
 *
 * Auth: Bearer service token (GRAFANA_AGENT_SERVICE_TOKEN)
 *
 * Query params:
 *   start: ISO date string (required)
 *   end: ISO date string (required)
 *   granularity: "hour" | "day" | "week" | "month" (default: "day")
 */
export async function GET(request) {
  // 1. Authenticate service token
  const { valid, token, error } = extractGrafanaToken(request);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized", details: error }, { status: 401 });
  }

  const auth = await validateGrafanaToken(token);
  if (!auth.valid) {
    return NextResponse.json({ error: "Forbidden", details: auth.error }, { status: 403 });
  }

  if (auth.type !== "agent") {
    return NextResponse.json(
      { error: "Forbidden", details: "Agent scope required" },
      { status: 403 }
    );
  }

  // 2. Validate query parameters
  const { searchParams } = new URL(request.url);
  const params = {
    start: searchParams.get("start"),
    end: searchParams.get("end"),
    granularity: searchParams.get("granularity") || "day",
  };

  const parsed = grafanaAgentQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // 3. Query analytics using G1 service with server-derived agent + org scope
  try {
    const startDate = new Date(parsed.data.start);
    const endDate = new Date(parsed.data.end);
    const { granularity } = parsed.data;

    const analytics = await getAgentAnalytics(
      auth.userId,
      auth.organizationId,
      { startDate, endDate, granularity }
    );

    return NextResponse.json(analytics);
  } catch (err) {
    console.error("Grafana agent analytics error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
