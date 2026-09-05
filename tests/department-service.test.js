import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    department: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db/prisma";
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  DepartmentError,
} from "@/lib/services/department-service";

const orgId = "org-1";
const userId = "user-1";

function makeDept(overrides = {}) {
  return {
    id: "dept-1",
    name: "Engineering",
    code: "ENG",
    managerId: null,
    isActive: true,
    organizationId: orgId,
    createdById: userId,
    updatedById: userId,
    manager: null,
    _count: { users: 5, tickets: 12 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listDepartments", () => {
  it("returns departments with counts", async () => {
    prisma.department.findMany.mockResolvedValue([makeDept()]);
    prisma.department.count.mockResolvedValue(1);

    const result = await listDepartments(orgId);
    expect(result.departments).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("filters by search", async () => {
    prisma.department.findMany.mockResolvedValue([]);
    prisma.department.count.mockResolvedValue(0);

    await listDepartments(orgId, { search: "eng" });

    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: expect.objectContaining({ contains: "eng" }) }),
          ]),
        }),
      })
    );
  });
});

describe("createDepartment", () => {
  it("creates department with valid data", async () => {
    prisma.department.findFirst.mockResolvedValue(null); // name check
    prisma.department.findFirst.mockResolvedValueOnce(null); // name check
    prisma.department.findFirst.mockResolvedValueOnce(null); // code check
    prisma.department.create.mockResolvedValue(makeDept());

    const result = await createDepartment(
      { name: "Engineering", code: "ENG" },
      orgId,
      userId
    );
    expect(result.name).toBe("Engineering");
  });

  it("throws on duplicate name", async () => {
    prisma.department.findFirst.mockResolvedValueOnce({ id: "existing" }); // name
    await expect(
      createDepartment({ name: "Engineering", code: "NEW" }, orgId, userId)
    ).rejects.toThrow("Department name already exists");
  });

  it("throws on duplicate code", async () => {
    prisma.department.findFirst.mockResolvedValueOnce(null); // name
    prisma.department.findFirst.mockResolvedValueOnce({ id: "existing" }); // code
    await expect(
      createDepartment({ name: "New Dept", code: "ENG" }, orgId, userId)
    ).rejects.toThrow("Department code already exists");
  });
});

describe("updateDepartment", () => {
  it("updates department fields", async () => {
    prisma.department.findUnique.mockResolvedValue(makeDept());
    prisma.department.findFirst.mockResolvedValue(null); // name dup check
    prisma.department.findFirst.mockResolvedValueOnce(null); // name
    prisma.department.update.mockResolvedValue(makeDept({ name: "Updated" }));

    const result = await updateDepartment("dept-1", { name: "Updated" }, orgId, userId);
    expect(result.name).toBe("Updated");
  });

  it("throws for cross-org department", async () => {
    prisma.department.findUnique.mockResolvedValue(makeDept({ organizationId: "other" }));
    await expect(
      updateDepartment("dept-1", { name: "X" }, orgId, userId)
    ).rejects.toThrow("Department not found");
  });
});
