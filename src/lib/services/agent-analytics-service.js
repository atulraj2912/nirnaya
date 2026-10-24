import prisma from "@/lib/db/prisma";

/**
 * Agent Analytics Service — G1 Analytics Foundation.
 *
 * Provides agent self-scoped analytics for Grafana consumption.
 * All queries are scoped to the authenticated agent's own tickets.
 * The agentId ALWAYS comes from the authenticated server-side session.
 *
 * SECURITY: Never accept agentId from client input.
 */

/**
 * Get agent's ticket creation trend — tickets created by the agent over time.
 *
 * @param {string} agentId - server-derived, from authenticated session
 * @param {string} organizationId - server-derived org scope
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} granularity
 * @returns {Promise<Array<{period: string, count: number}>>}
 */
export async function getMyCreationTrend(agentId, organizationId, startDate, endDate, granularity = "day") {
  const tickets = await prisma.ticket.findMany({
    where: {
      organizationId,
      requesterId: agentId,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return bucketByPeriod(tickets, "createdAt", granularity);
}

/**
 * Get agent's resolution trend — tickets resolved by the agent over time.
 *
 * @param {string} agentId
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} granularity
 * @returns {Promise<Array<{period: string, count: number}>>}
 */
export async function getMyResolutionTrend(agentId, organizationId, startDate, endDate, granularity = "day") {
  const tickets = await prisma.ticket.findMany({
    where: {
      organizationId,
      assignedAgentId: agentId,
      resolvedAt: { not: null, gte: startDate, lte: endDate },
    },
    select: { resolvedAt: true },
    orderBy: { resolvedAt: "asc" },
  });

  return bucketByPeriod(tickets, "resolvedAt", granularity);
}

/**
 * Get agent's closure trend — tickets closed by the agent over time.
 *
 * @param {string} agentId
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} granularity
 * @returns {Promise<Array<{period: string, count: number}>>}
 */
export async function getMyClosureTrend(agentId, organizationId, startDate, endDate, granularity = "day") {
  const tickets = await prisma.ticket.findMany({
    where: {
      organizationId,
      assignedAgentId: agentId,
      closedAt: { not: null, gte: startDate, lte: endDate },
    },
    select: { closedAt: true },
    orderBy: { closedAt: "asc" },
  });

  return bucketByPeriod(tickets, "closedAt", granularity);
}

/**
 * Get agent's current open workload count.
 *
 * @param {string} agentId
 * @param {string} organizationId
 * @returns {Promise<number>}
 */
export async function getMyWorkload(agentId, organizationId) {
  return prisma.ticket.count({
    where: {
      organizationId,
      assignedAgentId: agentId,
      status: { notIn: ["RESOLVED", "CLOSED"] },
    },
  });
}

/**
 * Get agent's status distribution.
 *
 * @param {string} agentId
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array<{status: string, count: number}>>}
 */
export async function getMyStatusDistribution(agentId, organizationId, startDate, endDate) {
  const results = await prisma.ticket.groupBy({
    by: ["status"],
    where: {
      organizationId,
      assignedAgentId: agentId,
      createdAt: { gte: startDate, lte: endDate },
    },
    _count: { id: true },
  });

  return results.map((r) => ({ status: r.status, count: r._count.id }));
}

/**
 * Get agent's priority distribution.
 *
 * @param {string} agentId
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array<{priority: string, count: number}>>}
 */
export async function getMyPriorityDistribution(agentId, organizationId, startDate, endDate) {
  const results = await prisma.ticket.groupBy({
    by: ["priority"],
    where: {
      organizationId,
      assignedAgentId: agentId,
      createdAt: { gte: startDate, lte: endDate },
    },
    _count: { id: true },
  });

  return results.map((r) => ({ priority: r.priority, count: r._count.id }));
}

/**
 * Get agent's category distribution with resolved names.
 *
 * @param {string} agentId
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array<{categoryId: string, name: string, count: number}>>}
 */
export async function getMyCategoryDistribution(agentId, organizationId, startDate, endDate) {
  const results = await prisma.ticket.groupBy({
    by: ["categoryId"],
    where: {
      organizationId,
      assignedAgentId: agentId,
      createdAt: { gte: startDate, lte: endDate },
      categoryId: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  const catIds = results.map((r) => r.categoryId).filter(Boolean);
  if (catIds.length === 0) return [];

  const categories = await prisma.category.findMany({
    where: { id: { in: catIds } },
    select: { id: true, name: true },
  });
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return results.map((r) => ({
    categoryId: r.categoryId,
    name: catMap[r.categoryId] || "Unknown",
    count: r._count.id,
  }));
}

/**
 * Get agent's SLA performance.
 *
 * @param {string} agentId
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<{response: Array<{status: string, count: number}>, resolution: Array<{status: string, count: number}>}>}
 */
export async function getMySLAPerformance(agentId, organizationId, startDate, endDate) {
  const dateFilter = { createdAt: { gte: startDate, lte: endDate } };
  const agentFilter = { assignedAgentId: agentId };

  const [responseResults, resolutionResults] = await Promise.all([
    prisma.ticket.groupBy({
      by: ["responseSlaStatus"],
      where: {
        organizationId,
        ...agentFilter,
        ...dateFilter,
        responseSlaStatus: { not: null },
      },
      _count: { id: true },
    }),
    prisma.ticket.groupBy({
      by: ["resolutionSlaStatus"],
      where: {
        organizationId,
        ...agentFilter,
        ...dateFilter,
        resolutionSlaStatus: { not: null },
      },
      _count: { id: true },
    }),
  ]);

  return {
    response: responseResults.map((r) => ({
      status: r.responseSlaStatus,
      count: r._count.id,
    })),
    resolution: resolutionResults.map((r) => ({
      status: r.resolutionSlaStatus,
      count: r._count.id,
    })),
  };
}

/**
 * Get agent's average resolution time.
 *
 * @param {string} agentId
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<{averageHours: number|null, sampleSize: number}>}
 */
export async function getMyAverageResolutionTime(agentId, organizationId, startDate, endDate) {
  const resolved = await prisma.ticket.findMany({
    where: {
      organizationId,
      assignedAgentId: agentId,
      status: { in: ["RESOLVED", "CLOSED"] },
      resolvedAt: { not: null },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { createdAt: true, resolvedAt: true },
    take: 5000,
  });

  if (resolved.length === 0) return { averageHours: null, sampleSize: 0 };

  const totalMs = resolved.reduce(
    (sum, t) => sum + (t.resolvedAt.getTime() - t.createdAt.getTime()),
    0
  );

  return {
    averageHours: Math.round((totalMs / resolved.length / (1000 * 60 * 60)) * 100) / 100,
    sampleSize: resolved.length,
  };
}

/**
 * Get agent's average first-response time.
 *
 * @param {string} agentId
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<{averageHours: number|null, sampleSize: number}>}
 */
export async function getMyAverageFirstResponseTime(agentId, organizationId, startDate, endDate) {
  const responded = await prisma.ticket.findMany({
    where: {
      organizationId,
      assignedAgentId: agentId,
      firstRespondedAt: { not: null },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { createdAt: true, firstRespondedAt: true },
    take: 5000,
  });

  if (responded.length === 0) return { averageHours: null, sampleSize: 0 };

  const totalMs = responded.reduce(
    (sum, t) => sum + (t.firstRespondedAt.getTime() - t.createdAt.getTime()),
    0
  );

  return {
    averageHours: Math.round((totalMs / responded.length / (1000 * 60 * 60)) * 100) / 100,
    sampleSize: responded.length,
  };
}

/**
 * Get complete agent analytics dashboard.
 *
 * @param {string} agentId - server-derived from authenticated session
 * @param {string} organizationId - server-derived from authenticated session
 * @param {object} params
 * @param {Date} params.startDate
 * @param {Date} params.endDate
 * @param {string} params.granularity
 * @returns {Promise<object>}
 */
export async function getAgentAnalytics(agentId, organizationId, { startDate, endDate, granularity }) {
  const [
    creationTrend,
    resolutionTrend,
    closureTrend,
    workload,
    statusDistribution,
    priorityDistribution,
    categoryDistribution,
    slaPerformance,
    averageResolutionTime,
    averageFirstResponseTime,
  ] = await Promise.all([
    getMyCreationTrend(agentId, organizationId, startDate, endDate, granularity),
    getMyResolutionTrend(agentId, organizationId, startDate, endDate, granularity),
    getMyClosureTrend(agentId, organizationId, startDate, endDate, granularity),
    getMyWorkload(agentId, organizationId),
    getMyStatusDistribution(agentId, organizationId, startDate, endDate),
    getMyPriorityDistribution(agentId, organizationId, startDate, endDate),
    getMyCategoryDistribution(agentId, organizationId, startDate, endDate),
    getMySLAPerformance(agentId, organizationId, startDate, endDate),
    getMyAverageResolutionTime(agentId, organizationId, startDate, endDate),
    getMyAverageFirstResponseTime(agentId, organizationId, startDate, endDate),
  ]);

  return {
    scope: "agent",
    generatedAt: new Date().toISOString(),
    agent: { id: agentId },
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      granularity,
    },
    tickets: {
      createdTrend: creationTrend,
      resolvedTrend: resolutionTrend,
      closedTrend: closureTrend,
      statusDistribution,
      priorityDistribution,
      categoryDistribution,
    },
    workload,
    sla: slaPerformance,
    performance: {
      averageResolutionTime,
      averageFirstResponseTime,
    },
  };
}

// ============================================================
// Helpers
// ============================================================

function bucketByPeriod(records, dateField, granularity) {
  const buckets = {};

  for (const record of records) {
    const date = record[dateField];
    const period = truncateToPeriod(date, granularity);
    buckets[period] = (buckets[period] || 0) + 1;
  }

  return Object.entries(buckets)
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function truncateToPeriod(date, granularity) {
  const d = new Date(date);

  switch (granularity) {
    case "hour":
      d.setUTCMinutes(0, 0, 0);
      return d.toISOString().slice(0, 13) + ":00:00.000Z";
    case "day":
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    case "week": {
      d.setUTCHours(0, 0, 0, 0);
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - day);
      return d.toISOString().slice(0, 10);
    }
    case "month":
      return d.toISOString().slice(0, 7);
    default:
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
  }
}
