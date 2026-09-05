import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { updateSLAConfig, SLAConfigError } from "@/lib/services/sla-config-service";

export async function PATCH(request, { params }) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await updateSLAConfig(id, body, user.organizationId);

    return NextResponse.json({ config: updated });
  } catch (err) {
    if (err instanceof SLAConfigError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Update SLA config error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
