import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { getUnreadCount } from "@/lib/services/notification-service";

export async function GET(request) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const result = await getUnreadCount(user.id, user.organizationId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Get unread count error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
