import prisma from "@/lib/db/prisma";

/**
 * Admin Analytics Service — G1 Analytics Foundation.
 *
 * Provides organization-scoped analytics for Grafana consumption.
 * All queries are scoped to the authenticated admin's organization.
 * Date ranges and granularity are server-validated.
 *
 * This service extends the existing analytics-service.js with additional
 * metrics required for the Grafana integration foundation.
 */

/**
 * Get ticket creation trend — tickets created grouped by time period.
 *
 * @param {string} organizationId - server-derived org scope
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} granularity - "hour" | "day" | "week" | "month"
 * @returns {Promise<Array<{period: string, count: number}>>}
 */
export async function getCreationTrend(organizationId, startDate, endDate, granularity = "day") {
  const tickets = await prisma.ticket.findMany({
    where: { organizationId, createdAt: { gte: startDate, lte: endDate } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return bucketByPeriod(tickets, "createdAt", granularity);
}

/**
 * Get ticket resolution trend — tickets resolved grouped by time period.
 *
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} granularity
 * @returns {Promise<Array<{period: string, count: number}>>}
 */
export async function getResolutionTrend(organizationId, startDate, endDate, granularity = "day") {
  const tickets = await prisma.ticket.findMany({
    where: {
      organizationId,
      resolvedAt: { not: null, gte: startDate, lte: endDate },
    },
    select: { resolvedAt: true },
    orderBy: { resolvedAt: "asc" },
  });

  return bucketByPeriod(tickets, "resolvedAt", granularity);
}

/**
 * Get ticket closure trend — tickets closed grouped by time period.
 *
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} granularity
 * @returns {Promise<Array<{period: string, count: number}>>}
 */
export async function getClosureTrend(organizationId, startDate, endDate, granularity = "day") {
  const tickets = await prisma.ticket.findMany({
    where: {
      organizationId,
      closedAt: { not: null, gte: startDate, lte: endDate },
    },
    select: { closedAt: true },
    orderBy: { closedAt: "asc" },
  });

  return bucketByPeriod(tickets, "closedAt", granularity);
}

/**
 * Get status distribution — count of tickets per status.
 *
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array<{status: string, count: number}>>}
 */
export async function getStatusDistribution(organizationId, startDate, endDate) {
  const results = await prisma.ticket.groupBy({
    by: ["status"],
    where: { organizationId, createdAt: { gte: startDate, lte: endDate } },
    _count: { id: true },
  });

  return results.map((r) => ({ status: r.status, count: r._count.id }));
}

/**
 * Get priority distribution — count of tickets per priority.
 *
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array<{priority: string, count: number}>>}
 */
export async function getPriorityDistribution(organizationId, startDate, endDate) {
  const results = await prisma.ticket.groupBy({
    by: ["priority"],
    where: { organizationId, createdAt: { gte: startDate, lte: endDate } },
    _count: { id: true },
  });

  return results.map((r) => ({ priority: r.priority, count: r._count.id }));
}

/**
 * Get tickets by department — resolved department names included.
 *
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array<{departmentId: string, name: string, count: number}>>}
 */
export async function getTicketsByDepartment(organizationId, startDate, endDate) {
  const results = await prisma.ticket.groupBy({
    by: ["departmentId"],
    where: { organizationId, createdAt: { gte: startDate, lte: endDate } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  const deptIds = results.map((r) => r.departmentId).filter(Boolean);
  if (deptIds.length === 0) return [];

  const departments = await prisma.department.findMany({
    where: { id: { in: deptIds } },
    select: { id: true, name: true },
  });
  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  return results.map((r) => ({
    departmentId: r.departmentId,
    name: deptMap[r.departmentId] || "Unknown",
    count: r._count.id,
  }));
}

/**
 * Get tickets by category — resolved category names included.
 *
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array<{categoryId: string, name: string, count: number}>>}
 */
export async function getTicketsByCategory(organizationId, startDate, endDate) {
  const results = await prisma.ticket.groupBy({
    by: ["categoryId"],
    where: {
      organizationId,
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
 * Get agent workload — active agents with their assigned ticket counts.
 *
 * @param {string} organizationId
 * @returns {Promise<Array<{agentId: string, username: string, designation: string, assignedCount: number}>>}
 */
export async function getAgentWorkload(organizationId) {
  const agents = await prisma.user.findMany({
    where: { organizationId, role: { in: ["AGENT", "ADMIN"] }, status: "ACTIVE" },
    select: { id: true, username: true, designation: true },
  });

  if (agents.length === 0) return [];

  const agentIds = agents.map((a) => a.id);

  const workloadCounts = await prisma.ticket.groupBy({
    by: ["assignedAgentId"],
    where: {
      organizationId,
      assignedAgentId: { in: agentIds },
      status: { notIn: ["RESOLVED", "CLOSED"] },
    },
    _count: { id: true },
  });

  const countMap = Object.fromEntries(
    workloadCounts.map((w) => [w.assignedAgentId, w._count.id])
  );

  return agents.map((a) => ({
    agentId: a.id,
    username: a.username,
    designation: a.designation,
    assignedCount: countMap[a.id] || 0,
  }));
}

/**
 * Get SLA performance — response and resolution SLA status counts.
 *
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<{response: Array<{status: string, count: number}>, resolution: Array<{status: string, count: number}>, responseComplianceRate: number|null, resolutionComplianceRate: number|null}>}
 */
export async function getSLAPerformance(organizationId, startDate, endDate) {
  const dateFilter = { createdAt: { gte: startDate, lte: endDate } };

  const [responseResults, resolutionResults] = await Promise.all([
    prisma.ticket.groupBy({
      by: ["responseSlaStatus"],
      where: {
        organizationId,
        ...dateFilter,
        responseSlaStatus: { not: null },
      },
      _count: { id: true },
    }),
    prisma.ticket.groupBy({
      by: ["resolutionSlaStatus"],
      where: {
        organizationId,
        ...dateFilter,
        resolutionSlaStatus: { not: null },
      },
      _count: { id: true },
    }),
  ]);

  const response = responseResults.map((r) => ({
    status: r.responseSlaStatus,
    count: r._count.id,
  }));
  const resolution = resolutionResults.map((r) => ({
    status: r.resolutionSlaStatus,
    count: r._count.id,
  }));

  // Compliance rate: percentage of tickets that are NOT BREACHED
  // Handles zero denominator (no SLA data) by returning null
  const responseComplianceRate = computeComplianceRate(response);
  const resolutionComplianceRate = computeComplianceRate(resolution);

  return {
    response,
    resolution,
    responseComplianceRate,
    resolutionComplianceRate,
  };
}

/**
 * Compute SLA compliance rate from status counts.
 * Compliance = (total - BREACHED) / total * 100
 * Returns null when there are no tickets with SLA data.
 *
 * @param {Array<{status: string, count: number>}}
 * @returns {number|null} percentage 0–100, or null if no data
 */
function computeComplianceRate(statusCounts) {
  const total = statusCounts.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;
  const breached = statusCounts.find((s) => s.status === "BREACHED")?.count || 0;
  return Math.round(((total - breached) / total) * 10000) / 100;
}

/**
 * Get average resolution time in hours.
 *
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<{averageHours: number|null, sampleSize: number}>}
 */
export async function getAverageResolutionTime(organizationId, startDate, endDate) {
  const resolved = await prisma.ticket.findMany({
    where: {
      organizationId,
      status: { in: ["RESOLVED", "CLOSED"] },
      resolvedAt: { not: null },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { createdAt: true, resolvedAt: true },
    take: 5000,
  });

  if (resolved.length === 0) return { averageHours: null, sampleSize: 0 };

  const valid = resolved.filter((t) => t.resolvedAt.getTime() >= t.createdAt.getTime());
  if (valid.length === 0) return { averageHours: null, sampleSize: 0 };

  const totalMs = valid.reduce(
    (sum, t) => sum + (t.resolvedAt.getTime() - t.createdAt.getTime()),
    0
  );

  return {
    averageHours: Math.round((totalMs / valid.length / (1000 * 60 * 60)) * 100) / 100,
    sampleSize: valid.length,
  };
}

/**
 * Get average first-response time in hours.
 *
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<{averageHours: number|null, sampleSize: number}>}
 */
export async function getAverageFirstResponseTime(organizationId, startDate, endDate) {
  const responded = await prisma.ticket.findMany({
    where: {
      organizationId,
      firstRespondedAt: { not: null },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { createdAt: true, firstRespondedAt: true },
    take: 5000,
  });

  if (responded.length === 0) return { averageHours: null, sampleSize: 0 };

  const valid = responded.filter((t) => t.firstRespondedAt.getTime() >= t.createdAt.getTime());
  if (valid.length === 0) return { averageHours: null, sampleSize: 0 };

  const totalMs = valid.reduce(
    (sum, t) => sum + (t.firstRespondedAt.getTime() - t.createdAt.getTime()),
    0
  );

  return {
    averageHours: Math.round((totalMs / valid.length / (1000 * 60 * 60)) * 100) / 100,
    sampleSize: valid.length,
  };
}

/**
 * Get AI classification statistics from existing AIPrediction data.
 *
 * @param {string} organizationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<{totalPredictions: number, averageConfidence: number|null, topCategories: Array<{name: string, count: number}>}>}
 */
export async function getAIStatistics(organizationId, startDate, endDate) {
  const predictions = await prisma.aIPrediction.findMany({
    where: {
      ticket: { organizationId },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      confidence: true,
      predictedCategoryId: true,
    },
  });

  if (predictions.length === 0) {
    return { totalPredictions: 0, averageConfidence: null, topCategories: [] };
  }

  const confidences = predictions.filter((p) => p.confidence != null);
  const avgConfidence =
    confidences.length > 0
      ? Math.round((confidences.reduce((s, p) => s + p.confidence, 0) / confidences.length) * 100) / 100
      : null;

  // Count predictions by predicted category
  const catCounts = {};
  for (const p of predictions) {
    if (p.predictedCategoryId) {
      catCounts[p.predictedCategoryId] = (catCounts[p.predictedCategoryId] || 0) + 1;
    }
  }

  const catIds = Object.keys(catCounts);
  let topCategories = [];
  if (catIds.length > 0) {
    const cats = await prisma.category.findMany({
      where: { id: { in: catIds } },
      select: { id: true, name: true },
    });
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));
    topCategories = Object.entries(catCounts)
      .map(([id, count]) => ({ name: catMap[id] || "Unknown", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  return {
    totalPredictions: predictions.length,
    averageConfidence: avgConfidence,
    topCategories,
  };
}

/**
 * Get complete admin analytics dashboard.
 *
 * @param {string} organizationId - server-derived, never from client
 * @param {object} params
 * @param {Date} params.startDate
 * @param {Date} params.endDate
 * @param {string} params.granularity
 * @returns {Promise<object>}
 */
export async function getAdminAnalytics(organizationId, { startDate, endDate, granularity }) {
  const [
    creationTrend,
    resolutionTrend,
    closureTrend,
    statusDistribution,
    priorityDistribution,
    ticketsByDepartment,
    ticketsByCategory,
    agentWorkload,
    slaPerformance,
    averageResolutionTime,
    averageFirstResponseTime,
    aiStatistics,
  ] = await Promise.all([
    getCreationTrend(organizationId, startDate, endDate, granularity),
    getResolutionTrend(organizationId, startDate, endDate, granularity),
    getClosureTrend(organizationId, startDate, endDate, granularity),
    getStatusDistribution(organizationId, startDate, endDate),
    getPriorityDistribution(organizationId, startDate, endDate),
    getTicketsByDepartment(organizationId, startDate, endDate),
    getTicketsByCategory(organizationId, startDate, endDate),
    getAgentWorkload(organizationId),
    getSLAPerformance(organizationId, startDate, endDate),
    getAverageResolutionTime(organizationId, startDate, endDate),
    getAverageFirstResponseTime(organizationId, startDate, endDate),
    getAIStatistics(organizationId, startDate, endDate),
  ]);

  return {
    scope: "organization",
    generatedAt: new Date().toISOString(),
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
      byDepartment: ticketsByDepartment,
      byCategory: ticketsByCategory,
    },
    workload: agentWorkload,
    sla: slaPerformance,
    performance: {
      averageResolutionTime,
      averageFirstResponseTime,
    },
    ai: aiStatistics,
  };
}

// ============================================================
// Helpers
// ============================================================

/**
 * Bucket records into time periods based on granularity.
 *
 * @param {Array} records - array of objects with a date field
 * @param {string} dateField - field name containing the Date
 * @param {string} granularity - "hour" | "day" | "week" | "month"
 * @returns {Array<{period: string, count: number}>}
 */
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

/**
 * Truncate a date to the specified granularity level.
 *
 * @param {Date} date
 * @param {string} granularity
 * @returns {string} ISO date string truncated to the period
 */
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
