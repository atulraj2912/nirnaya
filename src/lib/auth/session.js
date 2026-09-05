import prisma from "@/lib/db/prisma";
import { verifyAccessToken } from "./jwt";
import { getAccessTokenFromRequest } from "./cookies";

/**
 * Retrieve the currently authenticated user from the request's access token.
 *
 * Verifies the JWT, then fetches the user from the database to confirm
 * the account is still ACTIVE. Returns null if unauthenticated or inactive.
 *
 * @param {import("next/server").NextRequest} request
 * @returns {Promise<object|null>} The user object (without passwordHash), or null
 */
export async function getCurrentUser(request) {
  const token = getAccessTokenFromRequest(request);
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      avatarUrl: true,
      designation: true,
      organizationId: true,
      departmentId: true,
      employeeId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return null;
  if (user.status !== "ACTIVE") return null;

  return user;
}
