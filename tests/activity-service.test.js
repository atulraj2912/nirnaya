import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: {
      findUnique: vi.fn(),
    },
    ticketAssignmentHistory: {
      findMany: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db/prisma";
import {
  listTicketActivity,
  ActivityError,
} from "@/lib/services/activity-service";

const mockOrgId = "org-1";
const mockTicketId = "ticket-1";
const mockUserId = "user-1";

function makeUser(overrides = {}) {
  return {
    id: mockUserId,
    username: "testuser",
    role: "USER",
    status: "ACTIVE",
    organizationId: mockOrgId,
    ...overrides,
  };
}

function makeTicket(overrides = {}) {
  return {
    id: mockTicketId,
    ticketNumber: "NIR-2026-000001",
    title: "Test Ticket",
    description: "Test description",
    status: "OPEN",
    priority: "MEDIUM",
    type: "INCIDENT",
    organizationId: mockOrgId,
    departmentId: "dept-1",
    requesterId: mockUserId,
    assignedAgentId: null,
    createdById: mockUserId,
    updatedById: mockUserId,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T01:00:00Z"),
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    ...overrides,
  };
}

describe("Activity Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listTicketActivity", () => {
    it("returns ticket creation activity", async () => {
      const user = makeUser();
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticketAssignmentHistory.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([]);

      const result = await listTicketActivity(mockTicketId, user);

      expect(result.activities.length).toBeGreaterThanOrEqual(1);
      const createdActivity = result.activities.find(
        (a) => a.type === "TICKET_CREATED"
      );
      expect(createdActivity).toBeDefined();
      expect(createdActivity.description).toBe("Ticket created");
    });

    it("includes assignment history", async () => {
      const user = makeUser({ role: "AGENT", id: "agent-1" });
      const ticket = makeTicket({ status: "ASSIGNED" });
      const assignment = {
        id: "assign-1",
        ticketId: mockTicketId,
        assignedToId: "agent-1",
        assignedById: "admin-1",
        reason: "Manual assignment",
        createdAt: new Date("2026-01-01T00:30:00Z"),
        assignedTo: { id: "agent-1", username: "agent1" },
        assignedBy: { id: "admin-1", username: "admin1" },
      };

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticketAssignmentHistory.findMany.mockResolvedValue([assignment]);
      prisma.comment.findMany.mockResolvedValue([]);

      const result = await listTicketActivity(mockTicketId, user);

      const assignActivity = result.activities.find(
        (a) => a.type === "ASSIGNMENT_CHANGED"
      );
      expect(assignActivity).toBeDefined();
      expect(assignActivity.description).toContain("agent1");
      expect(assignActivity.meta.assignedToUsername).toBe("agent1");
    });

    it("includes public comments", async () => {
      const user = makeUser();
      const ticket = makeTicket();
      const comment = {
        id: "comment-1",
        ticketId: mockTicketId,
        authorId: mockUserId,
        visibility: "PUBLIC",
        content: "Test comment",
        createdAt: new Date("2026-01-01T00:15:00Z"),
        author: { id: mockUserId, username: "testuser", role: "USER" },
      };

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticketAssignmentHistory.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([comment]);

      const result = await listTicketActivity(mockTicketId, user);

      const commentActivity = result.activities.find(
        (a) => a.type === "COMMENT_ADDED"
      );
      expect(commentActivity).toBeDefined();
      expect(commentActivity.description).toContain("comment");
      expect(commentActivity.meta.commentId).toBe("comment-1");
    });

    it("excludes internal comments for USER", async () => {
      const user = makeUser({ role: "USER" });
      const ticket = makeTicket();
      const comment = {
        id: "comment-1",
        ticketId: mockTicketId,
        authorId: "agent-1",
        visibility: "INTERNAL",
        content: "Internal note",
        createdAt: new Date("2026-01-01T00:15:00Z"),
        author: { id: "agent-1", username: "agent1", role: "AGENT" },
      };

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticketAssignmentHistory.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([comment]);

      const result = await listTicketActivity(mockTicketId, user);

      const commentActivity = result.activities.find(
        (a) => a.type === "COMMENT_ADDED"
      );
      expect(commentActivity).toBeUndefined();
    });

    it("includes internal comments for AGENT", async () => {
      const user = makeUser({ role: "AGENT", id: "agent-1" });
      const ticket = makeTicket();
      const comment = {
        id: "comment-1",
        ticketId: mockTicketId,
        authorId: "agent-1",
        visibility: "INTERNAL",
        content: "Internal note",
        createdAt: new Date("2026-01-01T00:15:00Z"),
        author: { id: "agent-1", username: "agent1", role: "AGENT" },
      };

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticketAssignmentHistory.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([comment]);

      const result = await listTicketActivity(mockTicketId, user);

      const commentActivity = result.activities.find(
        (a) => a.type === "COMMENT_ADDED"
      );
      expect(commentActivity).toBeDefined();
      expect(commentActivity.meta.visibility).toBe("INTERNAL");
    });

    it("includes SLA response activity when firstRespondedAt is set", async () => {
      const user = makeUser();
      const ticket = makeTicket({
        firstRespondedAt: new Date("2026-01-01T00:10:00Z"),
      });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticketAssignmentHistory.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([]);

      const result = await listTicketActivity(mockTicketId, user);

      const slaActivity = result.activities.find(
        (a) => a.type === "SLA_RESPONDED"
      );
      expect(slaActivity).toBeDefined();
      expect(slaActivity.description).toBe("Response SLA satisfied");
    });

    it("includes resolution activity when resolvedAt is set", async () => {
      const user = makeUser();
      const ticket = makeTicket({
        status: "RESOLVED",
        resolvedAt: new Date("2026-01-01T02:00:00Z"),
      });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticketAssignmentHistory.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([]);

      const result = await listTicketActivity(mockTicketId, user);

      const resolvedActivity = result.activities.find(
        (a) => a.type === "TICKET_RESOLVED"
      );
      expect(resolvedActivity).toBeDefined();
      expect(resolvedActivity.description).toBe("Ticket resolved");
    });

    it("includes closure activity when closedAt is set", async () => {
      const user = makeUser();
      const ticket = makeTicket({
        status: "CLOSED",
        resolvedAt: new Date("2026-01-01T02:00:00Z"),
        closedAt: new Date("2026-01-01T03:00:00Z"),
      });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticketAssignmentHistory.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([]);

      const result = await listTicketActivity(mockTicketId, user);

      const closedActivity = result.activities.find(
        (a) => a.type === "TICKET_CLOSED"
      );
      expect(closedActivity).toBeDefined();
      expect(closedActivity.description).toBe("Ticket closed");
    });

    it("orders activities by timestamp descending (newest first)", async () => {
      const user = makeUser();
      const ticket = makeTicket({
        resolvedAt: new Date("2026-01-01T02:00:00Z"),
      });
      const comment = {
        id: "comment-1",
        ticketId: mockTicketId,
        authorId: mockUserId,
        visibility: "PUBLIC",
        content: "Comment",
        createdAt: new Date("2026-01-01T00:15:00Z"),
        author: { id: mockUserId, username: "testuser", role: "USER" },
      };

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticketAssignmentHistory.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([comment]);

      const result = await listTicketActivity(mockTicketId, user);

      for (let i = 1; i < result.activities.length; i++) {
        const prev = new Date(result.activities[i - 1].timestamp).getTime();
        const curr = new Date(result.activities[i].timestamp).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it("rejects nonexistent ticket", async () => {
      const user = makeUser();

      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(listTicketActivity("nonexistent", user)).rejects.toThrow(
        ActivityError
      );
    });

    it("rejects cross-organization ticket", async () => {
      const user = makeUser();
      const ticket = makeTicket({ organizationId: "other-org" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(listTicketActivity(mockTicketId, user)).rejects.toThrow(
        ActivityError
      );
    });

    it("rejects USER accessing another user's ticket", async () => {
      const user = makeUser({ id: "user-1" });
      const ticket = makeTicket({ requesterId: "user-2" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(listTicketActivity(mockTicketId, user)).rejects.toThrow(
        ActivityError
      );
    });

    it("supports pagination", async () => {
      const user = makeUser();
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticketAssignmentHistory.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([]);

      const result = await listTicketActivity(mockTicketId, user, {
        page: 1,
        limit: 1,
      });

      expect(result.activities.length).toBeLessThanOrEqual(1);
      expect(result.limit).toBe(1);
      expect(result.page).toBe(1);
    });

    it("returns pagination metadata", async () => {
      const user = makeUser();
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticketAssignmentHistory.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([]);

      const result = await listTicketActivity(mockTicketId, user);

      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("page");
      expect(result).toHaveProperty("limit");
      expect(result).toHaveProperty("totalPages");
    });

    it("includes status change activity", async () => {
      const user = makeUser({ role: "AGENT", id: "agent-1" });
      const ticket = makeTicket({ status: "IN_PROGRESS" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticketAssignmentHistory.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([]);

      const result = await listTicketActivity(mockTicketId, user);

      const statusActivity = result.activities.find(
        (a) => a.type === "STATUS_CHANGED"
      );
      expect(statusActivity).toBeDefined();
      expect(statusActivity.meta.to).toBe("IN_PROGRESS");
    });
  });
});
