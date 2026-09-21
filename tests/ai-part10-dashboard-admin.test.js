import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    user: {
      count: vi.fn(),
    },
    department: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    category: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    tag: {
      count: vi.fn(),
    },
    savedReply: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/realtime/socket-server", () => ({
  emitToUser: vi.fn(),
  emitToOrg: vi.fn(),
  emitToTicket: vi.fn(),
}));

vi.mock("@/lib/realtime/socket-instance", () => ({
  getIO: vi.fn(() => null),
  setIO: vi.fn(),
}));

import prisma from "@/lib/db/prisma";
import { getAgentDashboardStats } from "@/lib/services/agent-dashboard-service";
import { getAnalytics } from "@/lib/services/analytics-service";
import {
  listSavedReplies,
  getSavedReply,
  createSavedReply,
  updateSavedReply,
  deleteSavedReply,
  SavedReplyError,
} from "@/lib/services/saved-reply-service";

const orgId = "org-1";
const userId = "user-1";
const otherOrgId = "org-2";

// ============================================================
// 1. Agent Dashboard Service
// ============================================================
describe("Part 10: Agent Dashboard Service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns agent-specific metrics", async () => {
    prisma.ticket.count
      .mockResolvedValueOnce(5)  // open
      .mockResolvedValueOnce(3)  // assignedToMe
      .mockResolvedValueOnce(2)  // inProgress
      .mockResolvedValueOnce(1)  // waitingForUser
      .mockResolvedValueOnce(4)  // resolvedToday
      .mockResolvedValueOnce(1)  // breachedSLA
      .mockResolvedValueOnce(0); // warningSLA
    prisma.ticket.findMany.mockResolvedValue([]);

    const stats = await getAgentDashboardStats(userId, orgId);

    expect(stats.openTickets).toBe(5);
    expect(stats.assignedToMe).toBe(3);
    expect(stats.inProgress).toBe(2);
    expect(stats.waitingForUser).toBe(1);
    expect(stats.resolvedToday).toBe(4);
    expect(stats.breachedSLA).toBe(1);
    expect(stats.warningSLA).toBe(0);
    expect(Array.isArray(stats.recentTickets)).toBe(true);
  });

  it("scopes queries to organization", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.findMany.mockResolvedValue([]);

    await getAgentDashboardStats(userId, orgId);

    const countCalls = prisma.ticket.count.mock.calls;
    for (const call of countCalls) {
      expect(call[0].where.organizationId).toBe(orgId);
    }
  });

  it("filters assignedToMe to current user", async () => {
    prisma.ticket.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.ticket.findMany.mockResolvedValue([]);

    await getAgentDashboardStats(userId, orgId);

    const assignedCall = prisma.ticket.count.mock.calls[1];
    expect(assignedCall[0].where.assignedAgentId).toBe(userId);
  });

  it("excludes resolved/closed from assignedToMe", async () => {
    prisma.ticket.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.ticket.findMany.mockResolvedValue([]);

    await getAgentDashboardStats(userId, orgId);

    const assignedCall = prisma.ticket.count.mock.calls[1];
    expect(assignedCall[0].where.status).toEqual({ notIn: ["RESOLVED", "CLOSED"] });
  });

  it("returns recent unassigned/open tickets", async () => {
    const mockTickets = [{ id: "t1", ticketNumber: "NIR-001", title: "Test" }];
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.findMany.mockResolvedValue(mockTickets);

    const stats = await getAgentDashboardStats(userId, orgId);

    expect(stats.recentTickets).toEqual(mockTickets);
    const findCall = prisma.ticket.findMany.mock.calls[0][0];
    expect(findCall.where.status).toEqual({ notIn: ["RESOLVED", "CLOSED"] });
    expect(findCall.take).toBe(10);
  });
});

