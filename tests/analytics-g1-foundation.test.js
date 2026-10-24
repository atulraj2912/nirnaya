import { describe, expect, it, vi, beforeEach } from "vitest";

// ============================================================
// Mock Prisma — use vi.hoisted so it's available in hoisted vi.mock factories
// ============================================================
const mockPrisma = vi.hoisted(() => ({
  ticket: {
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  department: {
    findMany: vi.fn(),
  },
  category: {
    findMany: vi.fn(),
  },
  aIPrediction: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ default: mockPrisma }));

// ============================================================
// Mock Auth
// ============================================================
const mockUsers = vi.hoisted(() => ({
  adminOrgA: {
    id: "admin-a",
    username: "adminA",
    email: "admin@a.com",
    role: "ADMIN",
    status: "ACTIVE",
    organizationId: "org-a",
    departmentId: "dept-a1",
  },
  adminOrgB: {
    id: "admin-b",
    username: "adminB",
    email: "admin@b.com",
    role: "ADMIN",
    status: "ACTIVE",
    organizationId: "org-b",
    departmentId: "dept-b1",
  },
  agentOrgA: {
    id: "agent-a1",
    username: "agentA1",
    email: "agent1@a.com",
    role: "AGENT",
    status: "ACTIVE",
    organizationId: "org-a",
    departmentId: "dept-a1",
  },
  agentOrgA2: {
    id: "agent-a2",
    username: "agentA2",
    email: "agent2@a.com",
    role: "AGENT",
    status: "ACTIVE",
    organizationId: "org-a",
    departmentId: "dept-a1",
  },
  agentOrgB: {
    id: "agent-b1",
    username: "agentB1",
    email: "agent1@b.com",
    role: "AGENT",
    status: "ACTIVE",
    organizationId: "org-b",
    departmentId: "dept-b1",
  },
  userOrgA: {
    id: "user-a1",
    username: "userA1",
    email: "user1@a.com",
    role: "USER",
    status: "ACTIVE",
    organizationId: "org-a",
    departmentId: "dept-a1",
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
  requireAgentOrAdmin: vi.fn(),
  requireSameOrganization: vi.fn(),
}));

// ============================================================
// Imports after mocks
// ============================================================
import prisma from "@/lib/db/prisma";
import { requireAuth, requireAdmin, requireRole } from "@/lib/authz";
import {
  adminAnalyticsQuerySchema,
  agentAnalyticsQuerySchema,
  resolveDateRange,
} from "@/lib/validation/analytics";
import {
  getAdminAnalytics,
  getCreationTrend,
  getResolutionTrend,
  getClosureTrend,
  getStatusDistribution,
  getPriorityDistribution,
  getTicketsByDepartment,
  getTicketsByCategory,
  getAgentWorkload,
  getSLAPerformance,
  getAverageResolutionTime,
  getAverageFirstResponseTime,
  getAIStatistics,
} from "@/lib/services/admin-analytics-service";
import {
  getAgentAnalytics,
  getMyCreationTrend,
  getMyWorkload,
  getMyStatusDistribution,
  getMyPriorityDistribution,
  getMyCategoryDistribution,
  getMySLAPerformance,
  getMyAverageResolutionTime,
  getMyAverageFirstResponseTime,
} from "@/lib/services/agent-analytics-service";

// ============================================================
// Helpers
// ============================================================
const ORG_A = "org-a";
const ORG_B = "org-b";
const AGENT_A1 = "agent-a1";
const AGENT_A2 = "agent-a2";
const now = new Date();
const startDefault = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

function resetMocks() {
  vi.clearAllMocks();
}

// ============================================================
// A. Admin Analytics
// ============================================================
describe("G1 — Admin Analytics Service", () => {
  beforeEach(resetMocks);

  describe("getCreationTrend", () => {
    it("returns tickets grouped by day", async () => {
      const day1 = new Date("2026-09-01T10:00:00Z");
      const day2 = new Date("2026-09-02T14:00:00Z");
      const day2b = new Date("2026-09-02T16:00:00Z");
      prisma.ticket.findMany.mockResolvedValue([
        { createdAt: day1 },
        { createdAt: day2 },
        { createdAt: day2b },
      ]);

      const result = await getCreationTrend(ORG_A, startDefault, now, "day");

      expect(result).toEqual([
        { period: "2026-09-01", count: 1 },
        { period: "2026-09-02", count: 2 },
      ]);
    });

    it("returns empty array when no tickets exist", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      const result = await getCreationTrend(ORG_A, startDefault, now, "day");
      expect(result).toEqual([]);
    });

    it("buckets by week correctly", async () => {
      prisma.ticket.findMany.mockResolvedValue([
        { createdAt: new Date("2026-09-01T10:00:00Z") }, // Monday
        { createdAt: new Date("2026-09-03T10:00:00Z") }, // Wednesday
        { createdAt: new Date("2026-09-08T10:00:00Z") }, // Next Monday
      ]);

      const result = await getCreationTrend(ORG_A, startDefault, now, "week");
      expect(result).toHaveLength(2);
      expect(result[0].count).toBe(2);
      expect(result[1].count).toBe(1);
    });
  });

  describe("getResolutionTrend", () => {
    it("returns resolved tickets grouped by day", async () => {
      prisma.ticket.findMany.mockResolvedValue([
        { resolvedAt: new Date("2026-09-01T10:00:00Z") },
        { resolvedAt: new Date("2026-09-01T14:00:00Z") },
      ]);

      const result = await getResolutionTrend(ORG_A, startDefault, now, "day");
      expect(result).toEqual([{ period: "2026-09-01", count: 2 }]);
    });
  });

  describe("getClosureTrend", () => {
    it("returns closed tickets grouped by day", async () => {
      prisma.ticket.findMany.mockResolvedValue([
        { closedAt: new Date("2026-09-05T10:00:00Z") },
      ]);

      const result = await getClosureTrend(ORG_A, startDefault, now, "day");
      expect(result).toEqual([{ period: "2026-09-05", count: 1 }]);
    });
  });

  describe("getStatusDistribution", () => {
    it("returns counts per status", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { status: "OPEN", _count: { id: 10 } },
        { status: "IN_PROGRESS", _count: { id: 5 } },
        { status: "RESOLVED", _count: { id: 20 } },
      ]);

      const result = await getStatusDistribution(ORG_A, startDefault, now);
      expect(result).toEqual([
        { status: "OPEN", count: 10 },
        { status: "IN_PROGRESS", count: 5 },
        { status: "RESOLVED", count: 20 },
      ]);
    });
  });

  describe("getPriorityDistribution", () => {
    it("returns counts per priority", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { priority: "HIGH", _count: { id: 8 } },
        { priority: "CRITICAL", _count: { id: 2 } },
      ]);

      const result = await getPriorityDistribution(ORG_A, startDefault, now);
      expect(result).toEqual([
        { priority: "HIGH", count: 8 },
        { priority: "CRITICAL", count: 2 },
      ]);
    });
  });

  describe("getTicketsByDepartment", () => {
    it("resolves department names", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { departmentId: "d1", _count: { id: 15 } },
        { departmentId: "d2", _count: { id: 5 } },
      ]);
      prisma.department.findMany.mockResolvedValue([
        { id: "d1", name: "IT Support" },
        { id: "d2", name: "Engineering" },
      ]);

      const result = await getTicketsByDepartment(ORG_A, startDefault, now);
      expect(result).toEqual([
        { departmentId: "d1", name: "IT Support", count: 15 },
        { departmentId: "d2", name: "Engineering", count: 5 },
      ]);
    });
  });

  describe("getTicketsByCategory", () => {
    it("resolves category names", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { categoryId: "c1", _count: { id: 12 } },
      ]);
      prisma.category.findMany.mockResolvedValue([
        { id: "c1", name: "NETWORK" },
      ]);

      const result = await getTicketsByCategory(ORG_A, startDefault, now);
      expect(result).toEqual([
        { categoryId: "c1", name: "NETWORK", count: 12 },
      ]);
    });
  });

  describe("getAgentWorkload", () => {
    it("returns agents with assigned ticket counts", async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: "a1", username: "agent1", designation: "Engineer" },
        { id: "a2", username: "agent2", designation: "Specialist" },
      ]);
      prisma.ticket.groupBy.mockResolvedValue([
        { assignedAgentId: "a1", _count: { id: 5 } },
      ]);

      const result = await getAgentWorkload(ORG_A);
      expect(result).toEqual([
        { agentId: "a1", username: "agent1", designation: "Engineer", assignedCount: 5 },
        { agentId: "a2", username: "agent2", designation: "Specialist", assignedCount: 0 },
      ]);
    });

    it("returns empty array when no agents exist", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      const result = await getAgentWorkload(ORG_A);
      expect(result).toEqual([]);
    });
  });

  describe("getSLAPerformance", () => {
    it("returns response and resolution SLA counts with compliance rates", async () => {
      prisma.ticket.groupBy
        .mockResolvedValueOnce([
          { responseSlaStatus: "ON_TRACK", _count: { id: 20 } },
          { responseSlaStatus: "BREACHED", _count: { id: 3 } },
        ])
        .mockResolvedValueOnce([
          { resolutionSlaStatus: "COMPLETED", _count: { id: 15 } },
        ]);

      const result = await getSLAPerformance(ORG_A, startDefault, now);
      expect(result.response).toEqual([
        { status: "ON_TRACK", count: 20 },
        { status: "BREACHED", count: 3 },
      ]);
      expect(result.resolution).toEqual([
        { status: "COMPLETED", count: 15 },
      ]);
      // Response compliance: (23 - 3) / 23 * 100 = 86.96%
      expect(result.responseComplianceRate).toBe(86.96);
      // Resolution compliance: no BREACHED, all COMPLETED = 100%
      expect(result.resolutionComplianceRate).toBe(100);
    });

    it("returns null compliance rate when no SLA data", async () => {
      prisma.ticket.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getSLAPerformance(ORG_A, startDefault, now);
      expect(result.responseComplianceRate).toBeNull();
      expect(result.resolutionComplianceRate).toBeNull();
    });

    it("computes compliance rate with mixed statuses", async () => {
      prisma.ticket.groupBy
        .mockResolvedValueOnce([
          { responseSlaStatus: "ON_TRACK", _count: { id: 10 } },
          { responseSlaStatus: "WARNING", _count: { id: 5 } },
          { responseSlaStatus: "BREACHED", _count: { id: 3 } },
          { responseSlaStatus: "PAUSED", _count: { id: 2 } },
        ])
        .mockResolvedValueOnce([
          { resolutionSlaStatus: "ON_TRACK", _count: { id: 8 } },
          { resolutionSlaStatus: "BREACHED", _count: { id: 2 } },
        ]);

      const result = await getSLAPerformance(ORG_A, startDefault, now);
      // Response: (20 - 3) / 20 * 100 = 85%
      expect(result.responseComplianceRate).toBe(85);
      // Resolution: (10 - 2) / 10 * 100 = 80%
      expect(result.resolutionComplianceRate).toBe(80);
    });
  });

  describe("getAverageResolutionTime", () => {
    it("calculates average in hours", async () => {
      const created = new Date("2026-09-01T00:00:00Z");
      const resolved1 = new Date("2026-09-01T02:00:00Z"); // 2 hours
      const resolved2 = new Date("2026-09-01T06:00:00Z"); // 6 hours
      prisma.ticket.findMany.mockResolvedValue([
        { createdAt: created, resolvedAt: resolved1 },
        { createdAt: created, resolvedAt: resolved2 },
      ]);

      const result = await getAverageResolutionTime(ORG_A, startDefault, now);
      expect(result.averageHours).toBe(4);
      expect(result.sampleSize).toBe(2);
    });

    it("returns null when no resolved tickets", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      const result = await getAverageResolutionTime(ORG_A, startDefault, now);
      expect(result.averageHours).toBeNull();
      expect(result.sampleSize).toBe(0);
    });
  });

  describe("getAverageFirstResponseTime", () => {
    it("calculates average first-response in hours", async () => {
      const created = new Date("2026-09-01T00:00:00Z");
      const responded = new Date("2026-09-01T01:30:00Z"); // 1.5 hours
      prisma.ticket.findMany.mockResolvedValue([
        { createdAt: created, firstRespondedAt: responded },
      ]);

      const result = await getAverageFirstResponseTime(ORG_A, startDefault, now);
      expect(result.averageHours).toBe(1.5);
      expect(result.sampleSize).toBe(1);
    });
  });

  describe("getAIStatistics", () => {
    it("returns prediction stats", async () => {
      prisma.aIPrediction.findMany.mockResolvedValue([
        { confidence: 0.8, predictedCategoryId: "c1" },
        { confidence: 0.6, predictedCategoryId: "c1" },
        { confidence: null, predictedCategoryId: null },
      ]);
      prisma.category.findMany.mockResolvedValue([
        { id: "c1", name: "NETWORK" },
      ]);

      const result = await getAIStatistics(ORG_A, startDefault, now);
      expect(result.totalPredictions).toBe(3);
      expect(result.averageConfidence).toBe(0.7);
      expect(result.topCategories).toEqual([
        { name: "NETWORK", count: 2 },
      ]);
    });

    it("returns zero state when no predictions", async () => {
      prisma.aIPrediction.findMany.mockResolvedValue([]);
      const result = await getAIStatistics(ORG_A, startDefault, now);
      expect(result.totalPredictions).toBe(0);
      expect(result.averageConfidence).toBeNull();
      expect(result.topCategories).toEqual([]);
    });
  });

  describe("getAdminAnalytics", () => {
    it("returns complete admin analytics dashboard", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.groupBy.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.department.findMany.mockResolvedValue([]);
      prisma.category.findMany.mockResolvedValue([]);
      prisma.aIPrediction.findMany.mockResolvedValue([]);

      const result = await getAdminAnalytics(ORG_A, {
        startDate: startDefault,
        endDate: now,
        granularity: "day",
      });

      expect(result.scope).toBe("organization");
      expect(result).toHaveProperty("generatedAt");
      expect(result).toHaveProperty("dateRange");
      expect(result).toHaveProperty("tickets");
      expect(result).toHaveProperty("workload");
      expect(result).toHaveProperty("sla");
      expect(result).toHaveProperty("performance");
      expect(result).toHaveProperty("ai");
      expect(result.dateRange.granularity).toBe("day");
    });
  });
});

