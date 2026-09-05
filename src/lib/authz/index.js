import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * Require an authenticated user. Returns 401 if not logged in.
 *
 * @param {import("next/server").NextRequest} request
 * @returns {Promise<{user: object}|{response: import("next/server").NextResponse}>}
 */
export async function requireAuth(request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return {
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }
  return { user };
}

/**
 * Require one of the specified roles. Returns 403 if unauthorized.
 *
 * @param {import("next/server").NextRequest} request
 * @param {string[]} allowedRoles - e.g. ["ADMIN"], ["AGENT", "ADMIN"]
 * @returns {Promise<{user: object}|{response: import("next/server").NextResponse}>}
 */
export async function requireRole(request, allowedRoles) {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult;

  if (!allowedRoles.includes(authResult.user.role)) {
    return {
      response: NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      ),
    };
  }
  return authResult;
}

/**
 * Require ADMIN role. Returns 403 if not admin.
 *
 * @param {import("next/server").NextRequest} request
 * @returns {Promise<{user: object}|{response: import("next/server").NextResponse}>}
 */
export async function requireAdmin(request) {
  return requireRole(request, ["ADMIN"]);
}

/**
 * Require AGENT or ADMIN role. Returns 403 if user role.
 *
 * @param {import("next/server").NextRequest} request
 * @returns {Promise<{user: object}|{response: import("next/server").NextResponse}>}
 */
export async function requireAgentOrAdmin(request) {
  return requireRole(request, ["AGENT", "ADMIN"]);
}

/**
 * Ensure a resource belongs to the user's organization.
 * Returns 403 if cross-org access is attempted.
 *
 * @param {object} user - The authenticated user
 * @param {string} resourceOrgId - The organizationId of the resource
 * @returns {{ok: true}|{response: import("next/server").NextResponse}}
 */
export function requireSameOrganization(user, resourceOrgId) {
  if (user.organizationId !== resourceOrgId) {
    return {
      response: NextResponse.json(
        { error: "Access denied: cross-organization" },
        { status: 403 }
      ),
    };
  }
  return { ok: true };
}
