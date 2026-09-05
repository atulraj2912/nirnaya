import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { listCategories, createCategory, CategoryAdminError } from "@/lib/services/category-admin-service";

export async function GET(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search") || undefined;
    const isActive = searchParams.get("isActive") !== null
      ? searchParams.get("isActive") === "true"
      : undefined;

    const result = await listCategories(user.organizationId, {
      page,
      limit,
      search,
      isActive,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CategoryAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("List categories error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const body = await request.json();
    const created = await createCategory(body, user.organizationId);

    return NextResponse.json({ category: created }, { status: 201 });
  } catch (err) {
    if (err instanceof CategoryAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Create category error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
