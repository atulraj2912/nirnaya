import prisma from "@/lib/db/prisma";

const WARNING_THRESHOLD = 0.2;

function evaluateStatus({ isBreached, isPaused, isCompleted, remainingMs, originalMs }) {
  if (isCompleted) return "COMPLETED";
  if (isPaused) return "PAUSED";
  if (isBreached) return "BREACHED";
  if (isPaused) return "PAUSED";
  if (remainingMs <= originalMs * WARNING_THRESHOLD) return "WARNING";
  return "ON_TRACK";
}

function calculateStatus(createdAt, dueAt, responseFirstRespondedAt, waitingSince) {
  const now = new Date();
  const originalMs = dueAt.getTime() - createdAt.getTime();
  const remainingMs = dueAt.getTime() - now.getTime();

  return evaluateStatus({
    isBreached: remainingMs < 0,
    isPaused: !!waitingSince,
    isCompleted: !!responseFirstRespondedAt && responseFirstRespondedAt <= dueAt,
    remainingMs,
    originalMs,
  });
}

export function computeSLAInfo(ticket) {
  const now = new Date();

  let responseRemainingMs = null;
  if (ticket.responseDueAt && !ticket.firstRespondedAt) {
    responseRemainingMs = ticket.responseDueAt.getTime() - now.getTime();
  }

  let resolutionRemainingMs = null;
  if (ticket.resolutionDueAt && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
    resolutionRemainingMs = ticket.resolutionDueAt.getTime() - now.getTime();
    if (ticket.waitingSince) {
      resolutionRemainingMs = null;
    }
  }

  const responseMet = !!ticket.firstRespondedAt;
  const resolutionMet = ticket.status === "RESOLVED" || ticket.status === "CLOSED";
  const isPaused = !!ticket.waitingSince;

  const responseStatus = responseMet ? "COMPLETED" : (isPaused ? "PAUSED" : (ticket.responseSlaStatus || "ON_TRACK"));
  const resolutionStatus = resolutionMet ? "COMPLETED" : (isPaused ? "PAUSED" : (ticket.resolutionSlaStatus || "ON_TRACK"));

  return {
    response: {
      status: responseStatus,
      dueAt: ticket.responseDueAt || null,
      remainingMs: responseRemainingMs,
      firstRespondedAt: ticket.firstRespondedAt || null,
      met: responseMet,
    },
    resolution: {
      status: resolutionStatus,
      dueAt: ticket.resolutionDueAt || null,
      remainingMs: resolutionRemainingMs,
      pausedAt: ticket.waitingSince || null,
      resumedFromPause: ticket.status === "IN_PROGRESS" && ticket.waitingSince === null,
      met: resolutionMet,
    },
  };
}

export async function initializeTicketSLA(ticketId, organizationId, priority) {
  const config = await prisma.sLAConfiguration.findFirst({
    where: { organizationId, priority },
  });

  if (!config) return {};

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  const createdAt = ticket.createdAt;

  const responseDueAt = new Date(createdAt.getTime() + config.responseTimeMinutes * 60 * 1000);
  const resolutionDueAt = new Date(createdAt.getTime() + config.resolutionTimeMinutes * 60 * 1000);

  const responseStatus = calculateStatus(createdAt, responseDueAt, null, null);
  const resolutionStatus = calculateStatus(createdAt, resolutionDueAt, null, null);

  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      responseSlaStatus: responseStatus,
      resolutionSlaStatus: resolutionStatus,
      responseDueAt,
      resolutionDueAt,
    },
  });
}

export async function pauseSLA(ticketId) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  const responseStatus = ticket.responseSlaStatus === "COMPLETED" ? "COMPLETED" : "PAUSED";
  const resolutionStatus = ticket.resolutionSlaStatus === "COMPLETED" ? "COMPLETED" : "PAUSED";

  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      waitingSince: new Date(),
      responseSlaStatus: responseStatus,
      resolutionSlaStatus: resolutionStatus,
    },
  });
}

