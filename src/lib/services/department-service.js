import prisma from "@/lib/db/prisma";
import { createDepartmentSchema, updateDepartmentSchema } from "@/lib/validation/admin";

export class DepartmentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "DepartmentError";
    this.status = status;
  }
}

export async function listDepartments(organizationId, options = {}) {
  const { page = 1, limit = 50, search, isActive } = options;

  const where = { organizationId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  if (isActive !== undefined) where.isActive = isActive;

  const skip = (page - 1) * limit;

  const [departments, total] = await Promise.all([
    prisma.department.findMany({
      where,
      include: {
        manager: { select: { id: true, username: true } },
        _count: { select: { users: true, tickets: true } },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.department.count({ where }),
  ]);

  return {
    departments,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createDepartment(data, organizationId, userId) {
  const parsed = createDepartmentSchema.parse(data);

  const existingName = await prisma.department.findFirst({
    where: { organizationId, name: parsed.name },
  });
  if (existingName) {
    throw new DepartmentError("Department name already exists", 409);
  }

  const existingCode = await prisma.department.findFirst({
    where: { organizationId, code: parsed.code },
  });
  if (existingCode) {
    throw new DepartmentError("Department code already exists", 409);
  }

  if (parsed.managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: parsed.managerId, organizationId, status: "ACTIVE" },
    });
    if (!manager) {
      throw new DepartmentError("Manager not found or inactive", 404);
    }
  }

  const department = await prisma.department.create({
    data: {
      name: parsed.name,
      code: parsed.code,
      managerId: parsed.managerId || null,
      organizationId,
      createdById: userId,
      updatedById: userId,
    },
    include: {
      manager: { select: { id: true, username: true } },
      _count: { select: { users: true, tickets: true } },
    },
  });

  return department;
}

export async function updateDepartment(departmentId, data, organizationId, userId) {
  const parsed = updateDepartmentSchema.parse(data);

  const existing = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!existing) {
    throw new DepartmentError("Department not found", 404);
  }
  if (existing.organizationId !== organizationId) {
    throw new DepartmentError("Department not found", 404);
  }

  if (parsed.name && parsed.name !== existing.name) {
    const dup = await prisma.department.findFirst({
      where: { organizationId, name: parsed.name, id: { not: departmentId } },
    });
    if (dup) {
      throw new DepartmentError("Department name already exists", 409);
    }
  }

  if (parsed.code && parsed.code !== existing.code) {
    const dup = await prisma.department.findFirst({
      where: { organizationId, code: parsed.code, id: { not: departmentId } },
    });
    if (dup) {
      throw new DepartmentError("Department code already exists", 409);
    }
  }

  if (parsed.managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: parsed.managerId, organizationId, status: "ACTIVE" },
    });
    if (!manager) {
      throw new DepartmentError("Manager not found or inactive", 404);
    }
  }

  const department = await prisma.department.update({
    where: { id: departmentId },
    data: {
      ...(parsed.name && { name: parsed.name }),
      ...(parsed.code && { code: parsed.code }),
      ...(parsed.managerId !== undefined && { managerId: parsed.managerId }),
      ...(parsed.isActive !== undefined && { isActive: parsed.isActive }),
      updatedById: userId,
    },
    include: {
      manager: { select: { id: true, username: true } },
      _count: { select: { users: true, tickets: true } },
    },
  });

  return department;
}
