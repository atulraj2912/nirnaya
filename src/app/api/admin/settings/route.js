import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import prisma from "@/lib/db/prisma";

export async function GET(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        businessHoursStart: true,
        businessHoursEnd: true,
        timezone: true,
        createdAt: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ organization: org });
  } catch (err) {
    console.error("Get org settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const body = await request.json();

    const allowed = {};
    if (body.name !== undefined) allowed.name = body.name;
    if (body.description !== undefined) allowed.description = body.description;
    if (body.businessHoursStart !== undefined) allowed.businessHoursStart = body.businessHoursStart;
    if (body.businessHoursEnd !== undefined) allowed.businessHoursEnd = body.businessHoursEnd;
    if (body.timezone !== undefined) allowed.timezone = body.timezone;

    const org = await prisma.organization.update({
      where: { id: user.organizationId },
      data: allowed,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        businessHoursStart: true,
        businessHoursEnd: true,
        timezone: true,
      },
    });

    return NextResponse.json({ organization: org });
  } catch (err) {
    console.error("Update org settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
