import prisma from "@/lib/db/prisma";

export async function getAgentDashboardStats(userId, organizationId) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const baseWhere = { organizationId };

  const [
    openTickets,
    assignedToMe,
    inProgress,
    waitingForUser,
    resolvedToday,
    breachedSLA,
    warningSLA,
    recentTickets,
  ] = await Promise.all([
    prisma.ticket.count({ where: { ...baseWhere, status: "OPEN" } }),
    prisma.ticket.count({ where: { ...baseWhere, assignedAgentId: userId, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.ticket.count({ where: { ...baseWhere, status: "IN_PROGRESS" } }),
    prisma.ticket.count({ where: { ...baseWhere, status: "WAITING_FOR_USER" } }),
    prisma.ticket.count({ where: { ...baseWhere, status: "RESOLVED", resolvedAt: { gte: todayStart } } }),
    prisma.ticket.count({ where: { ...baseWhere, responseSlaStatus: "BREACHED", firstRespondedAt: null } }),
    prisma.ticket.count({ where: { ...baseWhere, responseSlaStatus: "WARNING", firstRespondedAt: null } }),
    prisma.ticket.findMany({
      where: { ...baseWhere, status: { notIn: ["RESOLVED", "CLOSED"] } },
      select: {
        id: true, ticketNumber: true, title: true, status: true, priority: true, createdAt: true,
        requester: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    openTickets,
    assignedToMe,
    inProgress,
    waitingForUser,
    resolvedToday,
    breachedSLA,
    warningSLA,
    recentTickets,
  };
}
