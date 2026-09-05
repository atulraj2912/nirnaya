import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    department: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((fns) => fns),
  },
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password-123"),
}));

import prisma from "@/lib/db/prisma";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  UserAdminError,
} from "@/lib/services/user-admin-service";

const orgId = "org-1";

function makeDbUser(overrides = {}) {
  return {
    id: "user-1",
    username: "john.doe",
    email: "john@example.com",
    passwordHash: "hashed",
    role: "USER",
    status: "ACTIVE",
    employeeId: "EMP001",
    designation: "Developer",
    avatarUrl: null,
    departmentId: "dept-1",
    organizationId: orgId,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    department: { id: "dept-1", name: "Engineering", code: "ENG" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listUsers", () => {
  it("returns paginated users for the organization", async () => {
    const users = [makeDbUser()];
    prisma.user.findMany.mockResolvedValue(users);
    prisma.user.count.mockResolvedValue(1);

    const result = await listUsers(orgId, { page: 1, limit: 10 });

    expect(result.users).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: orgId }),
      })
    );
  });

  it("filters by search term", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await listUsers(orgId, { search: "john" });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: orgId,
          OR: expect.arrayContaining([
            expect.objectContaining({ username: expect.objectContaining({ contains: "john" }) }),
          ]),
        }),
      })
    );
  });

  it("filters by role", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await listUsers(orgId, { role: "ADMIN" });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: "ADMIN" }),
      })
    );
  });

  it("filters by status", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await listUsers(orgId, { status: "INACTIVE" });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "INACTIVE" }),
      })
    );
  });
});

describe("getUser", () => {
  it("returns user by id within organization", async () => {
    const user = makeDbUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await getUser("user-1", orgId);
    expect(result.id).toBe("user-1");
  });

  it("throws 404 if user not found", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(getUser("missing", orgId)).rejects.toThrow("User not found");
  });

  it("throws 404 for cross-org access", async () => {
    prisma.user.findUnique.mockResolvedValue(makeDbUser({ organizationId: "other-org" }));
    await expect(getUser("user-1", orgId)).rejects.toThrow("User not found");
  });
});

describe("createUser", () => {
  it("creates user with hashed password", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
    prisma.user.create.mockResolvedValue(makeDbUser());

    const result = await createUser(
      {
        username: "john.doe",
        email: "john@example.com",
        password: "secret123",
        role: "USER",
        departmentId: "dept-1",
      },
      orgId
    );

    expect(result.id).toBe("user-1");
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: "john.doe",
          passwordHash: "hashed-password-123",
          organizationId: orgId,
        }),
      })
    );
  });

  it("throws on duplicate username", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: "existing" });
    await expect(
      createUser({ username: "john.doe", email: "j@example.com", password: "password123", role: "USER", departmentId: "dept-1" }, orgId)
    ).rejects.toThrow("Username already exists");
  });

  it("throws on duplicate email", async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce(null) // username check
      .mockResolvedValueOnce({ id: "existing" }); // email check
    await expect(
      createUser({ username: "new.user", email: "john@example.com", password: "password123", role: "USER", departmentId: "dept-1" }, orgId)
    ).rejects.toThrow("Email already exists");
  });

  it("throws if department not found", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.department.findFirst.mockResolvedValue(null);
    await expect(
      createUser({ username: "valid.user", email: "valid@example.com", password: "password123", role: "USER", departmentId: "bad" }, orgId)
    ).rejects.toThrow("Department not found");
  });
});

describe("updateUser", () => {
  it("updates user fields", async () => {
    prisma.user.findUnique.mockResolvedValue(makeDbUser());
    // No duplicate username
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue(makeDbUser({ username: "new.name" }));

    const result = await updateUser("user-1", { username: "new.name" }, orgId);
    expect(result.username).toBe("new.name");
  });

  it("throws on duplicate username during update", async () => {
    prisma.user.findUnique.mockResolvedValue(makeDbUser());
    prisma.user.findFirst.mockResolvedValue({ id: "other" });

    await expect(
      updateUser("user-1", { username: "taken" }, orgId)
    ).rejects.toThrow("Username already exists");
  });

  it("prevents demoting the last admin", async () => {
    prisma.user.findUnique.mockResolvedValue(makeDbUser({ role: "ADMIN" }));
    prisma.user.findFirst.mockResolvedValue(null); // username check passes
    prisma.user.count.mockResolvedValue(1);

    await expect(
      updateUser("user-1", { role: "USER" }, orgId)
    ).rejects.toThrow("Cannot demote the last admin");
  });

  it("throws for cross-org user", async () => {
    prisma.user.findUnique.mockResolvedValue(makeDbUser({ organizationId: "other" }));
    await expect(updateUser("user-1", { username: "valid.name" }, orgId)).rejects.toThrow("User not found");
  });
});

describe("deactivateUser", () => {
  it("sets user status to INACTIVE", async () => {
    prisma.user.findUnique.mockResolvedValue(makeDbUser());
    prisma.user.update.mockResolvedValue({ status: "INACTIVE" });

    const result = await deactivateUser("user-1", orgId);
    expect(result.status).toBe("INACTIVE");
  });

  it("prevents deactivating the last admin", async () => {
    prisma.user.findUnique.mockResolvedValue(makeDbUser({ role: "ADMIN" }));
    prisma.user.count.mockResolvedValue(1);

    await expect(deactivateUser("user-1", orgId)).rejects.toThrow("Cannot deactivate the last admin");
  });

  it("throws for non-existent user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(deactivateUser("missing", orgId)).rejects.toThrow("User not found");
  });
});
