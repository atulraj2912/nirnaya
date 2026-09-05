import prisma from "@/lib/db/prisma";
import {
  createTicketSchema,
  updateTicketSchema,
  statusTransitionSchema,
  assignTicketSchema,
  ticketListQuerySchema,
} from "@/lib/validation/ticket";
import { canTransition, getAllowedTransitions } from "./lifecycle";
import {
  initializeTicketSLA,
  pauseSLA,
  resumeSLA,
  completeResolutionSLA,
  reopenSLA,
  recalculateResolutionSLA,
  evaluateAndPersistSLA,
} from "./sla-service";

/**
 * Generate a ticket number in NIR-YYYY-000001 format.
 * Uses atomic counter increment on Organization to prevent collisions.
 *
 * @param {string} organizationId
 * @returns {Promise<string>}
 */
async function generateTicketNumber(organizationId) {
  const year = new Date().getFullYear();

  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: { ticketCounter: { increment: 1 } },
    select: { ticketCounter: true },
  });

  const number = String(org.ticketCounter).padStart(6, "0");
  return `NIR-${year}-${number}`;
}

/**
 * Create a new ticket.
 *
 * @param {object} data - Validated ticket data
 * @param {object} user - Authenticated user
 * @returns {Promise<object>} Created ticket
 */
export async function createTicket(data, user) {
  const parsed = createTicketSchema.parse(data);
  const orgId = user.organizationId;

  // Validate department belongs to same org
  const department = await prisma.department.findFirst({
    where: { id: parsed.departmentId, organizationId: orgId, isActive: true },
  });
  if (!department) {
    throw new TicketError("Department not found or inactive", 404);
  }

  // Validate category if provided
  if (parsed.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: parsed.categoryId, organizationId: orgId, isActive: true },
    });
    if (!category) {
      throw new TicketError("Category not found or inactive", 404);
    }
  }

  // Validate tags if provided
  if (parsed.tagIds && parsed.tagIds.length > 0) {
    const tagCount = await prisma.tag.count({
      where: { id: { in: parsed.tagIds }, organizationId: orgId },
    });
    if (tagCount !== parsed.tagIds.length) {
      throw new TicketError("One or more tags not found", 404);
    }
  }

  // Generate ticket number atomically
  const ticketNumber = await generateTicketNumber(orgId);

  // Create ticket with tags in a transaction
  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        ticketNumber,
        title: parsed.title,
        description: parsed.description,
        priority: parsed.priority,
        type: parsed.type,
        source: parsed.source,
        organizationId: orgId,
        departmentId: parsed.departmentId,
        categoryId: parsed.categoryId || null,
        requesterId: user.id,
        createdById: user.id,
        updatedById: user.id,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true } },
        requester: { select: { id: true, username: true, email: true, designation: true } },
      },
    });

    // Attach tags
    if (parsed.tagIds && parsed.tagIds.length > 0) {
      await tx.ticketTag.createMany({
        data: parsed.tagIds.map((tagId) => ({
          ticketId: created.id,
          tagId,
        })),
      });
    }

    return created;
  });

  // Initialize SLA clocks (fire-and-forget, non-blocking)
  initializeTicketSLA(ticket.id, orgId, ticket.priority).catch((err) => {
    console.error("SLA initialization failed:", err);
  });

  return ticket;
}

/**
 * List tickets with filters, pagination, and sorting.
 * Organization-scoped. Role-aware (USER sees only own tickets).
 *
 * @param {object} query - Validated query params
 * @param {object} user - Authenticated user
 * @returns {Promise<{tickets: object[], total: number, page: number, limit: number, totalPages: number}>}
 */
export async function listTickets(query, user) {
  const params = ticketListQuerySchema.parse(query);
  const orgId = user.organizationId;

  const where = { organizationId: orgId };

  // USER can only see their own tickets
  if (user.role === "USER") {
    where.requesterId = user.id;
  }

  // Apply filters
  if (params.status) where.status = params.status;
  if (params.priority) where.priority = params.priority;
  if (params.type) where.type = params.type;
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.assignedAgentId) where.assignedAgentId = params.assignedAgentId;
  if (params.requesterId && user.role !== "USER") {
    where.requesterId = params.requesterId;
  }
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { ticketNumber: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const skip = (params.page - 1) * params.limit;

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true } },
        requester: { select: { id: true, username: true, email: true } },
        assignedAgent: { select: { id: true, username: true, email: true } },
        _count: { select: { comments: true, watchers: true } },
      },
      orderBy: { [params.sort]: params.order },
      skip,
      take: params.limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    tickets,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

