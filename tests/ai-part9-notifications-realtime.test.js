import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    notification: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    ticket: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    watcher: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    ticketAssignmentHistory: {
      create: vi.fn(),
    },
    comment: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fns) => {
      if (typeof fns === "function") return fns({});
      return Promise.all(fns);
    }),
  },
}));

vi.mock("@/lib/auth/jwt.js", () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock("@/lib/auth/cookies.js", () => ({
  ACCESS_TOKEN_NAME: "nirnaya_access_token",
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    JWT_ACCESS_SECRET: "test-access-secret-that-is-at-least-16-chars-long",
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-16-chars-long",
    NODE_ENV: "test",
  }),
}));

vi.mock("@/lib/services/sla-service", () => ({
  initializeTicketSLA: vi.fn().mockResolvedValue({}),
  pauseSLA: vi.fn().mockResolvedValue({}),
  resumeSLA: vi.fn().mockResolvedValue({}),
  completeResolutionSLA: vi.fn().mockResolvedValue({}),
  reopenSLA: vi.fn().mockResolvedValue({}),
  recalculateResolutionSLA: vi.fn().mockResolvedValue({}),
  satisfyResponseSLA: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/services/lifecycle", () => ({
  canTransition: vi.fn(() => ({ allowed: true })),
  getAllowedTransitions: vi.fn(() => []),
}));

vi.mock("@/lib/validation/ticket", () => ({
  createTicketSchema: { parse: (d) => d },
  updateTicketSchema: { parse: (d) => d },
  statusTransitionSchema: { parse: (d) => d },
  assignTicketSchema: { parse: (d) => d },
  ticketListQuerySchema: { parse: () => ({ page: 1, limit: 20, sort: "createdAt", order: "desc" }) },
}));

import prisma from "@/lib/db/prisma";
import { getIO, setIO } from "@/lib/realtime/socket-instance";
import { verifyAccessToken } from "@/lib/auth/jwt.js";
import {
  createNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  getUserNotifications,
  NotificationError,
} from "@/lib/services/notification-service";
import { transitionStatus, assignTicket } from "@/lib/services/ticket-service";
import { createComment } from "@/lib/services/comment-service";
import { addWatcher, removeWatcher } from "@/lib/services/watcher-service";
import { setupSocketServer } from "@/lib/realtime/socket-server";

const mockUser = { id: "user-1", role: "AGENT", organizationId: "org-1", username: "agent1" };
const mockAdmin = { id: "admin-1", role: "ADMIN", organizationId: "org-1", username: "admin1" };
const mockTicket = {
  id: "ticket-1",
  ticketNumber: "NIR-2026-000001",
  organizationId: "org-1",
  requesterId: "user-1",
  assignedAgentId: "agent-1",
  departmentId: "dept-1",
  status: "OPEN",
};

function makeMockIO() {
  const mockIO = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
  return mockIO;
}

function makeMockSocket(user, handshake = {}) {
  const handlers = {};
  return {
    data: user ? { user } : {},
    handshake: { auth: {}, headers: {}, query: {}, ...handshake },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    on: vi.fn((ev, h) => { handlers[ev] = h; }),
    _handlers: handlers,
    id: "socket-1",
  };
}

// ============================================================
// 1. Socket Instance Module
// ============================================================
describe("Part 9: Socket Instance Module", () => {
  it("setIO/getIO round-trip", () => {
    const mockIO = { to: vi.fn(), emit: vi.fn() };
    setIO(mockIO);
    expect(getIO()).toBe(mockIO);
  });
});

