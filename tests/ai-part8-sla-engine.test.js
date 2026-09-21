import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    sLAConfiguration: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    ticket: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    user: { findUnique: vi.fn() },
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
  notifySLABreach: vi.fn().mockResolvedValue({}),
  notifySLAWarning: vi.fn().mockResolvedValue({}),
  notifyTicketAssigned: vi.fn().mockResolvedValue({}),
  notifyTicketStatusChanged: vi.fn().mockResolvedValue({}),
  notifyTicketReopened: vi.fn().mockResolvedValue({}),
  createNotification: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/services/sla-service", async (importOriginal) => {
  const orig = await importOriginal();
  return { ...orig };
});

import prisma from "@/lib/db/prisma";
import {
  computeSLAInfo, initializeTicketSLA, pauseSLA, resumeSLA,
  completeResolutionSLA, satisfyResponseSLA, recalculateResolutionSLA,
  reopenSLA, evaluateAndPersistSLA
} from "@/lib/services/sla-service";

const org1 = "org-1", org2 = "org-2";
const ticketId = "ticket-1";

function makeSLAConfig(overrides = {}) {
  return {
    id: "sla-config-1",
    organizationId: org1,
    priority: "MEDIUM",
    responseTimeMinutes: 240,
    resolutionTimeMinutes: 1440,
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-01"),
    ...overrides,
  };
}

function makeTicket(overrides = {}) {
  const now = new Date();
  return {
    id: ticketId,
    ticketNumber: "NIR-2026-000001",
    title: "Test ticket",
    description: "Test",
    status: "OPEN",
    priority: "MEDIUM",
    type: "INCIDENT",
    source: "WEB",
    organizationId: org1,
    departmentId: "dept-1",
    categoryId: null,
    requesterId: "user-1",
    assignedAgentId: null,
    createdAt: now,
    updatedAt: now,
    responseSlaStatus: null,
    resolutionSlaStatus: null,
    responseDueAt: null,
    resolutionDueAt: null,
    firstRespondedAt: null,
    waitingSince: null,
    resolvedAt: null,
    closedAt: null,
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

// ============================================================
// A. SLA Configuration
// ============================================================
describe("Part 8: SLA Configuration", () => {
  it("config scoped to correct organization", async () => {
    const config = makeSLAConfig();
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    prisma.ticket.update.mockResolvedValue({});
    await initializeTicketSLA(ticketId, org1, "MEDIUM");
    expect(prisma.sLAConfiguration.findFirst).toHaveBeenCalledWith({
      where: { organizationId: org1, priority: "MEDIUM" },
    });
  });

  it("returns empty when no config exists", async () => {
    prisma.sLAConfiguration.findFirst.mockResolvedValue(null);
    const result = await initializeTicketSLA(ticketId, org1, "MEDIUM");
    expect(result).toEqual({});
  });

  it("cross-org config not used", async () => {
    prisma.sLAConfiguration.findFirst.mockResolvedValue(null);
    await initializeTicketSLA(ticketId, org2, "MEDIUM");
    expect(prisma.sLAConfiguration.findFirst).toHaveBeenCalledWith({
      where: { organizationId: org2, priority: "MEDIUM" },
    });
  });

  it("inactive config not distinguished (no isActive field)", async () => {
    const config = makeSLAConfig();
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    prisma.ticket.update.mockResolvedValue({});
    await initializeTicketSLA(ticketId, org1, "MEDIUM");
    expect(prisma.ticket.update).toHaveBeenCalled();
  });
});

// ============================================================
// B. Response SLA
// ============================================================
describe("Part 8: Response SLA", () => {
  it("correct start: responseDueAt = createdAt + responseTimeMinutes", async () => {
    const createdAt = new Date("2026-09-21T10:00:00Z");
    const config = makeSLAConfig({ responseTimeMinutes: 60 });
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ createdAt }));
    prisma.ticket.update.mockResolvedValue({});
    await initializeTicketSLA(ticketId, org1, "MEDIUM");
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.responseDueAt).toEqual(new Date("2026-09-21T11:00:00Z"));
  });

  it("response before deadline: status ON_TRACK", async () => {
    const createdAt = new Date(Date.now() - 30 * 60 * 1000);
    const config = makeSLAConfig({ responseTimeMinutes: 60 });
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ createdAt }));
    prisma.ticket.update.mockResolvedValue({});
    await initializeTicketSLA(ticketId, org1, "MEDIUM");
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.responseSlaStatus).toBe("ON_TRACK");
  });

  it("satisfyResponseSLA: AGENT completes response SLA", async () => {
    const ticket = makeTicket({ responseSlaStatus: "ON_TRACK" });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({});
    await satisfyResponseSLA(ticketId, "AGENT");
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: ticketId },
      data: expect.objectContaining({
        firstRespondedAt: expect.any(Date),
        responseSlaStatus: "COMPLETED",
      }),
    });
  });

  it("satisfyResponseSLA: ADMIN completes response SLA", async () => {
    const ticket = makeTicket();
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({});
    await satisfyResponseSLA(ticketId, "ADMIN");
    expect(prisma.ticket.update).toHaveBeenCalled();
  });

  it("satisfyResponseSLA: USER does NOT complete response SLA", async () => {
    const ticket = makeTicket();
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    const result = await satisfyResponseSLA(ticketId, "USER");
    expect(result).toBeNull();
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("satisfyResponseSLA: already satisfied is idempotent", async () => {
    const ticket = makeTicket({ firstRespondedAt: new Date() });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    const result = await satisfyResponseSLA(ticketId, "AGENT");
    expect(result).toBeNull();
  });

  it("response SLA remains satisfied permanently", async () => {
    const ticket = makeTicket({ firstRespondedAt: new Date(), responseSlaStatus: "COMPLETED" });
    const info = computeSLAInfo(ticket);
    expect(info.response.met).toBe(true);
    expect(info.response.status).toBe("COMPLETED");
  });

  it("computeSLAInfo: response remaining before deadline", async () => {
    const dueAt = new Date(Date.now() + 60 * 60 * 1000);
    const ticket = makeTicket({ responseDueAt: dueAt, responseSlaStatus: "ON_TRACK" });
    const info = computeSLAInfo(ticket);
    expect(info.response.remainingMs).toBeGreaterThan(0);
    expect(info.response.status).toBe("ON_TRACK");
  });

  it("computeSLAInfo: response met shows null remaining", async () => {
    const ticket = makeTicket({ firstRespondedAt: new Date(), responseSlaStatus: "COMPLETED" });
    const info = computeSLAInfo(ticket);
    expect(info.response.remainingMs).toBeNull();
    expect(info.response.met).toBe(true);
  });
});

