import prisma from "@/lib/db/prisma";

export class NotificationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "NotificationError";
    this.status = status;
  }
}

export async function createNotification({
  type,
  message,
  ticketId,
  recipientId,
  organizationId,
}) {
  if (!type || !message || !recipientId || !organizationId) {
    throw new NotificationError("Missing required notification fields");
  }

  if (ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, organizationId: true },
    });
    if (!ticket || ticket.organizationId !== organizationId) {
      throw new NotificationError("Invalid ticket for notification");
    }
  }

  const existing = await prisma.notification.findFirst({
    where: {
      type,
      ticketId: ticketId || null,
      recipientId,
      organizationId,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.notification.create({
    data: {
      type,
      message,
      ticketId: ticketId || null,
      recipientId,
      organizationId,
    },
  });
}

export async function createBulkNotifications(notifications) {
  const results = [];
  for (const notif of notifications) {
    try {
      const created = await createNotification(notif);
      results.push(created);
    } catch {
      // Skip failed notifications — don't block the batch
    }
  }
  return results;
}

export async function getUserNotifications(userId, organizationId, options = {}) {
  const { page = 1, limit = 20, unreadOnly = false } = options;

  const where = {
    recipientId: userId,
    organizationId,
  };

  if (unreadOnly) {
    where.isRead = false;
  }

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getUnreadCount(userId, organizationId) {
  const count = await prisma.notification.count({
    where: {
      recipientId: userId,
      organizationId,
      isRead: false,
    },
  });
  return { count };
}

export async function markAsRead(notificationId, userId, organizationId) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotificationError("Notification not found", 404);
  }

  if (notification.recipientId !== userId) {
    throw new NotificationError("Access denied", 403);
  }

  if (notification.organizationId !== organizationId) {
    throw new NotificationError("Access denied", 403);
  }

  if (notification.isRead) {
    return notification;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId, organizationId) {
  await prisma.notification.updateMany({
    where: {
      recipientId: userId,
      organizationId,
      isRead: false,
    },
    data: { isRead: true },
  });

  return { success: true };
}

export async function notifyTicketAssigned({
  ticketId,
  ticketNumber,
  assignedToId,
  assignedById,
  organizationId,
}) {
  if (assignedToId === assignedById) return null;

  const assigner = await prisma.user.findUnique({
    where: { id: assignedById },
    select: { username: true },
  });

  return createNotification({
    type: "TICKET_ASSIGNED",
    message: `${assigner?.username || "Someone"} assigned you ticket ${ticketNumber}`,
    ticketId,
    recipientId: assignedToId,
    organizationId,
  });
}

export async function notifyTicketStatusChanged({
  ticketId,
  ticketNumber,
  newStatus,
  recipientId,
  organizationId,
  actorId,
}) {
  if (recipientId === actorId) return null;

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { username: true },
  });

  const statusLabel = newStatus.replace(/_/g, " ").toLowerCase();

  return createNotification({
    type: "TICKET_STATUS_CHANGED",
    message: `${actor?.username || "Someone"} changed ticket ${ticketNumber} to ${statusLabel}`,
    ticketId,
    recipientId,
    organizationId,
  });
}

export async function notifySLABreach({
  ticketId,
  ticketNumber,
  slaType,
  recipientId,
  organizationId,
}) {
  const label = slaType === "response" ? "Response" : "Resolution";

  return createNotification({
    type: "SLA_BREACHED",
    message: `${label} SLA breached for ticket ${ticketNumber}`,
    ticketId,
    recipientId,
    organizationId,
  });
}

export async function notifySLAWarning({
  ticketId,
  ticketNumber,
  slaType,
  recipientId,
  organizationId,
}) {
  const label = slaType === "response" ? "Response" : "Resolution";

  return createNotification({
    type: "SLA_WARNING",
    message: `${label} SLA warning for ticket ${ticketNumber}`,
    ticketId,
    recipientId,
    organizationId,
  });
}

export async function notifyTicketReopened({
  ticketId,
  ticketNumber,
  recipientId,
  organizationId,
  actorId,
}) {
  if (recipientId === actorId) return null;

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { username: true },
  });

  return createNotification({
    type: "TICKET_STATUS_CHANGED",
    message: `${actor?.username || "Someone"} reopened ticket ${ticketNumber}`,
    ticketId,
    recipientId,
    organizationId,
  });
}