/**
 * Get a single ticket by ID with full relations.
 * Organization-scoped.
 *
 * @param {string} ticketId
 * @param {object} user - Authenticated user
 * @returns {Promise<object>}
 */
export async function getTicketById(ticketId, user) {
  const orgId = user.organizationId;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      department: { select: { id: true, name: true, code: true } },
      category: { select: { id: true, name: true } },
      requester: { select: { id: true, username: true, email: true, designation: true, avatarUrl: true } },
      assignedAgent: { select: { id: true, username: true, email: true, designation: true, avatarUrl: true } },
      ticketTags: {
        include: { tag: { select: { id: true, name: true } } },
      },
      comments: {
        include: {
          author: { select: { id: true, username: true, role: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      assignmentHistory: {
        include: {
          assignedTo: { select: { id: true, username: true } },
          assignedBy: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { watchers: true } },
    },
  });

  if (!ticket) {
    throw new TicketError("Ticket not found", 404);
  }

  // Organization isolation
  if (ticket.organizationId !== orgId) {
    throw new TicketError("Ticket not found", 404);
  }

  // USER can only see their own tickets
  if (user.role === "USER" && ticket.requesterId !== user.id) {
    throw new TicketError("Ticket not found", 404);
  }

  // Filter out internal comments for USER role
  if (user.role === "USER") {
    ticket.comments = ticket.comments.filter((c) => c.visibility === "PUBLIC");
  }

  // Add allowed transitions to response
  ticket.allowedTransitions = getAllowedTransitions(ticket.status);

  return ticket;
}

/**
 * Update ticket fields.
 * Organization-scoped. Protected fields cannot be changed.
 *
 * @param {string} ticketId
 * @param {object} data - Validated update data
 * @param {object} user - Authenticated user
 * @returns {Promise<object>}
 */
export async function updateTicket(ticketId, data, user) {
  const parsed = updateTicketSchema.parse(data);
  const orgId = user.organizationId;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

  if (!ticket) {
    throw new TicketError("Ticket not found", 404);
  }

  if (ticket.organizationId !== orgId) {
    throw new TicketError("Ticket not found", 404);
  }

  // Validate department if changing
  if (parsed.departmentId) {
    const department = await prisma.department.findFirst({
      where: { id: parsed.departmentId, organizationId: orgId, isActive: true },
    });
    if (!department) {
      throw new TicketError("Department not found or inactive", 404);
    }
  }

  // Validate category if changing
  if (parsed.categoryId !== undefined) {
    if (parsed.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: parsed.categoryId, organizationId: orgId, isActive: true },
      });
      if (!category) {
        throw new TicketError("Category not found or inactive", 404);
      }
    }
  }

  // Validate tags if changing
  if (parsed.tagIds !== undefined) {
    if (parsed.tagIds.length > 0) {
      const tagCount = await prisma.tag.count({
        where: { id: { in: parsed.tagIds }, organizationId: orgId },
      });
      if (tagCount !== parsed.tagIds.length) {
        throw new TicketError("One or more tags not found", 404);
      }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const { tagIds, ...ticketData } = parsed;

    const updatedTicket = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        ...ticketData,
        updatedById: user.id,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true } },
        requester: { select: { id: true, username: true, email: true } },
        assignedAgent: { select: { id: true, username: true, email: true } },
      },
    });

    // Handle tag changes if provided
    if (tagIds !== undefined) {
      await tx.ticketTag.deleteMany({ where: { ticketId } });
      if (tagIds.length > 0) {
        await tx.ticketTag.createMany({
          data: tagIds.map((tagId) => ({ ticketId, tagId })),
        });
      }
    }

    return updatedTicket;
  });

  // Recalculate resolution SLA if priority changed
  if (parsed.priority && parsed.priority !== ticket.priority) {
    recalculateResolutionSLA(ticketId, parsed.priority).catch((err) => {
      console.error("SLA recalculation failed:", err);
    });
  }

  return updated;
}

/**
 * Transition ticket status.
 * Enforces lifecycle rules from spec §12 / D-006.
 *
 * @param {string} ticketId
 * @param {string} newStatus
 * @param {object} user - Authenticated user
 * @returns {Promise<object>}
 */