// ============================================================
// C. Resolution SLA
// ============================================================
describe("Part 8: Resolution SLA", () => {
  it("correct start: resolutionDueAt = createdAt + resolutionTimeMinutes", async () => {
    const createdAt = new Date("2026-09-21T10:00:00Z");
    const config = makeSLAConfig({ resolutionTimeMinutes: 480 });
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ createdAt }));
    prisma.ticket.update.mockResolvedValue({});
    await initializeTicketSLA(ticketId, org1, "MEDIUM");
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.resolutionDueAt).toEqual(new Date("2026-09-21T18:00:00Z"));
  });

  it("completeResolutionSLA: sets resolvedAt and COMPLETED", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    prisma.ticket.update.mockResolvedValue({});
    await completeResolutionSLA(ticketId);
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: ticketId },
      data: expect.objectContaining({
        resolvedAt: expect.any(Date),
        resolutionSlaStatus: "COMPLETED",
      }),
    });
  });

  it("computeSLAInfo: resolution met when RESOLVED", async () => {
    const ticket = makeTicket({ status: "RESOLVED", resolvedAt: new Date() });
    const info = computeSLAInfo(ticket);
    expect(info.resolution.met).toBe(true);
    expect(info.resolution.status).toBe("COMPLETED");
  });

  it("computeSLAInfo: resolution met when CLOSED", async () => {
    const ticket = makeTicket({ status: "CLOSED", resolvedAt: new Date() });
    const info = computeSLAInfo(ticket);
    expect(info.resolution.met).toBe(true);
  });

  it("recalculateResolutionSLA: recalculates from original createdAt", async () => {
    const createdAt = new Date(Date.now() - 60 * 60 * 1000);
    const ticket = makeTicket({ createdAt, priority: "LOW" });
    const config = makeSLAConfig({ resolutionTimeMinutes: 240 });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.update.mockResolvedValue({});
    await recalculateResolutionSLA(ticketId, "MEDIUM");
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.resolutionSlaStatus).toBe("ON_TRACK");
  });

  it("recalculateResolutionSLA: BREACHED when new deadline is past", async () => {
    const createdAt = new Date("2026-09-01T10:00:00Z");
    const ticket = makeTicket({ createdAt });
    const config = makeSLAConfig({ resolutionTimeMinutes: 60 });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.update.mockResolvedValue({});
    await recalculateResolutionSLA(ticketId, "MEDIUM");
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.resolutionSlaStatus).toBe("BREACHED");
  });
});

