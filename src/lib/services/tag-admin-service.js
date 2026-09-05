import prisma from "@/lib/db/prisma";
import { createTagSchema, updateTagSchema } from "@/lib/validation/admin";

export class TagAdminError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "TagAdminError";
    this.status = status;
  }
}

export async function listTags(organizationId, options = {}) {
  const { page = 1, limit = 50, search } = options;

  const where = { organizationId };

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const skip = (page - 1) * limit;

  const [tags, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      include: {
        _count: { select: { ticketTags: true } },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.tag.count({ where }),
  ]);

  return {
    tags,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createTag(data, organizationId) {
  const parsed = createTagSchema.parse(data);

  const existing = await prisma.tag.findFirst({
    where: { organizationId, name: parsed.name },
  });
  if (existing) {
    throw new TagAdminError("Tag name already exists", 409);
  }

  const tag = await prisma.tag.create({
    data: {
      name: parsed.name,
      organizationId,
    },
    include: {
      _count: { select: { ticketTags: true } },
    },
  });

  return tag;
}

export async function deleteTag(tagId, organizationId) {
  const existing = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!existing) {
    throw new TagAdminError("Tag not found", 404);
  }
  if (existing.organizationId !== organizationId) {
    throw new TagAdminError("Tag not found", 404);
  }

  await prisma.tag.delete({ where: { id: tagId } });

  return { success: true };
}
