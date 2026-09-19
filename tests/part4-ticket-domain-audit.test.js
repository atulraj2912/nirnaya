import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    organization: { update: vi.fn() },
    department: { findFirst: vi.fn() },
    category: { findFirst: vi.fn() },
    tag: { count: vi.fn() },
    ticketTag: { createMany: vi.fn(), deleteMany: vi.fn() },
    user: { findUnique: vi.fn() },
    ticketAssignmentHistory: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    JWT_ACCESS_SECRET: "test-access-secret-that-is-at-least-16-chars-long",
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-16-chars-long",
    NODE_ENV: "test",
  }),
}));

vi.mock("@/lib/services/notification-service", () => ({
  notifyTicketAssigned: vi.fn().mockResolvedValue({}),
  notifyTicketStatusChanged: vi.fn().mockResolvedValue({}),
  notifyTicketReopened: vi.fn().mockResolvedValue({}),
  createNotification: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/services/sla-service", () => ({
  initializeTicketSLA: vi.fn().mockResolvedValue({}),
  pauseSLA: vi.fn().mockResolvedValue({}),
  resumeSLA: vi.fn().mockResolvedValue({}),
  completeResolutionSLA: vi.fn().mockResolvedValue({}),
  reopenSLA: vi.fn().mockResolvedValue({}),
  recalculateResolutionSLA: vi.fn().mockResolvedValue({}),
  evaluateAndPersistSLA: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/services/ai-classification-service", () => ({
  classifyTicket: vi.fn().mockResolvedValue({}),
}));

import prisma from "@/lib/db/prisma";
import { createTicket, listTickets, getTicketById, updateTicket, transitionStatus, assignTicket, TicketError } from "@/lib/services/ticket-service";
import { canTransition, getAllowedTransitions, isTerminal } from "@/lib/services/lifecycle";

const org1 = "org-1", org2 = "org-2";

function makeUser(o = {}) { return { id: "user-1", role: "USER", organizationId: org1, status: "ACTIVE", ...o }; }
function makeAgent(o = {}) { return { id: "agent-1", role: "AGENT", organizationId: org1, status: "ACTIVE", ...o }; }
function makeAdmin(o = {}) { return { id: "admin-1", role: "ADMIN", organizationId: org1, ...o }; }
function makeTicket(o = {}) {
  return { id: "ticket-1", ticketNumber: "NIR-2026-000001", title: "Test ticket", description: "Test description", status: "OPEN", priority: "MEDIUM", type: "INCIDENT", source: "WEB", organizationId: org1, departmentId: "dept-1", categoryId: null, requesterId: "user-1", assignedAgentId: null, createdAt: new Date(), updatedAt: new Date(), ...o };
}
function mockTx() { return { ticket: { create: vi.fn(), update: vi.fn() }, ticketTag: { createMany: vi.fn(), deleteMany: vi.fn() } }; }
function setupCreate(overrides = {}) {
  prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
  prisma.tag.count.mockResolvedValue(0);
  prisma.organization.update.mockResolvedValue({ ticketCounter: 1 });
  const tx = mockTx();
  tx.ticket.create.mockResolvedValue({ ...makeTicket(overrides), department: { id: "dept-1", name: "IT", code: "IT" }, category: null, requester: { id: "user-1", username: "testuser", email: "test@example.com", designation: null } });
  prisma.$transaction.mockImplementation(async (fn) => fn(tx));
  return tx;
}
function setupUpdate(overrides = {}) {
  prisma.ticket.findUnique.mockResolvedValue(makeTicket());
  const tx = mockTx();
  const updatedTicket = { ...makeTicket(overrides), department: { id: "dept-1", name: "IT", code: "IT" }, category: null, requester: { id: "user-1", username: "testuser", email: "test@example.com" }, assignedAgent: null };
  tx.ticket.update.mockResolvedValue(updatedTicket);
  tx.ticketTag.deleteMany.mockResolvedValue({ count: 0 });
  tx.ticketTag.createMany.mockResolvedValue({ count: 0 });
  prisma.$transaction.mockImplementation(async (fn) => fn(tx));
  return tx;
}

