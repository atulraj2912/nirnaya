import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { runSLABreachScan } from "@/lib/services/sla-scan-service";

export async function POST(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  try {
    const result = await runSLABreachScan(user.organizationId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("SLA scan error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