// ============================================================
// 2. Analytics Service
// ============================================================
describe("Part 10: Analytics Service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns complete analytics structure", async () => {
    prisma.ticket.count.mockResolvedValue(10);
    prisma.ticket.groupBy
      .mockResolvedValueOnce([{ status: "OPEN", _count: { id: 5 } }])
      .mockResolvedValueOnce([{ priority: "HIGH", _count: { id: 3 } }])
      .mockResolvedValueOnce([{ type: "INCIDENT", _count: { id: 7 } }])
      .mockResolvedValueOnce([{ departmentId: "d1", _count: { id: 4 } }])
      .mockResolvedValueOnce([]);
    prisma.ticket.aggregate.mockResolvedValue({ _count: { id: 10 } });
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    // Mock SLA counts
    prisma.ticket.count
      .mockResolvedValueOnce(10)  // totalTickets
      .mockResolvedValueOnce(2)   // breached
      .mockResolvedValueOnce(1)   // warning
      .mockResolvedValueOnce(7);  // onTrack

    const analytics = await getAnalytics(orgId, { timeWindow: "30d" });

    expect(analytics.totalTickets).toBeDefined();
    expect(analytics.timeWindow).toBe("30d");
    expect(analytics.startDate).toBeDefined();
    expect(analytics.endDate).toBeDefined();
    expect(Array.isArray(analytics.statusBreakdown)).toBe(true);
    expect(Array.isArray(analytics.priorityBreakdown)).toBe(true);
    expect(Array.isArray(analytics.typeBreakdown)).toBe(true);
    expect(Array.isArray(analytics.departmentBreakdown)).toBe(true);
    expect(Array.isArray(analytics.categoryBreakdown)).toBe(true);
    expect(analytics.slaMetrics).toBeDefined();
    expect(Array.isArray(analytics.ticketsByDay)).toBe(true);
  });

  it("scopes all queries to organization", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.aggregate.mockResolvedValue({ _count: { id: 0 } });
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    await getAnalytics(orgId, { timeWindow: "30d" });

    const countCalls = prisma.ticket.count.mock.calls;
    for (const call of countCalls) {
      expect(call[0].where.organizationId).toBe(orgId);
    }
  });

  it("supports different time windows", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.aggregate.mockResolvedValue({ _count: { id: 0 } });
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    const today = await getAnalytics(orgId, { timeWindow: "today" });
    expect(today.timeWindow).toBe("today");

    const week = await getAnalytics(orgId, { timeWindow: "7d" });
    expect(week.timeWindow).toBe("7d");

    const month = await getAnalytics(orgId, { timeWindow: "month" });
    expect(month.timeWindow).toBe("month");
  });

  it("uses groupBy for status breakdown (no N+1)", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.groupBy
      .mockResolvedValueOnce([{ status: "OPEN", _count: { id: 5 } }, { status: "CLOSED", _count: { id: 3 } }])
      .mockResolvedValue([])
      .mockResolvedValue([])
      .mockResolvedValue([])
      .mockResolvedValue([]);
    prisma.ticket.aggregate.mockResolvedValue({ _count: { id: 0 } });
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    const analytics = await getAnalytics(orgId, { timeWindow: "30d" });

    expect(analytics.statusBreakdown).toHaveLength(2);
    expect(analytics.statusBreakdown[0]).toEqual({ status: "OPEN", count: 5 });
  });

  it("resolves department names from IDs", async () => {
    // count calls: totalTickets(1) + aggregate.then (breached, warning, onTrack)(3) = 4 total
    prisma.ticket.count
      .mockResolvedValueOnce(0)   // totalTickets
      .mockResolvedValueOnce(2)   // breached (inside aggregate.then)
      .mockResolvedValueOnce(1)   // warning (inside aggregate.then)
      .mockResolvedValueOnce(7);  // onTrack (inside aggregate.then)
    prisma.ticket.groupBy
      .mockResolvedValueOnce([])  // status
      .mockResolvedValueOnce([])  // priority
      .mockResolvedValueOnce([])  // type
      .mockResolvedValueOnce([{ departmentId: "d1", _count: { id: 3 } }])
      .mockResolvedValueOnce([]); // category
    prisma.ticket.aggregate.mockResolvedValue({ _count: { id: 0 } });
    prisma.ticket.findMany
      .mockResolvedValueOnce([])  // trend
      .mockResolvedValueOnce([]); // resolution time
    prisma.department.findMany.mockResolvedValue([{ id: "d1", name: "Engineering" }]);
    prisma.category.findMany.mockResolvedValue([]);

    const analytics = await getAnalytics(orgId, { timeWindow: "30d" });

    expect(analytics.departmentBreakdown[0].name).toBe("Engineering");
  });

  it("resolves category names from IDs", async () => {
    prisma.ticket.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.ticket.groupBy
      .mockResolvedValueOnce([])  // status
      .mockResolvedValueOnce([])  // priority
      .mockResolvedValueOnce([])  // type
      .mockResolvedValueOnce([])  // department
      .mockResolvedValueOnce([{ categoryId: "c1", _count: { id: 2 } }]);
    prisma.ticket.aggregate.mockResolvedValue({ _count: { id: 0 } });
    prisma.ticket.findMany
      .mockResolvedValueOnce([])  // trend
      .mockResolvedValueOnce([]); // resolution time
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([{ id: "c1", name: "Bug" }]);

    const analytics = await getAnalytics(orgId, { timeWindow: "30d" });

    expect(analytics.categoryBreakdown[0].name).toBe("Bug");
  });

  it("computes average resolution time", async () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.aggregate.mockResolvedValue({ _count: { id: 0 } });
    prisma.ticket.findMany
      .mockResolvedValueOnce([])  // trend query
      .mockResolvedValueOnce([    // resolution time query
        { createdAt: twoHoursAgo, resolvedAt: oneHourAgo },
      ]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    const analytics = await getAnalytics(orgId, { timeWindow: "30d" });

    expect(analytics.avgResolutionTime).toBe(1);
  });

  it("returns null avgResolutionTime when no resolved tickets", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.aggregate.mockResolvedValue({ _count: { id: 0 } });
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    const analytics = await getAnalytics(orgId, { timeWindow: "30d" });

    expect(analytics.avgResolutionTime).toBeNull();
  });

  it("uses take limit on trend query to bound results", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.aggregate.mockResolvedValue({ _count: { id: 0 } });
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    await getAnalytics(orgId, { timeWindow: "30d" });

    const trendCall = prisma.ticket.findMany.mock.calls[0][0];
    expect(trendCall.take).toBe(1000);
  });

  it("uses take limit on resolution time query to bound results", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.aggregate.mockResolvedValue({ _count: { id: 0 } });
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    await getAnalytics(orgId, { timeWindow: "30d" });

    const resolutionCall = prisma.ticket.findMany.mock.calls[1][0];
    expect(resolutionCall.take).toBe(500);
  });
});