beforeEach(() => { vi.clearAllMocks(); });
describe("Part 4: Ticket Creation", () => {
  it("creates a ticket with valid data", async () => {
    const tx = setupCreate();
    const result = await createTicket({ title: "Test ticket", description: "Test description", departmentId: "dept-1" }, makeUser());
    expect(result.ticketNumber).toMatch(/^NIR-2026-\d{6}$/);
    expect(prisma.organization.update).toHaveBeenCalled();
  });

  it("derives requesterId from authenticated user", async () => {
    const tx = setupCreate();
    await createTicket({ title: "T", description: "D", departmentId: "dept-1" }, makeUser({ id: "real-user" }));
    expect(tx.ticket.create.mock.calls[0][0].data.requesterId).toBe("real-user");
  });

  it("derives organizationId from authenticated user", async () => {
    const tx = setupCreate();
    await createTicket({ title: "T", description: "D", departmentId: "dept-1" }, makeUser({ organizationId: "org-secure" }));
    expect(tx.ticket.create.mock.calls[0][0].data.organizationId).toBe("org-secure");
  });

  it("generates ticket number atomically via org counter", async () => {
    prisma.organization.update.mockResolvedValue({ ticketCounter: 5 });
    prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
    prisma.tag.count.mockResolvedValue(0);
    const tx = mockTx();
    tx.ticket.create.mockResolvedValue({ ...makeTicket({ ticketNumber: "NIR-2026-000005" }), department: { id: "dept-1", name: "IT", code: "IT" }, category: null, requester: { id: "user-1", username: "t", email: "t@t.com", designation: null } });
    prisma.$transaction.mockImplementation(async (fn) => fn(tx));
    const result = await createTicket({ title: "T", description: "D", departmentId: "dept-1" }, makeUser());
    expect(result.ticketNumber).toBe("NIR-2026-000005");
    expect(prisma.organization.update).toHaveBeenCalledWith({ where: { id: org1 }, data: { ticketCounter: { increment: 1 } }, select: { ticketCounter: true } });
  });

  it("rejects title exceeding 200 characters", async () => {
    await expect(createTicket({ title: "x".repeat(201), description: "D", departmentId: "dept-1" }, makeUser())).rejects.toThrow();
  });

  it("rejects description exceeding 10000 characters", async () => {
    await expect(createTicket({ title: "T", description: "x".repeat(10001), departmentId: "dept-1" }, makeUser())).rejects.toThrow();
  });

  it("rejects invalid priority", async () => {
    await expect(createTicket({ title: "T", description: "D", departmentId: "dept-1", priority: "INVALID" }, makeUser())).rejects.toThrow();
  });

  it("rejects invalid type", async () => {
    await expect(createTicket({ title: "T", description: "D", departmentId: "dept-1", type: "INVALID" }, makeUser())).rejects.toThrow();
  });

  it("rejects invalid source", async () => {
    await expect(createTicket({ title: "T", description: "D", departmentId: "dept-1", source: "INVALID" }, makeUser())).rejects.toThrow();
  });

  it("rejects missing title", async () => {
    await expect(createTicket({ description: "D", departmentId: "dept-1" }, makeUser())).rejects.toThrow();
  });

  it("rejects missing description", async () => {
    await expect(createTicket({ title: "T", departmentId: "dept-1" }, makeUser())).rejects.toThrow();
  });

  it("rejects missing departmentId", async () => {
    await expect(createTicket({ title: "T", description: "D" }, makeUser())).rejects.toThrow();
  });

  it("rejects foreign department", async () => {
    prisma.department.findFirst.mockResolvedValue(null);
    await expect(createTicket({ title: "T", description: "D", departmentId: "bad" }, makeUser())).rejects.toThrow(TicketError);
  });

  it("rejects foreign category", async () => {
    prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
    prisma.category.findFirst.mockResolvedValue(null);
    await expect(createTicket({ title: "T", description: "D", departmentId: "dept-1", categoryId: "bad" }, makeUser())).rejects.toThrow(TicketError);
  });

  it("rejects foreign tags", async () => {
    prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
    prisma.tag.count.mockResolvedValue(0);
    await expect(createTicket({ title: "T", description: "D", departmentId: "dept-1", tagIds: ["t1", "t2"] }, makeUser())).rejects.toThrow(TicketError);
  });

  it("accepts all valid priority values", async () => {
    for (const p of ["LOW", "MEDIUM", "HIGH", "CRITICAL"]) {
      setupCreate({ priority: p });
      const r = await createTicket({ title: "T", description: "D", departmentId: "dept-1", priority: p }, makeUser());
      expect(r.priority).toBe(p);
      vi.clearAllMocks();
    }
  });

  it("accepts all valid type values", async () => {
    for (const t of ["INCIDENT", "SERVICE_REQUEST"]) {
      setupCreate({ type: t });
      const r = await createTicket({ title: "T", description: "D", departmentId: "dept-1", type: t }, makeUser());
      expect(r.type).toBe(t);
      vi.clearAllMocks();
    }
  });

  it("accepts all valid source values", async () => {
    for (const s of ["WEB", "EMAIL", "API"]) {
      setupCreate({ source: s });
      const r = await createTicket({ title: "T", description: "D", departmentId: "dept-1", source: s }, makeUser());
      expect(r.source).toBe(s);
      vi.clearAllMocks();
    }
  });
});
describe("Part 4: Mass Assignment Protection", () => {
  it("createTicket ignores injected requesterId", async () => {
    const tx = setupCreate();
    await createTicket({ title: "T", description: "D", departmentId: "dept-1", requesterId: "spoofed" }, makeUser({ id: "real" }));
    expect(tx.ticket.create.mock.calls[0][0].data.requesterId).toBe("real");
  });

  it("createTicket ignores injected organizationId", async () => {
    const tx = setupCreate();
    await createTicket({ title: "T", description: "D", departmentId: "dept-1", organizationId: "fake" }, makeUser({ organizationId: "real" }));
    expect(tx.ticket.create.mock.calls[0][0].data.organizationId).toBe("real");
  });

  it("createTicket ignores injected status", async () => {
    const tx = setupCreate();
    await createTicket({ title: "T", description: "D", departmentId: "dept-1", status: "CLOSED" }, makeUser());
    expect(tx.ticket.create.mock.calls[0][0].data.status).toBeUndefined();
  });

  it("createTicket ignores injected ticketNumber", async () => {
    const tx = setupCreate();
    await createTicket({ title: "T", description: "D", departmentId: "dept-1", ticketNumber: "NIR-2026-999999" }, makeUser());
    expect(tx.ticket.create.mock.calls[0][0].data.ticketNumber).not.toBe("NIR-2026-999999");
  });

  it("createTicket ignores injected assignedAgentId", async () => {
    const tx = setupCreate();
    await createTicket({ title: "T", description: "D", departmentId: "dept-1", assignedAgentId: "agent-hack" }, makeUser());
    expect(tx.ticket.create.mock.calls[0][0].data.assignedAgentId).toBeUndefined();
  });

  it("updateTicket ignores source", async () => {
    const tx = setupUpdate();
    await updateTicket("t1", { source: "EMAIL" }, makeAgent());
    expect(tx.ticket.update.mock.calls[0][0].data.source).toBeUndefined();
  });

  it("updateTicket ignores assignedAgentId", async () => {
    const tx = setupUpdate();
    await updateTicket("t1", { assignedAgentId: "hack" }, makeAgent());
    expect(tx.ticket.update.mock.calls[0][0].data.assignedAgentId).toBeUndefined();
  });

  it("updateTicket ignores status", async () => {
    const tx = setupUpdate();
    await updateTicket("t1", { status: "RESOLVED" }, makeAgent());
    expect(tx.ticket.update.mock.calls[0][0].data.status).toBeUndefined();
  });

  it("updateTicket ignores organizationId", async () => {
    const tx = setupUpdate();
    await updateTicket("t1", { organizationId: "hack" }, makeAgent());
    expect(tx.ticket.update.mock.calls[0][0].data.organizationId).toBeUndefined();
  });

  it("updateTicket ignores requesterId", async () => {
    const tx = setupUpdate();
    await updateTicket("t1", { requesterId: "other" }, makeAgent());
    expect(tx.ticket.update.mock.calls[0][0].data.requesterId).toBeUndefined();
  });

  it("updateTicket ignores createdAt", async () => {
    const tx = setupUpdate();
    await updateTicket("t1", { createdAt: new Date("2000-01-01") }, makeAgent());
    expect(tx.ticket.update.mock.calls[0][0].data.createdAt).toBeUndefined();
  });

  it("updateTicket ignores resolvedAt", async () => {
    const tx = setupUpdate();
    await updateTicket("t1", { resolvedAt: new Date() }, makeAgent());
    expect(tx.ticket.update.mock.calls[0][0].data.resolvedAt).toBeUndefined();
  });

  it("updateTicket ignores closedAt", async () => {
    const tx = setupUpdate();
    await updateTicket("t1", { closedAt: new Date() }, makeAgent());
    expect(tx.ticket.update.mock.calls[0][0].data.closedAt).toBeUndefined();
  });

  it("updateTicket ignores firstRespondedAt", async () => {
    const tx = setupUpdate();
    await updateTicket("t1", { firstRespondedAt: new Date() }, makeAgent());
    expect(tx.ticket.update.mock.calls[0][0].data.firstRespondedAt).toBeUndefined();
  });
});
describe("Part 4: Organization Isolation", () => {
  it("getTicketById rejects cross-org", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ organizationId: org2 }));
    await expect(getTicketById("t1", makeUser())).rejects.toThrow(TicketError);
  });

  it("updateTicket rejects cross-org", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ organizationId: org2 }));
    await expect(updateTicket("t1", { title: "X" }, makeAgent())).rejects.toThrow(TicketError);
  });

  it("transitionStatus rejects cross-org", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ organizationId: org2 }));
    await expect(transitionStatus("t1", "ASSIGNED", makeAgent())).rejects.toThrow(TicketError);
  });

  it("assignTicket rejects cross-org ticket", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ organizationId: org2 }));
    await expect(assignTicket("t1", { agentId: "a1" }, makeAdmin())).rejects.toThrow(TicketError);
  });

  it("assignTicket rejects cross-org agent", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    prisma.user.findUnique.mockResolvedValue(makeAgent({ organizationId: org2 }));
    await expect(assignTicket("t1", { agentId: "a2" }, makeAdmin())).rejects.toThrow(TicketError);
  });

  it("listTickets enforces org isolation", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    await listTickets({}, makeUser());
    expect(prisma.ticket.findMany.mock.calls[0][0].where.organizationId).toBe(org1);
  });

  it("USER cannot access another user's ticket", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ requesterId: "other" }));
    await expect(getTicketById("t1", makeUser())).rejects.toThrow(TicketError);
  });

  it("AGENT can access any ticket in their org", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...makeTicket({ requesterId: "other" }), comments: [], ticketTags: [], assignmentHistory: [] });
    const r = await getTicketById("t1", makeAgent());
    expect(r.id).toBe("ticket-1");
  });

  it("ADMIN can access any ticket in their org", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...makeTicket({ requesterId: "other" }), comments: [], ticketTags: [], assignmentHistory: [] });
    const r = await getTicketById("t1", makeAdmin());
    expect(r.id).toBe("ticket-1");
  });

  it("USER listTickets only returns own tickets", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    await listTickets({}, makeUser());
    expect(prisma.ticket.findMany.mock.calls[0][0].where.requesterId).toBe("user-1");
  });

  it("AGENT listTickets returns all org tickets", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    await listTickets({}, makeAgent());
    expect(prisma.ticket.findMany.mock.calls[0][0].where.requesterId).toBeUndefined();
  });
});