// ============================================================
// 2. Notification Service — Realtime Emissions
// ============================================================
describe("Part 9: Notification Realtime Emissions", () => {
  let mockIO;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIO = makeMockIO();
    setIO(mockIO);
  });

  it("emits notification:new after creating notification", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({
      id: "notif-1", type: "TICKET_ASSIGNED", message: "Test",
      ticketId: "ticket-1", recipientId: "user-2", organizationId: "org-1",
      isRead: false, createdAt: new Date(),
    });

    await createNotification({
      type: "TICKET_ASSIGNED", message: "Test", ticketId: "ticket-1",
      recipientId: "user-2", organizationId: "org-1",
    });

    expect(mockIO.to).toHaveBeenCalledWith("user:user-2");
    expect(mockIO.emit).toHaveBeenCalledWith("notification:new", {
      notification: expect.objectContaining({ id: "notif-1", type: "TICKET_ASSIGNED" }),
    });
  });

  it("does not emit when IO is null", async () => {
    setIO(null);
    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({
      id: "notif-1", type: "TICKET_ASSIGNED", message: "Test",
      ticketId: "ticket-1", recipientId: "user-2", organizationId: "org-1",
      isRead: false, createdAt: new Date(),
    });

    await createNotification({
      type: "TICKET_ASSIGNED", message: "Test", ticketId: "ticket-1",
      recipientId: "user-2", organizationId: "org-1",
    });

    expect(mockIO.to).not.toHaveBeenCalled();
  });

  it("does not emit for duplicate notification", async () => {
    const existing = { id: "existing", type: "TICKET_ASSIGNED" };
    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
    prisma.notification.findFirst.mockResolvedValue(existing);

    const result = await createNotification({
      type: "TICKET_ASSIGNED", message: "Test", ticketId: "ticket-1",
      recipientId: "user-2", organizationId: "org-1",
    });

    expect(result.id).toBe("existing");
    expect(mockIO.to).not.toHaveBeenCalled();
  });

  it("markAsRead emits notification:read", async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: "notif-1", recipientId: "user-1", organizationId: "org-1", isRead: false,
    });
    prisma.notification.update.mockResolvedValue({ id: "notif-1", isRead: true });

    await markAsRead("notif-1", "user-1", "org-1");

    expect(mockIO.to).toHaveBeenCalledWith("user:user-1");
    expect(mockIO.emit).toHaveBeenCalledWith("notification:read", { notificationId: "notif-1" });
  });

  it("markAllAsRead emits notification:read_all", async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });

    await markAllAsRead("user-1", "org-1");

    expect(mockIO.to).toHaveBeenCalledWith("user:user-1");
    expect(mockIO.emit).toHaveBeenCalledWith("notification:read_all", { organizationId: "org-1" });
  });
});

// ============================================================
// 3. Notification Core Behavior
// ============================================================
describe("Part 9: Notification Core Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setIO(makeMockIO());
  });

  it("getUnreadCount scoped to user and org", async () => {
    prisma.notification.count.mockResolvedValue(5);
    const result = await getUnreadCount("user-1", "org-1");
    expect(result.count).toBe(5);
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { recipientId: "user-1", organizationId: "org-1", isRead: false },
    });
  });

  it("getUserNotifications paginated with org scope", async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);
    const result = await getUserNotifications("user-1", "org-1", { page: 2, limit: 10 });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    const findCall = prisma.notification.findMany.mock.calls[0][0];
    expect(findCall.where.recipientId).toBe("user-1");
    expect(findCall.where.organizationId).toBe("org-1");
  });

  it("getUserNotifications supports unreadOnly filter", async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);
    await getUserNotifications("user-1", "org-1", { unreadOnly: true });
    expect(prisma.notification.findMany.mock.calls[0][0].where.isRead).toBe(false);
  });

  it("markAsRead rejects cross-user access", async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: "notif-1", recipientId: "user-2", organizationId: "org-1", isRead: false,
    });
    await expect(markAsRead("notif-1", "user-1", "org-1")).rejects.toThrow(NotificationError);
  });

  it("markAsRead rejects cross-org access", async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: "notif-1", recipientId: "user-1", organizationId: "org-2", isRead: false,
    });
    await expect(markAsRead("notif-1", "user-1", "org-1")).rejects.toThrow(NotificationError);
  });

  it("markAsRead is idempotent for already-read", async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: "notif-1", recipientId: "user-1", organizationId: "org-1", isRead: true,
    });
    const result = await markAsRead("notif-1", "user-1", "org-1");
    expect(result.isRead).toBe(true);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it("createNotification validates ticket org matches", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-2" });
    await expect(
      createNotification({
        type: "TICKET_ASSIGNED", message: "Test", ticketId: "ticket-1",
        recipientId: "user-2", organizationId: "org-1",
      })
    ).rejects.toThrow(NotificationError);
  });

  it("createNotification deduplicates", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
    const existing = { id: "existing", type: "TICKET_ASSIGNED" };
    prisma.notification.findFirst.mockResolvedValue(existing);

    const result = await createNotification({
      type: "TICKET_ASSIGNED", message: "Test", ticketId: "ticket-1",
      recipientId: "user-2", organizationId: "org-1",
    });
    expect(result.id).toBe("existing");
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("createNotification requires mandatory fields", async () => {
    await expect(
      createNotification({ type: "TICKET_ASSIGNED", message: "Test" })
    ).rejects.toThrow(NotificationError);
  });

  it("markAsRead throws for nonexistent notification", async () => {
    prisma.notification.findUnique.mockResolvedValue(null);
    await expect(markAsRead("nonexistent", "user-1", "org-1")).rejects.toThrow(NotificationError);
  });

  it("createNotification without ticketId succeeds", async () => {
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({
      id: "notif-1", type: "TICKET_CREATED", message: "System",
      ticketId: null, recipientId: "user-1", organizationId: "org-1",
      isRead: false, createdAt: new Date(),
    });
    const result = await createNotification({
      type: "TICKET_CREATED", message: "System",
      recipientId: "user-1", organizationId: "org-1",
    });
    expect(result.id).toBe("notif-1");
  });
});

