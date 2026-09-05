import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { createComment, listTicketComments, CommentError } from "@/lib/services/comment-service";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await listTicketComments(id, authResult.user, { page, limit });
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
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const { id } = await params;
    const body = await request.json();

    const comment = await createComment(
      { ticketId: id, content: body.content, visibility: body.visibility },
      authResult.user
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
