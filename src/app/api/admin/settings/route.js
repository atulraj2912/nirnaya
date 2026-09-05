import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import prisma from "@/lib/db/prisma";
import { updateOrgSettingsSchema } from "@/lib/validation/admin";

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
    const parsed = updateOrgSettingsSchema.parse(body);

    const allowed = {};
    if (parsed.name !== undefined) allowed.name = parsed.name;
    if (parsed.description !== undefined) allowed.description = parsed.description;
    if (parsed.businessHoursStart !== undefined) allowed.businessHoursStart = parsed.businessHoursStart;
    if (parsed.businessHoursEnd !== undefined) allowed.businessHoursEnd = parsed.businessHoursEnd;
    if (parsed.timezone !== undefined) allowed.timezone = parsed.timezone;

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
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: err.issues }, { status: 400 });
    }
    console.error("Update org settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
