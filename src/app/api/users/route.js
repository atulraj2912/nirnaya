import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, requireAgentOrAdmin } from "@/lib/authz";

export async function GET(request) {
  const { user, response: authResponse } = await requireAuth(request);
  if (authResponse) return authResponse;

  const { response: roleResponse } = await requireAgentOrAdmin(request);
  if (roleResponse) return roleResponse;

  try {
    const agents = await prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
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
