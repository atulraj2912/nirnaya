import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { getUserDashboardStats } from "@/lib/services/user-dashboard-service";

export async function GET(request) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const stats = await getUserDashboardStats(user.id, user.organizationId);

    return NextResponse.json(stats);
  } catch (err) {
    console.error("User dashboard stats error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
