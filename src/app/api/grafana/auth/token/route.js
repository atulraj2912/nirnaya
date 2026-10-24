import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { signGrafanaToken } from "@/lib/auth/grafana-jwt";

/**
 * POST /api/grafana/auth/token
 *
 * Issues a short-lived Grafana identity token for the authenticated agent.
 *
 * Flow:
 *   1. Agent authenticates with NIRNAYA (existing session cookie)
 *   2. Agent calls POST /api/grafana/auth/token
 *   3. NIRNAYA validates the session and extracts user identity
 *   4. NIRNAYA signs a 5-minute JWT with the agent's identity
 *   5. Agent uses this JWT as a Bearer token for Grafana API requests
 *
 * SECURITY:
 *   - Only authenticated AGENT or ADMIN users can request tokens
 *   - Token contains only minimum necessary claims (userId, orgId, role)
 *   - Token is short-lived (5 minutes) to limit exposure
 *   - Token is signed with a dedicated GRAFANA_JWT_SECRET
 *   - organizationId and userId come from the server-side session, never from client input
 *   - The token does NOT grant access to NIRNAYA's main application JWT secrets
 *
 * Request:
 *   - Method: POST
 *   - Auth: NIRNAYA session cookie (existing auth)
 *   - Body: {} (empty — identity comes from session)
 *
 * Response (200):
 *   { token: "<jwt>", expiresIn: 300, tokenType: "Bearer" }
 *
 * Response (401):
 *   { error: "Authentication required" }
 *
 * Response (403):
 *   { error: "Agent or admin role required for Grafana access" }
 */
export async function POST(request) {
  // 1. Authenticate via existing NIRNAYA session
  let user;
  try {
    user = await getCurrentUser(request);
  } catch {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // 2. Enforce role — only AGENT and ADMIN can get Grafana tokens
  if (user.role !== "AGENT" && user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Agent or admin role required for Grafana access" },
      { status: 403 }
    );
  }

  // 3. Sign a short-lived Grafana identity token
  //    userId and organizationId come from the validated session — never from client
  //    role is always AGENT — even admins get agent-scoped analytics tokens
  //    (admin analytics use the static GRAFANA_SERVICE_TOKEN instead)
  try {
    const token = await signGrafanaToken({
      userId: user.id,
      organizationId: user.organizationId,
      role: "AGENT",
    });

    return NextResponse.json({
      token,
      expiresIn: 300,
      tokenType: "Bearer",
    });
  } catch (err) {
    console.error("Grafana token issuance error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