describe("Part 4: Category and Department Independence", () => {
  it("category does NOT depend on departmentId", async () => {
    prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
    prisma.category.findFirst.mockResolvedValue({ id: "cat-1" });
    prisma.tag.count.mockResolvedValue(0);
    prisma.organization.update.mockResolvedValue({ ticketCounter: 1 });
    const tx = mockTx();
    tx.ticket.create.mockResolvedValue({ ...makeTicket({ categoryId: "cat-1" }), department: { id: "dept-1", name: "IT", code: "IT" }, category: { id: "cat-1", name: "Net" }, requester: { id: "user-1", username: "t", email: "t@t.com", designation: null } });
    prisma.$transaction.mockImplementation(async (fn) => fn(tx));
    await createTicket({ title: "T", description: "D", departmentId: "dept-1", categoryId: "cat-1" }, makeUser());
    expect(prisma.category.findFirst).toHaveBeenCalledWith({ where: { id: "cat-1", organizationId: org1, isActive: true } });
  });

  it("department and category are independently validated", async () => {
    prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
    prisma.category.findFirst.mockResolvedValue(null);
    await expect(createTicket({ title: "T", description: "D", departmentId: "dept-1", categoryId: "bad" }, makeUser())).rejects.toThrow(TicketError);
  });
});
describe("Part 4: Lifecycle - Valid Transitions", () => {
  const valid = [
    ["OPEN", "ASSIGNED"], ["ASSIGNED", "IN_PROGRESS"], ["IN_PROGRESS", "WAITING_FOR_USER"],
    ["WAITING_FOR_USER", "IN_PROGRESS"], ["IN_PROGRESS", "RESOLVED"], ["RESOLVED", "CLOSED"],
    ["RESOLVED", "REOPENED"], ["REOPENED", "IN_PROGRESS"],
  ];

  it.each(valid)("%s to %s is allowed", (from, to) => {
    expect(canTransition(from, to, "AGENT").allowed).toBe(true);
  });

  it("ADMIN can perform all valid transitions", () => {
    for (const [f, t] of valid) expect(canTransition(f, t, "ADMIN").allowed).toBe(true);
  });

  it("AGENT can perform all valid transitions", () => {
    for (const [f, t] of valid) expect(canTransition(f, t, "AGENT").allowed).toBe(true);
  });

  it("USER can reopen own RESOLVED ticket", () => {
    expect(canTransition("RESOLVED", "REOPENED", "USER", { requesterId: "u1", actorId: "u1" }).allowed).toBe(true);
  });

  it("USER cannot reopen another user's RESOLVED ticket", () => {
    expect(canTransition("RESOLVED", "REOPENED", "USER", { requesterId: "u1", actorId: "u2" }).allowed).toBe(false);
  });

  it("USER cannot perform agent transitions", () => {
    expect(canTransition("OPEN", "ASSIGNED", "USER").allowed).toBe(false);
    expect(canTransition("ASSIGNED", "IN_PROGRESS", "USER").allowed).toBe(false);
    expect(canTransition("IN_PROGRESS", "RESOLVED", "USER").allowed).toBe(false);
    expect(canTransition("IN_PROGRESS", "WAITING_FOR_USER", "USER").allowed).toBe(false);
    expect(canTransition("RESOLVED", "CLOSED", "USER").allowed).toBe(false);
  });

  it("same-status transition is allowed (no-op)", () => {
    expect(canTransition("OPEN", "OPEN", "AGENT").allowed).toBe(true);
    expect(canTransition("CLOSED", "CLOSED", "ADMIN").allowed).toBe(true);
  });
});
describe("Part 4: Lifecycle - Invalid Transitions", () => {
  it("OPEN cannot go to IN_PROGRESS", () => {
    expect(canTransition("OPEN", "IN_PROGRESS", "AGENT").allowed).toBe(false);
  });

  it("OPEN cannot go to WAITING_FOR_USER", () => {
    expect(canTransition("OPEN", "WAITING_FOR_USER", "AGENT").allowed).toBe(false);
  });

  it("OPEN cannot go to RESOLVED", () => {
    expect(canTransition("OPEN", "RESOLVED", "AGENT").allowed).toBe(false);
  });

  it("OPEN cannot go to CLOSED", () => {
    expect(canTransition("OPEN", "CLOSED", "AGENT").allowed).toBe(false);
  });

  it("OPEN cannot go to REOPENED", () => {
    expect(canTransition("OPEN", "REOPENED", "AGENT").allowed).toBe(false);
  });

  it("ASSIGNED cannot go to OPEN", () => {
    expect(canTransition("ASSIGNED", "OPEN", "AGENT").allowed).toBe(false);
  });

  it("ASSIGNED cannot go to WAITING_FOR_USER", () => {
    expect(canTransition("ASSIGNED", "WAITING_FOR_USER", "AGENT").allowed).toBe(false);
  });

  it("ASSIGNED cannot go to RESOLVED", () => {
    expect(canTransition("ASSIGNED", "RESOLVED", "AGENT").allowed).toBe(false);
  });

  it("ASSIGNED cannot go to CLOSED", () => {
    expect(canTransition("ASSIGNED", "CLOSED", "AGENT").allowed).toBe(false);
  });

  it("ASSIGNED cannot go to REOPENED", () => {
    expect(canTransition("ASSIGNED", "REOPENED", "AGENT").allowed).toBe(false);
  });

  it("IN_PROGRESS cannot go to OPEN", () => {
    expect(canTransition("IN_PROGRESS", "OPEN", "AGENT").allowed).toBe(false);
  });

  it("IN_PROGRESS cannot go to ASSIGNED", () => {
    expect(canTransition("IN_PROGRESS", "ASSIGNED", "AGENT").allowed).toBe(false);
  });

  it("IN_PROGRESS cannot go to CLOSED", () => {
    expect(canTransition("IN_PROGRESS", "CLOSED", "AGENT").allowed).toBe(false);
  });

  it("IN_PROGRESS cannot go to REOPENED", () => {
    expect(canTransition("IN_PROGRESS", "REOPENED", "AGENT").allowed).toBe(false);
  });

  it("WAITING_FOR_USER cannot go to OPEN", () => {
    expect(canTransition("WAITING_FOR_USER", "OPEN", "AGENT").allowed).toBe(false);
  });

  it("WAITING_FOR_USER cannot go to ASSIGNED", () => {
    expect(canTransition("WAITING_FOR_USER", "ASSIGNED", "AGENT").allowed).toBe(false);
  });

  it("WAITING_FOR_USER cannot go to RESOLVED", () => {
    expect(canTransition("WAITING_FOR_USER", "RESOLVED", "AGENT").allowed).toBe(false);
  });

  it("WAITING_FOR_USER cannot go to CLOSED", () => {
    expect(canTransition("WAITING_FOR_USER", "CLOSED", "AGENT").allowed).toBe(false);
  });

  it("WAITING_FOR_USER cannot go to REOPENED", () => {
    expect(canTransition("WAITING_FOR_USER", "REOPENED", "AGENT").allowed).toBe(false);
  });

  it("RESOLVED cannot go to OPEN", () => {
    expect(canTransition("RESOLVED", "OPEN", "AGENT").allowed).toBe(false);
  });

  it("RESOLVED cannot go to ASSIGNED", () => {
    expect(canTransition("RESOLVED", "ASSIGNED", "AGENT").allowed).toBe(false);
  });

  it("RESOLVED cannot go to IN_PROGRESS", () => {
    expect(canTransition("RESOLVED", "IN_PROGRESS", "AGENT").allowed).toBe(false);
  });

  it("RESOLVED cannot go to WAITING_FOR_USER", () => {
    expect(canTransition("RESOLVED", "WAITING_FOR_USER", "AGENT").allowed).toBe(false);
  });

  it("REOPENED cannot go to OPEN", () => {
    expect(canTransition("REOPENED", "OPEN", "AGENT").allowed).toBe(false);
  });

  it("REOPENED cannot go to ASSIGNED", () => {
    expect(canTransition("REOPENED", "ASSIGNED", "AGENT").allowed).toBe(false);
  });

  it("REOPENED cannot go to WAITING_FOR_USER", () => {
    expect(canTransition("REOPENED", "WAITING_FOR_USER", "AGENT").allowed).toBe(false);
  });

  it("REOPENED cannot go to RESOLVED", () => {
    expect(canTransition("REOPENED", "RESOLVED", "AGENT").allowed).toBe(false);
  });

  it("REOPENED cannot go to CLOSED", () => {
    expect(canTransition("REOPENED", "CLOSED", "AGENT").allowed).toBe(false);
  });

  it("CLOSED cannot go to any state", () => {
    expect(canTransition("CLOSED", "OPEN", "ADMIN").allowed).toBe(false);
    expect(canTransition("CLOSED", "ASSIGNED", "ADMIN").allowed).toBe(false);
    expect(canTransition("CLOSED", "IN_PROGRESS", "ADMIN").allowed).toBe(false);
    expect(canTransition("CLOSED", "WAITING_FOR_USER", "ADMIN").allowed).toBe(false);
    expect(canTransition("CLOSED", "RESOLVED", "ADMIN").allowed).toBe(false);
    expect(canTransition("CLOSED", "REOPENED", "ADMIN").allowed).toBe(false);
  });

  it("unknown status cannot transition", () => {
    expect(canTransition("UNKNOWN", "OPEN", "AGENT").allowed).toBe(false);
  });
});
describe("Part 4: Terminal State", () => {
  it("CLOSED is terminal", () => {
    expect(isTerminal("CLOSED")).toBe(true);
  });

  it("OPEN is not terminal", () => {
    expect(isTerminal("OPEN")).toBe(false);
  });

  it("RESOLVED is not terminal", () => {
    expect(isTerminal("RESOLVED")).toBe(false);
  });

  it("getAllowedTransitions returns empty for CLOSED", () => {
    expect(getAllowedTransitions("CLOSED")).toEqual([]);
  });

  it("getAllowedTransitions returns correct values", () => {
    expect(getAllowedTransitions("OPEN")).toEqual(["ASSIGNED"]);
    expect(getAllowedTransitions("ASSIGNED")).toEqual(["IN_PROGRESS"]);
    expect(getAllowedTransitions("IN_PROGRESS")).toEqual(["WAITING_FOR_USER", "RESOLVED"]);
    expect(getAllowedTransitions("WAITING_FOR_USER")).toEqual(["IN_PROGRESS"]);
    expect(getAllowedTransitions("RESOLVED")).toEqual(["CLOSED", "REOPENED"]);
    expect(getAllowedTransitions("REOPENED")).toEqual(["IN_PROGRESS"]);
  });
});

