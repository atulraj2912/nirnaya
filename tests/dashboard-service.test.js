import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      count: vi.fn(),
    },
    department: {
      count: vi.fn(),
    },
    category: {
      count: vi.fn(),
    },
    tag: {
      count: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db/prisma";
import { getDashboardStats } from "@/lib/services/dashboard-service";

const orgId = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDashboardStats", () => {
  it("returns comprehensive stats for organization", async () => {
    prisma.ticket.count
      .mockResolvedValueOnce(100)  // total
      .mockResolvedValueOnce(10)   // open
      .mockResolvedValueOnce(5)    // assigned
      .mockResolvedValueOnce(15)   // in progress
      .mockResolvedValueOnce(3)    // resolved today
      .mockResolvedValueOnce(70)   // closed
      .mockResolvedValueOnce(2)    // breached SLA
      .mockResolvedValueOnce(1);   // warning SLA
    prisma.user.count
      .mockResolvedValueOnce(20)   // total users
      .mockResolvedValueOnce(18);  // active users
    prisma.department.count
      .mockResolvedValueOnce(5)    // total departments
      .mockResolvedValueOnce(4);   // active departments
    prisma.category.count
      .mockResolvedValueOnce(8)    // total categories
      .mockResolvedValueOnce(7);   // active categories
    prisma.tag.count.mockResolvedValueOnce(12); // total tags
    prisma.ticket.findMany.mockResolvedValue([]);

    const stats = await getDashboardStats(orgId);

    expect(stats.tickets.total).toBe(100);
    expect(stats.tickets.open).toBe(10);
    expect(stats.tickets.assigned).toBe(5);
    expect(stats.tickets.inProgress).toBe(15);
    expect(stats.tickets.resolvedToday).toBe(3);
    expect(stats.tickets.closed).toBe(70);
    expect(stats.sla.breached).toBe(2);
    expect(stats.sla.warning).toBe(1);
    expect(stats.users.total).toBe(20);
    expect(stats.users.active).toBe(18);
    expect(stats.departments.total).toBe(5);
    expect(stats.departments.active).toBe(4);
    expect(stats.categories.total).toBe(8);
    expect(stats.categories.active).toBe(7);
    expect(stats.tags.total).toBe(12);
  });

  it("returns recent tickets", async () => {
    // Reset and setup for this test
    prisma.ticket.count.mockResolvedValue(0);
    prisma.user.count.mockResolvedValue(0);
    prisma.department.count.mockResolvedValue(0);
    prisma.category.count.mockResolvedValue(0);
    prisma.tag.count.mockResolvedValue(0);
    prisma.ticket.findMany.mockResolvedValue([
      {
        id: "t1",
        ticketNumber: "NIR-2026-000001",
        title: "Test ticket",
        status: "OPEN",
        priority: "HIGH",
        createdAt: new Date(),
        requester: { id: "u1", username: "admin" },
      },
    ]);

    const stats = await getDashboardStats(orgId);
    expect(stats.recentTickets).toHaveLength(1);
    expect(stats.recentTickets[0].ticketNumber).toBe("NIR-2026-000001");
  });
});
