import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getDashboardStats } from "@/lib/services/dashboard-service";

export async function GET(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const stats = await getDashboardStats(user.organizationId);

    return NextResponse.json({ stats });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
