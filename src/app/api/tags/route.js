import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET(request) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const tags = await prisma.tag.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("List tags error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
