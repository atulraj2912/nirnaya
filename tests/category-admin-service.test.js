import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    category: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db/prisma";
import {
  listCategories,
  createCategory,
  updateCategory,
  CategoryAdminError,
} from "@/lib/services/category-admin-service";

const orgId = "org-1";

function makeCategory(overrides = {}) {
  return {
    id: "cat-1",
    name: "Software",
    isActive: true,
    organizationId: orgId,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { tickets: 5 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCategories", () => {
  it("returns categories with counts", async () => {
    prisma.category.findMany.mockResolvedValue([makeCategory()]);
    prisma.category.count.mockResolvedValue(1);

    const result = await listCategories(orgId);
    expect(result.categories).toHaveLength(1);
  });

  it("filters by search", async () => {
    prisma.category.findMany.mockResolvedValue([]);
    prisma.category.count.mockResolvedValue(0);

    await listCategories(orgId, { search: "soft" });

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "soft", mode: "insensitive" },
        }),
      })
    );
  });

  it("filters by isActive", async () => {
    prisma.category.findMany.mockResolvedValue([]);
    prisma.category.count.mockResolvedValue(0);

    await listCategories(orgId, { isActive: false });

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: false }),
      })
    );
  });
});

describe("createCategory", () => {
  it("creates category", async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.create.mockResolvedValue(makeCategory());

    const result = await createCategory({ name: "Software" }, orgId);
    expect(result.name).toBe("Software");
  });

  it("throws on duplicate name", async () => {
    prisma.category.findFirst.mockResolvedValue({ id: "existing" });
    await expect(createCategory({ name: "Software" }, orgId)).rejects.toThrow(
      "Category name already exists"
    );
  });
});

describe("updateCategory", () => {
  it("updates category fields", async () => {
    prisma.category.findUnique.mockResolvedValue(makeCategory());
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.update.mockResolvedValue(makeCategory({ name: "Updated" }));

    const result = await updateCategory("cat-1", { name: "Updated" }, orgId);
    expect(result.name).toBe("Updated");
  });

  it("toggles isActive", async () => {
    prisma.category.findUnique.mockResolvedValue(makeCategory());
    prisma.category.update.mockResolvedValue(makeCategory({ isActive: false }));

    const result = await updateCategory("cat-1", { isActive: false }, orgId);
    expect(result.isActive).toBe(false);
  });

  it("throws for cross-org category", async () => {
    prisma.category.findUnique.mockResolvedValue(makeCategory({ organizationId: "other" }));
    await expect(updateCategory("cat-1", { name: "X" }, orgId)).rejects.toThrow(
      "Category not found"
    );
  });

  it("throws on duplicate name during update", async () => {
    prisma.category.findUnique.mockResolvedValue(makeCategory());
    prisma.category.findFirst.mockResolvedValue({ id: "other" });

    await expect(updateCategory("cat-1", { name: "Taken" }, orgId)).rejects.toThrow(
      "Category name already exists"
    );
  });
});