// ============================================================
// D. Pause / Resume
// ============================================================
describe("Part 8: Pause / Resume", () => {
  it("pauseSLA: sets waitingSince and pauses both clocks", async () => {
    const ticket = makeTicket({ responseSlaStatus: "ON_TRACK", resolutionSlaStatus: "ON_TRACK" });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({});
    await pauseSLA(ticketId);
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: ticketId },
      data: expect.objectContaining({
        waitingSince: expect.any(Date),
        responseSlaStatus: "PAUSED",
        resolutionSlaStatus: "PAUSED",
      }),
    });
  });

  it("pauseSLA: preserves COMPLETED on response", async () => {
    const ticket = makeTicket({ responseSlaStatus: "COMPLETED", resolutionSlaStatus: "ON_TRACK" });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({});
    await pauseSLA(ticketId);
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.responseSlaStatus).toBe("COMPLETED");
    expect(updateCall.data.resolutionSlaStatus).toBe("PAUSED");
  });

  it("pauseSLA: preserves COMPLETED on resolution", async () => {
    const ticket = makeTicket({ responseSlaStatus: "ON_TRACK", resolutionSlaStatus: "COMPLETED" });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({});
    await pauseSLA(ticketId);
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.responseSlaStatus).toBe("PAUSED");
    expect(updateCall.data.resolutionSlaStatus).toBe("COMPLETED");
  });

  it("resumeSLA: clears waitingSince and recalculates both clocks", async () => {
    const createdAt = new Date(Date.now() - 30 * 60 * 1000);
    const ticket = makeTicket({
      createdAt,
      waitingSince: new Date(Date.now() - 10 * 60 * 1000),
      responseSlaStatus: "PAUSED",
      resolutionSlaStatus: "PAUSED",
      responseDueAt: new Date(Date.now() + 30 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + 210 * 60 * 1000),
    });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({});
    await resumeSLA(ticketId);
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.waitingSince).toBeNull();
    expect(updateCall.data.resolutionSlaStatus).toBe("ON_TRACK");
    expect(updateCall.data.responseSlaStatus).toBe("ON_TRACK");
  });

  it("resumeSLA: response SLA breach detection after resume", async () => {
    const createdAt = new Date("2026-09-01T10:00:00Z");
    const ticket = makeTicket({
      createdAt,
      waitingSince: new Date(Date.now() - 60 * 60 * 1000),
      responseSlaStatus: "PAUSED",
      resolutionSlaStatus: "PAUSED",
      responseDueAt: new Date("2026-09-01T10:30:00Z"),
      resolutionDueAt: new Date("2026-09-01T14:00:00Z"),
    });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({});
    await resumeSLA(ticketId);
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.responseSlaStatus).toBe("BREACHED");
  });

  it("pauseSLA: null when ticket not found", async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);
    const result = await pauseSLA("bad-id");
    expect(result).toBeNull();
  });

  it("resumeSLA: null when ticket not found", async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);
    const result = await resumeSLA("bad-id");
    expect(result).toBeNull();
  });

  it("computeSLAInfo: paused when waitingSince set", async () => {
    const ticket = makeTicket({
      waitingSince: new Date(),
      responseSlaStatus: "PAUSED",
      resolutionSlaStatus: "PAUSED",
      responseDueAt: new Date(Date.now() + 60 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const info = computeSLAInfo(ticket);
    expect(info.response.status).toBe("PAUSED");
    expect(info.resolution.status).toBe("PAUSED");
    expect(info.resolution.pausedAt).toBeDefined();
  });
});

// ============================================================
// E. WAITING_FOR_USER
// ============================================================
describe("Part 8: WAITING_FOR_USER SLA Behavior", () => {
  it("no accidental reset on pause", async () => {
    const createdAt = new Date(Date.now() - 60 * 60 * 1000);
    const config = makeSLAConfig({ responseTimeMinutes: 120, resolutionTimeMinutes: 480 });
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ createdAt }));
    prisma.ticket.update.mockResolvedValue({});
    await initializeTicketSLA(ticketId, org1, "MEDIUM");
    const initCall = prisma.ticket.update.mock.calls[0][0];
    const originalDueAt = initCall.data.resolutionDueAt;
    vi.clearAllMocks();
    const ticketAfterInit = makeTicket({
      createdAt,
      responseDueAt: initCall.data.responseDueAt,
      resolutionDueAt: originalDueAt,
      responseSlaStatus: "ON_TRACK",
      resolutionSlaStatus: "ON_TRACK",
    });
    prisma.ticket.findUnique.mockResolvedValue(ticketAfterInit);
    prisma.ticket.update.mockResolvedValue({});
    await pauseSLA(ticketId);
    const pauseCall = prisma.ticket.update.mock.calls[0][0];
    expect(pauseCall.data.resolutionDueAt).toBeUndefined();
  });

  it("resume restores active state without resetting deadline", async () => {
    const createdAt = new Date(Date.now() - 30 * 60 * 1000);
    const resolutionDueAt = new Date(Date.now() + 210 * 60 * 1000);
    const ticket = makeTicket({
      createdAt,
      waitingSince: new Date(Date.now() - 10 * 60 * 1000),
      responseSlaStatus: "PAUSED",
      resolutionSlaStatus: "PAUSED",
      responseDueAt: new Date(Date.now() + 30 * 60 * 1000),
      resolutionDueAt,
    });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({});
    await resumeSLA(ticketId);
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.resolutionDueAt).toBeUndefined();
  });
});

