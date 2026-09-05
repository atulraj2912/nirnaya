import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const categories = await prisma.category.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: { id: true, name: true, departmentId: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("List categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
