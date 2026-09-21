import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getAnalytics } from "@/lib/services/analytics-service";

export async function GET(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const timeWindow = searchParams.get("timeWindow") || "30d";

  if (!["today", "7d", "30d", "month"].includes(timeWindow)) {
    return NextResponse.json({ error: "Invalid timeWindow" }, { status: 400 });
  }

  try {
    const analytics = await getAnalytics(user.organizationId, { timeWindow });
    return NextResponse.json(analytics);
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
