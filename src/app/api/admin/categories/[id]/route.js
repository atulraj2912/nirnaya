import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { updateCategory, CategoryAdminError } from "@/lib/services/category-admin-service";

export async function PATCH(request, { params }) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await updateCategory(id, body, user.organizationId);

    return NextResponse.json({ category: updated });
  } catch (err) {
    if (err instanceof CategoryAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Update category error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
