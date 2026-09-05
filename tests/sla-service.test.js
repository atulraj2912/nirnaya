import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    sLAConfiguration: {
      findFirst: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db/prisma";
import {
  computeSLAInfo,
  initializeTicketSLA,
  pauseSLA,
  resumeSLA,
  completeResolutionSLA,
  satisfyResponseSLA,
  recalculateResolutionSLA,
  reopenSLA,
  evaluateAndPersistSLA,
} from "@/lib/services/sla-service";

const mockOrgId = "org-1";
const mockTicketId = "ticket-1";

function makeTicket(overrides = {}) {
  const now = new Date();
  const createdAt = new Date(now.getTime() - 3600000);
  return {
    id: mockTicketId,
    ticketNumber: "NIR-2026-000001",
    title: "Test",
    description: "Desc",
    status: "OPEN",
    priority: "MEDIUM",
    type: "INCIDENT",
    organizationId: mockOrgId,
    departmentId: "dept-1",
    requesterId: "user-1",
    assignedAgentId: null,
    createdAt,
    updatedAt: now,
    responseSlaStatus: "ON_TRACK",
    resolutionSlaStatus: "ON_TRACK",
    responseDueAt: new Date(createdAt.getTime() + 60 * 60000),
    resolutionDueAt: new Date(createdAt.getTime() + 240 * 60000),
    firstRespondedAt: null,
    waitingSince: null,
    resolvedAt: null,
    closedAt: null,
    ...overrides,
  };
}

function makeSLAConfig(overrides = {}) {
  return {
    id: "sla-1",
    organizationId: mockOrgId,
    priority: "MEDIUM",
    responseTimeMinutes: 60,
    resolutionTimeMinutes: 240,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("SLA Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("computeSLAInfo", () => {
    it("returns response and resolution SLA info for active ticket", () => {
      const ticket = makeTicket();
      const info = computeSLAInfo(ticket);

      expect(info.response.status).toBe("ON_TRACK");
      expect(info.response.met).toBe(false);
      expect(info.resolution.status).toBe("ON_TRACK");
      expect(info.resolution.met).toBe(false);
    });

    it("marks response as met when firstRespondedAt is set", () => {
      const ticket = makeTicket({ firstRespondedAt: new Date() });
      const info = computeSLAInfo(ticket);

      expect(info.response.met).toBe(true);
      expect(info.response.status).toBe("COMPLETED");
    });

    it("marks resolution as met when status is RESOLVED", () => {
      const ticket = makeTicket({ status: "RESOLVED", resolvedAt: new Date() });
      const info = computeSLAInfo(ticket);

      expect(info.resolution.met).toBe(true);
    });

    it("marks resolution as met when status is CLOSED", () => {
      const ticket = makeTicket({ status: "CLOSED", closedAt: new Date() });
      const info = computeSLAInfo(ticket);

      expect(info.resolution.met).toBe(true);
    });

    it("returns null remainingMs for response when firstRespondedAt is set", () => {
      const ticket = makeTicket({ firstRespondedAt: new Date() });
      const info = computeSLAInfo(ticket);

      expect(info.response.remainingMs).toBeNull();
    });

    it("returns null remainingMs for resolution when ticket is resolved", () => {
      const ticket = makeTicket({ status: "RESOLVED" });
      const info = computeSLAInfo(ticket);

      expect(info.resolution.remainingMs).toBeNull();
    });

    it("returns paused info when waitingSince is set", () => {
      const ticket = makeTicket({ waitingSince: new Date() });
      const info = computeSLAInfo(ticket);

      expect(info.resolution.pausedAt).not.toBeNull();
      expect(info.resolution.remainingMs).toBeNull();
    });

    it("returns null dueAt when no SLA configured", () => {
      const ticket = makeTicket({ responseDueAt: null, resolutionDueAt: null });
      const info = computeSLAInfo(ticket);

      expect(info.response.dueAt).toBeNull();
      expect(info.resolution.dueAt).toBeNull();
    });
  });

  describe("initializeTicketSLA", () => {
    it("sets SLA deadlines from config", async () => {
      const config = makeSLAConfig();
      const ticket = makeTicket();

      prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await initializeTicketSLA(mockTicketId, mockOrgId, "MEDIUM");

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: expect.objectContaining({
          responseSlaStatus: expect.any(String),
          resolutionSlaStatus: expect.any(String),
          responseDueAt: expect.any(Date),
          resolutionDueAt: expect.any(Date),
        }),
      });
    });

    it("returns empty object when no config found", async () => {
      prisma.sLAConfiguration.findFirst.mockResolvedValue(null);

      const result = await initializeTicketSLA(mockTicketId, mockOrgId, "MEDIUM");

      expect(result).toEqual({});
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it("calculates response due from createdAt + responseTimeMinutes", async () => {
      const createdAt = new Date("2026-09-01T10:00:00Z");
      const config = makeSLAConfig({ responseTimeMinutes: 60 });
      const ticket = makeTicket({ createdAt });

      prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await initializeTicketSLA(mockTicketId, mockOrgId, "MEDIUM");

      const updateCall = prisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.responseDueAt).toEqual(new Date("2026-09-01T11:00:00Z"));
    });

    it("calculates resolution due from createdAt + resolutionTimeMinutes", async () => {
      const createdAt = new Date("2026-09-01T10:00:00Z");
      const config = makeSLAConfig({ resolutionTimeMinutes: 240 });
      const ticket = makeTicket({ createdAt });

      prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await initializeTicketSLA(mockTicketId, mockOrgId, "MEDIUM");

      const updateCall = prisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.resolutionDueAt).toEqual(new Date("2026-09-01T14:00:00Z"));
    });
  });

  describe("pauseSLA", () => {
    it("sets waitingSince and pauses both SLA clocks", async () => {
      const ticket = makeTicket();
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await pauseSLA(mockTicketId);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: expect.objectContaining({
          waitingSince: expect.any(Date),
          responseSlaStatus: "PAUSED",
          resolutionSlaStatus: "PAUSED",
        }),
      });
    });

    it("preserves COMPLETED status on response SLA when pausing", async () => {
      const ticket = makeTicket({ responseSlaStatus: "COMPLETED" });
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await pauseSLA(mockTicketId);

      const updateCall = prisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.responseSlaStatus).toBe("COMPLETED");
      expect(updateCall.data.resolutionSlaStatus).toBe("PAUSED");
    });

    it("preserves COMPLETED status on resolution SLA when pausing", async () => {
      const ticket = makeTicket({ resolutionSlaStatus: "COMPLETED" });
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await pauseSLA(mockTicketId);

      const updateCall = prisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.responseSlaStatus).toBe("PAUSED");
      expect(updateCall.data.resolutionSlaStatus).toBe("COMPLETED");
    });

    it("returns null when ticket not found", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      const result = await pauseSLA("nonexistent");

      expect(result).toBeNull();
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });
  });

  describe("resumeSLA", () => {
    it("clears waitingSince and recalculates resolution status", async () => {
      const ticket = makeTicket({ waitingSince: new Date() });
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await resumeSLA(mockTicketId);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: expect.objectContaining({
          waitingSince: null,
          resolutionSlaStatus: expect.any(String),
        }),
      });
    });

    it("returns null when ticket not found", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      const result = await resumeSLA("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("completeResolutionSLA", () => {
    it("sets resolvedAt and marks resolution as COMPLETED", async () => {
      const ticket = makeTicket();
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await completeResolutionSLA(mockTicketId);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: expect.objectContaining({
          resolvedAt: expect.any(Date),
          resolutionSlaStatus: "COMPLETED",
        }),
      });
    });

    it("returns null when ticket not found", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      const result = await completeResolutionSLA("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("satisfyResponseSLA", () => {
    it("sets firstRespondedAt and marks response as COMPLETED for AGENT", async () => {
      const ticket = makeTicket();
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await satisfyResponseSLA(mockTicketId, "AGENT");

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: expect.objectContaining({
          firstRespondedAt: expect.any(Date),
          responseSlaStatus: "COMPLETED",
        }),
      });
    });

    it("satisfies response SLA for ADMIN role", async () => {
      const ticket = makeTicket();
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await satisfyResponseSLA(mockTicketId, "ADMIN");

      expect(prisma.ticket.update).toHaveBeenCalled();
    });

    it("does not satisfy response SLA for USER role", async () => {
      const ticket = makeTicket();
      prisma.ticket.findUnique.mockResolvedValue(ticket);

      const result = await satisfyResponseSLA(mockTicketId, "USER");

      expect(result).toBeNull();
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it("does not re-satisfy if already satisfied", async () => {
      const ticket = makeTicket({ firstRespondedAt: new Date() });
      prisma.ticket.findUnique.mockResolvedValue(ticket);

      const result = await satisfyResponseSLA(mockTicketId, "AGENT");

      expect(result).toBeNull();
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it("returns null when ticket not found", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      const result = await satisfyResponseSLA("nonexistent", "AGENT");

      expect(result).toBeNull();
    });
  });

  describe("recalculateResolutionSLA", () => {
    it("recalculates resolution due from original createdAt with new priority config", async () => {
      const createdAt = new Date("2026-09-01T10:00:00Z");
      const newConfig = makeSLAConfig({
        priority: "HIGH",
        resolutionTimeMinutes: 120,
      });
      const ticket = makeTicket({ createdAt, priority: "MEDIUM" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.sLAConfiguration.findFirst.mockResolvedValue(newConfig);
      prisma.ticket.update.mockResolvedValue(ticket);

      await recalculateResolutionSLA(mockTicketId, "HIGH");

      const updateCall = prisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.resolutionDueAt).toEqual(new Date("2026-09-01T12:00:00Z"));
    });

    it("returns null when ticket not found", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      const result = await recalculateResolutionSLA("nonexistent", "HIGH");

      expect(result).toBeNull();
    });

    it("returns null when no config for new priority", async () => {
      const ticket = makeTicket();
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.sLAConfiguration.findFirst.mockResolvedValue(null);

      const result = await recalculateResolutionSLA(mockTicketId, "CRITICAL");

      expect(result).toBeNull();
    });

    it("sets BREACHED when recalculated deadline is in the past", async () => {
      const createdAt = new Date("2026-09-01T10:00:00Z");
      const config = makeSLAConfig({ resolutionTimeMinutes: 30 });
      const ticket = makeTicket({ createdAt });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
      prisma.ticket.update.mockResolvedValue(ticket);

      await recalculateResolutionSLA(mockTicketId, "MEDIUM");

      const updateCall = prisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.resolutionSlaStatus).toBe("BREACHED");
    });
  });

  describe("reopenSLA", () => {
    it("resets resolution SLA to ON_TRACK with new deadline", async () => {
      const createdAt = new Date("2026-09-01T10:00:00Z");
      const config = makeSLAConfig({ resolutionTimeMinutes: 240 });
      const ticket = makeTicket({ createdAt, status: "RESOLVED" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
      prisma.ticket.update.mockResolvedValue(ticket);

      await reopenSLA(mockTicketId);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: expect.objectContaining({
          resolvedAt: null,
          resolutionSlaStatus: "ON_TRACK",
          resolutionDueAt: expect.any(Date),
        }),
      });
    });

    it("returns null when ticket not found", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      const result = await reopenSLA("nonexistent");

      expect(result).toBeNull();
    });

    it("returns null when no SLA config found", async () => {
      const ticket = makeTicket();
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.sLAConfiguration.findFirst.mockResolvedValue(null);

      const result = await reopenSLA(mockTicketId);

      expect(result).toBeNull();
    });
  });

  describe("evaluateAndPersistSLA", () => {
    it("returns ticket unchanged when no SLA configured", async () => {
      const ticket = makeTicket({ responseDueAt: null, resolutionDueAt: null });
      prisma.ticket.findUnique.mockResolvedValue(ticket);

      const result = await evaluateAndPersistSLA(mockTicketId);

      expect(result).toEqual(ticket);
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it("marks response as BREACHED when dueAt is in the past", async () => {
      const past = new Date(Date.now() - 3600000);
      const ticket = makeTicket({
        responseDueAt: past,
        responseSlaStatus: "ON_TRACK",
      });
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await evaluateAndPersistSLA(mockTicketId);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: expect.objectContaining({
          responseSlaStatus: "BREACHED",
        }),
      });
    });

    it("marks response as WARNING when within 20% of deadline", async () => {
      const now = new Date();
      const totalMs = 60 * 60000;
      const remaining = totalMs * 0.15;
      const responseDueAt = new Date(now.getTime() + remaining);
      const createdAt = new Date(now.getTime() - (totalMs - remaining));

      const ticket = makeTicket({
        createdAt,
        responseDueAt,
        responseSlaStatus: "ON_TRACK",
      });
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await evaluateAndPersistSLA(mockTicketId);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: expect.objectContaining({
          responseSlaStatus: "WARNING",
        }),
      });
    });

    it("does not update when statuses are already correct", async () => {
      const future = new Date(Date.now() + 3600000);
      const ticket = makeTicket({
        responseDueAt: future,
        resolutionDueAt: future,
        responseSlaStatus: "ON_TRACK",
        resolutionSlaStatus: "ON_TRACK",
      });
      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await evaluateAndPersistSLA(mockTicketId);

      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it("returns null when ticket not found", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      const result = await evaluateAndPersistSLA("nonexistent");

      expect(result).toBeNull();
    });

    it("skips resolution evaluation for RESOLVED tickets", async () => {
      const future = new Date(Date.now() + 3600000);
      const ticket = makeTicket({
        status: "RESOLVED",
        resolutionDueAt: future,
        responseDueAt: future,
        resolutionSlaStatus: "ON_TRACK",
        responseSlaStatus: "ON_TRACK",
      });
      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await evaluateAndPersistSLA(mockTicketId);

      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it("skips resolution evaluation for CLOSED tickets", async () => {
      const future = new Date(Date.now() + 3600000);
      const ticket = makeTicket({
        status: "CLOSED",
        resolutionDueAt: future,
        responseDueAt: future,
        resolutionSlaStatus: "ON_TRACK",
        responseSlaStatus: "ON_TRACK",
      });
      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await evaluateAndPersistSLA(mockTicketId);

      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });
  });

  describe("org isolation", () => {
    it("queries SLA config with correct org ID", async () => {
      const config = makeSLAConfig();
      const ticket = makeTicket({ organizationId: "org-2" });

      prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await initializeTicketSLA(mockTicketId, "org-2", "MEDIUM");

      expect(prisma.sLAConfiguration.findFirst).toHaveBeenCalledWith({
        where: { organizationId: "org-2", priority: "MEDIUM" },
      });
    });
  });

  describe("edge cases", () => {
    it("handles ticket with no createdAt gracefully", async () => {
      const config = makeSLAConfig();
      const ticket = makeTicket({ createdAt: new Date() });

      prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await initializeTicketSLA(mockTicketId, mockOrgId, "MEDIUM");

      expect(prisma.ticket.update).toHaveBeenCalled();
    });

    it("handles very short SLA window (1 minute)", async () => {
      const createdAt = new Date("2026-09-01T10:00:00Z");
      const config = makeSLAConfig({ responseTimeMinutes: 1, resolutionTimeMinutes: 1 });
      const ticket = makeTicket({ createdAt });

      prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await initializeTicketSLA(mockTicketId, mockOrgId, "MEDIUM");

      const updateCall = prisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.responseDueAt).toEqual(new Date("2026-09-01T10:01:00Z"));
      expect(updateCall.data.resolutionDueAt).toEqual(new Date("2026-09-01T10:01:00Z"));
    });

    it("handles very long SLA window (30 days)", async () => {
      const createdAt = new Date("2026-09-01T10:00:00Z");
      const config = makeSLAConfig({
        responseTimeMinutes: 60,
        resolutionTimeMinutes: 30 * 24 * 60,
      });
      const ticket = makeTicket({ createdAt });

      prisma.sLAConfiguration.findFirst.mockResolvedValue(config);
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(ticket);

      await initializeTicketSLA(mockTicketId, mockOrgId, "MEDIUM");

      const updateCall = prisma.ticket.update.mock.calls[0][0];
      const expectedMs = 30 * 24 * 60 * 60 * 1000;
      const expectedDue = new Date(createdAt.getTime() + expectedMs);
      expect(updateCall.data.resolutionDueAt).toEqual(expectedDue);
    });
  });
});