export async function transitionStatus(ticketId, newStatus, user) {
  statusTransitionSchema.parse({ status: newStatus });

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

  if (!ticket) {
    throw new TicketError("Ticket not found", 404);
  }

  if (ticket.organizationId !== user.organizationId) {
    throw new TicketError("Ticket not found", 404);
  }

  // Check lifecycle transition
  const transition = canTransition(ticket.status, newStatus, user.role, {
    requesterId: ticket.requesterId,
    actorId: user.id,
  });

  if (!transition.allowed) {
    throw new TicketError(transition.reason, 409);
  }

  // Build update data based on transition
  const updateData = {
    status: newStatus,
    updatedById: user.id,
  };

  // Set server-controlled timestamp fields
  if (newStatus === "RESOLVED") {
    updateData.resolvedAt = new Date();
  } else if (newStatus === "CLOSED") {
    updateData.closedAt = new Date();
  } else if (newStatus === "WAITING_FOR_USER") {
    updateData.waitingSince = new Date();
  } else if (newStatus === "IN_PROGRESS" && ticket.status === "WAITING_FOR_USER") {
    updateData.waitingSince = null;
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: updateData,
    include: {
      department: { select: { id: true, name: true, code: true } },
      category: { select: { id: true, name: true } },
      requester: { select: { id: true, username: true, email: true } },
      assignedAgent: { select: { id: true, username: true, email: true } },
    },
  });

  updated.allowedTransitions = getAllowedTransitions(updated.status);

  // SLA lifecycle hooks (fire-and-forget)
  if (newStatus === "WAITING_FOR_USER") {
    pauseSLA(ticketId).catch((err) => console.error("SLA pause failed:", err));
  } else if (newStatus === "IN_PROGRESS" && ticket.status === "WAITING_FOR_USER") {
    resumeSLA(ticketId).catch((err) => console.error("SLA resume failed:", err));
  } else if (newStatus === "RESOLVED") {
    completeResolutionSLA(ticketId).catch((err) => console.error("SLA completion failed:", err));
  } else if (newStatus === "REOPENED") {
    reopenSLA(ticketId).catch((err) => console.error("SLA reopen failed:", err));
  }

  return updated;
}

/**
 * Assign or reassign a ticket to an agent.
 * Validates agent eligibility and records assignment history.
 *
 * @param {string} ticketId
 * @param {object} data - { agentId, reason? }
 * @param {object} user - Authenticated user
 * @returns {Promise<object>}
 */
export async function assignTicket(ticketId, data, user) {
  const parsed = assignTicketSchema.parse(data);

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

  if (!ticket) {
    throw new TicketError("Ticket not found", 404);
  }

  if (ticket.organizationId !== user.organizationId) {
    throw new TicketError("Ticket not found", 404);
  }

  // Validate target agent
  const agent = await prisma.user.findUnique({ where: { id: parsed.agentId } });

  if (!agent) {
    throw new TicketError("Agent not found", 404);
  }

  if (agent.organizationId !== user.organizationId) {
    throw new TicketError("Agent not found", 404);
  }

  if (agent.role !== "AGENT" && agent.role !== "ADMIN") {
    throw new TicketError("Can only assign to AGENT or ADMIN users", 400);
  }

  if (agent.status !== "ACTIVE") {
    throw new TicketError("Cannot assign to inactive user", 400);
  }

  // Update ticket and create assignment history in a transaction
  const [updated] = await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedAgentId: parsed.agentId,
        updatedById: user.id,
        // Auto-transition OPEN → ASSIGNED if needed
        ...(ticket.status === "OPEN" ? { status: "ASSIGNED" } : {}),
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true } },
        requester: { select: { id: true, username: true, email: true } },
        assignedAgent: { select: { id: true, username: true, email: true } },
      },
    }),
    prisma.ticketAssignmentHistory.create({
      data: {
        ticketId,
        assignedToId: parsed.agentId,
        assignedById: user.id,
        reason: parsed.reason || null,
      },
    }),
  ]);

  updated.allowedTransitions = getAllowedTransitions(updated.status);

  return updated;
}

/**
 * Custom error class for ticket operations.
 */
export class TicketError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "TicketError";
    this.status = status;
  }
}
