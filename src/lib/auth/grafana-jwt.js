import { SignJWT, jwtVerify } from "jose";

/**
 * Grafana identity JWT — short-lived tokens for agent authentication.
 *
 * These tokens are issued by NIRNAYA to authenticated agents and are used
 * by Grafana datasources to query agent-scoped analytics. They are SEPARATE
 * from NIRNAYA's access/refresh tokens and use a dedicated signing secret.
 *
 * SECURITY INVARIANTS:
 *   - Signed with GRAFANA_JWT_SECRET (never shared with Grafana)
 *   - Short-lived (5 minutes) to limit exposure window
 *   - Audience-bound ("grafana") to prevent token misuse
 *   - Purpose-bound ("analytics") to restrict token usage
 *   - Role-bound (AGENT only) to enforce authorization
 *   - Issuer-bound ("nirnaya-grafana") to prevent token confusion
 *   - Contains only minimum necessary claims (userId, organizationId, role)
 */

const GRAFANA_TOKEN_EXPIRY = "5m";
const GRAFANA_TOKEN_ISSUER = "nirnaya-grafana";
const GRAFANA_TOKEN_AUDIENCE = "grafana";
const GRAFANA_TOKEN_PURPOSE = "analytics";

let _grafanaKey = null;
let _grafanaKeyPromise = null;

/**
 * Import the Grafana JWT signing key from environment.
 * Uses a SEPARATE secret from JWT_ACCESS_SECRET / JWT_REFRESH_SECRET.
 *
 * @returns {Promise<CryptoKey>}
 */
async function getGrafanaKey() {
  if (_grafanaKey) return _grafanaKey;

  // Access process.env directly — this runs server-side only.
  const secret = process.env.GRAFANA_JWT_SECRET;
  if (!secret) {
    _grafanaKey = null;
    _grafanaKeyPromise = null;
    throw new Error("GRAFANA_JWT_SECRET is not configured");
  }

  // Cache the promise to avoid concurrent imports
  if (!_grafanaKeyPromise) {
    _grafanaKeyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
  }

  _grafanaKey = await _grafanaKeyPromise;
  return _grafanaKey;
}

/**
 * Reset the cached Grafana key. Used in tests when changing env vars.
 */
export function resetGrafanaKeyCache() {
  _grafanaKey = null;
  _grafanaKeyPromise = null;
}

/**
 * Sign a short-lived Grafana identity token.
 *
 * @param {object} payload
 * @param {string} payload.userId - NIRNAYA user ID
 * @param {string} payload.organizationId - NIRNAYA organization ID
 * @param {string} payload.role - NIRNAYA role (must be "AGENT")
 * @returns {Promise<string>} Signed JWT (5-minute expiry)
 */
export async function signGrafanaToken(payload) {
  const key = await getGrafanaKey();

  return new SignJWT({
    sub: payload.userId,
    org: payload.organizationId,
    role: payload.role,
    purpose: GRAFANA_TOKEN_PURPOSE,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(GRAFANA_TOKEN_ISSUER)
    .setAudience(GRAFANA_TOKEN_AUDIENCE)
    .setExpirationTime(GRAFANA_TOKEN_EXPIRY)
    .sign(key);
}

/**
 * Verify a Grafana identity token.
 *
 * Validates:
 *   - Signature (HS256 with GRAFANA_JWT_SECRET)
 *   - Expiration (5-minute window)
 *   - Issuer ("nirnaya-grafana")
 *   - Audience ("grafana")
 *   - Purpose claim ("analytics")
 *   - Role claim ("AGENT")
 *
 * @param {string} token - The JWT to verify
 * @returns {Promise<{valid: boolean, userId?: string, organizationId?: string, role?: string, error?: string}>}
 */
export async function verifyGrafanaToken(token) {
  try {
    const key = await getGrafanaKey();

    const { payload } = await jwtVerify(token, key, {
      issuer: GRAFANA_TOKEN_ISSUER,
      audience: GRAFANA_TOKEN_AUDIENCE,
    });

    // Validate required claims
    if (!payload.sub || !payload.org || !payload.role) {
      return { valid: false, error: "Missing required claims (sub, org, role)" };
    }

    if (payload.purpose !== GRAFANA_TOKEN_PURPOSE) {
      return { valid: false, error: "Invalid token purpose" };
    }

    if (payload.role !== "AGENT") {
      return { valid: false, error: "Agent role required" };
    }

    return {
      valid: true,
      userId: payload.sub,
      organizationId: payload.org,
      role: payload.role,
    };
  } catch (err) {
    // Distinguish error types for better debugging without leaking internals
    if (err.code === "ERR_JWT_EXPIRED") {
      return { valid: false, error: "Token expired" };
    }
    if (err.code === "ERR_JWT_INVALID_ISSUER") {
      return { valid: false, error: "Invalid issuer" };
    }
    if (err.code === "ERR_JWT_INVALID_AUDIENCE") {
      return { valid: false, error: "Invalid audience" };
    }
    if (err.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" || err.code === "ERR_JWT_SIGNATURE_VERIFICATION_FAILED") {
      return { valid: false, error: "Invalid signature" };
    }
    return { valid: false, error: "Invalid token" };
  }
}