// ============================================================
// 4. Ticket Service — Status Transition Events
// ============================================================
describe("Part 9: Ticket Service Status Transitions", () => {
  let mockIO;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIO = makeMockIO();
    setIO(mockIO);
  });

  it("emits ticket:status-changed on status transition", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...mockTicket, status: "IN_PROGRESS", assignedAgentId: "agent-1",
    });
    prisma.ticket.update.mockResolvedValue({
      ...mockTicket, status: "RESOLVED", assignedAgentId: "agent-1",
    });
    prisma.watcher.findMany.mockResolvedValue([]);

    await transitionStatus("ticket-1", "RESOLVED", { ...mockUser, id: "user-1" });

    expect(mockIO.to).toHaveBeenCalledWith("ticket:ticket-1");
    expect(mockIO.emit).toHaveBeenCalledWith("ticket:status-changed", {
      ticketId: "ticket-1",
      ticketNumber: "NIR-2026-000001",
      status: "RESOLVED",
      updatedBy: "user-1",
    });
  });

  it("emits ticket:assignment_changed on assignment", async () => {
    prisma.ticket.findUnique.mockResolvedValueOnce({ ...mockTicket, departmentId: "dept-1" });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "agent-1", organizationId: "org-1", role: "AGENT",
      status: "ACTIVE", departmentId: "dept-1",
    });
    prisma.ticket.update.mockResolvedValue({
      ...mockTicket, assignedAgentId: "agent-1", status: "ASSIGNED",
    });
    prisma.ticketAssignmentHistory.create.mockResolvedValue({});
    prisma.watcher.findMany.mockResolvedValue([]);

    await assignTicket("ticket-1", { agentId: "agent-1" }, mockAdmin);

    expect(mockIO.to).toHaveBeenCalledWith("ticket:ticket-1");
    expect(mockIO.emit).toHaveBeenCalledWith("ticket:assignment_changed", {
      ticketId: "ticket-1",
      ticketNumber: "NIR-2026-000001",
      assignedAgentId: "agent-1",
      assignedBy: "admin-1",
    });
  });

  it("notifies watchers on status change (fire-and-forget)", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...mockTicket, status: "IN_PROGRESS", assignedAgentId: "agent-1",
    });
    prisma.ticket.update.mockResolvedValue({
      ...mockTicket, status: "RESOLVED", assignedAgentId: "agent-1",
    });
    prisma.watcher.findMany.mockResolvedValue([{ userId: "watcher-1" }]);

    await transitionStatus("ticket-1", "RESOLVED", { ...mockUser, id: "user-1" });
    await new Promise((r) => setTimeout(r, 50));

    expect(prisma.notification.create).toHaveBeenCalled();
  });
});

