import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getSavedReply, updateSavedReply, deleteSavedReply } from "@/lib/services/saved-reply-service";
import { updateSavedReplySchema } from "@/lib/validation/admin";
import { SavedReplyError } from "@/lib/services/saved-reply-service";

export async function GET(request, { params }) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await params;

  try {
    const reply = await getSavedReply(id, user.organizationId);
    return NextResponse.json(reply);
  } catch (err) {
    if (err instanceof SavedReplyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateSavedReplySchema.parse(body);
    const reply = await updateSavedReply(id, parsed, user.organizationId, user.id);
    return NextResponse.json(reply);
  } catch (err) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    if (err instanceof SavedReplyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await params;

  try {
    await deleteSavedReply(id, user.organizationId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SavedReplyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
