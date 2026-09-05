import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { listTicketActivity, ActivityError } from "@/lib/services/activity-service";

export async function GET(request, { params }) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    const result = await listTicketActivity(id, user, { page, limit });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ActivityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("List activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
