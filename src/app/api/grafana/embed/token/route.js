import { NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";
import { requireAdmin } from "@/lib/authz";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * POST /api/grafana/embed/token
 *
 * Issues a short-lived JWT for embedding the Grafana admin dashboard
 * inside the NIRNAYA Admin Dashboard.
 *
 * SECURITY:
 *   - Requires authenticated ADMIN role (server-side verified)
 *   - Token is short-lived (5 minutes)
 *   - Token is signed with RSA private key (Grafana verifies with public key)
 *   - Token contains only minimum necessary claims for Grafana user mapping
 *   - Token is returned in JSON response, never exposed in URLs or HTML
 *
 * Grafana JWT auth configuration:
 *   - GF_AUTH_JWT_ENABLED=true
 *   - GF_AUTH_JWT_URL_LOGIN=true (accepts auth_token query parameter)
 *   - GF_AUTH_JWT_EMAIL_CLAIM=email
 *   - GF_AUTH_JWT_AUTO_SIGN_UP=true
 *   - GF_AUTH_JWT_KEY_FILE=/etc/grafana/jwt-public.pem (RSA public key)
 *
 * Auth: NIRNAYA session (httpOnly cookie) — ADMIN only
 */
export async function POST(request) {
  // 1. Verify authenticated ADMIN
  const authResult = await requireAdmin(request);
  if (authResult.response) return authResult;

  const { user } = authResult;

  // 2. Generate short-lived JWT for Grafana embedding
  try {
    const keyPath = process.env.GRAFANA_JWT_PRIVATE_KEY_PATH;
    if (!keyPath) {
      return NextResponse.json(
        { error: "Grafana embedding not configured" },
        { status: 503 }
      );
    }

    const resolvedPath = join(process.cwd(), keyPath);
    const privateKeyPem = await readFile(resolvedPath, "utf-8");
    const privateKey = await importPKCS8(privateKeyPem, "RS256");

    const token = await new SignJWT({
      sub: user.email,
      email: user.email,
      username: user.email.split("@")[0],
      name: user.name || user.email.split("@")[0],
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt()
      .setIssuer("nirnaya-grafana-embed")
      .setAudience("grafana")
      .setExpirationTime("5m")
      .sign(privateKey);

    // 3. Return token (never logged, never exposed in URLs)
    return NextResponse.json({ token });
  } catch (err) {
    console.error("Grafana embed token error:", err);
    return NextResponse.json(
      { error: "Failed to generate embed token" },
      { status: 500 }
    );
  }
}