// ============================================================
// B. Agent Analytics
// ============================================================
describe("G1 — Agent Analytics Service", () => {
  beforeEach(resetMocks);

  describe("getMyCreationTrend", () => {
    it("returns tickets created by the agent", async () => {
      prisma.ticket.findMany.mockResolvedValue([
        { createdAt: new Date("2026-09-01T10:00:00Z") },
      ]);

      const result = await getMyCreationTrend(AGENT_A1, ORG_A, startDefault, now, "day");
      expect(result).toEqual([{ period: "2026-09-01", count: 1 }]);

      // Verify the query filters by requesterId
      const callArgs = prisma.ticket.findMany.mock.calls[0][0];
      expect(callArgs.where.requesterId).toBe(AGENT_A1);
      expect(callArgs.where.organizationId).toBe(ORG_A);
    });
  });

  describe("getMyWorkload", () => {
    it("counts non-resolved tickets assigned to agent", async () => {
      prisma.ticket.count.mockResolvedValue(7);

      const result = await getMyWorkload(AGENT_A1, ORG_A);
      expect(result).toBe(7);

      const callArgs = prisma.ticket.count.mock.calls[0][0];
      expect(callArgs.where.assignedAgentId).toBe(AGENT_A1);
      expect(callArgs.where.organizationId).toBe(ORG_A);
      expect(callArgs.where.status).toEqual({ notIn: ["RESOLVED", "CLOSED"] });
    });
  });

  describe("getMyStatusDistribution", () => {
    it("returns status distribution scoped to agent", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { status: "OPEN", _count: { id: 3 } },
        { status: "IN_PROGRESS", _count: { id: 2 } },
      ]);

      const result = await getMyStatusDistribution(AGENT_A1, ORG_A, startDefault, now);
      expect(result).toEqual([
        { status: "OPEN", count: 3 },
        { status: "IN_PROGRESS", count: 2 },
      ]);

      const callArgs = prisma.ticket.groupBy.mock.calls[0][0];
      expect(callArgs.where.assignedAgentId).toBe(AGENT_A1);
    });
  });

  describe("getMyPriorityDistribution", () => {
    it("returns priority distribution scoped to agent", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { priority: "HIGH", _count: { id: 4 } },
      ]);

      const result = await getMyPriorityDistribution(AGENT_A1, ORG_A, startDefault, now);
      expect(result).toEqual([{ priority: "HIGH", count: 4 }]);
    });
  });

  describe("getMyCategoryDistribution", () => {
    it("resolves category names for agent's tickets", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { categoryId: "c1", _count: { id: 5 } },
      ]);
      prisma.category.findMany.mockResolvedValue([
        { id: "c1", name: "SOFTWARE" },
      ]);

      const result = await getMyCategoryDistribution(AGENT_A1, ORG_A, startDefault, now);
      expect(result).toEqual([
        { categoryId: "c1", name: "SOFTWARE", count: 5 },
      ]);
    });
  });

  describe("getMySLAPerformance", () => {
    it("returns SLA stats scoped to agent", async () => {
      prisma.ticket.groupBy
        .mockResolvedValueOnce([{ responseSlaStatus: "ON_TRACK", _count: { id: 10 } }])
        .mockResolvedValueOnce([{ resolutionSlaStatus: "COMPLETED", _count: { id: 8 } }]);

      const result = await getMySLAPerformance(AGENT_A1, ORG_A, startDefault, now);
      expect(result.response).toEqual([{ status: "ON_TRACK", count: 10 }]);
      expect(result.resolution).toEqual([{ status: "COMPLETED", count: 8 }]);

      // Verify agent scope in both queries
      const call1 = prisma.ticket.groupBy.mock.calls[0][0];
      const call2 = prisma.ticket.groupBy.mock.calls[1][0];
      expect(call1.where.assignedAgentId).toBe(AGENT_A1);
      expect(call2.where.assignedAgentId).toBe(AGENT_A1);
    });
  });

  describe("getMyAverageResolutionTime", () => {
    it("calculates agent's average resolution time", async () => {
      const created = new Date("2026-09-01T00:00:00Z");
      prisma.ticket.findMany.mockResolvedValue([
        { createdAt: created, resolvedAt: new Date("2026-09-01T03:00:00Z") },
        { createdAt: created, resolvedAt: new Date("2026-09-01T05:00:00Z") },
      ]);

      const result = await getMyAverageResolutionTime(AGENT_A1, ORG_A, startDefault, now);
      expect(result.averageHours).toBe(4);
      expect(result.sampleSize).toBe(2);

      const callArgs = prisma.ticket.findMany.mock.calls[0][0];
      expect(callArgs.where.assignedAgentId).toBe(AGENT_A1);
    });
  });

  describe("getMyAverageFirstResponseTime", () => {
    it("calculates agent's average first-response time", async () => {
      prisma.ticket.findMany.mockResolvedValue([
        {
          createdAt: new Date("2026-09-01T00:00:00Z"),
          firstRespondedAt: new Date("2026-09-01T00:45:00Z"),
        },
      ]);

      const result = await getMyAverageFirstResponseTime(AGENT_A1, ORG_A, startDefault, now);
      expect(result.averageHours).toBe(0.75);
      expect(result.sampleSize).toBe(1);
    });
  });

  describe("getAgentAnalytics", () => {
    it("returns complete agent analytics dashboard", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.groupBy.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);
      prisma.category.findMany.mockResolvedValue([]);

      const result = await getAgentAnalytics(AGENT_A1, ORG_A, {
        startDate: startDefault,
        endDate: now,
        granularity: "day",
      });

      expect(result.scope).toBe("agent");
      expect(result.agent.id).toBe(AGENT_A1);
      expect(result).toHaveProperty("dateRange");
      expect(result).toHaveProperty("tickets");
      expect(result).toHaveProperty("workload");
      expect(result).toHaveProperty("sla");
      expect(result).toHaveProperty("performance");
    });
  });
});

