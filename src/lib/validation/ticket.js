import { z } from "zod";

const TicketPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const TicketTypeEnum = z.enum(["INCIDENT", "SERVICE_REQUEST"]);
const TicketSourceEnum = z.enum(["WEB", "EMAIL", "API"]);
const TicketStatusEnum = z.enum([
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
]);

export const createTicketSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(10000, "Description must be at most 10,000 characters"),
  priority: TicketPriorityEnum.default("MEDIUM"),
  type: TicketTypeEnum.default("INCIDENT"),
  source: TicketSourceEnum.default("WEB"),
  departmentId: z.string().min(1, "Department is required"),
  categoryId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).max(10, "At most 10 tags allowed").optional(),
});

export const updateTicketSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters")
    .optional(),
  description: z
    .string()
    .min(1, "Description is required")
    .max(10000, "Description must be at most 10,000 characters")
    .optional(),
  priority: TicketPriorityEnum.optional(),
  type: TicketTypeEnum.optional(),
  departmentId: z.string().min(1).optional(),
  categoryId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).max(10).optional(),
});

export const statusTransitionSchema = z.object({
  status: TicketStatusEnum,
});

export const assignTicketSchema = z.object({
  agentId: z.string().min(1, "Agent ID is required"),
  reason: z
    .string()
    .max(500, "Reason must be at most 500 characters")
    .optional(),
});

export const ticketListQuerySchema = z.object({
  status: TicketStatusEnum.optional(),
  priority: TicketPriorityEnum.optional(),
  type: TicketTypeEnum.optional(),
  categoryId: z.string().optional(),
  assignedAgentId: z.string().optional(),
  requesterId: z.string().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "updatedAt", "priority", "status"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export { TicketPriorityEnum, TicketTypeEnum, TicketSourceEnum, TicketStatusEnum };
