import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { updateUser, deactivateUser, UserAdminError } from "@/lib/services/user-admin-service";

export async function PATCH(request, { params }) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await updateUser(id, body, user.organizationId);

    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof UserAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Update user error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const { id } = await params;
    const result = await deactivateUser(id, user.organizationId);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UserAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Deactivate user error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