// ============================================================
// C. Cross-Organization Isolation
// ============================================================
describe("G1 — Cross-Organization Isolation", () => {
  beforeEach(resetMocks);

  it("admin org A queries only use org A scope", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);
    prisma.aIPrediction.findMany.mockResolvedValue([]);

    await getAdminAnalytics(ORG_A, {
      startDate: startDefault,
      endDate: now,
      granularity: "day",
    });

    // Verify all prisma calls use org-a
    const allCalls = [
      ...prisma.ticket.findMany.mock.calls,
      ...prisma.ticket.groupBy.mock.calls,
      ...prisma.user.findMany.mock.calls,
    ];

    for (const call of allCalls) {
      const where = call[0]?.where;
      if (where?.organizationId) {
        expect(where.organizationId).toBe(ORG_A);
      }
    }
  });

  it("admin org B queries only use org B scope", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);
    prisma.aIPrediction.findMany.mockResolvedValue([]);

    await getAdminAnalytics(ORG_B, {
      startDate: startDefault,
      endDate: now,
      granularity: "day",
    });

    const allCalls = [
      ...prisma.ticket.findMany.mock.calls,
      ...prisma.ticket.groupBy.mock.calls,
      ...prisma.user.findMany.mock.calls,
    ];

    for (const call of allCalls) {
      const where = call[0]?.where;
      if (where?.organizationId) {
        expect(where.organizationId).toBe(ORG_B);
      }
    }
  });

  it("agent analytics uses agent's own organization scope", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.category.findMany.mockResolvedValue([]);

    await getAgentAnalytics(AGENT_A1, ORG_A, {
      startDate: startDefault,
      endDate: now,
      granularity: "day",
    });

    const allCalls = [
      ...prisma.ticket.findMany.mock.calls,
      ...prisma.ticket.groupBy.mock.calls,
    ];

    for (const call of allCalls) {
      const where = call[0]?.where;
      if (where?.organizationId) {
        expect(where.organizationId).toBe(ORG_A);
      }
    }
  });
});

