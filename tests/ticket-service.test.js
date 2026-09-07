import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      update: vi.fn(),
    },
    department: {
      findFirst: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
    },
    tag: {
      count: vi.fn(),
    },
    ticketTag: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    ticketAssignmentHistory: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from "@/lib/db/prisma";
import {
  createTicket,
  listTickets,
  getTicketById,
  updateTicket,
  transitionStatus,
  assignTicket,
  TicketError,
} from "@/lib/services/ticket-service";

const mockUser = {
  id: "user-1",
  role: "USER",
  organizationId: "org-1",
};

const mockAgent = {
  id: "agent-1",
  role: "AGENT",
  organizationId: "org-1",
  status: "ACTIVE",
};

const mockAdmin = {
  id: "admin-1",
  role: "ADMIN",
  organizationId: "org-1",
};

const mockTicket = {
  id: "ticket-1",
  ticketNumber: "NIR-2026-000001",
  title: "Test ticket",
  description: "Test description",
  status: "OPEN",
  priority: "MEDIUM",
  type: "INCIDENT",
  organizationId: "org-1",
  departmentId: "dept-1",
  requesterId: "user-1",
  assignedAgentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  department: { id: "dept-1", name: "IT", code: "IT" },
  category: null,
  requester: { id: "user-1", username: "testuser", email: "test@example.com" },
  assignedAgent: null,
};

