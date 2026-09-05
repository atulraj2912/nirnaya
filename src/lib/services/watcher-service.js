import prisma from "@/lib/db/prisma";

export class WatcherError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "WatcherError";
    this.status = status;
  }
}

export async function addWatcher(ticketId, userId, user) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new WatcherError("Ticket not found", 404);
  }

  if (ticket.organizationId !== user.organizationId) {
    throw new WatcherError("Ticket not found", 404);
  }

  if (user.role === "USER" && ticket.requesterId !== user.id) {
    throw new WatcherError("Access denied", 403);
  }

  const targetUserId = userId || user.id;

  if (targetUserId !== user.id && user.role === "USER") {
    throw new WatcherError("Users can only watch their own tickets", 403);
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, organizationId: true, status: true },
  });

  if (!targetUser) {
    throw new WatcherError("User not found", 404);
  }

  if (targetUser.organizationId !== user.organizationId) {
    throw new WatcherError("Access denied", 403);
  }

  if (targetUser.status !== "ACTIVE") {
    throw new WatcherError("Cannot watch as inactive user", 400);
  }

  const existing = await prisma.watcher.findUnique({
    where: { ticketId_userId: { ticketId, userId: targetUserId } },
  });

  if (existing) {
    return existing;
  }

  return prisma.watcher.create({
    data: {
      ticketId,
      userId: targetUserId,
    },
  });
}

export async function removeWatcher(ticketId, userId, user) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new WatcherError("Ticket not found", 404);
  }

  if (ticket.organizationId !== user.organizationId) {
    throw new WatcherError("Ticket not found", 404);
  }

  const targetUserId = userId || user.id;

  if (targetUserId !== user.id && user.role === "USER") {
    throw new WatcherError("Users can only manage their own watch status", 403);
  }

  const watcher = await prisma.watcher.findUnique({
    where: { ticketId_userId: { ticketId, userId: targetUserId } },
  });

  if (!watcher) {
    return { success: true };
  }

  await prisma.watcher.delete({
    where: { id: watcher.id },
  });

  return { success: true };
}

export async function listWatchers(ticketId, user) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new WatcherError("Ticket not found", 404);
  }

  if (ticket.organizationId !== user.organizationId) {
    throw new WatcherError("Ticket not found", 404);
  }

  if (user.role === "USER" && ticket.requesterId !== user.id) {
    throw new WatcherError("Access denied", 403);
  }

  const watchers = await prisma.watcher.findMany({
    where: { ticketId },
    include: {
      user: {
        select: { id: true, username: true, role: true, avatarUrl: true, designation: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return { watchers };
}

export async function isWatching(ticketId, userId) {
  const watcher = await prisma.watcher.findUnique({
    where: { ticketId_userId: { ticketId, userId } },
  });

  return !!watcher;
}
