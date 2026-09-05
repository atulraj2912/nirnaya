import prisma from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth";
import { createUserSchema, updateUserSchema } from "@/lib/validation/admin";

export class UserAdminError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "UserAdminError";
    this.status = status;
  }
}

export async function listUsers(organizationId, options = {}) {
  const { page = 1, limit = 20, search, role, status, departmentId } = options;

  const where = { organizationId };

  if (search) {
    where.OR = [
      { username: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { employeeId: { contains: search, mode: "insensitive" } },
    ];
  }
  if (role) where.role = role;
  if (status) where.status = status;
  if (departmentId) where.departmentId = departmentId;

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        employeeId: true,
        role: true,
        status: true,
        designation: true,
        avatarUrl: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getUser(userId, organizationId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      employeeId: true,
      role: true,
      status: true,
      designation: true,
      avatarUrl: true,
      departmentId: true,
      createdAt: true,
      updatedAt: true,
      department: { select: { id: true, name: true, code: true } },
    },
  });

  if (!user) {
    throw new UserAdminError("User not found", 404);
  }

  if (user.organizationId !== organizationId) {
    throw new UserAdminError("User not found", 404);
  }

  return user;
}

export async function createUser(data, organizationId) {
  const parsed = createUserSchema.parse(data);

  const existingUsername = await prisma.user.findFirst({
    where: { organizationId, username: parsed.username },
  });
  if (existingUsername) {
    throw new UserAdminError("Username already exists in this organization", 409);
  }

  const existingEmail = await prisma.user.findFirst({
    where: { organizationId, email: parsed.email },
  });
  if (existingEmail) {
    throw new UserAdminError("Email already exists in this organization", 409);
  }

  if (parsed.employeeId) {
    const existingEmpId = await prisma.user.findFirst({
      where: { organizationId, employeeId: parsed.employeeId },
    });
    if (existingEmpId) {
      throw new UserAdminError("Employee ID already exists in this organization", 409);
    }
  }

  const department = await prisma.department.findFirst({
    where: { id: parsed.departmentId, organizationId, isActive: true },
  });
  if (!department) {
    throw new UserAdminError("Department not found or inactive", 404);
  }

  const passwordHash = await hashPassword(parsed.password);

  const user = await prisma.user.create({
    data: {
      username: parsed.username,
      email: parsed.email,
      passwordHash,
      role: parsed.role,
      departmentId: parsed.departmentId,
      employeeId: parsed.employeeId || null,
      designation: parsed.designation || null,
      organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      username: true,
      email: true,
      employeeId: true,
      role: true,
      status: true,
      designation: true,
      departmentId: true,
      createdAt: true,
    },
  });

  return user;
}

export async function updateUser(userId, data, organizationId) {
  const parsed = updateUserSchema.parse(data);

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new UserAdminError("User not found", 404);
  }
  if (existing.organizationId !== organizationId) {
    throw new UserAdminError("User not found", 404);
  }

  if (parsed.username && parsed.username !== existing.username) {
    const dup = await prisma.user.findFirst({
      where: { organizationId, username: parsed.username, id: { not: userId } },
    });
    if (dup) {
      throw new UserAdminError("Username already exists", 409);
    }
  }

  if (parsed.email && parsed.email !== existing.email) {
    const dup = await prisma.user.findFirst({
      where: { organizationId, email: parsed.email, id: { not: userId } },
    });
    if (dup) {
      throw new UserAdminError("Email already exists", 409);
    }
  }

  if (parsed.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: parsed.departmentId, organizationId, isActive: true },
    });
    if (!dept) {
      throw new UserAdminError("Department not found or inactive", 404);
    }
  }

  if (existing.role === "ADMIN" && parsed.role && parsed.role !== "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { organizationId, role: "ADMIN", status: "ACTIVE" },
    });
    if (adminCount <= 1) {
      throw new UserAdminError("Cannot demote the last admin", 400);
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(parsed.username && { username: parsed.username }),
      ...(parsed.email && { email: parsed.email }),
      ...(parsed.role && { role: parsed.role }),
      ...(parsed.status && { status: parsed.status }),
      ...(parsed.departmentId && { departmentId: parsed.departmentId }),
      ...(parsed.employeeId !== undefined && { employeeId: parsed.employeeId }),
      ...(parsed.designation !== undefined && { designation: parsed.designation }),
      ...(parsed.avatarUrl !== undefined && { avatarUrl: parsed.avatarUrl }),
    },
    select: {
      id: true,
      username: true,
      email: true,
      employeeId: true,
      role: true,
      status: true,
      designation: true,
      avatarUrl: true,
      departmentId: true,
      createdAt: true,
      updatedAt: true,
      department: { select: { id: true, name: true, code: true } },
    },
  });

  return user;
}

export async function deactivateUser(userId, organizationId) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new UserAdminError("User not found", 404);
  }
  if (existing.organizationId !== organizationId) {
    throw new UserAdminError("User not found", 404);
  }

  if (existing.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { organizationId, role: "ADMIN", status: "ACTIVE" },
    });
    if (adminCount <= 1) {
      throw new UserAdminError("Cannot deactivate the last admin", 400);
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: "INACTIVE" },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
    },
  });

  return user;
}