describe("Ticket service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTicket", () => {
    it("creates a ticket with valid data", async () => {
      prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
      prisma.tag.count.mockResolvedValue(0);
      prisma.organization.update.mockResolvedValue({ ticketCounter: 1 });
      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          ticket: {
            create: vi.fn().mockResolvedValue({ ...mockTicket, ticketNumber: "NIR-2026-000001" }),
          },
          ticketTag: {
            createMany: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await createTicket(
        {
          title: "Test ticket",
          description: "Test description",
          departmentId: "dept-1",
        },
        mockUser
      );

      expect(result.ticketNumber).toBe("NIR-2026-000001");
      expect(prisma.organization.update).toHaveBeenCalled();
    });

    it("throws if department not found", async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        createTicket(
          { title: "Test", description: "Desc", departmentId: "bad" },
          mockUser
        )
      ).rejects.toThrow(TicketError);
    });

    it("throws if category not found", async () => {
      prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        createTicket(
          { title: "Test", description: "Desc", departmentId: "dept-1", categoryId: "bad-cat" },
          mockUser
        )
      ).rejects.toThrow(TicketError);
    });
  });

  describe("getTicketById", () => {
    it("returns ticket for same org", async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...mockTicket,
        comments: [],
        ticketTags: [],
        assignmentHistory: [],
      });

      const result = await getTicketById("ticket-1", mockUser);
      expect(result.id).toBe("ticket-1");
    });

    it("throws for different org", async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...mockTicket,
        organizationId: "org-2",
      });

      await expect(getTicketById("ticket-1", mockUser)).rejects.toThrow(TicketError);
    });

    it("throws if USER tries to view another user's ticket", async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...mockTicket,
        requesterId: "user-other",
      });

      await expect(getTicketById("ticket-1", mockUser)).rejects.toThrow(TicketError);
    });

    it("allows AGENT to view any ticket in org", async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...mockTicket,
        requesterId: "user-other",
      });

      const result = await getTicketById("ticket-1", mockAgent);
      expect(result.id).toBe("ticket-1");
    });
  });

  describe("transitionStatus", () => {
    it("allows OPEN → ASSIGNED", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.ticket.update.mockResolvedValue({
        ...mockTicket,
        status: "ASSIGNED",
      });

      const result = await transitionStatus("ticket-1", "ASSIGNED", mockAgent);
      expect(result.status).toBe("ASSIGNED");
    });

    it("rejects invalid transition", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);

      await expect(
        transitionStatus("ticket-1", "CLOSED", mockAgent)
      ).rejects.toThrow(TicketError);
    });

    it("rejects cross-org transition", async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...mockTicket,
        organizationId: "org-2",
      });

      await expect(
        transitionStatus("ticket-1", "ASSIGNED", mockAgent)
      ).rejects.toThrow(TicketError);
    });
  });

  describe("assignTicket", () => {
    it("assigns ticket to valid agent", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findUnique.mockResolvedValue(mockAgent);
      prisma.$transaction.mockResolvedValue([
        { ...mockTicket, assignedAgentId: "agent-1", status: "ASSIGNED" },
        { id: "hist-1" },
      ]);

      const result = await assignTicket(
        "ticket-1",
        { agentId: "agent-1" },
        mockAdmin
      );
      expect(result.assignedAgentId).toBe("agent-1");
    });

    it("auto-transitions OPEN to ASSIGNED on assignment", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findUnique.mockResolvedValue(mockAgent);
      prisma.$transaction.mockResolvedValue([
        { ...mockTicket, assignedAgentId: "agent-1", status: "ASSIGNED" },
        { id: "hist-1" },
      ]);

      const result = await assignTicket("ticket-1", { agentId: "agent-1" }, mockAdmin);
      expect(result.status).toBe("ASSIGNED");
      expect(result.assignedAgentId).toBe("agent-1");
    });

    it("rejects assignment to inactive user", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findUnique.mockResolvedValue({ ...mockAgent, status: "INACTIVE" });

      await expect(
        assignTicket("ticket-1", { agentId: "agent-1" }, mockAdmin)
      ).rejects.toThrow(TicketError);
    });

    it("rejects assignment to non-agent role", async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      prisma.user.findUnique.mockResolvedValue({ ...mockAgent, role: "USER" });

      await expect(
        assignTicket("ticket-1", { agentId: "agent-1" }, mockAdmin)
      ).rejects.toThrow(TicketError);
    });
  });

  describe("listTickets", () => {
    it("returns paginated tickets for org", async () => {
      prisma.ticket.findMany.mockResolvedValue([mockTicket]);
      prisma.ticket.count.mockResolvedValue(1);

      const result = await listTickets({ page: 1, limit: 20 }, mockUser);
      expect(result.tickets).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("enforces org isolation in query", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await listTickets({}, mockUser);

      const findCall = prisma.ticket.findMany.mock.calls[0][0];
      expect(findCall.where.organizationId).toBe("org-1");
    });

    it("restricts USER to own tickets only", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await listTickets({}, mockUser);

      const findCall = prisma.ticket.findMany.mock.calls[0][0];
      expect(findCall.where.requesterId).toBe("user-1");
    });

    it("does not restrict AGENT to own tickets", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await listTickets({}, mockAgent);

      const findCall = prisma.ticket.findMany.mock.calls[0][0];
      expect(findCall.where.requesterId).toBeUndefined();
    });

    describe("scope: my-active", () => {
      it("USER gets own tickets excluding RESOLVED and CLOSED", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active" }, mockUser);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        expect(findCall.where.requesterId).toBe("user-1");
        expect(findCall.where.status).toEqual({ notIn: ["RESOLVED", "CLOSED"] });
      });

      it("AGENT gets assigned tickets with active statuses", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active" }, mockAgent);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        expect(findCall.where.assignedAgentId).toBe("agent-1");
        expect(findCall.where.status).toEqual({
          in: ["ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "REOPENED"],
        });
      });

      it("ADMIN gets assigned tickets with active statuses", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active" }, mockAdmin);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        expect(findCall.where.assignedAgentId).toBe("admin-1");
        expect(findCall.where.status).toEqual({
          in: ["ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "REOPENED"],
        });
      });

      it("enforces org isolation with scope", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active" }, mockUser);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        expect(findCall.where.organizationId).toBe("org-1");
      });

      it("client-supplied requesterId is ignored for USER", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active", requesterId: "other-user" }, mockUser);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        expect(findCall.where.requesterId).toBe("user-1");
      });

      it("client-supplied assignedAgentId is ignored for AGENT", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active", assignedAgentId: "other-agent" }, mockAgent);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        expect(findCall.where.assignedAgentId).toBe("agent-1");
      });

      it("USER scope returns own active tickets", async () => {
        const activeTicket = { ...mockTicket, status: "IN_PROGRESS" };
        prisma.ticket.findMany.mockResolvedValue([activeTicket]);
        prisma.ticket.count.mockResolvedValue(1);

        const result = await listTickets({ scope: "my-active" }, mockUser);
        expect(result.tickets).toHaveLength(1);
        expect(result.tickets[0].status).toBe("IN_PROGRESS");
      });

      it("USER scope excludes RESOLVED tickets", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active", status: "RESOLVED" }, mockUser);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        expect(findCall.where.status).toEqual({ notIn: ["RESOLVED", "CLOSED"] });
      });

      it("AGENT scope excludes RESOLVED and CLOSED tickets", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active" }, mockAgent);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        const statuses = findCall.where.status.in;
        expect(statuses).not.toContain("RESOLVED");
        expect(statuses).not.toContain("CLOSED");
        expect(statuses).not.toContain("OPEN");
      });

      it("client-supplied OPEN status is overridden by USER scope", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active", status: "OPEN" }, mockUser);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        expect(findCall.where.status).toEqual({ notIn: ["RESOLVED", "CLOSED"] });
      });

      it("client-supplied CLOSED status is overridden by USER scope", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active", status: "CLOSED" }, mockUser);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        expect(findCall.where.status).toEqual({ notIn: ["RESOLVED", "CLOSED"] });
      });

      it("client-supplied OPEN status is overridden by AGENT scope", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active", status: "OPEN" }, mockAgent);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        expect(findCall.where.status).toEqual({
          in: ["ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "REOPENED"],
        });
      });

      it("client-supplied CLOSED status is overridden by AGENT scope", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active", status: "CLOSED" }, mockAgent);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        expect(findCall.where.status).toEqual({
          in: ["ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "REOPENED"],
        });
      });

      it("client-supplied RESOLVED status is overridden by AGENT scope", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);

        await listTickets({ scope: "my-active", status: "RESOLVED" }, mockAgent);

        const findCall = prisma.ticket.findMany.mock.calls[0][0];
        expect(findCall.where.status).toEqual({
          in: ["ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "REOPENED"],
        });
      });
    });
  });
});
