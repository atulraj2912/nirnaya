import prisma from "@/lib/db/prisma";
import { createCategorySchema, updateCategorySchema } from "@/lib/validation/admin";

export class CategoryAdminError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CategoryAdminError";
    this.status = status;
  }
}

export async function listCategories(organizationId, options = {}) {
  const { page = 1, limit = 50, search, isActive } = options;

  const where = { organizationId };

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }
  if (isActive !== undefined) where.isActive = isActive;

  const skip = (page - 1) * limit;

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      include: {
        _count: { select: { tickets: true } },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.category.count({ where }),
  ]);

  return {
    categories,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createCategory(data, organizationId) {
  const parsed = createCategorySchema.parse(data);

  const existing = await prisma.category.findFirst({
    where: { organizationId, name: parsed.name },
  });
  if (existing) {
    throw new CategoryAdminError("Category name already exists", 409);
  }

  const category = await prisma.category.create({
    data: {
      name: parsed.name,
      organizationId,
    },
    include: {
      _count: { select: { tickets: true } },
    },
  });

  return category;
}

export async function updateCategory(categoryId, data, organizationId) {
  const parsed = updateCategorySchema.parse(data);

  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) {
    throw new CategoryAdminError("Category not found", 404);
  }
  if (existing.organizationId !== organizationId) {
    throw new CategoryAdminError("Category not found", 404);
  }

  if (parsed.name && parsed.name !== existing.name) {
    const dup = await prisma.category.findFirst({
      where: { organizationId, name: parsed.name, id: { not: categoryId } },
    });
    if (dup) {
      throw new CategoryAdminError("Category name already exists", 409);
    }
  }

  const category = await prisma.category.update({
    where: { id: categoryId },
    data: {
      ...(parsed.name && { name: parsed.name }),
      ...(parsed.isActive !== undefined && { isActive: parsed.isActive }),
    },
    include: {
      _count: { select: { tickets: true } },
    },
  });

  return category;
}
