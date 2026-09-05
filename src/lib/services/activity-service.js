import prisma from "@/lib/db/prisma";

export class ActivityError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ActivityError";
    this.status = status;
  }
}

function buildActivityEntry(type, data) {
  return {
    type,
    ...data,
  };
}

export async function listTicketActivity(ticketId, user, options = {}) {
  const { page = 1, limit = 50 } = options;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new ActivityError("Ticket not found", 404);
  }

  if (ticket.organizationId !== user.organizationId) {
    throw new ActivityError("Ticket not found", 404);
  }

  if (user.role === "USER" && ticket.requesterId !== user.id) {
    throw new ActivityError("Access denied", 403);
  }

  const activities = [];

  activities.push(
    buildActivityEntry("TICKET_CREATED", {
      id: `created-${ticket.id}`,
      timestamp: ticket.createdAt,
      actor: ticket.requesterId,
      description: `Ticket created`,
      meta: {
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        priority: ticket.priority,
        type: ticket.type,
      },
    })
  );

  if (ticket.status !== "OPEN" || ticket.assignedAgentId) {
    activities.push(
      buildActivityEntry("STATUS_CHANGED", {
        id: `status-${ticket.id}`,
        timestamp: ticket.updatedAt,
        actor: ticket.updatedById,
        description: `Status changed to ${ticket.status.replace(/_/g, " ").toLowerCase()}`,
        meta: {
          from: "OPEN",
          to: ticket.status,
        },
      })
    );
  }

  const assignmentHistory = await prisma.ticketAssignmentHistory.findMany({
    where: { ticketId },
    include: {
      assignedTo: { select: { id: true, username: true } },
      assignedBy: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const assignment of assignmentHistory) {
    activities.push(
      buildActivityEntry("ASSIGNMENT_CHANGED", {
        id: `assign-${assignment.id}`,
        timestamp: assignment.createdAt,
        actor: assignment.assignedById,
        description: `Assigned to ${assignment.assignedTo?.username || "unknown"} by ${assignment.assignedBy?.username || "unknown"}`,
        meta: {
          assignedToId: assignment.assignedToId,
          assignedToUsername: assignment.assignedTo?.username,
          assignedById: assignment.assignedById,
          assignedByUsername: assignment.assignedBy?.username,
          reason: assignment.reason,
        },
      })
    );
  }

  const comments = await prisma.comment.findMany({
    where: { ticketId },
    include: {
      author: { select: { id: true, username: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const comment of comments) {
    if (comment.visibility === "INTERNAL" && user.role === "USER") {
      continue;
    }

    activities.push(
      buildActivityEntry("COMMENT_ADDED", {
        id: `comment-${comment.id}`,
        timestamp: comment.createdAt,
        actor: comment.authorId,
        description: `${comment.author?.username || "Someone"} added a ${comment.visibility === "INTERNAL" ? "internal " : ""}comment`,
        meta: {
          commentId: comment.id,
          visibility: comment.visibility,
          authorUsername: comment.author?.username,
          authorRole: comment.author?.role,
          preview: comment.content.substring(0, 100),
        },
      })
    );
  }

  if (ticket.firstRespondedAt) {
    activities.push(
      buildActivityEntry("SLA_RESPONDED", {
        id: `sla-responded-${ticket.id}`,
        timestamp: ticket.firstRespondedAt,
        actor: null,
        description: "Response SLA satisfied",
        meta: {
          firstRespondedAt: ticket.firstRespondedAt,
        },
      })
    );
  }

  if (ticket.resolvedAt) {
    activities.push(
      buildActivityEntry("TICKET_RESOLVED", {
        id: `resolved-${ticket.id}`,
        timestamp: ticket.resolvedAt,
        actor: ticket.updatedById,
        description: "Ticket resolved",
        meta: {
          resolvedAt: ticket.resolvedAt,
        },
      })
    );
  }

  if (ticket.closedAt) {
    activities.push(
      buildActivityEntry("TICKET_CLOSED", {
        id: `closed-${ticket.id}`,
        timestamp: ticket.closedAt,
        actor: ticket.updatedById,
        description: "Ticket closed",
        meta: {
          closedAt: ticket.closedAt,
        },
      })
    );
  }

  activities.sort((a, b) => {
    const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });

  const total = activities.length;
  const skip = (page - 1) * limit;
  const paginatedActivities = activities.slice(skip, skip + limit);

  return {
    activities: paginatedActivities,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
