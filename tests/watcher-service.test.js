import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    watcher: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db/prisma";
import {
  addWatcher,
  removeWatcher,
  listWatchers,
  isWatching,
  WatcherError,
} from "@/lib/services/watcher-service";

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
    status: "OPEN",
    organizationId: mockOrgId,
    requesterId: mockUserId,
    assignedAgentId: null,
    ...overrides,
  };
}

function makeWatcher(overrides = {}) {
  return {
    id: "watcher-1",
    ticketId: mockTicketId,
    userId: mockUserId,
    createdAt: new Date(),
    user: { id: mockUserId, username: "testuser", role: "USER", avatarUrl: null, designation: null },
    ...overrides,
  };
}

describe("Watcher Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addWatcher", () => {
    it("adds current user as watcher", async () => {
      const user = makeUser();
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.watcher.findUnique.mockResolvedValue(null);
      prisma.watcher.create.mockResolvedValue(makeWatcher());

      const result = await addWatcher(mockTicketId, null, user);

      expect(result.ticketId).toBe(mockTicketId);
      expect(result.userId).toBe(mockUserId);
    });

    it("adds specific user as watcher (AGENT/ADMIN)", async () => {
      const user = makeUser({ role: "AGENT", id: "agent-1" });
      const ticket = makeTicket();
      const targetUser = { id: "user-2", organizationId: mockOrgId, status: "ACTIVE" };

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.user.findUnique.mockResolvedValue(targetUser);
      prisma.watcher.findUnique.mockResolvedValue(null);
      prisma.watcher.create.mockResolvedValue(makeWatcher({ userId: "user-2" }));

      const result = await addWatcher(mockTicketId, "user-2", user);

      expect(result.userId).toBe("user-2");
    });

    it("rejects USER adding another user as watcher", async () => {
      const user = makeUser({ role: "USER", id: "user-1" });
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(addWatcher(mockTicketId, "user-2", user)).rejects.toThrow(
        WatcherError
      );
    });

    it("rejects nonexistent ticket", async () => {
      const user = makeUser();

      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(addWatcher("nonexistent", null, user)).rejects.toThrow(
        WatcherError
      );
    });

    it("rejects cross-organization ticket", async () => {
      const user = makeUser();
      const ticket = makeTicket({ organizationId: "other-org" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(addWatcher(mockTicketId, null, user)).rejects.toThrow(
        WatcherError
      );
    });

    it("rejects USER accessing another user's ticket", async () => {
      const user = makeUser({ id: "user-1" });
      const ticket = makeTicket({ requesterId: "user-2" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(addWatcher(mockTicketId, null, user)).rejects.toThrow(
        WatcherError
      );
    });

    it("rejects cross-organization target user", async () => {
      const user = makeUser({ role: "AGENT", id: "agent-1" });
      const ticket = makeTicket();
      const targetUser = { id: "user-2", organizationId: "other-org", status: "ACTIVE" };

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.user.findUnique.mockResolvedValue(targetUser);

      await expect(addWatcher(mockTicketId, "user-2", user)).rejects.toThrow(
        WatcherError
      );
    });

    it("rejects inactive target user", async () => {
      const user = makeUser({ role: "AGENT", id: "agent-1" });
      const ticket = makeTicket();
      const targetUser = { id: "user-2", organizationId: mockOrgId, status: "INACTIVE" };

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.user.findUnique.mockResolvedValue(targetUser);

      await expect(addWatcher(mockTicketId, "user-2", user)).rejects.toThrow(
        WatcherError
      );
    });

    it("returns existing watcher if already watching (idempotent)", async () => {
      const user = makeUser();
      const ticket = makeTicket();
      const existingWatcher = makeWatcher();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.user.findUnique.mockResolvedValue({ id: user.id, organizationId: mockOrgId, status: "ACTIVE" });
      prisma.watcher.findUnique.mockResolvedValue(existingWatcher);

      const result = await addWatcher(mockTicketId, null, user);

      expect(result.id).toBe("watcher-1");
      expect(prisma.watcher.create).not.toHaveBeenCalled();
    });

    it("allows ADMIN to add any user as watcher", async () => {
      const user = makeUser({ role: "ADMIN", id: "admin-1" });
      const ticket = makeTicket();
      const targetUser = { id: "user-3", organizationId: mockOrgId, status: "ACTIVE" };

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.user.findUnique.mockResolvedValue(targetUser);
      prisma.watcher.findUnique.mockResolvedValue(null);
      prisma.watcher.create.mockResolvedValue(makeWatcher({ userId: "user-3" }));

      const result = await addWatcher(mockTicketId, "user-3", user);

      expect(result.userId).toBe("user-3");
    });
  });

  describe("removeWatcher", () => {
    it("removes own watcher", async () => {
      const user = makeUser();
      const ticket = makeTicket();
      const watcher = makeWatcher();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.watcher.findUnique.mockResolvedValue(watcher);
      prisma.watcher.delete.mockResolvedValue({});

      const result = await removeWatcher(mockTicketId, null, user);

      expect(result.success).toBe(true);
    });

    it("returns success if not watching (idempotent)", async () => {
      const user = makeUser();
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.watcher.findUnique.mockResolvedValue(null);

      const result = await removeWatcher(mockTicketId, null, user);

      expect(result.success).toBe(true);
      expect(prisma.watcher.delete).not.toHaveBeenCalled();
    });

    it("rejects USER removing another user's watcher", async () => {
      const user = makeUser({ role: "USER", id: "user-1" });
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(removeWatcher(mockTicketId, "user-2", user)).rejects.toThrow(
        WatcherError
      );
    });

    it("rejects nonexistent ticket", async () => {
      const user = makeUser();

      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(removeWatcher("nonexistent", null, user)).rejects.toThrow(
        WatcherError
      );
    });

    it("rejects cross-organization ticket", async () => {
      const user = makeUser();
      const ticket = makeTicket({ organizationId: "other-org" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(removeWatcher(mockTicketId, null, user)).rejects.toThrow(
        WatcherError
      );
    });

    it("allows AGENT to remove any watcher", async () => {
      const user = makeUser({ role: "AGENT", id: "agent-1" });
      const ticket = makeTicket();
      const watcher = makeWatcher({ userId: "user-2" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.watcher.findUnique.mockResolvedValue(watcher);
      prisma.watcher.delete.mockResolvedValue({});

      const result = await removeWatcher(mockTicketId, "user-2", user);

      expect(result.success).toBe(true);
    });
  });

  describe("listWatchers", () => {
    it("returns watchers for authorized ticket", async () => {
      const user = makeUser();
      const ticket = makeTicket();
      const watchers = [makeWatcher(), makeWatcher({ id: "watcher-2", userId: "user-2" })];

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.watcher.findMany.mockResolvedValue(watchers);

      const result = await listWatchers(mockTicketId, user);

      expect(result.watchers).toHaveLength(2);
    });

    it("rejects nonexistent ticket", async () => {
      const user = makeUser();

      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(listWatchers("nonexistent", user)).rejects.toThrow(
        WatcherError
      );
    });

    it("rejects cross-organization ticket", async () => {
      const user = makeUser();
      const ticket = makeTicket({ organizationId: "other-org" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(listWatchers(mockTicketId, user)).rejects.toThrow(
        WatcherError
      );
    });

    it("rejects USER accessing another user's ticket", async () => {
      const user = makeUser({ id: "user-1" });
      const ticket = makeTicket({ requesterId: "user-2" });

      prisma.ticket.findUnique.mockResolvedValue(ticket);

      await expect(listWatchers(mockTicketId, user)).rejects.toThrow(
        WatcherError
      );
    });

    it("returns empty array for ticket with no watchers", async () => {
      const user = makeUser();
      const ticket = makeTicket();

      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.watcher.findMany.mockResolvedValue([]);

      const result = await listWatchers(mockTicketId, user);

      expect(result.watchers).toHaveLength(0);
    });
  });

  describe("isWatching", () => {
    it("returns true if user is watching", async () => {
      prisma.watcher.findUnique.mockResolvedValue(makeWatcher());

      const result = await isWatching(mockTicketId, mockUserId);

      expect(result).toBe(true);
    });

    it("returns false if user is not watching", async () => {
      prisma.watcher.findUnique.mockResolvedValue(null);

      const result = await isWatching(mockTicketId, mockUserId);

      expect(result).toBe(false);
    });
  });
});
