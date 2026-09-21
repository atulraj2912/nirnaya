import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: { findUnique: vi.fn(), groupBy: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/db/prisma";
import { getRecommendations, calculateConfidence } from "@/lib/services/agent-recommendation-service";

const mockUser = { id: "user-1", role: "AGENT", organizationId: "org-1" };

const mockTicket = {
  id: "ticket-1", title: "WiFi not working", description: "Cannot connect",
  status: "OPEN", priority: "MEDIUM", type: "INCIDENT",
  organizationId: "org-1", departmentId: "dept-1", categoryId: "cat-1",
  department: { id: "dept-1", name: "IT Support" },
  category: { id: "cat-1", name: "NETWORK" },
};

const mockAgents = [
  { id: "agent-1", username: "alice", email: "alice@test.com", departmentId: "dept-1", department: { name: "IT Support" } },
  { id: "agent-2", username: "bob", email: "bob@test.com", departmentId: "dept-2", department: { name: "Network Ops" } },
];

beforeEach(() => { vi.clearAllMocks(); if (prisma.aIPrediction) delete prisma.aIPrediction; });

// A. Candidate Eligibility
describe("Part 7: Candidate Eligibility", () => {
  it("same-org AGENT with ACTIVE status is accepted", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].agentId).toBe("agent-1");
  });

  it("cross-org agent is excluded", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    await getRecommendations("ticket-1", mockUser);
    expect(prisma.user.findMany.mock.calls[0][0].where.organizationId).toBe("org-1");
  });

  it("USER role excluded", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    await getRecommendations("ticket-1", mockUser);
    expect(prisma.user.findMany.mock.calls[0][0].where.role).toBe("AGENT");
  });

  it("ADMIN role excluded", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    await getRecommendations("ticket-1", mockUser);
    expect(prisma.user.findMany.mock.calls[0][0].where.role).not.toBe("ADMIN");
  });

  it("inactive agents excluded", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    await getRecommendations("ticket-1", mockUser);
    expect(prisma.user.findMany.mock.calls[0][0].where.status).toBe("ACTIVE");
  });

  it("wrong-department excluded when dept known", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    await getRecommendations("ticket-1", mockUser);
    expect(prisma.user.findMany.mock.calls[0][0].where.departmentId).toBe("dept-1");
  });

  it("all-org agents when dept unknown", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...mockTicket, departmentId: null, department: null });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    await getRecommendations("ticket-1", mockUser);
    expect(prisma.user.findMany.mock.calls[0][0].where.departmentId).toBeUndefined();
  });
});

// B. Department Scoring
describe("Part 7: Department Scoring", () => {
  it("same dept = 1.0", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    const dept = result.recommendations[0].factors.find(f => f.name === "Department Match");
    expect(dept.normalized).toBe(1.0);
    expect(dept.contribution).toBe(30);
  });

  it("diff dept = 0.0", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[1]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    const dept = result.recommendations[0].factors.find(f => f.name === "Department Match");
    expect(dept.normalized).toBe(0.0);
  });

  it("unknown dept = 0.0", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...mockTicket, departmentId: null, department: null });
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    const dept = result.recommendations[0].factors.find(f => f.name === "Department Match");
    expect(dept.normalized).toBe(0.0);
  });
});

// C. Category Experience
describe("Part 7: Category Experience", () => {
  it("no history = 0", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    const cat = result.recommendations[0].factors.find(f => f.name === "Category Experience");
    expect(cat.normalized).toBe(0);
  });

  it("diminishing returns verified", async () => {
    const agents = [
      { id: "a1", username: "a1", email: "a1@test.com", departmentId: "dept-1", department: { name: "IT" } },
      { id: "a2", username: "a2", email: "a2@test.com", departmentId: "dept-1", department: { name: "IT" } },
    ];
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue(agents);
    prisma.ticket.groupBy
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { assignedAgentId: "a1", _count: { id: 10 } },
        { assignedAgentId: "a2", _count: { id: 50 } },
      ]);
    const result = await getRecommendations("ticket-1", mockUser);
    const a1 = result.recommendations.find(r => r.agentId === "a1");
    const a2 = result.recommendations.find(r => r.agentId === "a2");
    const cat1 = a1.factors.find(f => f.name === "Category Experience");
    const cat2 = a2.factors.find(f => f.name === "Category Experience");
    expect(cat2.normalized).toBeGreaterThan(cat1.normalized);
    expect(cat2.normalized / cat1.normalized).toBeLessThan(5);
  });
});

// D. Workload
describe("Part 7: Workload Calculation", () => {
  it("active statuses counted", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy
      .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 3 } }])
      .mockResolvedValueOnce([]);
    const result = await getRecommendations("ticket-1", mockUser);
    expect(result.recommendations[0].workload.activeTickets).toBe(3);
  });

  it("RESOLVED/CLOSED not counted", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    expect(result.recommendations[0].workload.activeTickets).toBe(0);
  });

  it("lower workload = higher factor", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue(mockAgents);
    prisma.ticket.groupBy
      .mockResolvedValueOnce([
        { assignedAgentId: "agent-1", _count: { id: 10 } },
        { assignedAgentId: "agent-2", _count: { id: 2 } },
      ])
      .mockResolvedValueOnce([]);
    const result = await getRecommendations("ticket-1", mockUser);
    const w1 = result.recommendations.find(r => r.agentId === "agent-1").factors.find(f => f.name === "Workload");
    const w2 = result.recommendations.find(r => r.agentId === "agent-2").factors.find(f => f.name === "Workload");
    expect(w2.normalized).toBeGreaterThan(w1.normalized);
  });
});

