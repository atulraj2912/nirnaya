import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db/prisma";
import { getUserDashboardStats } from "@/lib/services/user-dashboard-service";

const userId = "user-1";
const orgId = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserDashboardStats", () => {
  it("returns user-scoped stats with correct counts", async () => {
    prisma.ticket.count
      .mockResolvedValueOnce(3)  // open (OPEN + ASSIGNED)
      .mockResolvedValueOnce(2)  // inProgress (IN_PROGRESS + WAITING_FOR_USER)
      .mockResolvedValueOnce(1)  // resolvedToday
      .mockResolvedValueOnce(1); // slaBreached
    prisma.ticket.findMany.mockResolvedValue([]);

    const stats = await getUserDashboardStats(userId, orgId);

    expect(stats.openTickets).toBe(3);
    expect(stats.inProgressTickets).toBe(2);
    expect(stats.resolvedToday).toBe(1);
    expect(stats.slaBreached).toBe(1);
    expect(stats.recentTickets).toEqual([]);
  });

  it("queries with requesterId scoped to the user", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.findMany.mockResolvedValue([]);

    await getUserDashboardStats(userId, orgId);

    const countCalls = prisma.ticket.count.mock.calls;
    for (const call of countCalls) {
      expect(call[0].where.requesterId).toBe(userId);
      expect(call[0].where.organizationId).toBe(orgId);
    }

    const findManyCall = prisma.ticket.findMany.mock.calls[0][0];
    expect(findManyCall.where.requesterId).toBe(userId);
    expect(findManyCall.where.organizationId).toBe(orgId);
  });

  it("does not count another user's tickets", async () => {
    prisma.ticket.count
      .mockResolvedValueOnce(0)  // open
      .mockResolvedValueOnce(0)  // inProgress
      .mockResolvedValueOnce(0)  // resolvedToday
      .mockResolvedValueOnce(0); // slaBreached
    prisma.ticket.findMany.mockResolvedValue([]);

    const stats = await getUserDashboardStats("other-user", orgId);

    expect(stats.openTickets).toBe(0);
    expect(stats.inProgressTickets).toBe(0);
    expect(stats.resolvedToday).toBe(0);
    expect(stats.slaBreached).toBe(0);

    const countCalls = prisma.ticket.count.mock.calls;
    for (const call of countCalls) {
      expect(call[0].where.requesterId).toBe("other-user");
    }
  });

  it("counts OPEN and ASSIGNED as open tickets", async () => {
    prisma.ticket.count
      .mockResolvedValueOnce(5)  // open = OPEN + ASSIGNED
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.ticket.findMany.mockResolvedValue([]);

    await getUserDashboardStats(userId, orgId);

    const openCall = prisma.ticket.count.mock.calls[0][0];
    expect(openCall.where.status).toEqual({ in: ["OPEN", "ASSIGNED"] });
  });

  it("counts IN_PROGRESS and WAITING_FOR_USER as in-progress", async () => {
    prisma.ticket.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(4)  // inProgress = IN_PROGRESS + WAITING_FOR_USER
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.ticket.findMany.mockResolvedValue([]);

    await getUserDashboardStats(userId, orgId);

    const ipCall = prisma.ticket.count.mock.calls[1][0];
    expect(ipCall.where.status).toEqual({ in: ["IN_PROGRESS", "WAITING_FOR_USER"] });
  });

  it("counts resolved today with correct date boundary", async () => {
    prisma.ticket.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)  // resolvedToday
      .mockResolvedValueOnce(0);
    prisma.ticket.findMany.mockResolvedValue([]);

    await getUserDashboardStats(userId, orgId);

    const resolvedCall = prisma.ticket.count.mock.calls[2][0];
    expect(resolvedCall.where.status).toBe("RESOLVED");
    expect(resolvedCall.where.resolvedAt.gte).toBeInstanceOf(Date);
  });

  it("counts SLA breached with responseSlaStatus BREACHED and no first response", async () => {
    prisma.ticket.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2); // slaBreached
    prisma.ticket.findMany.mockResolvedValue([]);

    await getUserDashboardStats(userId, orgId);

    const slaCall = prisma.ticket.count.mock.calls[3][0];
    expect(slaCall.where.responseSlaStatus).toBe("BREACHED");
    expect(slaCall.where.firstRespondedAt).toBeNull();
  });

  it("returns recent tickets limited to 10", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    const mockTickets = Array.from({ length: 10 }, (_, i) => ({
      id: `t-${i}`,
      ticketNumber: `NIR-2026-${String(i + 1).padStart(6, "0")}`,
      title: `Ticket ${i}`,
      status: "OPEN",
      priority: "MEDIUM",
      createdAt: new Date(),
    }));
    prisma.ticket.findMany.mockResolvedValue(mockTickets);

    const stats = await getUserDashboardStats(userId, orgId);

    expect(stats.recentTickets).toHaveLength(10);

    const findManyCall = prisma.ticket.findMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(10);
    expect(findManyCall.orderBy).toEqual({ createdAt: "desc" });
  });

  it("returns recent tickets with correct select fields", async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.findMany.mockResolvedValue([]);

    await getUserDashboardStats(userId, orgId);

    const findManyCall = prisma.ticket.findMany.mock.calls[0][0];
    expect(findManyCall.select).toEqual({
      id: true,
      ticketNumber: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
    });
  });
});
