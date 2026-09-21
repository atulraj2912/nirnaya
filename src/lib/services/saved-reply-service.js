import prisma from "@/lib/db/prisma";

export class SavedReplyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "SavedReplyError";
    this.status = status;
  }
}

export async function listSavedReplies(organizationId, options = {}) {
  const { page = 1, limit = 20, search = "" } = options;
  const where = { organizationId };
  if (search) where.title = { contains: search, mode: "insensitive" };
  
  const skip = (page - 1) * limit;
  const [replies, total] = await Promise.all([
    prisma.savedReply.findMany({
      where,
      include: { createdBy: { select: { id: true, username: true } } },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.savedReply.count({ where }),
  ]);

  return { replies, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getSavedReply(replyId, organizationId) {
  const reply = await prisma.savedReply.findUnique({ where: { id: replyId } });
  if (!reply) throw new SavedReplyError("Saved reply not found", 404);
  if (reply.organizationId !== organizationId) throw new SavedReplyError("Access denied", 403);
  return reply;
}

export async function createSavedReply(data, organizationId, userId) {
  const reply = await prisma.savedReply.create({
    data: {
      title: data.title,
      content: data.content,
      organizationId,
      createdById: userId,
      updatedById: userId,
    },
    include: { createdBy: { select: { id: true, username: true } } },
  });
  return reply;
}

export async function updateSavedReply(replyId, data, organizationId, userId) {
  const existing = await prisma.savedReply.findUnique({ where: { id: replyId } });
  if (!existing) throw new SavedReplyError("Saved reply not found", 404);
  if (existing.organizationId !== organizationId) throw new SavedReplyError("Access denied", 403);

  const reply = await prisma.savedReply.update({
    where: { id: replyId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
      updatedById: userId,
    },
    include: { createdBy: { select: { id: true, username: true } } },
  });
  return reply;
}

export async function deleteSavedReply(replyId, organizationId) {
  const existing = await prisma.savedReply.findUnique({ where: { id: replyId } });
  if (!existing) throw new SavedReplyError("Saved reply not found", 404);
  if (existing.organizationId !== organizationId) throw new SavedReplyError("Access denied", 403);

  await prisma.savedReply.delete({ where: { id: replyId } });
  return { success: true };
}
