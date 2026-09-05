import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { addWatcher, removeWatcher, listWatchers, WatcherError } from "@/lib/services/watcher-service";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const { id } = await params;
    const result = await listWatchers(id, authResult.user);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WatcherError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("List watchers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const { id } = await params;
    const body = await request.json();

    const watcher = await addWatcher(id, body.userId, authResult.user);
    return NextResponse.json({ watcher }, { status: 201 });
  } catch (error) {
    if (error instanceof WatcherError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Add watcher error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const result = await removeWatcher(id, userId, authResult.user);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WatcherError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Remove watcher error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