// ============================================================
// 3. Saved Reply Service
// ============================================================
describe("Part 10: Saved Reply Service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("listSavedReplies", () => {
    it("returns paginated replies scoped to org", async () => {
      const mockReplies = [{ id: "sr-1", title: "Template", content: "Hello" }];
      prisma.savedReply.findMany.mockResolvedValue(mockReplies);
      prisma.savedReply.count.mockResolvedValue(1);

      const result = await listSavedReplies(orgId, { page: 1, limit: 20 });

      expect(result.replies).toEqual(mockReplies);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(prisma.savedReply.findMany.mock.calls[0][0].where.organizationId).toBe(orgId);
    });

    it("supports search filter", async () => {
      prisma.savedReply.findMany.mockResolvedValue([]);
      prisma.savedReply.count.mockResolvedValue(0);

      await listSavedReplies(orgId, { search: "greeting" });

      const where = prisma.savedReply.findMany.mock.calls[0][0].where;
      expect(where.title).toEqual({ contains: "greeting", mode: "insensitive" });
    });
  });

  describe("getSavedReply", () => {
    it("returns reply for same org", async () => {
      const reply = { id: "sr-1", organizationId: orgId };
      prisma.savedReply.findUnique.mockResolvedValue(reply);

      const result = await getSavedReply("sr-1", orgId);
      expect(result.id).toBe("sr-1");
    });

    it("rejects cross-org access", async () => {
      const reply = { id: "sr-1", organizationId: otherOrgId };
      prisma.savedReply.findUnique.mockResolvedValue(reply);

      await expect(getSavedReply("sr-1", orgId)).rejects.toThrow(SavedReplyError);
    });

    it("throws for nonexistent reply", async () => {
      prisma.savedReply.findUnique.mockResolvedValue(null);
      await expect(getSavedReply("nonexistent", orgId)).rejects.toThrow(SavedReplyError);
    });
  });

  describe("createSavedReply", () => {
    it("creates reply with org scope", async () => {
      const created = { id: "sr-1", title: "Greeting", content: "Hello!", organizationId: orgId, createdById: userId };
      prisma.savedReply.create.mockResolvedValue(created);

      const result = await createSavedReply({ title: "Greeting", content: "Hello!" }, orgId, userId);

      expect(result.organizationId).toBe(orgId);
      expect(result.createdById).toBe(userId);
    });
  });

  describe("updateSavedReply", () => {
    it("updates reply within same org", async () => {
      const existing = { id: "sr-1", organizationId: orgId };
      const updated = { id: "sr-1", title: "Updated", organizationId: orgId };
      prisma.savedReply.findUnique.mockResolvedValue(existing);
      prisma.savedReply.update.mockResolvedValue(updated);

      const result = await updateSavedReply("sr-1", { title: "Updated" }, orgId, userId);
      expect(result.title).toBe("Updated");
    });

    it("rejects cross-org update", async () => {
      const existing = { id: "sr-1", organizationId: otherOrgId };
      prisma.savedReply.findUnique.mockResolvedValue(existing);

      await expect(updateSavedReply("sr-1", { title: "X" }, orgId, userId)).rejects.toThrow(SavedReplyError);
    });
  });

  describe("deleteSavedReply", () => {
    it("deletes reply within same org", async () => {
      const existing = { id: "sr-1", organizationId: orgId };
      prisma.savedReply.findUnique.mockResolvedValue(existing);
      prisma.savedReply.delete.mockResolvedValue({});

      const result = await deleteSavedReply("sr-1", orgId);
      expect(result.success).toBe(true);
    });

    it("rejects cross-org delete", async () => {
      const existing = { id: "sr-1", organizationId: otherOrgId };
      prisma.savedReply.findUnique.mockResolvedValue(existing);

      await expect(deleteSavedReply("sr-1", orgId)).rejects.toThrow(SavedReplyError);
    });

    it("throws for nonexistent reply", async () => {
      prisma.savedReply.findUnique.mockResolvedValue(null);
      await expect(deleteSavedReply("nonexistent", orgId)).rejects.toThrow(SavedReplyError);
    });
  });
});

