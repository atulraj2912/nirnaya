import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const tags = await prisma.tag.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("List tags error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
