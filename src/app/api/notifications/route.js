import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  NotificationError,
} from "@/lib/services/notification-service";

export async function GET(request) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const result = await getUserNotifications(user.id, user.organizationId, {
      page,
      limit,
      unreadOnly,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Get notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const body = await request.json();

    if (body.action === "markAllRead") {
      await markAllAsRead(user.id, user.organizationId);
      return NextResponse.json({ success: true });
    }

    if (body.notificationId) {
      const notification = await markAsRead(
        body.notificationId,
        user.id,
        user.organizationId
      );
      return NextResponse.json({ notification });
    }

    return NextResponse.json(
      { error: "Invalid request: provide notificationId or action" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof NotificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Update notification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