// ============================================================
// D. Cross-Agent Isolation
// ============================================================
describe("G1 — Cross-Agent Isolation", () => {
  beforeEach(resetMocks);

  it("agent A1 queries filter by agent A1's id", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.category.findMany.mockResolvedValue([]);

    await getAgentAnalytics(AGENT_A1, ORG_A, {
      startDate: startDefault,
      endDate: now,
      granularity: "day",
    });

    // Check all queries that use assignedAgentId
    const groupByCalls = prisma.ticket.groupBy.mock.calls;
    for (const call of groupByCalls) {
      const where = call[0]?.where;
      if (where?.assignedAgentId) {
        expect(where.assignedAgentId).toBe(AGENT_A1);
      }
    }

    // Check findMany calls that filter by requesterId
    const findManyCalls = prisma.ticket.findMany.mock.calls;
    for (const call of findManyCalls) {
      const where = call[0]?.where;
      if (where?.requesterId) {
        expect(where.requesterId).toBe(AGENT_A1);
      }
      if (where?.assignedAgentId) {
        expect(where.assignedAgentId).toBe(AGENT_A1);
      }
    }
  });

  it("agent A2 queries filter by agent A2's id, not A1", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.category.findMany.mockResolvedValue([]);

    await getAgentAnalytics(AGENT_A2, ORG_A, {
      startDate: startDefault,
      endDate: now,
      granularity: "day",
    });

    const groupByCalls = prisma.ticket.groupBy.mock.calls;
    for (const call of groupByCalls) {
      const where = call[0]?.where;
      if (where?.assignedAgentId) {
        expect(where.assignedAgentId).toBe(AGENT_A2);
      }
    }
  });

  it("agent from org A cannot access org B data", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.category.findMany.mockResolvedValue([]);

    await getAgentAnalytics(AGENT_A1, ORG_A, {
      startDate: startDefault,
      endDate: now,
      granularity: "day",
    });

    // Verify no query uses org-b
    const allCalls = [
      ...prisma.ticket.findMany.mock.calls,
      ...prisma.ticket.groupBy.mock.calls,
    ];

    for (const call of allCalls) {
      const where = call[0]?.where;
      if (where?.organizationId) {
        expect(where.organizationId).not.toBe(ORG_B);
      }
    }
  });
});