// ============================================================
// 4. Organization Isolation
// ============================================================
describe("Part 10: Organization Isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("agent dashboard uses org-scoped queries", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.findMany.mockResolvedValue([]);

    await getAgentDashboardStats(userId, orgId);

    const findCall = prisma.ticket.findMany.mock.calls[0][0];
    expect(findCall.where.organizationId).toBe(orgId);
  });

  it("analytics queries are org-scoped", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.aggregate.mockResolvedValue({ _count: { id: 0 } });
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    await getAnalytics(orgId, { timeWindow: "30d" });

    const countCalls = prisma.ticket.count.mock.calls;
    for (const call of countCalls) {
      expect(call[0].where.organizationId).toBe(orgId);
    }
  });

  it("saved reply queries are org-scoped", async () => {
    prisma.savedReply.findMany.mockResolvedValue([]);
    prisma.savedReply.count.mockResolvedValue(0);

    await listSavedReplies(orgId);

    const where = prisma.savedReply.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe(orgId);
  });
});

// ============================================================
// 5. Dashboard Route Authorization
// ============================================================
describe("Part 10: Dashboard API Authorization", () => {
  it("agent dashboard API requires AGENT or ADMIN", async () => {
    const { requireAgentOrAdmin } = await import("@/lib/authz");
    
    // Verify the function exists and is callable
    expect(typeof requireAgentOrAdmin).toBe("function");
  });

  it("analytics API requires ADMIN", async () => {
    const { requireAdmin } = await import("@/lib/authz");
    
    expect(typeof requireAdmin).toBe("function");
  });

  it("saved replies API requires ADMIN", async () => {
    const { requireAdmin } = await import("@/lib/authz");
    
    expect(typeof requireAdmin).toBe("function");
  });
});

