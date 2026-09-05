import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { listSLAConfigs, createSLAConfig, SLAConfigError } from "@/lib/services/sla-config-service";

export async function GET(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const result = await listSLAConfigs(user.organizationId);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SLAConfigError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("List SLA configs error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const body = await request.json();
    const created = await createSLAConfig(body, user.organizationId);

    return NextResponse.json({ config: created }, { status: 201 });
  } catch (err) {
    if (err instanceof SLAConfigError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Create SLA config error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