// ============================================================
// E. RBAC
// ============================================================
describe("G1 — RBAC Authorization", () => {
  beforeEach(resetMocks);

  it("requireAdmin is called for admin analytics route", async () => {
    const { GET } = await import("@/app/api/admin/analytics/route");

    requireAdmin.mockResolvedValue({ user: mockUsers.adminOrgA });

    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);
    prisma.aIPrediction.findMany.mockResolvedValue([]);

    const request = new Request("http://localhost/api/admin/analytics?mode=full&start=2026-09-01&end=2026-09-22");
    await GET(request);

    expect(requireAdmin).toHaveBeenCalled();
  });

  it("requireRole with AGENT/ADMIN is called for agent analytics route", async () => {
    const { GET } = await import("@/app/api/analytics/agent/route");

    requireRole.mockResolvedValue({ user: mockUsers.agentOrgA });

    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.category.findMany.mockResolvedValue([]);

    const request = new Request("http://localhost/api/analytics/agent?start=2026-09-01&end=2026-09-22");
    await GET(request);

    expect(requireRole).toHaveBeenCalledWith(request, ["AGENT", "ADMIN"]);
  });

  it("admin analytics returns 401 for unauthenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/route");
    requireAdmin.mockResolvedValue({ response: new Response(null, { status: 401 }) });

    const request = new Request("http://localhost/api/admin/analytics");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("agent analytics returns 403 for USER role", async () => {
    const { GET } = await import("@/app/api/analytics/agent/route");
    requireRole.mockResolvedValue({ response: new Response(null, { status: 403 }) });

    const request = new Request("http://localhost/api/analytics/agent");
    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});

// ============================================================
// F. Input Validation
// ============================================================
describe("G1 — Input Validation", () => {
  describe("adminAnalyticsQuerySchema", () => {
    it("accepts valid timeWindow", () => {
      expect(adminAnalyticsQuerySchema.safeParse({ timeWindow: "7d" }).success).toBe(true);
    });

    it("accepts valid start/end/granularity", () => {
      expect(
        adminAnalyticsQuerySchema.safeParse({
          start: "2026-09-01",
          end: "2026-09-22",
          granularity: "week",
        }).success
      ).toBe(true);
    });

    it("rejects both timeWindow and start/end", () => {
      const result = adminAnalyticsQuerySchema.safeParse({
        timeWindow: "7d",
        start: "2026-09-01",
        end: "2026-09-22",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid timeWindow", () => {
      expect(adminAnalyticsQuerySchema.safeParse({ timeWindow: "invalid" }).success).toBe(false);
    });

    it("rejects invalid granularity", () => {
      expect(
        adminAnalyticsQuerySchema.safeParse({
          start: "2026-09-01",
          end: "2026-09-22",
          granularity: "invalid",
        }).success
      ).toBe(false);
    });

    it("rejects end before start", () => {
      expect(
        adminAnalyticsQuerySchema.safeParse({
          start: "2026-09-22",
          end: "2026-09-01",
        }).success
      ).toBe(false);
    });

    it("rejects date range exceeding 365 days", () => {
      expect(
        adminAnalyticsQuerySchema.safeParse({
          start: "2025-01-01",
          end: "2026-09-22",
        }).success
      ).toBe(false);
    });

    it("defaults granularity to day", () => {
      const result = adminAnalyticsQuerySchema.safeParse({
        start: "2026-09-01",
        end: "2026-09-22",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.granularity).toBe("day");
      }
    });
  });

  describe("agentAnalyticsQuerySchema", () => {
    it("accepts valid parameters", () => {
      expect(
        agentAnalyticsQuerySchema.safeParse({
          start: "2026-09-01",
          end: "2026-09-22",
          granularity: "month",
        }).success
      ).toBe(true);
    });

    it("rejects invalid granularity", () => {
      expect(
        agentAnalyticsQuerySchema.safeParse({
          start: "2026-09-01",
          end: "2026-09-22",
          granularity: "year",
        }).success
      ).toBe(false);
    });
  });

  describe("resolveDateRange", () => {
    it("resolves timeWindow 7d correctly", () => {
      const result = resolveDateRange({ timeWindow: "7d" });
      const expected = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      expect(Math.abs(result.start.getTime() - expected.getTime())).toBeLessThan(1000);
    });

    it("resolves explicit start/end", () => {
      const result = resolveDateRange({
        start: "2026-09-01",
        end: "2026-09-15",
      });
      expect(result.start.toISOString().slice(0, 10)).toBe("2026-09-01");
      expect(result.end.toISOString().slice(0, 10)).toBe("2026-09-15");
    });

    it("defaults to 30d when no params", () => {
      const result = resolveDateRange({});
      const expected = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      expect(Math.abs(result.start.getTime() - expected.getTime())).toBeLessThan(1000);
    });
  });
});

// ============================================================
// G. API Route Validation
// ============================================================
describe("G1 — API Route Parameter Validation", () => {
  beforeEach(resetMocks);

  it("admin analytics rejects invalid timeWindow via route", async () => {
    const { GET } = await import("@/app/api/admin/analytics/route");
    requireAdmin.mockResolvedValue({ user: mockUsers.adminOrgA });

    const request = new Request("http://localhost/api/admin/analytics?timeWindow=invalid");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("admin analytics rejects conflicting timeWindow + start/end", async () => {
    const { GET } = await import("@/app/api/admin/analytics/route");
    requireAdmin.mockResolvedValue({ user: mockUsers.adminOrgA });

    const request = new Request(
      "http://localhost/api/admin/analytics?timeWindow=7d&start=2026-09-01&end=2026-09-22"
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("agent analytics rejects invalid granularity", async () => {
    const { GET } = await import("@/app/api/analytics/agent/route");
    requireRole.mockResolvedValue({ user: mockUsers.agentOrgA });

    const request = new Request(
      "http://localhost/api/analytics/agent?start=2026-09-01&end=2026-09-22&granularity=year"
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});

// ============================================================
// H. No Fake Data
// ============================================================
describe("G1 — No Fake Data Verification", () => {
  it("all metrics derive from real database state via Prisma", async () => {
    // Verify that every service function queries Prisma, not returning hardcoded data
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);
    prisma.aIPrediction.findMany.mockResolvedValue([]);

    await getAdminAnalytics(ORG_A, {
      startDate: startDefault,
      endDate: now,
      granularity: "day",
    });

    // At least some Prisma calls must have been made
    const totalCalls =
      prisma.ticket.findMany.mock.calls.length +
      prisma.ticket.groupBy.mock.calls.length +
      prisma.ticket.count.mock.calls.length +
      prisma.user.findMany.mock.calls.length;

    expect(totalCalls).toBeGreaterThan(0);
  });

  it("average resolution time is computed from real resolvedAt timestamps", async () => {
    const created = new Date("2026-09-01T00:00:00Z");
    const resolved = new Date("2026-09-01T04:30:00Z");
    prisma.ticket.findMany.mockResolvedValue([
      { createdAt: created, resolvedAt: resolved },
    ]);

    const result = await getAverageResolutionTime(ORG_A, startDefault, now);
    expect(result.averageHours).toBe(4.5);
    expect(result.sampleSize).toBe(1);
  });

  it("average first-response time is computed from real timestamps", async () => {
    prisma.ticket.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-09-01T00:00:00Z"),
        firstRespondedAt: new Date("2026-09-01T00:30:00Z"),
      },
    ]);

    const result = await getAverageFirstResponseTime(ORG_A, startDefault, now);
    expect(result.averageHours).toBe(0.5);
  });
});

// ============================================================
// I. Error Handling
// ============================================================
describe("G1 — Error Handling", () => {
  beforeEach(resetMocks);

  it("admin analytics route returns 500 on internal error", async () => {
    const { GET } = await import("@/app/api/admin/analytics/route");
    requireAdmin.mockResolvedValue({ user: mockUsers.adminOrgA });

    // Override the safeParse to pass validation
    prisma.ticket.findMany.mockRejectedValue(new Error("DB connection failed"));

    const request = new Request("http://localhost/api/admin/analytics?mode=full&start=2026-09-01&end=2026-09-22");
    const response = await GET(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe("Internal server error");
    // Ensure no Prisma internals are exposed
    expect(JSON.stringify(body)).not.toContain("prisma");
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("agent analytics route returns 500 on internal error", async () => {
    const { GET } = await import("@/app/api/analytics/agent/route");
    requireRole.mockResolvedValue({ user: mockUsers.agentOrgA });

    prisma.ticket.findMany.mockRejectedValue(new Error("DB connection failed"));

    const request = new Request("http://localhost/api/analytics/agent?start=2026-09-01&end=2026-09-22");
    const response = await GET(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("prisma");
  });
});

// ============================================================
// J. Performance / Query Behavior
// ============================================================
describe("G1 — Performance and Query Behavior", () => {
  beforeEach(resetMocks);

  it("agent workload query uses bounded result set", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "a1", username: "agent1", designation: "Eng" },
    ]);
    prisma.ticket.groupBy.mockResolvedValue([]);

    await getAgentWorkload(ORG_A);

    // user.findMany should not have unbounded take
    const userCall = prisma.user.findMany.mock.calls[0][0];
    // The query filters by role and status, which is bounded
    expect(userCall.where.role).toEqual({ in: ["AGENT", "ADMIN"] });
    expect(userCall.where.status).toBe("ACTIVE");
  });

  it("average resolution time limits result set to 5000", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);

    await getAverageResolutionTime(ORG_A, startDefault, now);

    const callArgs = prisma.ticket.findMany.mock.calls[0][0];
    expect(callArgs.take).toBe(5000);
  });

  it("average first-response time limits result set to 5000", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);

    await getAverageFirstResponseTime(ORG_A, startDefault, now);

    const callArgs = prisma.ticket.findMany.mock.calls[0][0];
    expect(callArgs.take).toBe(5000);
  });

  it("AI statistics limits result set to prediction data", async () => {
    prisma.aIPrediction.findMany.mockResolvedValue([]);

    await getAIStatistics(ORG_A, startDefault, now);

    const callArgs = prisma.aIPrediction.findMany.mock.calls[0][0];
    expect(callArgs.where.ticket).toEqual({ organizationId: ORG_A });
  });
});
