import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getAdminAnalytics } from "@/lib/services/admin-analytics-service";
import { getAnalytics } from "@/lib/services/analytics-service";
import {
  adminAnalyticsQuerySchema,
  resolveDateRange,
} from "@/lib/validation/analytics";

/**
 * GET /api/admin/analytics
 *
 * Admin organization-scoped analytics endpoint.
 * Supports both legacy timeWindow and new date range + granularity.
 *
 * Query params:
 *   timeWindow: "today" | "7d" | "30d" | "month" (legacy)
 *   start: ISO date string (new)
 *   end: ISO date string (new)
 *   granularity: "hour" | "day" | "week" | "month" (default: "day")
 *   mode: "legacy" | "full" (default: "full")
 *
 * - "legacy" returns the existing analytics-service.js shape for backward compat
 * - "full" returns the G1 extended analytics shape
 *
 * Authorization: ADMIN only, scoped to authenticated user's organization.
 * organizationId is NEVER accepted from client input.
 */
export async function GET(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const parsed = adminAnalyticsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { timeWindow, start, end, granularity } = parsed.data;
  const mode = searchParams.get("mode") || "full";

  try {
    // Legacy mode: use existing analytics-service.js for backward compatibility
    if (mode === "legacy" || timeWindow) {
      const tw = timeWindow || "30d";
      const analytics = await getAnalytics(user.organizationId, { timeWindow: tw });
      return NextResponse.json(analytics);
    }

    // Full G1 mode: use new admin analytics service with date range
    const dateRange = resolveDateRange({ start, end });
    const analytics = await getAdminAnalytics(user.organizationId, {
      startDate: dateRange.start,
      endDate: dateRange.end,
      granularity,
    });

    return NextResponse.json(analytics);
  } catch (err) {
    console.error("Admin analytics error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