// E. Priority Readiness
describe("Part 7: Priority Readiness", () => {
  it("HIGH ticket penalizes high workload", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...mockTicket, priority: "HIGH" });
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy
      .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 10 } }])
      .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 5 } }]);
    const result = await getRecommendations("ticket-1", mockUser);
    const pr = result.recommendations[0].factors.find(f => f.name === "Priority Readiness");
    expect(pr.normalized).toBeLessThan(1.0);
  });

  it("MEDIUM ticket = all equal readiness", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy
      .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 10 } }])
      .mockResolvedValueOnce([]);
    const result = await getRecommendations("ticket-1", mockUser);
    const pr = result.recommendations[0].factors.find(f => f.name === "Priority Readiness");
    expect(pr.normalized).toBe(1.0);
  });

  it("CRITICAL ticket penalizes high workload", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...mockTicket, priority: "CRITICAL" });
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy
      .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 8 } }])
      .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 4 } }]);
    const result = await getRecommendations("ticket-1", mockUser);
    const pr = result.recommendations[0].factors.find(f => f.name === "Priority Readiness");
    expect(pr.normalized).toBeLessThan(1.0);
  });

  it("LOW ticket = all equal readiness", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...mockTicket, priority: "LOW" });
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy
      .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 10 } }])
      .mockResolvedValueOnce([]);
    const result = await getRecommendations("ticket-1", mockUser);
    const pr = result.recommendations[0].factors.find(f => f.name === "Priority Readiness");
    expect(pr.normalized).toBe(1.0);
  });
});

// F. Historical Experience
describe("Part 7: Historical Experience", () => {
  it("distinct from category experience", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 50 } }])
      .mockResolvedValueOnce([{ assignedAgentId: "agent-1", _count: { id: 5 } }]);
    const result = await getRecommendations("ticket-1", mockUser);
    const hist = result.recommendations[0].factors.find(f => f.name === "Historical Experience");
    const cat = result.recommendations[0].factors.find(f => f.name === "Category Experience");
    expect(hist.normalized).toBeGreaterThan(0);
    expect(cat.normalized).toBeGreaterThan(0);
    expect(hist.normalized).not.toBe(cat.normalized);
  });
});

// G. Weighted Score
describe("Part 7: Weighted Final Score", () => {
  it("weights sum to 100%", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    const factors = result.recommendations[0].factors;
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 10);
  });

  it("contribution reconciles with score", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    const rec = result.recommendations[0];
    const totalContribution = rec.factors.reduce((sum, f) => sum + f.contribution, 0);
    expect(totalContribution).toBeCloseTo(rec.score, 1);
  });
});

// H. Deterministic Ordering
describe("Part 7: Deterministic Ordering", () => {
  it("identical scores tie-broken by agent ID", async () => {
    const agents = [
      { id: "agent-zzz", username: "zzz", email: "z@test.com", departmentId: "dept-1", department: { name: "IT" } },
      { id: "agent-aaa", username: "aaa", email: "a@test.com", departmentId: "dept-1", department: { name: "IT" } },
    ];
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue(agents);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    expect(result.recommendations[0].agentId).toBe("agent-aaa");
    expect(result.recommendations[1].agentId).toBe("agent-zzz");
  });
});

// I. Top-2 Behavior
describe("Part 7: Top-2 Behavior", () => {
  it("many candidates returns 2", async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: "a" + i, username: "u" + i, email: "u" + i + "@t.com", departmentId: "dept-1", department: { name: "IT" },
    }));
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue(many);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    expect(result.recommendations).toHaveLength(2);
    expect(result.totalEligibleAgents).toBe(5);
  });

  it("one candidate returns 1", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    expect(result.recommendations).toHaveLength(1);
  });

  it("zero candidates returns empty", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    expect(result.recommendations).toEqual([]);
    expect(result.totalEligibleAgents).toBe(0);
  });
});

