import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { createComment, listTicketComments, CommentError } from "@/lib/services/comment-service";

export async function GET(request, { params }) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    const result = await listTicketComments(id, user, { page, limit });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CommentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("List comments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { id } = await params;
    const body = await request.json();

    const comment = await createComment(
      { ticketId: id, content: body.content, visibility: body.visibility },
      user
    );

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    if (error instanceof CommentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Create comment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
