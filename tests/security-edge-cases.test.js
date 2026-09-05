import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    ticket: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    department: {
      findFirst: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
    },
    tag: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fns) => {
      if (typeof fns === "function") {
        return await fns({
          ticket: prisma.ticket,
          ticketTag: prisma.ticketTag || { deleteMany: vi.fn(), createMany: vi.fn() },
          ticketAssignmentHistory: prisma.ticketAssignmentHistory || { create: vi.fn() },
        });
      }
      return Promise.all(fns);
    }),
  },
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/services/notification-service", () => ({
  notifyTicketAssigned: vi.fn().mockResolvedValue({}),
  notifyTicketStatusChanged: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/services/sla-service", () => ({
  initializeSLA: vi.fn().mockResolvedValue({}),
  satisfyResponseSLA: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/services/ai-classification-service", () => ({
  classifyTicket: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    JWT_ACCESS_SECRET: "test-access-secret-that-is-at-least-16-chars",
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-16-chars",
    NODE_ENV: "test",
  }),
}));

import prisma from "@/lib/db/prisma";
import { getTicketById, assignTicket, updateTicket, transitionStatus, listTickets } from "@/lib/services/ticket-service";
import { deactivateUser } from "@/lib/services/user-admin-service";
import { requireAuth, requireAdmin } from "@/lib/authz";

const org1 = "org-1";
const org2 = "org-2";

function makeUser(overrides = {}) {
  return {
    id: "user-1",
    username: "testuser",
    email: "test@example.com",
    role: "USER",
    status: "ACTIVE",
    organizationId: org1,
    departmentId: "dept-1",
    ...overrides,
  };
}

function makeAgent(overrides = {}) {
  return {
    id: "agent-1",
    username: "agent",
    email: "agent@example.com",
    role: "AGENT",
    status: "ACTIVE",
    organizationId: org1,
    departmentId: "dept-1",
    ...overrides,
  };
}

function makeAdmin(overrides = {}) {
  return {
    id: "admin-1",
    username: "admin",
    email: "admin@example.com",
    role: "ADMIN",
    status: "ACTIVE",
    organizationId: org1,
    departmentId: "dept-1",
    ...overrides,
  };
}

function makeTicket(overrides = {}) {
  return {
    id: "ticket-1",
    ticketNumber: "NIR-2026-000001",
    title: "Test ticket",
    description: "Test description",
    status: "OPEN",
    priority: "MEDIUM",
    type: "INCIDENT",
    source: "WEB",
    organizationId: org1,
    requesterId: "user-1",
    departmentId: "dept-1",
    categoryId: null,
    assignedAgentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    comments: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Security: Cross-organization isolation", () => {
  it("user from org-1 cannot access org-2 ticket", async () => {
    const user = makeUser();
    const ticket = makeTicket({ id: "ticket-2", organizationId: org2 });

    prisma.ticket.findUnique.mockResolvedValue(ticket);

    await expect(getTicketById("ticket-2", user)).rejects.toThrow("Ticket not found");
  });

  it("agent from org-1 cannot update org-2 ticket", async () => {
    const agent = makeAgent();
    const ticket = makeTicket({ id: "ticket-2", organizationId: org2 });

    prisma.ticket.findUnique.mockResolvedValue(ticket);

    await expect(
      updateTicket("ticket-2", { title: "Hacked" }, agent)
    ).rejects.toThrow("Ticket not found");
  });

  it("admin from org-1 cannot assign org-2 ticket", async () => {
    const admin = makeAdmin();
    const ticket = makeTicket({ id: "ticket-2", organizationId: org2 });

    prisma.ticket.findUnique.mockResolvedValue(ticket);

    await expect(
      assignTicket("ticket-2", { agentId: "agent-2" }, admin)
    ).rejects.toThrow("Ticket not found");
  });

  it("admin cannot deactivate org-2 user", async () => {
    const admin = makeAdmin();
    const org2User = makeUser({ id: "user-2", organizationId: org2 });

    prisma.user.findUnique.mockResolvedValue(org2User);

    await expect(
      deactivateUser("user-2", org1)
    ).rejects.toThrow("User not found");
  });
});

describe("Security: USER role restrictions at service layer", () => {
  it("USER cannot assign tickets (service validates target agent role)", async () => {
    const user = makeUser();
    const ticket = makeTicket();
    const targetAgent = makeAgent({ role: "USER" });

    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.user.findUnique.mockResolvedValue(targetAgent);

    await expect(
      assignTicket("ticket-1", { agentId: "user-1" }, user)
    ).rejects.toThrow("Can only assign to AGENT or ADMIN users");
  });

  it("USER can list tickets but only sees own tickets", async () => {
    const user = makeUser();
    const tickets = [makeTicket({ requesterId: user.id })];

    prisma.ticket.findMany.mockResolvedValue(tickets);
    prisma.ticket.count.mockResolvedValue(1);

    await listTickets({}, user);

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requesterId: user.id,
        }),
      })
    );
  });
});

