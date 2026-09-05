import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { deleteTag, TagAdminError } from "@/lib/services/tag-admin-service";

export async function DELETE(request, { params }) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const { id } = await params;
    const result = await deleteTag(id, user.organizationId);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TagAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Delete tag error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