// ============================================================
// F. Reopening
// ============================================================
describe("Part 8: Reopening SLA", () => {
  it("reopenSLA: clears resolvedAt and recalculates deadline", async () => {
    const createdAt = new Date(Date.now() - 60 * 60 * 1000);
    const ticket = makeTicket({ createdAt, status: "RESOLVED", resolvedAt: new Date() });
    const config = makeSLAConfig({ resolutionTimeMinutes: 240 });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.update.mockResolvedValue({});
    await reopenSLA(ticketId);
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: ticketId },
      data: expect.objectContaining({
        resolvedAt: null,
        resolutionSlaStatus: "ON_TRACK",
        resolutionDueAt: expect.any(Date),
      }),
    });
  });

  it("reopenSLA: BREACHED when recalculated deadline is already past", async () => {
    const createdAt = new Date("2026-09-01T10:00:00Z");
    const ticket = makeTicket({ createdAt, status: "RESOLVED", resolvedAt: new Date() });
    const config = makeSLAConfig({ resolutionTimeMinutes: 60 });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.update.mockResolvedValue({});
    await reopenSLA(ticketId);
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.resolutionSlaStatus).toBe("BREACHED");
  });

  it("reopenSLA: null when ticket not found", async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);
    const result = await reopenSLA("bad-id");
    expect(result).toBeNull();
  });

  it("reopenSLA: null when no config exists", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    prisma.sLAConfiguration.findFirst.mockResolvedValue(null);
    const result = await reopenSLA(ticketId);
    expect(result).toBeNull();
  });
});