export async function resumeSLA(ticketId) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  const now = new Date();
  const resolutionStatus = calculateStatus(
    ticket.createdAt,
    ticket.resolutionDueAt,
    null,
    null
  );

  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      waitingSince: null,
      resolutionSlaStatus: resolutionStatus,
    },
  });
}

export async function completeResolutionSLA(ticketId) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      resolvedAt: new Date(),
      resolutionSlaStatus: "COMPLETED",
    },
  });
}

export async function satisfyResponseSLA(ticketId, commentAuthorRole) {
  if (commentAuthorRole !== "AGENT" && commentAuthorRole !== "ADMIN") return null;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.firstRespondedAt) return null;

  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      firstRespondedAt: new Date(),
      responseSlaStatus: "COMPLETED",
    },
  });
}

export async function recalculateResolutionSLA(ticketId, newPriority) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  const config = await prisma.sLAConfiguration.findFirst({
    where: { organizationId: ticket.organizationId, priority: newPriority },
  });

  if (!config) return null;

  const createdAt = ticket.createdAt;
  const resolutionDueAt = new Date(createdAt.getTime() + config.resolutionTimeMinutes * 60 * 1000);

  const now = new Date();
  const remainingMs = resolutionDueAt.getTime() - now.getTime();
  const originalMs = config.resolutionTimeMinutes * 60 * 1000;

  const resolutionStatus = evaluateStatus({
    isBreached: remainingMs < 0,
    isPaused: !!ticket.waitingSince,
    isCompleted: ticket.status === "RESOLVED" || ticket.status === "CLOSED",
    remainingMs,
    originalMs,
  });

  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      resolutionDueAt,
      resolutionSlaStatus: resolutionStatus,
    },
  });
}

export async function reopenSLA(ticketId) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  const config = await prisma.sLAConfiguration.findFirst({
    where: { organizationId: ticket.organizationId, priority: ticket.priority },
  });

  if (!config) return null;

  const createdAt = ticket.createdAt;
  const resolutionDueAt = new Date(createdAt.getTime() + config.resolutionTimeMinutes * 60 * 1000);

  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      resolvedAt: null,
      resolutionDueAt,
      resolutionSlaStatus: "ON_TRACK",
    },
  });
}

export async function evaluateAndPersistSLA(ticketId) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  if (!ticket.responseDueAt && !ticket.resolutionDueAt) return ticket;

  const now = new Date();

  let responseStatus = ticket.responseSlaStatus;
  if (ticket.responseDueAt && !ticket.firstRespondedAt) {
    const responseRemainingMs = ticket.responseDueAt.getTime() - now.getTime();
    const responseOriginalMs = ticket.responseDueAt.getTime() - ticket.createdAt.getTime();

    responseStatus = evaluateStatus({
      isBreached: responseRemainingMs < 0,
      isPaused: !!ticket.waitingSince,
      isCompleted: false,
      remainingMs: responseRemainingMs,
      originalMs: responseOriginalMs,
    });
  }

  let resolutionStatus = ticket.resolutionSlaStatus;
  if (ticket.resolutionDueAt && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
    const resolutionRemainingMs = ticket.resolutionDueAt.getTime() - now.getTime();
    const resolutionOriginalMs = ticket.resolutionDueAt.getTime() - ticket.createdAt.getTime();

    resolutionStatus = evaluateStatus({
      isBreached: resolutionRemainingMs < 0,
      isPaused: !!ticket.waitingSince,
      isCompleted: false,
      remainingMs: resolutionRemainingMs,
      originalMs: resolutionOriginalMs,
    });
  }

  if (responseStatus !== ticket.responseSlaStatus || resolutionStatus !== ticket.resolutionSlaStatus) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data: {
        responseSlaStatus: responseStatus,
        resolutionSlaStatus: resolutionStatus,
      },
    });
  }

  return ticket;
}
