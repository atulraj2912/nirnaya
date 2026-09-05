import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, requireAgentOrAdmin } from "@/lib/authz";

export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const { user: agentUser, error: agentError } = await requireAgentOrAdmin();
    if (agentError) {
      return NextResponse.json({ error: agentError }, { status: 403 });
    }

    const agents = await prisma.user.findMany({
      where: {
        organizationId: agentUser.organizationId,
        status: "ACTIVE",
        role: { in: ["AGENT", "ADMIN"] },
      },
      select: {
        id: true,
        username: true,
        email: true,
        designation: true,
        role: true,
        avatarUrl: true,
      },
      orderBy: { username: "asc" },
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("List agents error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