// ============================================================
// G. Independent Clocks
// ============================================================
describe("Part 8: Independent Clocks", () => {
  it("response completes while resolution remains active", async () => {
    const ticket = makeTicket({
      responseSlaStatus: "ON_TRACK",
      resolutionSlaStatus: "ON_TRACK",
      responseDueAt: new Date(Date.now() + 60 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({});
    await satisfyResponseSLA(ticketId, "AGENT");
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.responseSlaStatus).toBe("COMPLETED");
    expect(updateCall.data.resolutionSlaStatus).toBeUndefined();
  });

  it("response breach does not mean resolution breach", async () => {
    const ticket = makeTicket({
      firstRespondedAt: null,
      responseSlaStatus: "BREACHED",
      resolutionSlaStatus: "ON_TRACK",
      responseDueAt: new Date(Date.now() - 60 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const info = computeSLAInfo(ticket);
    expect(info.response.status).toBe("BREACHED");
    expect(info.resolution.status).toBe("ON_TRACK");
  });

  it("resolution completion does not incorrectly mark response complete", async () => {
    const ticket = makeTicket({
      status: "RESOLVED",
      resolvedAt: new Date(),
      firstRespondedAt: null,
      responseSlaStatus: "ON_TRACK",
      resolutionSlaStatus: "COMPLETED",
    });
    const info = computeSLAInfo(ticket);
    expect(info.response.met).toBe(false);
    expect(info.resolution.met).toBe(true);
  });
});

// ============================================================
// H. Boundary Conditions
// ============================================================
describe("Part 8: Boundary Conditions", () => {
  it("computeSLAInfo: zero remaining shows zero or negative", async () => {
    const ticket = makeTicket({
      responseDueAt: new Date(),
      responseSlaStatus: "ON_TRACK",
    });
    const info = computeSLAInfo(ticket);
    expect(info.response.remainingMs).toBeLessThanOrEqual(0);
  });

  it("evaluateAndPersistSLA: detects breach at boundary", async () => {
    const ticket = makeTicket({
      responseDueAt: new Date(Date.now() - 1000),
      responseSlaStatus: "ON_TRACK",
      firstRespondedAt: null,
    });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({});
    await evaluateAndPersistSLA(ticketId);
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.responseSlaStatus).toBe("BREACHED");
  });

  it("evaluateAndPersistSLA: detects warning at 20% threshold", async () => {
    const totalMs = 60 * 60 * 1000;
    const remainingMs = totalMs * 0.19;
    const ticket = makeTicket({
      createdAt: new Date(Date.now() - (totalMs - remainingMs)),
      responseDueAt: new Date(Date.now() + remainingMs),
      responseSlaStatus: "ON_TRACK",
      firstRespondedAt: null,
    });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.update.mockResolvedValue({});
    await evaluateAndPersistSLA(ticketId);
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.responseSlaStatus).toBe("WARNING");
  });

  it("evaluateAndPersistSLA: no update when unchanged", async () => {
    const ticket = makeTicket({
      responseDueAt: new Date(Date.now() + 60 * 60 * 1000),
      responseSlaStatus: "ON_TRACK",
      firstRespondedAt: null,
    });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    await evaluateAndPersistSLA(ticketId);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });
});

// ============================================================
// I. Time Handling
// ============================================================
describe("Part 8: Time Handling", () => {
  it("UTC consistency: deadlines calculated in UTC", async () => {
    const createdAt = new Date("2026-09-21T10:00:00Z");
    const config = makeSLAConfig({ responseTimeMinutes: 60, resolutionTimeMinutes: 120 });
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ createdAt }));
    prisma.ticket.update.mockResolvedValue({});
    await initializeTicketSLA(ticketId, org1, "MEDIUM");
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.responseDueAt.toISOString()).toBe("2026-09-21T11:00:00.000Z");
    expect(updateCall.data.resolutionDueAt.toISOString()).toBe("2026-09-21T12:00:00.000Z");
  });

  it("deadline uses wall-clock minutes, not business hours", async () => {
    const createdAt = new Date("2026-09-21T23:00:00Z");
    const config = makeSLAConfig({ responseTimeMinutes: 120 });
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ createdAt }));
    prisma.ticket.update.mockResolvedValue({});
    await initializeTicketSLA(ticketId, org1, "MEDIUM");
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.responseDueAt.toISOString()).toBe("2026-09-22T01:00:00.000Z");
  });
});

// ============================================================
// J. Security / Organization Isolation
// ============================================================
describe("Part 8: Security / Org Isolation", () => {
  it("SLA config lookup always uses correct organizationId", async () => {
    prisma.sLAConfiguration.findFirst.mockResolvedValue(null);
    await initializeTicketSLA(ticketId, org2, "HIGH");
    expect(prisma.sLAConfiguration.findFirst).toHaveBeenCalledWith({
      where: { organizationId: org2, priority: "HIGH" },
    });
  });

  it("recalculateResolutionSLA uses ticket org, not user org", async () => {
    const ticket = makeTicket({ organizationId: "org-999" });
    const config = makeSLAConfig({ organizationId: "org-999" });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.update.mockResolvedValue({});
    await recalculateResolutionSLA(ticketId, "HIGH");
    expect(prisma.sLAConfiguration.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-999", priority: "HIGH" },
    });
  });

  it("satisfyResponseSLA rejects USER role", async () => {
    prisma.ticket.findUnique.mockResolvedValue(makeTicket());
    const result = await satisfyResponseSLA(ticketId, "USER");
    expect(result).toBeNull();
  });
});

// ============================================================
// K. Ticket Lifecycle Integration
// ============================================================
describe("Part 8: Ticket Lifecycle Integration", () => {
  it("initializeTicketSLA: sets both due dates and statuses", async () => {
    const now = new Date();
    const createdAt = new Date(now.getTime() - 60_000);
    const config = makeSLAConfig({ responseTimeMinutes: 30, resolutionTimeMinutes: 240 });
    prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ createdAt }));
    prisma.ticket.update.mockResolvedValue({});
    await initializeTicketSLA(ticketId, org1, "MEDIUM");
    const updateCall = prisma.ticket.update.mock.calls[0][0];
    expect(updateCall.data.responseDueAt).toEqual(new Date(createdAt.getTime() + 30 * 60_000));
    expect(updateCall.data.resolutionDueAt).toEqual(new Date(createdAt.getTime() + 240 * 60_000));
    expect(updateCall.data.responseSlaStatus).toBe("ON_TRACK");
    expect(updateCall.data.resolutionSlaStatus).toBe("ON_TRACK");
  });

  it("completeResolutionSLA: null when ticket not found", async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);
    const result = await completeResolutionSLA("bad-id");
    expect(result).toBeNull();
  });
});

