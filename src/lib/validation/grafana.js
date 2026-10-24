import { z } from "zod";
import { verifyGrafanaToken } from "@/lib/auth/grafana-jwt";

/**
 * Grafana-specific validation schemas.
 *
 * Validates query parameters for Grafana-proxied analytics endpoints.
 * These schemas are intentionally minimal — they mirror the G1 schemas
 * but are maintained separately to avoid coupling Grafana infrastructure
 * with core NIRNAYA analytics logic.
 */

// ============================================================
// Grafana analytics query schemas
// ============================================================

/**
 * Admin analytics query — used by Grafana admin datasource.
 * Accepts date range + granularity. No timeWindow (Grafana dashboards
 * use explicit time ranges from the Grafana time picker).
 */
export const grafanaAdminQuerySchema = z
  .object({
    start: z.string().min(1, "start is required"),
    end: z.string().min(1, "end is required"),
    granularity: z.enum(["hour", "day", "week", "month"]).default("day"),
  })
  .refine((data) => {
    const startDate = new Date(data.start);
    const endDate = new Date(data.end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return false;
    return startDate < endDate;
  }, { message: "start must be before end" })
  .refine((data) => {
    const startDate = new Date(data.start);
    const endDate = new Date(data.end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const maxMs = 365 * 24 * 60 * 60 * 1000;
    return diffMs <= maxMs;
  }, { message: "date range must not exceed 365 days" });

/**
 * Agent analytics query — used by Grafana agent datasource.
 * Same structure as admin but the agentId is server-derived.
 */
export const grafanaAgentQuerySchema = z
  .object({
    start: z.string().min(1, "start is required"),
    end: z.string().min(1, "end is required"),
    granularity: z.enum(["hour", "day", "week", "month"]).default("day"),
  })
  .refine((data) => {
    const startDate = new Date(data.start);
    const endDate = new Date(data.end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return false;
    return startDate < endDate;
  }, { message: "start must be before end" })
  .refine((data) => {
    const startDate = new Date(data.start);
    const endDate = new Date(data.end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const maxMs = 365 * 24 * 60 * 60 * 1000;
    return diffMs <= maxMs;
  }, { message: "date range must not exceed 365 days" });

// ============================================================
// Service token validation
// ============================================================

/**
 * Extract a Grafana token from the Authorization header.
 *
 * @param {Request} request
 * @returns {{ valid: boolean, token?: string, error?: string }}
 */
export function extractGrafanaToken(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return { valid: false, error: "Invalid Authorization format. Expected: Bearer <token>" };
  }

  return { valid: true, token: parts[1] };
}

/**
 * Validate a Grafana authentication token.
 *
 * Supports two authentication methods:
 *   1. Admin service token (static, from GRAFANA_SERVICE_TOKEN env var)
 *   2. Signed JWT (dynamic, issued by /api/grafana/auth/token)
 *
 * The validation flow:
 *   1. Check if token matches admin service token → admin scope
 *   2. Try to verify as signed JWT → agent scope (from JWT claims)
 *   3. Neither match → reject
 *
 * SECURITY: organizationId and userId are NEVER accepted from client input.
 * For service tokens, they come from environment variables.
 * For JWTs, they come from the signed token claims (issued by NIRNAYA).
 *
 * @param {string} token
 * @returns {Promise<{valid: boolean, type?: "admin" | "agent", userId?: string, organizationId?: string, error?: string}>}
 */
export async function validateGrafanaToken(token) {
  let env;
  try {
    env = process.env;
  } catch {
    return { valid: false, error: "Environment not initialized" };
  }

  // Method 1: Check admin service token (backward compatible)
  const adminToken = env.GRAFANA_SERVICE_TOKEN;
  if (adminToken && token === adminToken) {
    const orgId = env.GRAFANA_ADMIN_ORGANIZATION_ID;
    const userId = env.GRAFANA_ADMIN_USER_ID;
    if (!orgId || !userId) {
      return { valid: false, error: "Admin Grafana token configured but GRAFANA_ADMIN_ORGANIZATION_ID or GRAFANA_ADMIN_USER_ID missing" };
    }
    return { valid: true, type: "admin", userId, organizationId: orgId };
  }

  // Method 2: Verify as signed JWT (dynamic agent identity)
  // This handles tokens issued by POST /api/grafana/auth/token
  const jwtResult = await verifyGrafanaToken(token);
  if (jwtResult.valid) {
    return {
      valid: true,
      type: "agent",
      userId: jwtResult.userId,
      organizationId: jwtResult.organizationId,
    };
  }

  // Neither method matched
  return { valid: false, error: "Invalid token" };
}
