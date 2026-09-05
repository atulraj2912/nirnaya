import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: {
      findUnique: vi.fn(),
    },
    comment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    watcher: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((fns) => fns),
  },
}));

vi.mock("@/lib/services/sla-service", () => ({
  satisfyResponseSLA: vi.fn(),
}));

vi.mock("@/lib/services/notification-service", () => ({
  notifyCommentAdded: vi.fn().mockResolvedValue({}),
}));

import prisma from "@/lib/db/prisma";
import {
  createComment,
  listTicketComments,
  getComment,
  CommentError,
} from "@/lib/services/comment-service";
import { satisfyResponseSLA } from "@/lib/services/sla-service";
import { notifyCommentAdded } from "@/lib/services/notification-service";

const mockOrgId = "org-1";
const mockTicketId = "ticket-1";
const mockUserId = "user-1";

function makeUser(overrides = {}) {
  return {
    id: mockUserId,
    username: "testuser",
    email: "test@example.com",
    role: "USER",
    status: "ACTIVE",
    organizationId: mockOrgId,
    departmentId: "dept-1",
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeComment(overrides = {}) {
  return {
    id: "comment-1",
    content: "Test comment",
    visibility: "PUBLIC",
    ticketId: mockTicketId,
    authorId: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: { id: mockUserId, username: "testuser", role: "USER", avatarUrl: null },
    ...overrides,
  };
}

describe("Comment Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createComment", () => {
    it("creates a PUBLIC comment for USER on own ticket", async () => {
      const user = makeUser();
      const ticket = makeTicket();
      const comment = makeComment();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.create.mockResolvedValue(comment);
      prisma.watcher.findMany.mockResolvedValue([]);

      const result = await createComment(
        { ticketId: mockTicketId, content: "Test comment", visibility: "PUBLIC" },
        user
      );

      expect(result.content).toBe("Test comment");
      expect(result.visibility).toBe("PUBLIC");
      expect(prisma.comment.create).toHaveBeenCalled();
    });

    it("rejects empty comment", async () => {
      const user = makeUser();
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(
        createComment({ ticketId: mockTicketId, content: "", visibility: "PUBLIC" }, user)
      ).rejects.toThrow(CommentError);
    });

    it("rejects whitespace-only comment", async () => {
      const user = makeUser();
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(
        createComment({ ticketId: mockTicketId, content: "   ", visibility: "PUBLIC" }, user)
      ).rejects.toThrow(CommentError);
    });

    it("rejects comment exceeding max length", async () => {
      const user = makeUser();
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(
        createComment(
          { ticketId: mockTicketId, content: "x".repeat(10001), visibility: "PUBLIC" },
          user
        )
      ).rejects.toThrow(CommentError);
    });

    it("rejects invalid visibility", async () => {
      const user = makeUser();
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(
        createComment(
          { ticketId: mockTicketId, content: "Test", visibility: "INVALID" },
          user
        )
      ).rejects.toThrow(CommentError);
    });

    it("rejects nonexistent ticket", async () => {
      const user = makeUser();

      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        createComment({ ticketId: "nonexistent", content: "Test", visibility: "PUBLIC" }, user)
      ).rejects.toThrow(CommentError);
    });

    it("rejects cross-organization ticket", async () => {
      const user = makeUser();
      const ticket = makeTicket({ organizationId: "other-org" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(
        createComment({ ticketId: mockTicketId, content: "Test", visibility: "PUBLIC" }, user)
      ).rejects.toThrow(CommentError);
    });

    it("rejects USER accessing another user's ticket", async () => {
      const user = makeUser({ id: "user-1" });
      const ticket = makeTicket({ requesterId: "user-2" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(
        createComment({ ticketId: mockTicketId, content: "Test", visibility: "PUBLIC" }, user)
      ).rejects.toThrow(CommentError);
    });

    it("rejects USER creating INTERNAL comment", async () => {
      const user = makeUser({ role: "USER" });
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(
        createComment(
          { ticketId: mockTicketId, content: "Test", visibility: "INTERNAL" },
          user
        )
      ).rejects.toThrow(CommentError);
    });

    it("allows AGENT to create INTERNAL comment", async () => {
      const user = makeUser({ role: "AGENT", id: "agent-1" });
      const ticket = makeTicket();
      const comment = makeComment({ visibility: "INTERNAL", authorId: "agent-1" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.create.mockResolvedValue(comment);
      prisma.watcher.findMany.mockResolvedValue([]);

      const result = await createComment(
        { ticketId: mockTicketId, content: "Internal note", visibility: "INTERNAL" },
        user
      );

      expect(result.visibility).toBe("INTERNAL");
    });

    it("allows ADMIN to create INTERNAL comment", async () => {
      const user = makeUser({ role: "ADMIN", id: "admin-1" });
      const ticket = makeTicket();
      const comment = makeComment({ visibility: "INTERNAL", authorId: "admin-1" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.create.mockResolvedValue(comment);
      prisma.watcher.findMany.mockResolvedValue([]);

      const result = await createComment(
        { ticketId: mockTicketId, content: "Admin note", visibility: "INTERNAL" },
        user
      );

      expect(result.visibility).toBe("INTERNAL");
    });

    it("trims comment content", async () => {
      const user = makeUser();
      const ticket = makeTicket();
      const comment = makeComment({ content: "trimmed" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.create.mockResolvedValue(comment);
      prisma.watcher.findMany.mockResolvedValue([]);

      await createComment(
        { ticketId: mockTicketId, content: "  trimmed  ", visibility: "PUBLIC" },
        user
      );

      expect(prisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: "trimmed" }),
        })
      );
    });

    it("satisfies response SLA for AGENT PUBLIC comment", async () => {
      const user = makeUser({ role: "AGENT", id: "agent-1" });
      const ticket = makeTicket();
      const comment = makeComment({ authorId: "agent-1" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.create.mockResolvedValue(comment);
      prisma.watcher.findMany.mockResolvedValue([]);
      satisfyResponseSLA.mockResolvedValue({});

      await createComment(
        { ticketId: mockTicketId, content: "Response", visibility: "PUBLIC" },
        user
      );

      expect(satisfyResponseSLA).toHaveBeenCalledWith(mockTicketId, "AGENT");
    });

    it("satisfies response SLA for ADMIN PUBLIC comment", async () => {
      const user = makeUser({ role: "ADMIN", id: "admin-1" });
      const ticket = makeTicket();
      const comment = makeComment({ authorId: "admin-1" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.create.mockResolvedValue(comment);
      prisma.watcher.findMany.mockResolvedValue([]);
      satisfyResponseSLA.mockResolvedValue({});

      await createComment(
        { ticketId: mockTicketId, content: "Response", visibility: "PUBLIC" },
        user
      );

      expect(satisfyResponseSLA).toHaveBeenCalledWith(mockTicketId, "ADMIN");
    });

    it("does NOT satisfy response SLA for USER PUBLIC comment", async () => {
      const user = makeUser({ role: "USER" });
      const ticket = makeTicket();
      const comment = makeComment();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.create.mockResolvedValue(comment);
      prisma.watcher.findMany.mockResolvedValue([]);

      await createComment(
        { ticketId: mockTicketId, content: "User comment", visibility: "PUBLIC" },
        user
      );

      expect(satisfyResponseSLA).not.toHaveBeenCalled();
    });

    it("does NOT satisfy response SLA for INTERNAL comment", async () => {
      const user = makeUser({ role: "AGENT", id: "agent-1" });
      const ticket = makeTicket();
      const comment = makeComment({ visibility: "INTERNAL", authorId: "agent-1" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.create.mockResolvedValue(comment);
      prisma.watcher.findMany.mockResolvedValue([]);

      await createComment(
        { ticketId: mockTicketId, content: "Internal", visibility: "INTERNAL" },
        user
      );

      expect(satisfyResponseSLA).not.toHaveBeenCalled();
    });

    it("notifies ticket requester about new comment", async () => {
      const user = makeUser({ id: "agent-1", role: "AGENT" });
      const ticket = makeTicket({ requesterId: "requester-1" });
      const comment = makeComment({ authorId: "agent-1" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.create.mockResolvedValue(comment);
      prisma.watcher.findMany.mockResolvedValue([]);
      satisfyResponseSLA.mockResolvedValue({});
      notifyCommentAdded.mockResolvedValue({});

      await createComment(
        { ticketId: mockTicketId, content: "Response", visibility: "PUBLIC" },
        user
      );

      expect(notifyCommentAdded).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: "requester-1",
        })
      );
    });

    it("notifies watchers about new comment", async () => {
      const user = makeUser({ id: "agent-1", role: "AGENT" });
      const ticket = makeTicket({ requesterId: "requester-1" });
      const comment = makeComment({ authorId: "agent-1" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.create.mockResolvedValue(comment);
      prisma.watcher.findMany.mockResolvedValue([
        { userId: "watcher-1" },
        { userId: "watcher-2" },
      ]);
      satisfyResponseSLA.mockResolvedValue({});
      notifyCommentAdded.mockResolvedValue({});

      await createComment(
        { ticketId: mockTicketId, content: "Response", visibility: "PUBLIC" },
        user
      );

      expect(notifyCommentAdded).toHaveBeenCalledTimes(3);
    });

    it("does not notify author about own comment", async () => {
      const user = makeUser({ id: "user-1" });
      const ticket = makeTicket({ requesterId: "user-1" });
      const comment = makeComment({ authorId: "user-1" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.create.mockResolvedValue(comment);
      prisma.watcher.findMany.mockResolvedValue([]);
      notifyCommentAdded.mockResolvedValue({});

      await createComment(
        { ticketId: mockTicketId, content: "My comment", visibility: "PUBLIC" },
        user
      );

      expect(notifyCommentAdded).not.toHaveBeenCalled();
    });

    it("defaults to PUBLIC visibility when not specified", async () => {
      const user = makeUser();
      const ticket = makeTicket();
      const comment = makeComment();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.create.mockResolvedValue(comment);
      prisma.watcher.findMany.mockResolvedValue([]);

      await createComment(
        { ticketId: mockTicketId, content: "Test" },
        user
      );

      expect(prisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ visibility: "PUBLIC" }),
        })
      );
    });
  });

  describe("listTicketComments", () => {
    it("returns comments for authorized user", async () => {
      const user = makeUser();
      const ticket = makeTicket();
      const comments = [makeComment(), makeComment({ id: "comment-2" })];

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.findMany.mockResolvedValue(comments);
      prisma.comment.count.mockResolvedValue(2);

      const result = await listTicketComments(mockTicketId, user);

      expect(result.comments).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("filters out INTERNAL comments for USER", async () => {
      const user = makeUser({ role: "USER" });
      const ticket = makeTicket();
      const comments = [
        makeComment({ visibility: "PUBLIC" }),
        makeComment({ id: "comment-2", visibility: "INTERNAL" }),
      ];

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.findMany.mockResolvedValue(comments);
      prisma.comment.count.mockResolvedValue(2);

      const result = await listTicketComments(mockTicketId, user);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].visibility).toBe("PUBLIC");
    });

    it("shows INTERNAL comments for AGENT", async () => {
      const user = makeUser({ role: "AGENT", id: "agent-1" });
      const ticket = makeTicket();
      const comments = [
        makeComment({ visibility: "PUBLIC" }),
        makeComment({ id: "comment-2", visibility: "INTERNAL" }),
      ];

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.findMany.mockResolvedValue(comments);
      prisma.comment.count.mockResolvedValue(2);

      const result = await listTicketComments(mockTicketId, user);

      expect(result.comments).toHaveLength(2);
    });

    it("rejects nonexistent ticket", async () => {
      const user = makeUser();

      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(listTicketComments("nonexistent", user)).rejects.toThrow(
        CommentError
      );
    });

    it("rejects cross-organization ticket", async () => {
      const user = makeUser();
      const ticket = makeTicket({ organizationId: "other-org" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(listTicketComments(mockTicketId, user)).rejects.toThrow(
        CommentError
      );
    });

    it("rejects USER accessing another user's ticket", async () => {
      const user = makeUser({ id: "user-1" });
      const ticket = makeTicket({ requesterId: "user-2" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(listTicketComments(mockTicketId, user)).rejects.toThrow(
        CommentError
      );
    });

    it("supports pagination", async () => {
      const user = makeUser();
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.findMany.mockResolvedValue([]);
      prisma.comment.count.mockResolvedValue(0);

      await listTicketComments(mockTicketId, user, { page: 2, limit: 10 });

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
    });

    it("orders comments by createdAt ascending", async () => {
      const user = makeUser();
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.comment.findMany.mockResolvedValue([]);
      prisma.comment.count.mockResolvedValue(0);

      await listTicketComments(mockTicketId, user);

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "asc" } })
      );
    });
  });

  describe("getComment", () => {
    it("returns comment for authorized user", async () => {
      const user = makeUser();
      const comment = makeComment();
      comment.ticket = { id: mockTicketId, organizationId: mockOrgId, requesterId: mockUserId };

      prisma.comment.findUnique.mockResolvedValue(comment);

      const result = await getComment("comment-1", user);

      expect(result.id).toBe("comment-1");
      expect(result.ticket).toBeUndefined();
    });

    it("rejects nonexistent comment", async () => {
      const user = makeUser();

      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(getComment("nonexistent", user)).rejects.toThrow(CommentError);
    });

    it("rejects INTERNAL comment for USER", async () => {
      const user = makeUser({ role: "USER" });
      const comment = makeComment({ visibility: "INTERNAL" });
      comment.ticket = { id: mockTicketId, organizationId: mockOrgId, requesterId: mockUserId };

      prisma.comment.findUnique.mockResolvedValue(comment);

      await expect(getComment("comment-1", user)).rejects.toThrow(CommentError);
    });

    it("allows AGENT to read INTERNAL comment", async () => {
      const user = makeUser({ role: "AGENT", id: "agent-1" });
      const comment = makeComment({ visibility: "INTERNAL" });
      comment.ticket = { id: mockTicketId, organizationId: mockOrgId, requesterId: mockUserId };

      prisma.comment.findUnique.mockResolvedValue(comment);

      const result = await getComment("comment-1", user);

      expect(result.visibility).toBe("INTERNAL");
    });

    it("rejects cross-organization comment", async () => {
      const user = makeUser();
      const comment = makeComment();
      comment.ticket = { id: mockTicketId, organizationId: "other-org", requesterId: mockUserId };

      prisma.comment.findUnique.mockResolvedValue(comment);

      await expect(getComment("comment-1", user)).rejects.toThrow(CommentError);
    });
  });
});
