import prisma from "@/lib/db/prisma";
import { satisfyResponseSLA } from "./sla-service";
import { notifyCommentAdded } from "./notification-service";

export class CommentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CommentError";
    this.status = status;
  }
}

function canSeeInternalComment(user, commentAuthorId) {
  return user.role === "AGENT" || user.role === "ADMIN";
}

function filterCommentsForUser(comments, user) {
  if (user.role === "USER") {
    return comments.filter((c) => c.visibility === "PUBLIC");
  }
  return comments;
}

export async function createComment({ ticketId, content, visibility }, user) {
  if (!content || content.trim().length === 0) {
    throw new CommentError("Comment content is required");
  }

  if (content.length > 10000) {
    throw new CommentError("Comment content exceeds maximum length");
  }

  const validVisibilities = ["PUBLIC", "INTERNAL"];
  if (visibility && !validVisibilities.includes(visibility)) {
    throw new CommentError("Invalid visibility");
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new CommentError("Ticket not found", 404);
  }

  if (ticket.organizationId !== user.organizationId) {
    throw new CommentError("Ticket not found", 404);
  }

  if (user.role === "USER" && ticket.requesterId !== user.id) {
    throw new CommentError("Access denied", 403);
  }

  if (user.role === "USER" && visibility === "INTERNAL") {
    throw new CommentError("Users cannot create internal comments", 403);
  }

  const commentVisibility = visibility || "PUBLIC";

  const comment = await prisma.comment.create({
    data: {
      content: content.trim(),
      visibility: commentVisibility,
      ticketId,
      authorId: user.id,
    },
    include: {
      author: {
        select: { id: true, username: true, role: true, avatarUrl: true },
      },
    },
  });

  if (
    commentVisibility === "PUBLIC" &&
    (user.role === "AGENT" || user.role === "ADMIN")
  ) {
    satisfyResponseSLA(ticketId, user.role).catch((err) => {
      console.error("SLA response satisfaction failed:", err);
    });
  }

  const watchers = await prisma.watcher.findMany({
    where: { ticketId },
    select: { userId: true },
  });

  const notifiedUserIds = new Set();

  if (ticket.requesterId !== user.id) {
    notifiedUserIds.add(ticket.requesterId);
    notifyCommentAdded({
      ticketId,
      ticketNumber: ticket.ticketNumber,
      authorId: user.id,
      authorUsername: user.username,
      visibility: commentVisibility,
      recipientId: ticket.requesterId,
      organizationId: user.organizationId,
    }).catch((err) => console.error("Comment notification failed:", err));
  }

  for (const watcher of watchers) {
    if (watcher.userId !== user.id && !notifiedUserIds.has(watcher.userId)) {
      notifiedUserIds.add(watcher.userId);
      notifyCommentAdded({
        ticketId,
        ticketNumber: ticket.ticketNumber,
        authorId: user.id,
        authorUsername: user.username,
        visibility: commentVisibility,
        recipientId: watcher.userId,
        organizationId: user.organizationId,
      }).catch((err) => console.error("Comment notification failed:", err));
    }
  }

  return comment;
}

export async function listTicketComments(ticketId, user, options = {}) {
  const { page = 1, limit = 50 } = options;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new CommentError("Ticket not found", 404);
  }

  if (ticket.organizationId !== user.organizationId) {
    throw new CommentError("Ticket not found", 404);
  }

  if (user.role === "USER" && ticket.requesterId !== user.id) {
    throw new CommentError("Access denied", 403);
  }

  const where = { ticketId };

  const skip = (page - 1) * limit;

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      include: {
        author: {
          select: { id: true, username: true, role: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.comment.count({ where }),
  ]);

  return {
    comments: filterCommentsForUser(comments, user),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getComment(commentId, user) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      author: {
        select: { id: true, username: true, role: true, avatarUrl: true },
      },
      ticket: {
        select: { id: true, organizationId: true, requesterId: true },
      },
    },
  });

  if (!comment) {
    throw new CommentError("Comment not found", 404);
  }

  if (comment.ticket.organizationId !== user.organizationId) {
    throw new CommentError("Comment not found", 404);
  }

  if (comment.visibility === "INTERNAL" && user.role === "USER") {
    throw new CommentError("Comment not found", 404);
  }

  if (user.role === "USER" && comment.ticket.requesterId !== user.id) {
    throw new CommentError("Access denied", 403);
  }

  const { ticket, ...commentData } = comment;
  return commentData;
}

export { canSeeInternalComment, filterCommentsForUser };