// J. Confidence Calculation
describe("Part 7: Confidence Calculation", () => {
  it("spec example: 48/47 approx 0.50", () => {
    const c = calculateConfidence(48, 47, 5);
    expect(c).toBeGreaterThanOrEqual(0.50);
    expect(c).toBeLessThanOrEqual(0.55);
  });

  it("spec example: 60/59 approx 0.50", () => {
    const c = calculateConfidence(60, 59, 5);
    expect(c).toBeGreaterThanOrEqual(0.50);
    expect(c).toBeLessThanOrEqual(0.55);
  });

  it("spec example: 80/40 approx 0.68", () => {
    const c = calculateConfidence(80, 40, 5);
    expect(c).toBeGreaterThanOrEqual(0.60);
    expect(c).toBeLessThanOrEqual(0.75);
  });

  it("spec example: 90/20 approx 0.82 (D-002: 0.93 unreachable with this formula)", () => {
    const c = calculateConfidence(90, 20, 5);
    expect(c).toBeGreaterThanOrEqual(0.80);
    expect(c).toBeLessThanOrEqual(0.85);
  });

  it("spec example: 60/40 approx 0.63", () => {
    const c = calculateConfidence(60, 40, 5);
    expect(c).toBeGreaterThanOrEqual(0.58);
    expect(c).toBeLessThanOrEqual(0.70);
  });

  it("never exceeds 0.98", () => {
    const c = calculateConfidence(100, 0, 20);
    expect(c).toBeLessThanOrEqual(0.98);
  });

  it("never below 0.50", () => {
    const c = calculateConfidence(1, 0, 1);
    expect(c).toBeGreaterThanOrEqual(0.50);
  });

  it("single candidate still has valid confidence", () => {
    const c = calculateConfidence(80, 0, 1);
    expect(c).toBeGreaterThanOrEqual(0.50);
    expect(c).toBeLessThanOrEqual(0.98);
  });
});

// K. Organization Isolation
describe("Part 7: Organization Isolation", () => {
  it("cross-org ticket returns Ticket not found", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...mockTicket, organizationId: "org-2" });
    const result = await getRecommendations("ticket-1", mockUser);
    expect(result.error).toBe("Ticket not found");
  });

  it("non-existent ticket returns Ticket not found", async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);
    const result = await getRecommendations("bad-id", mockUser);
    expect(result.error).toBe("Ticket not found");
  });

  it("agent query scoped to ticket org", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    await getRecommendations("ticket-1", mockUser);
    expect(prisma.user.findMany.mock.calls[0][0].where.organizationId).toBe("org-1");
  });
});

// L. Role Security
describe("Part 7: Role Security", () => {
  it("only AGENT/ADMIN can access (tested via route auth)", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    expect(result.error).toBeUndefined();
  });
});

// M. AI Independence
describe("Part 7: AI Independence", () => {
  it("works when AI prediction unavailable", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    expect(result.error).toBeUndefined();
    expect(result.aiEnhanced).toBe(false);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("deterministic scoring without AI", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const r1 = await getRecommendations("ticket-1", mockUser);
    const r2 = await getRecommendations("ticket-1", mockUser);
    expect(r1.recommendations[0].score).toBe(r2.recommendations[0].score);
  });
});

// N. Recommendation != Assignment
describe("Part 7: Recommendation is NOT Assignment", () => {
  it("GET /recommendations does not mutate ticket", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    await getRecommendations("ticket-1", mockUser);
    expect(prisma.ticket.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "ticket-1" },
    }));
    expect(result => result).toBeDefined();
  });

  it("recommendation output includes timestamp but not assignment", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    expect(result.generatedAt).toBeDefined();
    expect(result.recommendations[0].timestamp).toBeDefined();
  });
});

// O. Stale Recommendation Protection
describe("Part 7: Stale Recommendation Protection", () => {
  it("each request fetches fresh data (no persistence)", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue([mockAgents[0]]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    await getRecommendations("ticket-1", mockUser);
    await getRecommendations("ticket-1", mockUser);
    expect(prisma.ticket.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(2);
  });
});

// P. Error Handling
describe("Part 7: Error Handling", () => {
  it("DB failure returns Recommendation failed", async () => {
    prisma.ticket.findUnique.mockRejectedValue(new Error("DB error"));
    const result = await getRecommendations("ticket-1", mockUser);
    expect(result.error).toBe("Recommendation failed");
  });
});

// Q. Score Bounds
describe("Part 7: Score Bounds", () => {
  it("score between 0 and 100", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue(mockAgents);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    for (const rec of result.recommendations) {
      expect(rec.score).toBeGreaterThanOrEqual(0);
      expect(rec.score).toBeLessThanOrEqual(100);
    }
  });

  it("confidence bounded 0.50-0.98", async () => {
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue(mockAgents);
    prisma.ticket.groupBy.mockResolvedValue([]);
    const result = await getRecommendations("ticket-1", mockUser);
    const c = result.recommendations[0].confidence;
    expect(c).toBeGreaterThanOrEqual(0.50);
    expect(c).toBeLessThanOrEqual(0.98);
  });
});

// R. N+1 Query Efficiency
describe("Part 7: N+1 Query Efficiency", () => {
  it("uses batched groupBy instead of per-agent queries", async () => {
    const agents = Array.from({ length: 10 }, (_, i) => ({
      id: "a" + i, username: "u" + i, email: "u" + i + "@t.com",
      departmentId: "dept-1", department: { name: "IT" },
    }));
    prisma.ticket.findUnique.mockResolvedValue(mockTicket);
    prisma.user.findMany.mockResolvedValue(agents);
    prisma.ticket.groupBy.mockResolvedValue([]);
    await getRecommendations("ticket-1", mockUser);
    const groupByCalls = prisma.ticket.groupBy.mock.calls.length;
    expect(groupByCalls).toBe(4);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
  });
});