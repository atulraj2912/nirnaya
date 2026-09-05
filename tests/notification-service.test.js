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
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db/prisma";
import {
  createNotification,
  createBulkNotifications,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  notifyTicketAssigned,
  notifyTicketStatusChanged,
  notifySLABreach,
  notifySLAWarning,
  notifyTicketReopened,
  NotificationError,
} from "@/lib/services/notification-service";

const mockUser = {
  id: "user-1",
  role: "AGENT",
  organizationId: "org-1",
};

const mockTicket = {
  id: "ticket-1",
  ticketNumber: "NIR-2026-000001",
  organizationId: "org-1",
  requesterId: "user-1",
  assignedAgentId: "agent-1",
};

describe("Notification service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createNotification", () => {
    it("creates a notification with valid data", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({
        id: "notif-1",
        type: "TICKET_ASSIGNED",
        message: "Test",
        ticketId: "ticket-1",
        recipientId: "user-2",
        organizationId: "org-1",
        isRead: false,
        createdAt: new Date(),
      });

      const result = await createNotification({
        type: "TICKET_ASSIGNED",
        message: "Test",
        ticketId: "ticket-1",
        recipientId: "user-2",
        organizationId: "org-1",
      });

      expect(result.id).toBe("notif-1");
      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it("returns existing notification if duplicate", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
      const existing = {
        id: "existing-notif",
        type: "TICKET_ASSIGNED",
        message: "Test",
        ticketId: "ticket-1",
        recipientId: "user-2",
        organizationId: "org-1",
        isRead: false,
      };
      prisma.notification.findFirst.mockResolvedValue(existing);

      const result = await createNotification({
        type: "TICKET_ASSIGNED",
        message: "Test",
        ticketId: "ticket-1",
        recipientId: "user-2",
        organizationId: "org-1",
      });

      expect(result.id).toBe("existing-notif");
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("throws if missing required fields", async () => {
      await expect(
        createNotification({ type: "TICKET_ASSIGNED", message: "Test" })
      ).rejects.toThrow(NotificationError);
    });

    it("throws if ticket not found", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        createNotification({
          type: "TICKET_ASSIGNED",
          message: "Test",
          ticketId: "nonexistent",
          recipientId: "user-2",
          organizationId: "org-1",
        })
      ).rejects.toThrow(NotificationError);
    });

    it("creates notification without ticketId", async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({
        id: "notif-2",
        type: "TICKET_CREATED",
        message: "System message",
        ticketId: null,
        recipientId: "user-1",
        organizationId: "org-1",
        isRead: false,
        createdAt: new Date(),
      });

      const result = await createNotification({
        type: "TICKET_CREATED",
        message: "System message",
        recipientId: "user-1",
        organizationId: "org-1",
      });

      expect(result.id).toBe("notif-2");
    });
  });

  describe("createBulkNotifications", () => {
    it("creates multiple notifications", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({
        id: "notif-1",
        type: "TICKET_ASSIGNED",
        message: "Test",
        isRead: false,
        createdAt: new Date(),
      });

      const results = await createBulkNotifications([
        {
          type: "TICKET_ASSIGNED",
          message: "Test 1",
          ticketId: "ticket-1",
          recipientId: "user-2",
          organizationId: "org-1",
        },
        {
          type: "TICKET_ASSIGNED",
          message: "Test 2",
          ticketId: "ticket-1",
          recipientId: "user-3",
          organizationId: "org-1",
        },
      ]);

      expect(results).toHaveLength(2);
    });

    it("skips failed notifications in batch", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      const results = await createBulkNotifications([
        {
          type: "TICKET_ASSIGNED",
          message: "Test 1",
          ticketId: "nonexistent",
          recipientId: "user-2",
          organizationId: "org-1",
        },
      ]);

      expect(results).toHaveLength(0);
    });
  });

  describe("getUserNotifications", () => {
    it("returns paginated notifications", async () => {
      prisma.notification.findMany.mockResolvedValue([
        { id: "notif-1", message: "Test", isRead: false },
      ]);
      prisma.notification.count.mockResolvedValue(1);

      const result = await getUserNotifications("user-1", "org-1");

      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("filters by unread only", async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await getUserNotifications("user-1", "org-1", { unreadOnly: true });

      const findCall = prisma.notification.findMany.mock.calls[0][0];
      expect(findCall.where.isRead).toBe(false);
    });

    it("enforces recipient scope", async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await getUserNotifications("user-1", "org-1");

      const findCall = prisma.notification.findMany.mock.calls[0][0];
      expect(findCall.where.recipientId).toBe("user-1");
      expect(findCall.where.organizationId).toBe("org-1");
    });
  });

  describe("getUnreadCount", () => {
    it("returns unread count", async () => {
      prisma.notification.count.mockResolvedValue(5);

      const result = await getUnreadCount("user-1", "org-1");

      expect(result.count).toBe(5);
    });

    it("enforces recipient and org scope", async () => {
      prisma.notification.count.mockResolvedValue(0);

      await getUnreadCount("user-1", "org-1");

      const countCall = prisma.notification.count.mock.calls[0][0];
      expect(countCall.where.recipientId).toBe("user-1");
      expect(countCall.where.organizationId).toBe("org-1");
      expect(countCall.where.isRead).toBe(false);
    });
  });

  describe("markAsRead", () => {
    it("marks own notification as read", async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: "notif-1",
        recipientId: "user-1",
        organizationId: "org-1",
        isRead: false,
      });
      prisma.notification.update.mockResolvedValue({
        id: "notif-1",
        isRead: true,
      });

      const result = await markAsRead("notif-1", "user-1", "org-1");

      expect(result.isRead).toBe(true);
    });

    it("rejects another user's notification", async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: "notif-1",
        recipientId: "user-2",
        organizationId: "org-1",
        isRead: false,
      });

      await expect(markAsRead("notif-1", "user-1", "org-1")).rejects.toThrow(
        NotificationError
      );
    });

    it("rejects cross-org notification", async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: "notif-1",
        recipientId: "user-1",
        organizationId: "org-2",
        isRead: false,
      });

      await expect(markAsRead("notif-1", "user-1", "org-1")).rejects.toThrow(
        NotificationError
      );
    });

    it("returns already-read notification without update", async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: "notif-1",
        recipientId: "user-1",
        organizationId: "org-1",
        isRead: true,
      });

      const result = await markAsRead("notif-1", "user-1", "org-1");

      expect(result.isRead).toBe(true);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it("throws if notification not found", async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(markAsRead("nonexistent", "user-1", "org-1")).rejects.toThrow(
        NotificationError
      );
    });
  });

  describe("markAllAsRead", () => {
    it("marks all unread notifications as read", async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await markAllAsRead("user-1", "org-1");

      expect(result.success).toBe(true);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          recipientId: "user-1",
          organizationId: "org-1",
          isRead: false,
        },
        data: { isRead: true },
      });
    });
  });

  describe("notifyTicketAssigned", () => {
    it("creates assignment notification", async () => {
      prisma.user.findUnique.mockResolvedValue({ username: "admin" });
      prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({
        id: "notif-1",
        type: "TICKET_ASSIGNED",
        isRead: false,
      });

      const result = await notifyTicketAssigned({
        ticketId: "ticket-1",
        ticketNumber: "NIR-2026-000001",
        assignedToId: "agent-1",
        assignedById: "admin-1",
        organizationId: "org-1",
      });

      expect(result).not.toBeNull();
    });

    it("does not notify self-assignment", async () => {
      const result = await notifyTicketAssigned({
        ticketId: "ticket-1",
        ticketNumber: "NIR-2026-000001",
        assignedToId: "user-1",
        assignedById: "user-1",
        organizationId: "org-1",
      });

      expect(result).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe("notifyTicketStatusChanged", () => {
    it("creates status change notification", async () => {
      prisma.user.findUnique.mockResolvedValue({ username: "agent" });
      prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({
        id: "notif-1",
        type: "TICKET_STATUS_CHANGED",
        isRead: false,
      });

      const result = await notifyTicketStatusChanged({
        ticketId: "ticket-1",
        ticketNumber: "NIR-2026-000001",
        newStatus: "RESOLVED",
        recipientId: "user-1",
        organizationId: "org-1",
        actorId: "agent-1",
      });

      expect(result).not.toBeNull();
    });

    it("does not notify self", async () => {
      const result = await notifyTicketStatusChanged({
        ticketId: "ticket-1",
        ticketNumber: "NIR-2026-000001",
        newStatus: "RESOLVED",
        recipientId: "user-1",
        organizationId: "org-1",
        actorId: "user-1",
      });

      expect(result).toBeNull();
    });
  });

  describe("notifySLABreach", () => {
    it("creates SLA breach notification", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({
        id: "notif-1",
        type: "SLA_BREACHED",
        isRead: false,
      });

      const result = await notifySLABreach({
        ticketId: "ticket-1",
        ticketNumber: "NIR-2026-000001",
        slaType: "response",
        recipientId: "user-1",
        organizationId: "org-1",
      });

      expect(result).not.toBeNull();
    });
  });

  describe("notifySLAWarning", () => {
    it("creates SLA warning notification", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({
        id: "notif-1",
        type: "SLA_WARNING",
        isRead: false,
      });

      const result = await notifySLAWarning({
        ticketId: "ticket-1",
        ticketNumber: "NIR-2026-000001",
        slaType: "resolution",
        recipientId: "user-1",
        organizationId: "org-1",
      });

      expect(result).not.toBeNull();
    });
  });

  describe("notifyTicketReopened", () => {
    it("creates reopen notification", async () => {
      prisma.user.findUnique.mockResolvedValue({ username: "user" });
      prisma.ticket.findUnique.mockResolvedValue({ id: "ticket-1", organizationId: "org-1" });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({
        id: "notif-1",
        type: "TICKET_STATUS_CHANGED",
        isRead: false,
      });

      const result = await notifyTicketReopened({
        ticketId: "ticket-1",
        ticketNumber: "NIR-2026-000001",
        recipientId: "agent-1",
        organizationId: "org-1",
        actorId: "user-1",
      });

      expect(result).not.toBeNull();
    });

    it("does not notify self-reopen", async () => {
      const result = await notifyTicketReopened({
        ticketId: "ticket-1",
        ticketNumber: "NIR-2026-000001",
        recipientId: "user-1",
        organizationId: "org-1",
        actorId: "user-1",
      });

      expect(result).toBeNull();
    });
  });
});