// ============================================================
// 5. Comment Service — Realtime Emission
// ============================================================
describe("Part 9: Comment Service Realtime", () => {
  let mockIO;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIO = makeMockIO();
    setIO(mockIO);
  });

  it("emits ticket:comment_added after comment creation", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...mockTicket, status: "OPEN" });
    prisma.comment.create.mockResolvedValue({
      id: "comment-1", content: "Test", visibility: "PUBLIC",
      ticketId: "ticket-1", authorId: "user-1", createdAt: new Date(),
    });
    prisma.watcher.findMany.mockResolvedValue([]);

    await createComment(
      { ticketId: "ticket-1", content: "Test", visibility: "PUBLIC" },
      mockUser
    );

    expect(mockIO.to).toHaveBeenCalledWith("ticket:ticket-1");
    expect(mockIO.emit).toHaveBeenCalledWith("ticket:comment_added", {
      ticketId: "ticket-1",
      commentId: "comment-1",
      authorId: "user-1",
      authorUsername: "agent1",
      isInternal: false,
      createdAt: expect.any(Date),
    });
  });

  it("marks internal comments correctly in event", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...mockTicket, status: "OPEN" });
    prisma.comment.create.mockResolvedValue({
      id: "comment-2", content: "Internal", visibility: "INTERNAL",
      ticketId: "ticket-1", authorId: "admin-1", createdAt: new Date(),
    });
    prisma.watcher.findMany.mockResolvedValue([]);

    await createComment(
      { ticketId: "ticket-1", content: "Internal", visibility: "INTERNAL" },
      mockAdmin
    );

    const emitCall = mockIO.emit.mock.calls.find(([event]) => event === "ticket:comment_added");
    expect(emitCall).toBeDefined();
    expect(emitCall[1].isInternal).toBe(true);
  });
});

// ============================================================
// 6. Watcher Service — Notifications & Events
// ============================================================
describe("Part 9: Watcher Service", () => {
  let mockIO;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIO = makeMockIO();
    setIO(mockIO);
  });

  it("addWatcher emits ticket:updated with watcher_added", async () => {
    prisma.ticket.findUnique
      .mockResolvedValueOnce({ ...mockTicket, status: "OPEN" })
      .mockResolvedValueOnce({ ticketNumber: "NIR-2026-000001" });
    prisma.watcher.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", organizationId: "org-1", status: "ACTIVE" });
    prisma.watcher.create.mockResolvedValue({ id: "watcher-1" });
    prisma.watcher.findMany.mockResolvedValue([]);

    await addWatcher("ticket-1", "user-1", mockAdmin);

    expect(mockIO.to).toHaveBeenCalledWith("ticket:ticket-1");
    expect(mockIO.emit).toHaveBeenCalledWith("ticket:updated", {
      ticketId: "ticket-1",
      event: "watcher_added",
      watcherId: "user-1",
    });
  });

  it("removeWatcher emits ticket:updated with watcher_removed", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...mockTicket, status: "OPEN" });
    prisma.watcher.findUnique.mockResolvedValue({ id: "watcher-1", userId: "user-1" });
    prisma.watcher.delete.mockResolvedValue({});

    await removeWatcher("ticket-1", "user-1", mockAdmin);

    expect(mockIO.to).toHaveBeenCalledWith("ticket:ticket-1");
    expect(mockIO.emit).toHaveBeenCalledWith("ticket:updated", {
      ticketId: "ticket-1",
      event: "watcher_removed",
      watcherId: "user-1",
    });
  });

  it("addWatcher notifies existing watchers", async () => {
    prisma.ticket.findUnique
      .mockResolvedValueOnce({ ...mockTicket, status: "OPEN" })
      .mockResolvedValueOnce({ ticketNumber: "NIR-2026-000001" });
    prisma.watcher.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", organizationId: "org-1", status: "ACTIVE" });
    prisma.watcher.create.mockResolvedValue({ id: "watcher-1" });
    prisma.watcher.findMany.mockResolvedValue([{ userId: "existing-watcher" }]);

    await addWatcher("ticket-1", "user-1", mockAdmin);
    await new Promise((r) => setTimeout(r, 50));

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "WATCHER_ADDED",
        recipientId: "existing-watcher",
      }),
    });
  });
});

