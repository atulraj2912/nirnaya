import { NextResponse } from "next/server";
import { getAdminAnalytics } from "@/lib/services/admin-analytics-service";
import {
  extractGrafanaToken,
  validateGrafanaToken,
  grafanaAdminQuerySchema,
} from "@/lib/validation/grafana";

/**
 * GET /api/grafana/analytics/admin
 *
 * Grafana-proxied admin analytics endpoint.
 * Returns organization-scoped analytics for the admin Grafana dashboard.
 *
 * SECURITY:
 *   - organizationId is derived from the validated service token
 *   - Never accepted from client/Grafana query parameters
 *   - Token maps to a fixed admin user + organization via env vars
 *   - All G1 isolation guarantees are preserved
 *
 * Auth: Bearer service token (GRAFANA_SERVICE_TOKEN)
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

  if (auth.type !== "admin") {
    return NextResponse.json(
      { error: "Forbidden", details: "Admin scope required" },
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

  const parsed = grafanaAdminQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // 3. Query analytics using G1 service with server-derived org scope
  try {
    const startDate = new Date(parsed.data.start);
    const endDate = new Date(parsed.data.end);
    const { granularity } = parsed.data;

    const analytics = await getAdminAnalytics(auth.organizationId, {
      startDate,
      endDate,
      granularity,
    });

    return NextResponse.json(analytics);
  } catch (err) {
    console.error("Grafana admin analytics error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