describe("Part 4: Assignment", () => {
  it("valid same-org agent assignment works", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    prisma.user.findUnique.mockResolvedValue(makeAgent());
    prisma.$transaction.mockResolvedValue([{ ...makeTicket(), assignedAgentId: "agent-1", status: "ASSIGNED" }, { id: "h1" }]);
    const r = await assignTicket("t1", { agentId: "agent-1" }, makeAdmin());
    expect(r.assignedAgentId).toBe("agent-1");
  });

  it("USER cannot assign tickets (route-level)", async () => {
    const { requireAgentOrAdmin } = await import("@/lib/authz");
    const mockUser = makeUser();
    const { signAccessToken } = await import("@/lib/auth/jwt");
    const jwt = await signAccessToken({ userId: mockUser.id, role: mockUser.role, organizationId: mockUser.organizationId });
    const request = { cookies: { get: (n) => n === "nirnaya_access_token" ? { value: jwt } : undefined } };
    prisma.user.findUnique.mockResolvedValue(mockUser);
    const result = await requireAgentOrAdmin(request);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(403);
  });

  it("rejects assignment to USER role", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    prisma.user.findUnique.mockResolvedValue({ ...makeAgent(), role: "USER" });
    await expect(assignTicket("t1", { agentId: "u1" }, makeAdmin())).rejects.toThrow(TicketError);
  });

  it("rejects assignment to INACTIVE user", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    prisma.user.findUnique.mockResolvedValue({ ...makeAgent(), status: "INACTIVE" });
    await expect(assignTicket("t1", { agentId: "a1" }, makeAdmin())).rejects.toThrow(TicketError);
  });

  it("auto-transitions OPEN to ASSIGNED on assignment", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    prisma.user.findUnique.mockResolvedValue(makeAgent());
    prisma.$transaction.mockResolvedValue([{ ...makeTicket(), status: "ASSIGNED", assignedAgentId: "agent-1" }, { id: "h1" }]);
    const r = await assignTicket("t1", { agentId: "agent-1" }, makeAdmin());
    expect(r.status).toBe("ASSIGNED");
  });

  it("records assignment history", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    prisma.user.findUnique.mockResolvedValue(makeAgent());
    prisma.$transaction.mockResolvedValue([{ ...makeTicket(), assignedAgentId: "agent-1" }, { id: "h1" }]);
    await assignTicket("t1", { agentId: "agent-1", reason: "Specialist needed" }, makeAdmin());
    expect(prisma.ticketAssignmentHistory.create).toHaveBeenCalled();
    const createCall = prisma.ticketAssignmentHistory.create.mock.calls[0][0];
    expect(createCall.data.reason).toBe("Specialist needed");
  });
});
describe("Part 4: Timestamp Protection", () => {
  it("resolvedAt is set server-side during RESOLVED transition", async () => {
    const ticket = makeTicket({ status: "IN_PROGRESS" });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({ ...ticket, status: "RESOLVED", resolvedAt: new Date() });
    await transitionStatus("t1", "RESOLVED", makeAgent());
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.resolvedAt).toBeInstanceOf(Date);
  });

  it("closedAt is set server-side during CLOSED transition", async () => {
    const ticket = makeTicket({ status: "RESOLVED" });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({ ...ticket, status: "CLOSED", closedAt: new Date() });
    await transitionStatus("t1", "CLOSED", makeAgent());
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.closedAt).toBeInstanceOf(Date);
  });

  it("waitingSince is set during WAITING_FOR_USER transition", async () => {
    const ticket = makeTicket({ status: "IN_PROGRESS" });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({ ...ticket, status: "WAITING_FOR_USER" });
    await transitionStatus("t1", "WAITING_FOR_USER", makeAgent());
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.waitingSince).toBeInstanceOf(Date);
  });

  it("waitingSince is cleared when returning from WAITING_FOR_USER", async () => {
    const ticket = makeTicket({ status: "WAITING_FOR_USER" });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({ ...ticket, status: "IN_PROGRESS" });
    await transitionStatus("t1", "IN_PROGRESS", makeAgent());
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.waitingSince).toBeNull();
  });

  it("updateTicket does not allow setting resolvedAt", async () => {
    const tx = setupUpdate();
    await updateTicket("t1", { resolvedAt: new Date() }, makeAgent());
    expect(tx.ticket.update.mock.calls[0][0].data.resolvedAt).toBeUndefined();
  });

  it("updateTicket does not allow setting closedAt", async () => {
    const tx = setupUpdate();
    await updateTicket("t1", { closedAt: new Date() }, makeAgent());
    expect(tx.ticket.update.mock.calls[0][0].data.closedAt).toBeUndefined();
  });

  it("updateTicket does not allow setting firstRespondedAt", async () => {
    const tx = setupUpdate();
    await updateTicket("t1", { firstRespondedAt: new Date() }, makeAgent());
    expect(tx.ticket.update.mock.calls[0][0].data.firstRespondedAt).toBeUndefined();
  });

  it("transitionStatus always sets updatedById", async () => {
    const ticket = makeTicket();
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({ ...ticket, status: "ASSIGNED" });
    await transitionStatus("t1", "ASSIGNED", makeAgent());
    expect(prisma.ticket.update.mock.calls[0][0].data.updatedById).toBe("agent-1");
  });
});
describe("Part 4: Pagination and Filter Validation", () => {
  it("validates page is positive integer", async () => {
    const { ticketListQuerySchema } = await import("@/lib/validation/ticket");
    const result = ticketListQuerySchema.safeParse({ page: -1 });
    expect(result.success).toBe(false);
  });

  it("validates limit bounds (1-100)", async () => {
    const { ticketListQuerySchema } = await import("@/lib/validation/ticket");
    expect(ticketListQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(ticketListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(ticketListQuerySchema.safeParse({ limit: 50 }).success).toBe(true);
  });

  it("validates status enum", async () => {
    const { ticketListQuerySchema } = await import("@/lib/validation/ticket");
    expect(ticketListQuerySchema.safeParse({ status: "INVALID" }).success).toBe(false);
    expect(ticketListQuerySchema.safeParse({ status: "OPEN" }).success).toBe(true);
  });

  it("validates priority enum", async () => {
    const { ticketListQuerySchema } = await import("@/lib/validation/ticket");
    expect(ticketListQuerySchema.safeParse({ priority: "INVALID" }).success).toBe(false);
    expect(ticketListQuerySchema.safeParse({ priority: "HIGH" }).success).toBe(true);
  });

  it("validates type enum", async () => {
    const { ticketListQuerySchema } = await import("@/lib/validation/ticket");
    expect(ticketListQuerySchema.safeParse({ type: "INVALID" }).success).toBe(false);
    expect(ticketListQuerySchema.safeParse({ type: "INCIDENT" }).success).toBe(true);
  });

  it("validates sort field", async () => {
    const { ticketListQuerySchema } = await import("@/lib/validation/ticket");
    expect(ticketListQuerySchema.safeParse({ sort: "hack" }).success).toBe(false);
    expect(ticketListQuerySchema.safeParse({ sort: "createdAt" }).success).toBe(true);
  });

  it("validates order direction", async () => {
    const { ticketListQuerySchema } = await import("@/lib/validation/ticket");
    expect(ticketListQuerySchema.safeParse({ order: "sideways" }).success).toBe(false);
    expect(ticketListQuerySchema.safeParse({ order: "desc" }).success).toBe(true);
  });

  it("defaults page to 1 and limit to 20", async () => {
    const { ticketListQuerySchema } = await import("@/lib/validation/ticket");
    const result = ticketListQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("listTickets applies pagination correctly", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    await listTickets({ page: 2, limit: 10 }, makeAgent());
    const findCall = prisma.ticket.findMany.mock.calls[0][0];
    expect(findCall.skip).toBe(10);
    expect(findCall.take).toBe(10);
  });
});
describe("Part 4: Service Error Handling", () => {
  it("createTicket throws TicketError for invalid department", async () => {
    prisma.department.findFirst.mockResolvedValue(null);
    try {
      await createTicket({ title: "T", description: "D", departmentId: "bad" }, makeUser());
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TicketError);
      expect(e.status).toBe(404);
    }
  });

  it("getTicketById throws 404 for missing ticket", async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);
    await expect(getTicketById("nonexistent", makeUser())).rejects.toThrow(TicketError);
  });

  it("transitionStatus throws 409 for invalid lifecycle transition", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ status: "OPEN" }));
    try {
      await transitionStatus("t1", "CLOSED", makeAgent());
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TicketError);
      expect(e.status).toBe(409);
    }
  });

  it("assignTicket throws 400 for non-agent role", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    prisma.user.findUnique.mockResolvedValue({ ...makeAgent(), role: "USER" });
    try {
      await assignTicket("t1", { agentId: "u1" }, makeAdmin());
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TicketError);
      expect(e.status).toBe(400);
    }
  });

  it("assignTicket throws 400 for inactive agent", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    prisma.user.findUnique.mockResolvedValue({ ...makeAgent(), status: "INACTIVE" });
    try {
      await assignTicket("t1", { agentId: "a1" }, makeAdmin());
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TicketError);
      expect(e.status).toBe(400);
    }
  });

  it("TicketError has correct name", () => {
    const e = new TicketError("test", 400);
    expect(e.name).toBe("TicketError");
    expect(e.status).toBe(400);
    expect(e.message).toBe("test");
  });
});