// ============================================================
// 7. Socket.IO Server — Authentication & Room Isolation
// ============================================================
describe("Part 9: Socket.IO Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects connection without token", async () => {
    verifyAccessToken.mockResolvedValue(null);
    const io = { use: vi.fn(), on: vi.fn() };
    setupSocketServer(io);

    const middlewareFn = io.use.mock.calls[0][0];
    const socket = makeMockSocket(null);
    const next = vi.fn();
    await middlewareFn(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("accepts valid token", async () => {
    verifyAccessToken.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1", username: "test", role: "AGENT", status: "ACTIVE",
      organizationId: "org-1", departmentId: "dept-1",
    });

    const io = { use: vi.fn(), on: vi.fn() };
    setupSocketServer(io);

    const middlewareFn = io.use.mock.calls[0][0];
    const socket = makeMockSocket(null, { auth: { token: "valid" } });
    const next = vi.fn();
    await middlewareFn(socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user.id).toBe("user-1");
  });

  it("rejects inactive user", async () => {
    verifyAccessToken.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", status: "INACTIVE" });

    const io = { use: vi.fn(), on: vi.fn() };
    setupSocketServer(io);

    const middlewareFn = io.use.mock.calls[0][0];
    const socket = makeMockSocket(null, { auth: { token: "valid" } });
    const next = vi.fn();
    await middlewareFn(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("joins user and org rooms on connect", async () => {
    const io = { use: vi.fn(), on: vi.fn() };
    setupSocketServer(io);

    const connectionHandler = io.on.mock.calls.find(([e]) => e === "connection")[1];
    const socket = makeMockSocket({
      id: "user-1", role: "AGENT", organizationId: "org-1",
    });
    connectionHandler(socket);
    expect(socket.join).toHaveBeenCalledWith("user:user-1");
    expect(socket.join).toHaveBeenCalledWith("org:org-1");
  });

  it("USER cannot subscribe to other user's ticket", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: "ticket-1", organizationId: "org-1", requesterId: "user-2", assignedAgentId: null,
    });

    const io = { use: vi.fn(), on: vi.fn() };
    setupSocketServer(io);

    const connectionHandler = io.on.mock.calls.find(([e]) => e === "connection")[1];
    const socket = makeMockSocket({
      id: "user-1", role: "USER", organizationId: "org-1",
    });
    connectionHandler(socket);

    await socket._handlers["ticket:subscribe"]("ticket-1");
    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Access denied" });
    expect(socket.join).not.toHaveBeenCalledWith("ticket:ticket-1");
  });

  it("USER can subscribe to own ticket", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: "ticket-1", organizationId: "org-1", requesterId: "user-1", assignedAgentId: null,
    });

    const io = { use: vi.fn(), on: vi.fn() };
    setupSocketServer(io);

    const connectionHandler = io.on.mock.calls.find(([e]) => e === "connection")[1];
    const socket = makeMockSocket({
      id: "user-1", role: "USER", organizationId: "org-1",
    });
    connectionHandler(socket);

    await socket._handlers["ticket:subscribe"]("ticket-1");
    expect(socket.join).toHaveBeenCalledWith("ticket:ticket-1");
  });

  it("cross-org ticket subscription is rejected", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: "ticket-1", organizationId: "org-2", requesterId: "user-2", assignedAgentId: null,
    });

    const io = { use: vi.fn(), on: vi.fn() };
    setupSocketServer(io);

    const connectionHandler = io.on.mock.calls.find(([e]) => e === "connection")[1];
    const socket = makeMockSocket({
      id: "user-1", role: "AGENT", organizationId: "org-1",
    });
    connectionHandler(socket);

    await socket._handlers["ticket:subscribe"]("ticket-1");
    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Access denied" });
  });

  it("ticket:unsubscribe leaves the room", async () => {
    const io = { use: vi.fn(), on: vi.fn() };
    setupSocketServer(io);

    const connectionHandler = io.on.mock.calls.find(([e]) => e === "connection")[1];
    const socket = makeMockSocket({
      id: "user-1", role: "AGENT", organizationId: "org-1",
    });
    connectionHandler(socket);

    socket._handlers["ticket:unsubscribe"]("ticket-1");
    expect(socket.leave).toHaveBeenCalledWith("ticket:ticket-1");
  });

  it("extracts token from cookie header", async () => {
    verifyAccessToken.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1", username: "test", role: "AGENT", status: "ACTIVE",
      organizationId: "org-1", departmentId: "dept-1",
    });

    const io = { use: vi.fn(), on: vi.fn() };
    setupSocketServer(io);

    const middlewareFn = io.use.mock.calls[0][0];
    const socket = makeMockSocket(null, {
      headers: { cookie: "nirnaya_access_token=cookie-token; other=val" },
    });
    const next = vi.fn();
    await middlewareFn(socket, next);
    expect(verifyAccessToken).toHaveBeenCalledWith("cookie-token");
    expect(next).toHaveBeenCalledWith();
  });
});

