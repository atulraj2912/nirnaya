import { NextResponse } from "next/server";

// Bootstrap validation endpoint — confirms the App Router API route
// handler toolchain is wired correctly. Not a product feature.
export function GET() {
  return NextResponse.json({ status: "ok", phase: "phase-0" });
}
