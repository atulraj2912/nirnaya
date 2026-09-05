import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    tag: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db/prisma";
import {
  listTags,
  createTag,
  deleteTag,
  TagAdminError,
} from "@/lib/services/tag-admin-service";

const orgId = "org-1";

function makeTag(overrides = {}) {
  return {
    id: "tag-1",
    name: "urgent",
    organizationId: orgId,
    createdAt: new Date(),
    _count: { ticketTags: 3 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listTags", () => {
  it("returns tags with usage counts", async () => {
    prisma.tag.findMany.mockResolvedValue([makeTag()]);
    prisma.tag.count.mockResolvedValue(1);

    const result = await listTags(orgId);
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0]._count.ticketTags).toBe(3);
  });

  it("filters by search", async () => {
    prisma.tag.findMany.mockResolvedValue([]);
    prisma.tag.count.mockResolvedValue(0);

    await listTags(orgId, { search: "urg" });

    expect(prisma.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "urg", mode: "insensitive" },
        }),
      })
    );
  });
});

describe("createTag", () => {
  it("creates tag", async () => {
    prisma.tag.findFirst.mockResolvedValue(null);
    prisma.tag.create.mockResolvedValue(makeTag());

    const result = await createTag({ name: "urgent" }, orgId);
    expect(result.name).toBe("urgent");
  });

  it("throws on duplicate name", async () => {
    prisma.tag.findFirst.mockResolvedValue({ id: "existing" });
    await expect(createTag({ name: "urgent" }, orgId)).rejects.toThrow(
      "Tag name already exists"
    );
  });
});

describe("deleteTag", () => {
  it("deletes tag", async () => {
    prisma.tag.findUnique.mockResolvedValue(makeTag());
    prisma.tag.delete.mockResolvedValue({});

    const result = await deleteTag("tag-1", orgId);
    expect(result.success).toBe(true);
  });

  it("throws for non-existent tag", async () => {
    prisma.tag.findUnique.mockResolvedValue(null);
    await expect(deleteTag("missing", orgId)).rejects.toThrow("Tag not found");
  });

  it("throws for cross-org tag", async () => {
    prisma.tag.findUnique.mockResolvedValue(makeTag({ organizationId: "other" }));
    await expect(deleteTag("tag-1", orgId)).rejects.toThrow("Tag not found");
  });
});
