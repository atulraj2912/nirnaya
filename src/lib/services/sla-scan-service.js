import prisma from "@/lib/db/prisma";
import {
  createNotification,
  notifySLABreach,
  notifySLAWarning,
} from "./notification-service";

const WARNING_THRESHOLD = 0.2;

function evaluateSLAStatus(createdAt, dueAt, waitingSince, isCompleted) {
  if (isCompleted) return "COMPLETED";
  if (waitingSince) return "PAUSED";

  const now = new Date();
  const originalMs = dueAt.getTime() - createdAt.getTime();
  const remainingMs = dueAt.getTime() - now.getTime();

  if (remainingMs < 0) return "BREACHED";
  if (remainingMs <= originalMs * WARNING_THRESHOLD) return "WARNING";
  return "ON_TRACK";
}

export async function runSLABreachScan(organizationId) {
  const now = new Date();

  const tickets = await prisma.ticket.findMany({
    where: {
      organizationId,
      status: { notIn: ["CLOSED"] },
      OR: [
        {
          responseSlaStatus: { in: ["ON_TRACK", "WARNING"] },
          responseDueAt: { not: null },
          firstRespondedAt: null,
        },
        {
          resolutionSlaStatus: { in: ["ON_TRACK", "WARNING"] },
          resolutionDueAt: { not: null },
          status: { notIn: ["RESOLVED", "CLOSED"] },
        },
      ],
    },
    select: {
      id: true,
      ticketNumber: true,
      createdAt: true,
      status: true,
      waitingSince: true,
      responseSlaStatus: true,
      resolutionSlaStatus: true,
      responseDueAt: true,
      resolutionDueAt: true,
      firstRespondedAt: true,
      requesterId: true,
      assignedAgentId: true,
    },
  });

  let breached = 0;
  let warned = 0;
  let unchanged = 0;
  const notifications = [];

  for (const ticket of tickets) {
    let responseChanged = false;
    let resolutionChanged = false;
    let newResponseStatus = ticket.responseSlaStatus;
    let newResolutionStatus = ticket.resolutionSlaStatus;

    if (ticket.responseDueAt && !ticket.firstRespondedAt) {
      const responseStatus = evaluateSLAStatus(
        ticket.createdAt,
        ticket.responseDueAt,
        ticket.waitingSince,
        false
      );

      if (responseStatus !== ticket.responseSlaStatus) {
        newResponseStatus = responseStatus;
        responseChanged = true;

        if (responseStatus === "BREACHED") {
          breached++;
          const notif = await notifySLABreach({
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            slaType: "response",
            recipientId: ticket.requesterId,
            organizationId,
          });
          if (notif) notifications.push(notif);
        } else if (responseStatus === "WARNING") {
          warned++;
          const notif = await notifySLAWarning({
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            slaType: "response",
            recipientId: ticket.requesterId,
            organizationId,
          });
          if (notif) notifications.push(notif);
        }
      }
    }

    if (ticket.resolutionDueAt && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
      const resolutionStatus = evaluateSLAStatus(
        ticket.createdAt,
        ticket.resolutionDueAt,
        ticket.waitingSince,
        false
      );

      if (resolutionStatus !== ticket.resolutionSlaStatus) {
        newResolutionStatus = resolutionStatus;
        resolutionChanged = true;

        if (resolutionStatus === "BREACHED") {
          breached++;
          const notif = await notifySLABreach({
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            slaType: "resolution",
            recipientId: ticket.requesterId,
            organizationId,
          });
          if (notif) notifications.push(notif);
        } else if (resolutionStatus === "WARNING") {
          warned++;
          const notif = await notifySLAWarning({
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            slaType: "resolution",
            recipientId: ticket.requesterId,
            organizationId,
          });
          if (notif) notifications.push(notif);
        }
      }
    }

    if (responseChanged || resolutionChanged) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          ...(responseChanged ? { responseSlaStatus: newResponseStatus } : {}),
          ...(resolutionChanged ? { resolutionSlaStatus: newResolutionStatus } : {}),
        },
      });
    } else {
      unchanged++;
    }
  }

  return {
    scanned: tickets.length,
    breached,
    warned,
    unchanged,
    notifications: notifications.length,
    timestamp: now.toISOString(),
  };
}
