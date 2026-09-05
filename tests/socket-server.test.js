import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    ticket: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/jwt.js", () => ({
  verifyAccessToken: vi.fn(),
}));

import prisma from "@/lib/db/prisma";
import { verifyAccessToken } from "@/lib/auth/jwt.js";
import { setupSocketServer, emitToUser, emitToOrg, emitToTicket } from "@/lib/realtime/socket-server";

function createMockSocket(user = null, handshake = {}) {
  const handlers = {};
  const socket = {
    data: {},
    handshake: {
      auth: {},
      headers: {},
      query: {},
      ...handshake,
    },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    on: vi.fn((event, handler) => {
      handlers[event] = handler;
    }),
    _handlers: handlers,
    id: "socket-1",
  };
  if (user) {
    socket.data.user = user;
  }
  return socket;
}

function createMockIO() {
  return {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
    use: vi.fn(),
    on: vi.fn(),
  };
}

describe("Socket.IO server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setupSocketServer", () => {
    it("registers middleware and connection handler", () => {
      const io = createMockIO();
      setupSocketServer(io);
      expect(io.use).toHaveBeenCalled();
      expect(io.on).toHaveBeenCalledWith("connection", expect.any(Function));
    });
  });

  describe("authentication middleware", () => {
    it("rejects connection without token", async () => {
      const io = createMockIO();
      setupSocketServer(io);

      const middlewareFn = io.use.mock.calls[0][0];
      const socket = createMockSocket(null, { auth: {} });
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it("accepts connection with valid token", async () => {
      verifyAccessToken.mockResolvedValue({ userId: "user-1" });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        username: "testuser",
        role: "AGENT",
        status: "ACTIVE",
        organizationId: "org-1",
        departmentId: "dept-1",
      });

      const io = createMockIO();
      setupSocketServer(io);

      const middlewareFn = io.use.mock.calls[0][0];
      const socket = createMockSocket(null, {
        auth: { token: "valid-token" },
      });
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.data.user).toBeDefined();
      expect(socket.data.user.id).toBe("user-1");
    });

    it("rejects connection with invalid token", async () => {
      verifyAccessToken.mockResolvedValue(null);

      const io = createMockIO();
      setupSocketServer(io);

      const middlewareFn = io.use.mock.calls[0][0];
      const socket = createMockSocket(null, {
        auth: { token: "invalid-token" },
      });
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it("rejects connection with inactive user", async () => {
      verifyAccessToken.mockResolvedValue({ userId: "user-1" });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        status: "INACTIVE",
      });

      const io = createMockIO();
      setupSocketServer(io);

      const middlewareFn = io.use.mock.calls[0][0];
      const socket = createMockSocket(null, {
        auth: { token: "valid-token" },
      });
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it("extracts token from cookie header", async () => {
      verifyAccessToken.mockResolvedValue({ userId: "user-1" });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        username: "testuser",
        role: "AGENT",
        status: "ACTIVE",
        organizationId: "org-1",
        departmentId: "dept-1",
      });

      const io = createMockIO();
      setupSocketServer(io);

      const middlewareFn = io.use.mock.calls[0][0];
      const socket = createMockSocket(null, {
        headers: {
          cookie: "nirnaya_access_token=cookie-token; other=value",
        },
      });
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(verifyAccessToken).toHaveBeenCalledWith("cookie-token");
      expect(next).toHaveBeenCalledWith();
    });

    it("extracts token from query parameter", async () => {
      verifyAccessToken.mockResolvedValue({ userId: "user-1" });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        username: "testuser",
        role: "AGENT",
        status: "ACTIVE",
        organizationId: "org-1",
        departmentId: "dept-1",
      });

      const io = createMockIO();
      setupSocketServer(io);

      const middlewareFn = io.use.mock.calls[0][0];
      const socket = createMockSocket(null, {
        query: { token: "query-token" },
      });
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(verifyAccessToken).toHaveBeenCalledWith("query-token");
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("connection handler", () => {
    it("joins user and org rooms on connect", () => {
      const user = {
        id: "user-1",
        role: "AGENT",
        organizationId: "org-1",
      };
      const socket = createMockSocket(user);
      const io = createMockIO();

      setupSocketServer(io);

      const connectionHandler = io.on.mock.calls.find(
        ([event]) => event === "connection"
      )[1];

      connectionHandler(socket);

      expect(socket.join).toHaveBeenCalledWith("user:user-1");
      expect(socket.join).toHaveBeenCalledWith("org:org-1");
    });

    it("handles ticket:subscribe with authorized ticket", async () => {
      const user = {
        id: "user-1",
        role: "AGENT",
        organizationId: "org-1",
      };
      const socket = createMockSocket(user);

      prisma.ticket.findUnique.mockResolvedValue({
        id: "ticket-1",
        organizationId: "org-1",
        requesterId: "user-2",
        assignedAgentId: null,
      });

      const io = createMockIO();
      setupSocketServer(io);

      const connectionHandler = io.on.mock.calls.find(
        ([event]) => event === "connection"
      )[1];

      connectionHandler(socket);

      const subscribeHandler = socket._handlers["ticket:subscribe"];
      await subscribeHandler("ticket-1");

      expect(socket.join).toHaveBeenCalledWith("ticket:ticket-1");
      expect(socket.emit).toHaveBeenCalledWith("ticket:subscribed", { ticketId: "ticket-1" });
    });

    it("rejects ticket:subscribe for cross-org ticket", async () => {
      const user = {
        id: "user-1",
        role: "AGENT",
        organizationId: "org-1",
      };
      const socket = createMockSocket(user);

      prisma.ticket.findUnique.mockResolvedValue({
        id: "ticket-1",
        organizationId: "org-2",
        requesterId: "user-2",
        assignedAgentId: null,
      });

      const io = createMockIO();
      setupSocketServer(io);

      const connectionHandler = io.on.mock.calls.find(
        ([event]) => event === "connection"
      )[1];

      connectionHandler(socket);

      const subscribeHandler = socket._handlers["ticket:subscribe"];
      await subscribeHandler("ticket-1");

      expect(socket.emit).toHaveBeenCalledWith("error", { message: "Access denied" });
    });

    it("rejects ticket:subscribe for USER viewing other user's ticket", async () => {
      const user = {
        id: "user-1",
        role: "USER",
        organizationId: "org-1",
      };
      const socket = createMockSocket(user);

      prisma.ticket.findUnique.mockResolvedValue({
        id: "ticket-1",
        organizationId: "org-1",
        requesterId: "user-2",
        assignedAgentId: null,
      });

      const io = createMockIO();
      setupSocketServer(io);

      const connectionHandler = io.on.mock.calls.find(
        ([event]) => event === "connection"
      )[1];

      connectionHandler(socket);

      const subscribeHandler = socket._handlers["ticket:subscribe"];
      await subscribeHandler("ticket-1");

      expect(socket.emit).toHaveBeenCalledWith("error", { message: "Access denied" });
    });

    it("allows USER to subscribe to own ticket", async () => {
      const user = {
        id: "user-1",
        role: "USER",
        organizationId: "org-1",
      };
      const socket = createMockSocket(user);

      prisma.ticket.findUnique.mockResolvedValue({
        id: "ticket-1",
        organizationId: "org-1",
        requesterId: "user-1",
        assignedAgentId: null,
      });

      const io = createMockIO();
      setupSocketServer(io);

      const connectionHandler = io.on.mock.calls.find(
        ([event]) => event === "connection"
      )[1];

      connectionHandler(socket);

      const subscribeHandler = socket._handlers["ticket:subscribe"];
      await subscribeHandler("ticket-1");

      expect(socket.join).toHaveBeenCalledWith("ticket:ticket-1");
    });

    it("handles ticket:unsubscribe", () => {
      const user = {
        id: "user-1",
        role: "AGENT",
        organizationId: "org-1",
      };
      const socket = createMockSocket(user);

      const io = createMockIO();
      setupSocketServer(io);

      const connectionHandler = io.on.mock.calls.find(
        ([event]) => event === "connection"
      )[1];

      connectionHandler(socket);

      const unsubscribeHandler = socket._handlers["ticket:unsubscribe"];
      unsubscribeHandler("ticket-1");

      expect(socket.leave).toHaveBeenCalledWith("ticket:ticket-1");
    });
  });

  describe("emit helpers", () => {
    it("emitToUser sends to user room", () => {
      const io = createMockIO();
      emitToUser(io, "user-1", "test:event", { data: "hello" });
      expect(io.to).toHaveBeenCalledWith("user:user-1");
      expect(io.emit).toHaveBeenCalledWith("test:event", { data: "hello" });
    });

    it("emitToOrg sends to org room", () => {
      const io = createMockIO();
      emitToOrg(io, "org-1", "test:event", { data: "hello" });
      expect(io.to).toHaveBeenCalledWith("org:org-1");
      expect(io.emit).toHaveBeenCalledWith("test:event", { data: "hello" });
    });

    it("emitToTicket sends to ticket room", () => {
      const io = createMockIO();
      emitToTicket(io, "ticket-1", "test:event", { data: "hello" });
      expect(io.to).toHaveBeenCalledWith("ticket:ticket-1");
      expect(io.emit).toHaveBeenCalledWith("test:event", { data: "hello" });
    });
  });
});
