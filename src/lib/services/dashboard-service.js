import prisma from "@/lib/db/prisma";

export async function getDashboardStats(organizationId) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalTickets,
    openTickets,
    assignedTickets,
    inProgressTickets,
    resolvedToday,
    closedTickets,
    breachedSLA,
    warningSLA,
    totalUsers,
    activeUsers,
    totalDepartments,
    activeDepartments,
    totalCategories,
    activeCategories,
    totalTags,
    recentTickets,
  ] = await Promise.all([
    prisma.ticket.count({ where: { organizationId } }),
    prisma.ticket.count({ where: { organizationId, status: "OPEN" } }),
    prisma.ticket.count({ where: { organizationId, status: "ASSIGNED" } }),
    prisma.ticket.count({ where: { organizationId, status: "IN_PROGRESS" } }),
    prisma.ticket.count({
      where: {
        organizationId,
        status: "RESOLVED",
        resolvedAt: { gte: todayStart },
      },
    }),
    prisma.ticket.count({ where: { organizationId, status: "CLOSED" } }),
    prisma.ticket.count({
      where: {
        organizationId,
        responseSlaStatus: "BREACHED",
        firstRespondedAt: null,
      },
    }),
    prisma.ticket.count({
      where: {
        organizationId,
        responseSlaStatus: "WARNING",
        firstRespondedAt: null,
      },
    }),
    prisma.user.count({ where: { organizationId } }),
    prisma.user.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.department.count({ where: { organizationId } }),
    prisma.department.count({ where: { organizationId, isActive: true } }),
    prisma.category.count({ where: { organizationId } }),
    prisma.category.count({ where: { organizationId, isActive: true } }),
    prisma.tag.count({ where: { organizationId } }),
    prisma.ticket.findMany({
      where: { organizationId },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        requester: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    tickets: {
      total: totalTickets,
      open: openTickets,
      assigned: assignedTickets,
      inProgress: inProgressTickets,
      resolvedToday,
      closed: closedTickets,
    },
    sla: {
      breached: breachedSLA,
      warning: warningSLA,
    },
    users: {
      total: totalUsers,
      active: activeUsers,
    },
    departments: {
      total: totalDepartments,
      active: activeDepartments,
    },
    categories: {
      total: totalCategories,
      active: activeCategories,
    },
    tags: {
      total: totalTags,
    },
    recentTickets,
  };
}