// ============================================================
// L. Failure Resilience
// ============================================================
describe("Part 8: Failure Resilience", () => {
  it("evaluateAndPersistSLA: no-op when no SLA fields configured", async () => {
    const ticket = makeTicket({ responseDueAt: null, resolutionDueAt: null });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    const result = await evaluateAndPersistSLA(ticketId);
    expect(result).toEqual(ticket);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("evaluateAndPersistSLA: null when ticket not found", async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);
    const result = await evaluateAndPersistSLA("bad-id");
    expect(result).toBeNull();
  });

  it("evaluateAndPersistSLA: skips resolution for RESOLVED tickets", async () => {
    const ticket = makeTicket({
      status: "RESOLVED",
      resolutionDueAt: new Date(Date.now() - 60 * 60 * 1000),
      resolutionSlaStatus: "ON_TRACK",
    });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    await evaluateAndPersistSLA(ticketId);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("evaluateAndPersistSLA: skips resolution for CLOSED tickets", async () => {
    const ticket = makeTicket({
      status: "CLOSED",
      resolutionDueAt: new Date(Date.now() - 60 * 60 * 1000),
      resolutionSlaStatus: "ON_TRACK",
    });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    await evaluateAndPersistSLA(ticketId);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });
});

// ============================================================
// M. computeSLAInfo Comprehensive
// ============================================================
describe("Part 8: computeSLAInfo Comprehensive", () => {
  it("null dueAt when no SLA configured", async () => {
    const ticket = makeTicket();
    const info = computeSLAInfo(ticket);
    expect(info.response.dueAt).toBeNull();
    expect(info.resolution.dueAt).toBeNull();
  });

  it("response paused override in computeSLAInfo", async () => {
    const ticket = makeTicket({
      waitingSince: new Date(),
      responseSlaStatus: "WARNING",
      responseDueAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const info = computeSLAInfo(ticket);
    expect(info.response.status).toBe("PAUSED");
  });

  it("resolution remaining is null when paused", async () => {
    const ticket = makeTicket({
      waitingSince: new Date(),
      resolutionDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const info = computeSLAInfo(ticket);
    expect(info.resolution.remainingMs).toBeNull();
  });

  it("resumedFromPause true when IN_PROGRESS and no waitingSince", async () => {
    const ticket = makeTicket({ status: "IN_PROGRESS", waitingSince: null });
    const info = computeSLAInfo(ticket);
    expect(info.resolution.resumedFromPause).toBe(true);
  });

  it("resumedFromPause false when waitingSince is set", async () => {
    const ticket = makeTicket({ status: "IN_PROGRESS", waitingSince: new Date() });
    const info = computeSLAInfo(ticket);
    expect(info.resolution.resumedFromPause).toBe(false);
  });
});

// ============================================================
// N. Warning Threshold Priority
// ============================================================
describe("Part 8: SLA Status Priority", () => {
  it("BREACHED takes priority over WARNING", async () => {
    const ticket = makeTicket({
      responseSlaStatus: "BREACHED",
      responseDueAt: new Date(Date.now() - 60 * 60 * 1000),
      firstRespondedAt: null,
    });
    const info = computeSLAInfo(ticket);
    expect(info.response.status).toBe("BREACHED");
  });

  it("PAUSED takes priority over ON_TRACK", async () => {
    const ticket = makeTicket({
      waitingSince: new Date(),
      responseSlaStatus: "ON_TRACK",
      resolutionSlaStatus: "ON_TRACK",
      responseDueAt: new Date(Date.now() + 60 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const info = computeSLAInfo(ticket);
    expect(info.response.status).toBe("PAUSED");
    expect(info.resolution.status).toBe("PAUSED");
  });

  it("COMPLETED takes priority over BREACHED", async () => {
    const ticket = makeTicket({
      firstRespondedAt: new Date(),
      responseSlaStatus: "BREACHED",
    });
    const info = computeSLAInfo(ticket);
    expect(info.response.status).toBe("COMPLETED");
  });
});