describe("Security: Role-based access control", () => {
  it("AGENT can update tickets in their org", async () => {
    const agent = makeAgent();
    const ticket = makeTicket();
    const updatedTicket = makeTicket({ title: "Updated by agent" });

    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue(updatedTicket);

    const result = await updateTicket("ticket-1", { title: "Updated by agent" }, agent);
    expect(result.title).toBe("Updated by agent");
  });

  it("ADMIN can update tickets in their org", async () => {
    const admin = makeAdmin();
    const ticket = makeTicket();
    const updatedTicket = makeTicket({ title: "Updated by admin" });

    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue(updatedTicket);

    const result = await updateTicket("ticket-1", { title: "Updated by admin" }, admin);
    expect(result.title).toBe("Updated by admin");
  });

  it("ADMIN cannot deactivate last admin", async () => {
    const admin = makeAdmin();

    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.user.count.mockResolvedValue(1);

    await expect(
      deactivateUser("admin-1", org1)
    ).rejects.toThrow("Cannot deactivate the last admin");
  });

  it("ADMIN can deactivate other admins if more than one exists", async () => {
    const admin1 = makeAdmin({ id: "admin-1" });
    const admin2 = makeAdmin({ id: "admin-2" });

    prisma.user.findUnique.mockResolvedValue(admin2);
    prisma.user.count.mockResolvedValue(2);
    prisma.user.update.mockResolvedValue({ ...admin2, status: "INACTIVE" });

    const result = await deactivateUser("admin-2", org1);
    expect(result.status).toBe("INACTIVE");
  });
});

describe("Security: Ticket lifecycle protection", () => {
  it("cannot transition from CLOSED status", async () => {
    const agent = makeAgent();
    const ticket = makeTicket({ status: "CLOSED" });

    prisma.ticket.findUnique.mockResolvedValue(ticket);

    await expect(
      transitionStatus("ticket-1", "OPEN", agent)
    ).rejects.toThrow("not allowed");
  });

  it("cannot skip lifecycle states", async () => {
    const agent = makeAgent();
    const ticket = makeTicket({ status: "OPEN" });

    prisma.ticket.findUnique.mockResolvedValue(ticket);

    await expect(
      transitionStatus("ticket-1", "RESOLVED", agent)
    ).rejects.toThrow("not allowed");
  });
});

describe("Security: Authentication and authorization", () => {
  it("requireAuth returns response for missing token", async () => {
    const { getCurrentUser } = await import("@/lib/auth");

    getCurrentUser.mockResolvedValue(null);

    const request = { cookies: { get: () => undefined } };
    const result = await requireAuth(request);

    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(401);
  });

  it("requireAuth returns user for valid token", async () => {
    const { getCurrentUser } = await import("@/lib/auth");

    const user = makeUser();
    getCurrentUser.mockResolvedValue(user);

    const request = { cookies: { get: () => ({ value: "valid-token" }) } };
    const result = await requireAuth(request);

    expect(result.user).toBeDefined();
    expect(result.user.organizationId).toBe(org1);
  });

  it("requireAdmin returns 403 for non-admin user", async () => {
    const { getCurrentUser } = await import("@/lib/auth");

    const user = makeUser({ role: "USER" });
    getCurrentUser.mockResolvedValue(user);

    const request = { cookies: { get: () => ({ value: "valid-token" }) } };
    const result = await requireAdmin(request);

    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(403);
  });

  it("requireAdmin allows ADMIN role", async () => {
    const { getCurrentUser } = await import("@/lib/auth");

    const admin = makeAdmin();
    getCurrentUser.mockResolvedValue(admin);

    const request = { cookies: { get: () => ({ value: "valid-token" }) } };
    const result = await requireAdmin(request);

    expect(result.user).toBeDefined();
    expect(result.user.role).toBe("ADMIN");
  });
});

describe("Security: Data isolation in queries", () => {
  it("list tickets filters by organization", async () => {
    const user = makeUser();

    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);

    await listTickets({}, user);

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: org1,
        }),
      })
    );
  });

  it("list tickets for USER filters by requesterId", async () => {
    const user = makeUser({ role: "USER" });

    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);

    await listTickets({}, user);

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requesterId: user.id,
        }),
      })
    );
  });
});
