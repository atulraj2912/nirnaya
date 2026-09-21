import prisma from "@/lib/db/prisma";
import { createNotification } from "./notification-service";
import { emitToTicket } from "@/lib/realtime/socket-server";
import { getIO } from "@/lib/realtime/socket-instance";

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

  const watcher = await prisma.watcher.create({
    data: {
      ticketId,
      userId: targetUserId,
    },
  });

  // Fetch ticket info for notifications and events
  const ticketInfo = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { ticketNumber: true },
  });

  // Notify existing watchers (fire-and-forget, excluding the new watcher and the actor)
  prisma.watcher
    .findMany({
      where: { ticketId, userId: { not: targetUserId, not: user.id } },
      select: { userId: true },
    })
    .then((existingWatchers) => {
      for (const w of existingWatchers) {
        createNotification({
          type: "WATCHER_ADDED",
          message: `Someone is now watching ticket ${ticketInfo?.ticketNumber || ""}`,
          ticketId,
          recipientId: w.userId,
          organizationId: user.organizationId,
        }).catch((err) => console.error("Watcher notification failed:", err));
      }
    })
    .catch((err) => console.error("Watcher lookup failed:", err));

  // Emit realtime watcher event (fire-and-forget)
  try {
    const io = getIO();
    if (io) {
      emitToTicket(io, ticketId, "ticket:updated", {
        ticketId,
        event: "watcher_added",
        watcherId: targetUserId,
      });
    }
  } catch {
    // Realtime emission is best-effort
  }

  return watcher;
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

  // Emit realtime watcher event (fire-and-forget)
  try {
    const io = getIO();
    if (io) {
      emitToTicket(io, ticketId, "ticket:updated", {
        ticketId,
        event: "watcher_removed",
        watcherId: targetUserId,
      });
    }
  } catch {
    // Realtime emission is best-effort
  }

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
