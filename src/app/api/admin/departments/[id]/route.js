import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { updateDepartment, DepartmentError } from "@/lib/services/department-service";

export async function PATCH(request, { params }) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await updateDepartment(id, body, user.organizationId, user.id);

    return NextResponse.json({ department: updated });
  } catch (err) {
    if (err instanceof DepartmentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Update department error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