// ============================================================
// 8. SLA Notification Deduplication
// ============================================================
describe("Part 9: SLA Notification Deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setIO(makeMockIO());
  });

  it("SLA breach deduplicates via existing check", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
    const existing = { id: "existing-sla", type: "SLA_BREACHED" };
    prisma.notification.findFirst.mockResolvedValue(existing);

    const result = await createNotification({
      type: "SLA_BREACHED", message: "Breached", ticketId: "ticket-1",
      recipientId: "user-1", organizationId: "org-1",
    });
    expect(result.id).toBe("existing-sla");
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("SLA warning deduplicates via existing check", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
    const existing = { id: "existing-warn", type: "SLA_WARNING" };
    prisma.notification.findFirst.mockResolvedValue(existing);

    const result = await createNotification({
      type: "SLA_WARNING", message: "Warning", ticketId: "ticket-1",
      recipientId: "user-1", organizationId: "org-1",
    });
    expect(result.id).toBe("existing-warn");
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

// ============================================================
// 9. Failure Isolation
// ============================================================
describe("Part 9: Failure Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setIO(makeMockIO());
  });

  it("notification with invalid ticket throws", async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);
    await expect(
      createNotification({
        type: "TICKET_ASSIGNED", message: "Test", ticketId: "nonexistent",
        recipientId: "user-2", organizationId: "org-1",
      })
    ).rejects.toThrow(NotificationError);
  });

  it("realtime emission failure does not prevent persistence", async () => {
    const failingIO = { to: vi.fn().mockReturnThis(), emit: vi.fn(() => { throw new Error("down"); }) };
    setIO(failingIO);

    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({
      id: "notif-1", type: "TICKET_ASSIGNED", message: "Test",
      ticketId: "ticket-1", recipientId: "user-2", organizationId: "org-1",
      isRead: false, createdAt: new Date(),
    });

    const result = await createNotification({
      type: "TICKET_ASSIGNED", message: "Test", ticketId: "ticket-1",
      recipientId: "user-2", organizationId: "org-1",
    });
    expect(result.id).toBe("notif-1");
  });
});

