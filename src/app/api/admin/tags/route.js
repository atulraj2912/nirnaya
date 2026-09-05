import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { listTags, createTag, TagAdminError } from "@/lib/services/tag-admin-service";

export async function GET(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const search = searchParams.get("search") || undefined;

    const result = await listTags(user.organizationId, {
      page,
      limit,
      search,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TagAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("List tags error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const body = await request.json();
    const created = await createTag(body, user.organizationId);

    return NextResponse.json({ tag: created }, { status: 201 });
  } catch (err) {
    if (err instanceof TagAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Create tag error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
