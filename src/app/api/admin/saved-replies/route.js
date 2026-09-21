import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { listSavedReplies, createSavedReply } from "@/lib/services/saved-reply-service";
import { createSavedReplySchema } from "@/lib/validation/admin";

export async function GET(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const search = searchParams.get("search") || "";

  try {
    const result = await listSavedReplies(user.organizationId, { page, limit, search });
    return NextResponse.json(result);
  } catch (err) {
    console.error("List saved replies error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const body = await request.json();
    const parsed = createSavedReplySchema.parse(body);
    const reply = await createSavedReply(parsed, user.organizationId, user.id);
    return NextResponse.json(reply, { status: 201 });
  } catch (err) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    console.error("Create saved reply error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
