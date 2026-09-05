import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { listUsers, createUser, UserAdminError } from "@/lib/services/user-admin-service";

export async function GET(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search") || undefined;
    const role = searchParams.get("role") || undefined;
    const status = searchParams.get("status") || undefined;
    const departmentId = searchParams.get("departmentId") || undefined;

    const result = await listUsers(user.organizationId, {
      page,
      limit,
      search,
      role,
      status,
      departmentId,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UserAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("List users error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const body = await request.json();
    const created = await createUser(body, user.organizationId);

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    if (err instanceof UserAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Create user error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
