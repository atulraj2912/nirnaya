import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: {
      findMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db/prisma";
import { runSLABreachScan } from "@/lib/services/sla-scan-service";

describe("SLA breach scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero counts when no tickets need scanning", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);

    const result = await runSLABreachScan("org-1");

    expect(result.scanned).toBe(0);
    expect(result.breached).toBe(0);
    expect(result.warned).toBe(0);
    expect(result.unchanged).toBe(0);
  });

  it("detects breached response SLA", async () => {
    const past = new Date(Date.now() - 3600000);
    const createdAt = new Date(Date.now() - 7200000);

    prisma.ticket.findMany.mockResolvedValue([
      {
        id: "ticket-1",
        ticketNumber: "NIR-2026-000001",
        createdAt,
        status: "IN_PROGRESS",
        waitingSince: null,
        responseSlaStatus: "ON_TRACK",
        resolutionSlaStatus: "ON_TRACK",
        responseDueAt: past,
        resolutionDueAt: new Date(Date.now() + 3600000),
        firstRespondedAt: null,
        requesterId: "user-1",
        assignedAgentId: "agent-1",
      },
    ]);

    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({ id: "notif-1" });
    prisma.user.findUnique.mockResolvedValue({ username: "test" });
    prisma.ticket.update.mockResolvedValue({});

    const result = await runSLABreachScan("org-1");

    expect(result.scanned).toBe(1);
    expect(result.breached).toBeGreaterThanOrEqual(1);
  });

  it("detects warning SLA", async () => {
    const createdAt = new Date(Date.now() - 100 * 60000);
    const responseDueAt = new Date(Date.now() + 10 * 60000);

    prisma.ticket.findMany.mockResolvedValue([
      {
        id: "ticket-2",
        ticketNumber: "NIR-2026-000002",
        createdAt,
        status: "IN_PROGRESS",
        waitingSince: null,
        responseSlaStatus: "ON_TRACK",
        resolutionSlaStatus: "ON_TRACK",
        responseDueAt,
        resolutionDueAt: new Date(Date.now() + 3600000),
        firstRespondedAt: null,
        requesterId: "user-1",
        assignedAgentId: "agent-1",
      },
    ]);

    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-2", organizationId: "org-1" });
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({ id: "notif-1" });
    prisma.user.findUnique.mockResolvedValue({ username: "test" });
    prisma.ticket.update.mockResolvedValue({});

    const result = await runSLABreachScan("org-1");

    expect(result.scanned).toBe(1);
    expect(result.warned).toBeGreaterThanOrEqual(1);
  });

  it("skips closed tickets", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);

    const result = await runSLABreachScan("org-1");

    const findCall = prisma.ticket.findMany.mock.calls[0][0];
    expect(findCall.where.status.notIn).toContain("CLOSED");
  });

  it("skips resolved tickets for resolution SLA", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);

    const result = await runSLABreachScan("org-1");

    const findCall = prisma.ticket.findMany.mock.calls[0][0];
    const resolutionCondition = findCall.where.OR[1];
    expect(resolutionCondition.status.notIn).toContain("RESOLVED");
  });

  it("does not create duplicate notifications", async () => {
    const past = new Date(Date.now() - 3600000);
    const createdAt = new Date(Date.now() - 7200000);

    prisma.ticket.findMany.mockResolvedValue([
      {
        id: "ticket-1",
        ticketNumber: "NIR-2026-000001",
        createdAt,
        status: "IN_PROGRESS",
        waitingSince: null,
        responseSlaStatus: "BREACHED",
        resolutionSlaStatus: "ON_TRACK",
        responseDueAt: past,
        resolutionDueAt: new Date(Date.now() + 3600000),
        firstRespondedAt: null,
        requesterId: "user-1",
        assignedAgentId: "agent-1",
      },
    ]);

    const result = await runSLABreachScan("org-1");

    expect(result.unchanged).toBe(1);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("returns timestamp", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);

    const result = await runSLABreachScan("org-1");

    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });
});