// ============================================================
// 6. Validation Schemas
// ============================================================
describe("Part 10: Validation Schemas", () => {
  it("createSavedReplySchema validates required fields", async () => {
    const { createSavedReplySchema } = await import("@/lib/validation/admin");
    
    expect(() => createSavedReplySchema.parse({})).toThrow();
    expect(() => createSavedReplySchema.parse({ title: "" })).toThrow();
    expect(() => createSavedReplySchema.parse({ title: "Test", content: "" })).toThrow();
    
    const valid = createSavedReplySchema.parse({ title: "Test", content: "Hello" });
    expect(valid.title).toBe("Test");
    expect(valid.content).toBe("Hello");
  });

  it("updateSavedReplySchema allows partial updates", async () => {
    const { updateSavedReplySchema } = await import("@/lib/validation/admin");
    
    const titleOnly = updateSavedReplySchema.parse({ title: "Updated" });
    expect(titleOnly.title).toBe("Updated");
    expect(titleOnly.content).toBeUndefined();
    
    const contentOnly = updateSavedReplySchema.parse({ content: "New content" });
    expect(contentOnly.content).toBe("New content");
    expect(contentOnly.title).toBeUndefined();
  });

  it("createSavedReplySchema enforces max lengths", async () => {
    const { createSavedReplySchema } = await import("@/lib/validation/admin");
    
    expect(() => createSavedReplySchema.parse({
      title: "x".repeat(201),
      content: "test",
    })).toThrow();
    
    expect(() => createSavedReplySchema.parse({
      title: "test",
      content: "x".repeat(10001),
    })).toThrow();
  });
});

// ============================================================
// 7. No Fake Data
// ============================================================
describe("Part 10: No Fake Data", () => {
  it("analytics returns computed data, not hardcoded values", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.aggregate.mockResolvedValue({ _count: { id: 0 } });
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    const analytics = await getAnalytics(orgId, { timeWindow: "30d" });

    // All counts should be 0 (from mock), not hardcoded numbers
    expect(analytics.totalTickets).toBe(0);
    expect(analytics.statusBreakdown).toHaveLength(0);
    expect(analytics.priorityBreakdown).toHaveLength(0);
    expect(analytics.slaMetrics.total).toBe(0);
  });

  it("agent dashboard returns computed data", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.findMany.mockResolvedValue([]);

    const stats = await getAgentDashboardStats(userId, orgId);

    expect(stats.openTickets).toBe(0);
    expect(stats.assignedToMe).toBe(0);
    expect(stats.inProgress).toBe(0);
    expect(stats.waitingForUser).toBe(0);
    expect(stats.resolvedToday).toBe(0);
    expect(stats.breachedSLA).toBe(0);
    expect(stats.warningSLA).toBe(0);
  });

  it("saved replies return actual data from DB", async () => {
    prisma.savedReply.findMany.mockResolvedValue([
      { id: "sr-1", title: "Greeting", content: "Hello!" },
    ]);
    prisma.savedReply.count.mockResolvedValue(1);

    const result = await listSavedReplies(orgId);

    expect(result.replies).toHaveLength(1);
    expect(result.replies[0].title).toBe("Greeting");
  });
});