// ============================================================
// 10. Realtime Payload Safety
// ============================================================
describe("Part 9: Realtime Payload Safety", () => {
  let mockIO;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIO = makeMockIO();
    setIO(mockIO);
  });

  it("comment_added does not leak comment content", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...mockTicket, status: "OPEN" });
    prisma.comment.create.mockResolvedValue({
      id: "comment-1", content: "Sensitive", visibility: "PUBLIC",
      ticketId: "ticket-1", authorId: "user-1", createdAt: new Date(),
    });
    prisma.watcher.findMany.mockResolvedValue([]);

    await createComment(
      { ticketId: "ticket-1", content: "Sensitive", visibility: "PUBLIC" },
      mockUser
    );

    const emitCall = mockIO.emit.mock.calls.find(([event]) => event === "ticket:comment_added");
    expect(emitCall).toBeDefined();
    const payload = emitCall[1];
    expect(payload).not.toHaveProperty("content");
    expect(payload).toHaveProperty("commentId");
    expect(payload).toHaveProperty("authorId");
    expect(payload).toHaveProperty("isInternal");
  });

  it("status-changed contains only safe metadata", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...mockTicket, status: "IN_PROGRESS", assignedAgentId: "agent-1",
    });
    prisma.ticket.update.mockResolvedValue({
      ...mockTicket, status: "RESOLVED", assignedAgentId: "agent-1",
    });
    prisma.watcher.findMany.mockResolvedValue([]);

    await transitionStatus("ticket-1", "RESOLVED", { ...mockUser, id: "user-1" });

    const emitCall = mockIO.emit.mock.calls.find(([event]) => event === "ticket:status-changed");
    expect(emitCall).toBeDefined();
    const payload = emitCall[1];
    expect(payload).toHaveProperty("ticketId");
    expect(payload).toHaveProperty("status");
    expect(payload).toHaveProperty("updatedBy");
    expect(payload).not.toHaveProperty("description");
    expect(payload).not.toHaveProperty("requesterId");
  });
});

// ============================================================
// 11. Organization Isolation
// ============================================================
describe("Part 9: Organization Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setIO(makeMockIO());
  });

  it("unread count is org-scoped", async () => {
    prisma.notification.count.mockResolvedValue(0);
    await getUnreadCount("user-1", "org-1");
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { recipientId: "user-1", organizationId: "org-1", isRead: false },
    });
  });

  it("listing is org-scoped", async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);
    await getUserNotifications("user-1", "org-1");
    expect(prisma.notification.findMany.mock.calls[0][0].where.organizationId).toBe("org-1");
  });

  it("markAsRead checks org ownership", async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: "notif-1", recipientId: "user-1", organizationId: "org-2", isRead: false,
    });
    await expect(markAsRead("notif-1", "user-1", "org-1")).rejects.toThrow(NotificationError);
  });

  it("markAsRead checks user ownership", async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: "notif-1", recipientId: "user-2", organizationId: "org-1", isRead: false,
    });
    await expect(markAsRead("notif-1", "user-1", "org-1")).rejects.toThrow(NotificationError);
  });

  it("ticket org mismatch prevents notification creation", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-2" });
    await expect(
      createNotification({
        type: "TICKET_ASSIGNED", message: "Test", ticketId: "ticket-1",
        recipientId: "user-2", organizationId: "org-1",
      })
    ).rejects.toThrow(NotificationError);
  });
});

// ============================================================
// 12. Emit Helpers
// ============================================================
describe("Part 9: Emit Helpers", () => {
  it("emitToUser sends to user room", async () => {
    const { emitToUser } = await import("@/lib/realtime/socket-server");
    const io = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    emitToUser(io, "user-1", "notification:new", { id: "n1" });
    expect(io.to).toHaveBeenCalledWith("user:user-1");
    expect(io.emit).toHaveBeenCalledWith("notification:new", { id: "n1" });
  });

  it("emitToTicket sends to ticket room", async () => {
    const { emitToTicket } = await import("@/lib/realtime/socket-server");
    const io = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    emitToTicket(io, "ticket-1", "ticket:updated", { ticketId: "ticket-1" });
    expect(io.to).toHaveBeenCalledWith("ticket:ticket-1");
    expect(io.emit).toHaveBeenCalledWith("ticket:updated", { ticketId: "ticket-1" });
  });

  it("emitToOrg sends to org room", async () => {
    const { emitToOrg } = await import("@/lib/realtime/socket-server");
    const io = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    emitToOrg(io, "org-1", "ticket:updated", { ticketId: "ticket-1" });
    expect(io.to).toHaveBeenCalledWith("org:org-1");
    expect(io.emit).toHaveBeenCalledWith("ticket:updated", { ticketId: "ticket-1" });
  });
});

