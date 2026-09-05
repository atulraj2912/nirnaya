import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET(request) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const departments = await prisma.department.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    console.error("List departments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
