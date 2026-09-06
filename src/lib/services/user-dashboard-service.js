import prisma from "@/lib/db/prisma";

/**
 * Get dashboard statistics scoped to a single user.
 *
 * Only counts tickets where the user is the requester (requesterId).
 * Organization isolation is enforced via the organizationId parameter
 * which comes from the authenticated user's session.
 */
export async function getUserDashboardStats(userId, organizationId) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const baseWhere = { organizationId, requesterId: userId };

  const [recentTickets, openCount, inProgressCount, resolvedTodayCount, breachedCount] =
    await Promise.all([
      prisma.ticket.findMany({
        where: baseWhere,
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.ticket.count({
        where: { ...baseWhere, status: { in: ["OPEN", "ASSIGNED"] } },
      }),
      prisma.ticket.count({
        where: {
          ...baseWhere,
          status: { in: ["IN_PROGRESS", "WAITING_FOR_USER"] },
        },
      }),
      prisma.ticket.count({
        where: {
          ...baseWhere,
          status: "RESOLVED",
          resolvedAt: { gte: todayStart },
        },
      }),
      prisma.ticket.count({
        where: {
          ...baseWhere,
          responseSlaStatus: "BREACHED",
          firstRespondedAt: null,
        },
      }),
    ]);

  return {
    openTickets: openCount,
    inProgressTickets: inProgressCount,
    resolvedToday: resolvedTodayCount,
    slaBreached: breachedCount,
    recentTickets,
  };
}
