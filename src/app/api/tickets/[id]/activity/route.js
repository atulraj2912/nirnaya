import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { listTicketActivity, ActivityError } from "@/lib/services/activity-service";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await listTicketActivity(id, authResult.user, { page, limit });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ActivityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("List activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