// ============================================================
// 13. Security Regression Tests
// ============================================================
describe("Part 9: Security Regression Tests", () => {
  it("org room join uses server-derived organizationId, not client input", async () => {
    const io = { use: vi.fn(), on: vi.fn() };
    setupSocketServer(io);

    const connectionHandler = io.on.mock.calls.find(([e]) => e === "connection")[1];
    const socket = makeMockSocket({
      id: "user-1", role: "AGENT", organizationId: "org-1",
    });
    connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith("org:org-1");

    const orgJoinCalls = socket.join.mock.calls.filter(([room]) => room.startsWith("org:"));
    expect(orgJoinCalls.length).toBe(1);
    expect(orgJoinCalls[0][0]).toBe("org:org-1");
  });

  it("no client event handler exists for joining arbitrary user rooms", async () => {
    const io = { use: vi.fn(), on: vi.fn() };
    setupSocketServer(io);

    const connectionHandler = io.on.mock.calls.find(([e]) => e === "connection")[1];
    const socket = makeMockSocket({
      id: "user-1", role: "AGENT", organizationId: "org-1",
    });
    connectionHandler(socket);

    const registeredEvents = Object.keys(socket._handlers);
    expect(registeredEvents).not.toContain("user:join");
    expect(registeredEvents).not.toContain("join-room");
    expect(registeredEvents).not.toContain("org:subscribe");
    expect(registeredEvents).toContain("ticket:subscribe");
    expect(registeredEvents).toContain("ticket:unsubscribe");
  });

  it("notification:new only reaches the intended recipient user room", async () => {
    const recipientId = "user-2";
    const testIO = makeMockIO();
    setIO(testIO);

    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({
      id: "notif-1", type: "TICKET_ASSIGNED", message: "Test",
      ticketId: "ticket-1", recipientId, organizationId: "org-1",
      isRead: false, createdAt: new Date(),
    });

    await createNotification({
      type: "TICKET_ASSIGNED", message: "Test", ticketId: "ticket-1",
      recipientId, organizationId: "org-1",
    });

    expect(testIO.to).toHaveBeenCalledWith("user:user-2");
    const toCalls = testIO.to.mock.calls.map(([room]) => room);
    expect(toCalls).not.toContain("user:user-1");
  });

  it("watcher notification failure does not break primary mutation", async () => {
    prisma.ticket.findUnique
      .mockResolvedValueOnce({ ...mockTicket, status: "OPEN" })
      .mockResolvedValueOnce({ ticketNumber: "NIR-2026-000001" });
    prisma.watcher.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", organizationId: "org-1", status: "ACTIVE" });
    prisma.watcher.create.mockResolvedValue({ id: "watcher-1" });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    prisma.watcher.findMany.mockRejectedValue(new Error("DB connection lost"));

    const watcher = await addWatcher("ticket-1", "user-1", mockAdmin);

    expect(watcher.id).toBe("watcher-1");
    expect(prisma.watcher.create).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("realtime emission failure does not prevent notification persistence", async () => {
    const failingIO = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(() => { throw new Error("Socket.IO down"); }),
    };
    setIO(failingIO);

    prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({
      id: "notif-1", type: "TICKET_ASSIGNED", message: "Test",
      ticketId: "ticket-1", recipientId: "user-2", organizationId: "org-1",
      isRead: false, createdAt: new Date(),
    });

    const result = await createNotification({
      type: "TICKET_ASSIGNED", message: "Test", ticketId: "ticket-1",
      recipientId: "user-2", organizationId: "org-1",
    });

    expect(result.id).toBe("notif-1");
    expect(result).toBeDefined();
  });
});
