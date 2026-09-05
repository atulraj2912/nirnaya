import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { runSLABreachScan } from "@/lib/services/sla-scan-service";

export async function POST(request) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const result = await runSLABreachScan(user.organizationId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("SLA scan error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
