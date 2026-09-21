import prisma from "@/lib/db/prisma";

/**
 * Get analytics for the organization.
 * Time windows: "today", "7d", "30d", "month"
 * Returns status breakdown, priority breakdown, department breakdown, 
 * category breakdown, SLA metrics, and trend data.
 */
export async function getAnalytics(organizationId, filters = {}) {
  const { timeWindow = "30d" } = filters;
  
  const now = new Date();
  let startDate;
  
  switch (timeWindow) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const dateFilter = { createdAt: { gte: startDate } };
  const baseWhere = { organizationId };

  const [
    totalTickets,
    statusBreakdown,
    priorityBreakdown,
    typeBreakdown,
    departmentBreakdown,
    categoryBreakdown,
    slaMetrics,
    ticketsByDay,
    avgResolutionTime,
  ] = await Promise.all([
    prisma.ticket.count({ where: { ...baseWhere, ...dateFilter } }),
    
    prisma.ticket.groupBy({
      by: ["status"],
      where: { ...baseWhere, ...dateFilter },
      _count: { id: true },
    }),
    
    prisma.ticket.groupBy({
      by: ["priority"],
      where: { ...baseWhere, ...dateFilter },
      _count: { id: true },
    }),
    
    prisma.ticket.groupBy({
      by: ["type"],
      where: { ...baseWhere, ...dateFilter },
      _count: { id: true },
    }),
    
    prisma.ticket.groupBy({
      by: ["departmentId"],
      where: { ...baseWhere, ...dateFilter },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    
    prisma.ticket.groupBy({
      by: ["categoryId"],
      where: { ...baseWhere, ...dateFilter, categoryId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    
    prisma.ticket.aggregate({
      where: { ...baseWhere, ...dateFilter },
      _count: { id: true },
    }).then(async (agg) => {
      const [breached, warning, onTrack] = await Promise.all([
        prisma.ticket.count({ where: { ...baseWhere, ...dateFilter, responseSlaStatus: "BREACHED" } }),
        prisma.ticket.count({ where: { ...baseWhere, ...dateFilter, responseSlaStatus: "WARNING" } }),
        prisma.ticket.count({ where: { ...baseWhere, ...dateFilter, responseSlaStatus: "ON_TRACK" } }),
      ]);
      return { total: agg._count.id, breached, warning, onTrack };
    }),
    
    getTicketTrend(organizationId, startDate, now),
    
    getAvgResolutionTime(organizationId, startDate),
  ]);

  // Resolve department names
  const deptIds = departmentBreakdown.map(d => d.departmentId).filter(Boolean);
  const departments = deptIds.length > 0 ? await prisma.department.findMany({
    where: { id: { in: deptIds } },
    select: { id: true, name: true },
  }) : [];
  const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));

  // Resolve category names
  const catIds = categoryBreakdown.map(c => c.categoryId).filter(Boolean);
  const categories = catIds.length > 0 ? await prisma.category.findMany({
    where: { id: { in: catIds } },
    select: { id: true, name: true },
  }) : [];
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

  return {
    totalTickets,
    timeWindow,
    startDate: startDate.toISOString(),
    endDate: now.toISOString(),
    statusBreakdown: statusBreakdown.map(s => ({ status: s.status, count: s._count.id })),
    priorityBreakdown: priorityBreakdown.map(p => ({ priority: p.priority, count: p._count.id })),
    typeBreakdown: typeBreakdown.map(t => ({ type: t.type, count: t._count.id })),
    departmentBreakdown: departmentBreakdown.map(d => ({
      departmentId: d.departmentId,
      name: deptMap[d.departmentId] || "Unknown",
      count: d._count.id,
    })),
    categoryBreakdown: categoryBreakdown.map(c => ({
      categoryId: c.categoryId,
      name: catMap[c.categoryId] || "Unknown",
      count: c._count.id,
    })),
    slaMetrics,
    ticketsByDay,
    avgResolutionTime,
  };
}

async function getTicketTrend(organizationId, startDate, endDate) {
  const tickets = await prisma.ticket.findMany({
    where: { organizationId, createdAt: { gte: startDate, lte: endDate } },
    select: { createdAt: true, status: true },
    orderBy: { createdAt: "asc" },
    take: 1000,
  });

  const dayMap = {};
  for (const ticket of tickets) {
    const day = ticket.createdAt.toISOString().split("T")[0];
    if (!dayMap[day]) dayMap[day] = { date: day, created: 0, resolved: 0 };
    dayMap[day].created++;
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      dayMap[day].resolved++;
    }
  }

  return Object.values(dayMap);
}

async function getAvgResolutionTime(organizationId, startDate) {
  const resolved = await prisma.ticket.findMany({
    where: {
      organizationId,
      status: { in: ["RESOLVED", "CLOSED"] },
      resolvedAt: { not: null },
      createdAt: { gte: startDate },
    },
    select: { createdAt: true, resolvedAt: true },
    take: 500,
  });

  if (resolved.length === 0) return null;

  const totalMs = resolved.reduce((sum, t) => sum + (t.resolvedAt.getTime() - t.createdAt.getTime()), 0);
  return Math.round(totalMs / resolved.length / (1000 * 60 * 60)); // hours
}
