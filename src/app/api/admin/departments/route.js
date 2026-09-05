import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { listDepartments, createDepartment, DepartmentError } from "@/lib/services/department-service";

export async function GET(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const search = searchParams.get("search") || undefined;
    const isActive = searchParams.get("isActive") !== null
      ? searchParams.get("isActive") === "true"
      : undefined;

    const result = await listDepartments(user.organizationId, {
      page,
      limit,
      search,
      isActive,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DepartmentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("List departments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const body = await request.json();
    const created = await createDepartment(body, user.organizationId, user.id);

    return NextResponse.json({ department: created }, { status: 201 });
  } catch (err) {
    if (err instanceof DepartmentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Create department error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
