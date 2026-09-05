import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: {
      findUnique: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db/prisma";
import { getRecommendations } from "@/lib/services/agent-recommendation-service";

const mockUser = {
  id: "user-1",
  role: "AGENT",
  organizationId: "org-1",
};

const mockTicket = {
  id: "ticket-1",
  title: "WiFi not working",
  description: "Cannot connect to wifi network",
  status: "OPEN",
  priority: "MEDIUM",
  type: "INCIDENT",
  organizationId: "org-1",
  departmentId: "dept-1",
  categoryId: "cat-1",
  department: { id: "dept-1", name: "IT Support" },
  category: { id: "cat-1", name: "NETWORK" },
};

const mockAgents = [
  {
    id: "agent-1",
    username: "alice",
    email: "alice@test.com",
    departmentId: "dept-1",
    department: { name: "IT Support" },
  },
  {
    id: "agent-2",
    username: "bob",
    email: "bob@test.com",
    departmentId: "dept-2",
    department: { name: "Network Ops" },
  },
];

describe("Agent recommendation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRecommendations", () => {
    it("returns recommendations for valid ticket with eligible agents", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue(mockAgents);
      prisma.ticket.groupBy.mockResolvedValue([]);

      const result = await getRecommendations("ticket-1", mockUser);

      expect(result.error).toBeUndefined();
      expect(result.recommendations).toBeDefined();
      expect(result.totalEligibleAgents).toBe(2);
      expect(result.generatedAt).toBeDefined();
    });

    it("returns error for non-existent ticket", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      const result = await getRecommendations("bad-id", mockUser);

      expect(result.error).toBe("Ticket not found");
    });

    it("returns error for cross-org ticket", async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...mockTicket,
        organizationId: "org-2",
      });

      const result = await getRecommendations("ticket-1", mockUser);

      expect(result.error).toBe("Ticket not found");
    });

    it("returns empty recommendations when no eligible agents", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await getRecommendations("ticket-1", mockUser);

      expect(result.recommendations).toEqual([]);
      expect(result.totalEligibleAgents).toBe(0);
    });

    it("only queries AGENT role users (not ADMIN or USER)", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.ticket.groupBy.mockResolvedValue([]);

      await getRecommendations("ticket-1", mockUser);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: "AGENT",
            status: "ACTIVE",
          }),
        })
      );
    });

    it("filters by department when ticket has department", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.ticket.groupBy.mockResolvedValue([]);

      await getRecommendations("ticket-1", mockUser);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: "dept-1",
          }),
        })
      );
    });

    it("does not filter by department when ticket has no department", async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...mockTicket,
        departmentId: null,
        department: null,
      });
      prisma.user.findMany.mockResolvedValue([]);
      prisma.ticket.groupBy.mockResolvedValue([]);

      await getRecommendations("ticket-1", mockUser);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            departmentId: expect.anything(),
          }),
        })
      );
    });

    it("calculates workload from active statuses only", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue([mockAgents[0]]);

      // Promise.all runs calculateWorkloads + calculateExperience concurrently
      // calculateWorkloads: 2 groupBy calls (active, high-priority)
      // calculateExperience: 2 groupBy calls (total resolved, category resolved)
      prisma.ticket.groupBy
        .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 5 } }])   // workload: active
        .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 1 } }])   // workload: high-priority
        .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 20 } }])  // experience: total resolved
        .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 8 } }]);  // experience: category resolved

      const result = await getRecommendations("ticket-1", mockUser);

      expect(result.recommendations[0].workload.activeTickets).toBe(5);
      expect(result.recommendations[0].workload.highPriorityTickets).toBe(1);
    });

    it("returns zero workload for agents with no active tickets", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
      prisma.ticket.groupBy.mockResolvedValue([]);

      const result = await getRecommendations("ticket-1", mockUser);

      expect(result.recommendations[0].workload.activeTickets).toBe(0);
      expect(result.recommendations[0].workload.highPriorityTickets).toBe(0);
    });

    it("scores agents and ranks them", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue(mockAgents);
      prisma.ticket.groupBy.mockResolvedValue([]);

      const result = await getRecommendations("ticket-1", mockUser);

      expect(result.recommendations.length).toBe(2);
      // agent-1 is in same department (dept-1) so should rank higher
      expect(result.recommendations[0].agentId).toBe("agent-1");
      expect(result.recommendations[0].rank).toBe(1);
      expect(result.recommendations[1].rank).toBe(2);
    });

    it("agent in same department gets higher score than different department", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue(mockAgents);
      prisma.ticket.groupBy.mockResolvedValue([]);

      const result = await getRecommendations("ticket-1", mockUser);

      const sameDept = result.recommendations.find((r) => r.agentId === "agent-1");
      const diffDept = result.recommendations.find((r) => r.agentId === "agent-2");

      expect(sameDept.score).toBeGreaterThan(diffDept.score);
    });

    it("lower workload results in higher workload factor", async () => {
      const agents = [
        { ...mockAgents[0], id: "agent-1" },
        { ...mockAgents[1], id: "agent-2" },
      ];
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue(agents);

      // agent-1 has 10 active tickets, agent-2 has 2
      prisma.ticket.groupBy
        .mockResolvedValueOnce([
          { assignedAgentId: "agent-1", _count: { id: 10 } },
          { assignedAgentId: "agent-2", _count: { id: 2 } },
        ])
        .mockResolvedValueOnce([]);

      const result = await getRecommendations("ticket-1", mockUser);

      const a1 = result.recommendations.find((r) => r.agentId === "agent-1");
      const a2 = result.recommendations.find((r) => r.agentId === "agent-2");

      // agent-2 has lower workload, so should have higher workload factor
      const a1Workload = a1.factors.find((f) => f.name === "Workload");
      const a2Workload = a2.factors.find((f) => f.name === "Workload");
      expect(a2Workload.normalized).toBeGreaterThan(a1Workload.normalized);
    });

    it("score is bounded between 0 and 100", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue(mockAgents);
      prisma.ticket.groupBy.mockResolvedValue([]);

      const result = await getRecommendations("ticket-1", mockUser);

      for (const rec of result.recommendations) {
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(100);
      }
    });

    it("includes factors with correct structure", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
      prisma.ticket.groupBy.mockResolvedValue([]);

      const result = await getRecommendations("ticket-1", mockUser);

      const factors = result.recommendations[0].factors;
      expect(factors.length).toBe(5);

      const names = factors.map((f) => f.name);
      expect(names).toContain("Department Match");
      expect(names).toContain("Category Experience");
      expect(names).toContain("Workload");
      expect(names).toContain("Priority Readiness");
      expect(names).toContain("Historical Experience");

      for (const f of factors) {
        expect(f.normalized).toBeGreaterThanOrEqual(0);
        expect(f.normalized).toBeLessThanOrEqual(1);
        expect(f.weight).toBeGreaterThan(0);
        expect(f.contribution).toBeGreaterThanOrEqual(0);
      }
    });

    it("generates explanation for each recommendation", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
      prisma.ticket.groupBy.mockResolvedValue([]);

      const result = await getRecommendations("ticket-1", mockUser);

      expect(result.recommendations[0].explanation).toBeTruthy();
      expect(typeof result.recommendations[0].explanation).toBe("string");
    });

    it("confidence is bounded 0.50-0.98 for top recommendation", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue(mockAgents);
      prisma.ticket.groupBy.mockResolvedValue([]);

      const result = await getRecommendations("ticket-1", mockUser);

      const top = result.recommendations[0];
      expect(top.confidence).toBeGreaterThanOrEqual(0.50);
      expect(top.confidence).toBeLessThanOrEqual(0.98);
    });

    it("tie-breaking is deterministic (stable agent ID)", async () => {
      // Two agents with identical data
      const identicalAgents = [
        { ...mockAgents[0], id: "agent-aaa", username: "aaa" },
        { ...mockAgents[1], id: "agent-zzz", username: "zzz", departmentId: "dept-1", department: { name: "IT Support" } },
      ];
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findMany.mockResolvedValue(identicalAgents);
      prisma.ticket.groupBy.mockResolvedValue([]);

      const result = await getRecommendations("ticket-1", mockUser);

      // Same department, same workload — tie broken by stable agent ID
      expect(result.recommendations[0].agentId).toBe("agent-aaa");
      expect(result.recommendations[1].agentId).toBe("agent-zzz");
    });

    it("handles provider failure gracefully", async () => {
      prisma.ticket.findUnique.mockRejectedValue(new Error("DB error"));

      const result = await getRecommendations("ticket-1", mockUser);

      expect(result.error).toBe("Recommendation failed");
      expect(result.recommendations).toBeUndefined();
    });
  });
});
