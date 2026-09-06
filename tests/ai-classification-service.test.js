import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    department: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    aIPrediction: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn().mockReturnValue({
    AI_PROVIDER: "mock",
  }),
}));

import prisma from "@/lib/db/prisma";
import {
  classifyTicket,
  getPredictions,
  getLatestPrediction,
  applyPrediction,
} from "@/lib/services/ai-classification-service";

const mockUser = {
  id: "user-1",
  role: "AGENT",
  organizationId: "org-1",
};

const mockTicket = {
  id: "ticket-1",
  title: "WiFi not working",
  description: "Cannot connect to wifi network",
  type: "INCIDENT",
  source: "WEB",
  organizationId: "org-1",
  department: { name: "IT Support" },
  category: null,
};

describe("AI classification service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("classifyTicket", () => {
    it("creates prediction for valid ticket", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.category.findFirst.mockResolvedValue({ id: "cat-1", name: "NETWORK" });
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.aIPrediction.create.mockResolvedValue({
        id: "pred-1",
        ticketId: "ticket-1",
        predictedCategoryId: "cat-1",
        predictedPriority: "MEDIUM",
        confidence: 0.7,
      });

      const { prediction, error } = await classifyTicket("ticket-1", mockUser);

      expect(error).toBeNull();
      expect(prediction).not.toBeNull();
      expect(prediction.ticketId).toBe("ticket-1");
      expect(prisma.aIPrediction.create).toHaveBeenCalled();
    });

    it("returns error for non-existent ticket", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      const { prediction, error } = await classifyTicket("bad-id", mockUser);

      expect(prediction).toBeNull();
      expect(error).toBe("Ticket not found");
    });

    it("returns error for cross-org ticket", async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...mockTicket,
        organizationId: "org-2",
      });

      const { prediction, error } = await classifyTicket("ticket-1", mockUser);

      expect(prediction).toBeNull();
      expect(error).toBe("Ticket not found");
    });

    it("resolves predicted category to real Category ID", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.category.findFirst.mockResolvedValue({ id: "cat-network", name: "NETWORK" });
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.aIPrediction.create.mockResolvedValue({ id: "pred-1" });

      await classifyTicket("ticket-1", mockUser);

      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          name: "NETWORK",
          isActive: true,
        },
      });
    });

    it("sets predictedCategoryId to null when category not found in org", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.aIPrediction.create.mockResolvedValue({ id: "pred-1" });

      await classifyTicket("ticket-1", mockUser);

      const createCall = prisma.aIPrediction.create.mock.calls[0][0];
      expect(createCall.data.predictedCategoryId).toBeNull();
    });

    it("handles provider failure gracefully", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);

      // Force a classification failure by mocking the classifier
      const { classify: originalClassify } = await import("@/lib/ai/classifier");
      vi.spyOn(await import("@/lib/ai/classifier"), "classify").mockRejectedValue(
        new Error("Provider failed")
      );

      const { prediction, error } = await classifyTicket("ticket-1", mockUser);

      expect(prediction).toBeNull();
      expect(error).toBe("Classification failed");
    });
  });

  describe("getPredictions", () => {
    it("returns predictions for ticket in same org", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ organizationId: "org-1" });
      prisma.aIPrediction.findMany.mockResolvedValue([
        { id: "pred-1", ticketId: "ticket-1", confidence: 0.8 },
      ]);

      const predictions = await getPredictions("ticket-1", mockUser);

      expect(predictions).toHaveLength(1);
      expect(prisma.aIPrediction.findMany).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns empty array for cross-org ticket", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ organizationId: "org-2" });

      const predictions = await getPredictions("ticket-1", mockUser);

      expect(predictions).toEqual([]);
    });

    it("returns empty array for non-existent ticket", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      const predictions = await getPredictions("bad-id", mockUser);

      expect(predictions).toEqual([]);
    });
  });

  describe("getLatestPrediction", () => {
    it("returns most recent prediction", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ organizationId: "org-1" });
      prisma.aIPrediction.findMany.mockResolvedValue([
        { id: "pred-2", confidence: 0.9 },
        { id: "pred-1", confidence: 0.7 },
      ]);

      const latest = await getLatestPrediction("ticket-1", mockUser);

      expect(latest.id).toBe("pred-2");
    });

    it("returns null when no predictions exist", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ organizationId: "org-1" });
      prisma.aIPrediction.findMany.mockResolvedValue([]);

      const latest = await getLatestPrediction("ticket-1", mockUser);

      expect(latest).toBeNull();
    });
  });

  describe("applyPrediction", () => {
    it("applies prediction to ticket", async () => {
      prisma.ticket.findUnique
        .mockResolvedValueOnce({ id: "ticket-1", organizationId: "org-1" })
        .mockResolvedValueOnce({
          id: "ticket-1",
          department: { id: "dept-1", name: "IT", code: "IT" },
          category: { id: "cat-1", name: "NETWORK" },
          requester: { id: "user-1", username: "test" },
          assignedAgent: null,
        });
      prisma.aIPrediction.findUnique.mockResolvedValue({
        id: "pred-1",
        ticketId: "ticket-1",
        predictedCategoryId: "cat-1",
        predictedPriority: "HIGH",
        predictedDepartmentId: null,
      });
      prisma.category.findFirst.mockResolvedValue({ id: "cat-1", name: "NETWORK" });
      prisma.ticket.update.mockResolvedValue({});

      const { ticket, error } = await applyPrediction("ticket-1", "pred-1", mockUser);

      expect(error).toBeNull();
      expect(ticket).not.toBeNull();
      expect(prisma.ticket.update).toHaveBeenCalled();
      const updateCall = prisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.categoryId).toBe("cat-1");
      expect(updateCall.data.priority).toBe("HIGH");
      expect(updateCall.data.departmentId).toBeUndefined();
    });

    it("returns error for non-existent ticket", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      const { ticket, error } = await applyPrediction("bad-id", "pred-1", mockUser);

      expect(ticket).toBeNull();
      expect(error).toBe("Ticket not found");
    });

    it("returns error for non-existent prediction", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
      prisma.aIPrediction.findUnique.mockResolvedValue(null);

      const { ticket, error } = await applyPrediction("ticket-1", "bad-pred", mockUser);

      expect(ticket).toBeNull();
      expect(error).toBe("Prediction not found");
    });

    it("returns error for prediction belonging to different ticket", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
      prisma.aIPrediction.findUnique.mockResolvedValue({
        id: "pred-1",
        ticketId: "ticket-2",
      });

      const { ticket, error } = await applyPrediction("ticket-1", "pred-1", mockUser);

      expect(ticket).toBeNull();
      expect(error).toBe("Prediction not found");
    });

    it("skips stale category ID that no longer exists in org", async () => {
      prisma.ticket.findUnique
        .mockResolvedValueOnce({ id: "ticket-1", organizationId: "org-1" })
        .mockResolvedValueOnce({
          id: "ticket-1",
          department: null,
          category: null,
          requester: null,
          assignedAgent: null,
        });
      prisma.aIPrediction.findUnique.mockResolvedValue({
        id: "pred-1",
        ticketId: "ticket-1",
        predictedCategoryId: "cat-deleted",
        predictedPriority: "HIGH",
        predictedDepartmentId: "dept-deleted",
      });
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.ticket.update.mockResolvedValue({});

      const { ticket, error } = await applyPrediction("ticket-1", "pred-1", mockUser);

      expect(error).toBeNull();
      expect(ticket).not.toBeNull();
      const updateCall = prisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.categoryId).toBeUndefined();
      expect(updateCall.data.departmentId).toBeUndefined();
      expect(updateCall.data.priority).toBe("HIGH");
    });
  });
});
