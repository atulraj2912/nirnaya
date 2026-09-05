import { z } from "zod";

const RoleEnum = z.enum(["USER", "AGENT", "ADMIN"]);
const UserStatusEnum = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);
const TicketPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be at most 50 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, hyphens, and underscores"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  role: RoleEnum.default("USER"),
  departmentId: z.string().min(1, "Department is required"),
  employeeId: z.string().max(50).optional(),
  designation: z.string().max(100).optional(),
});

export const updateUserSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  email: z.string().email().optional(),
  role: RoleEnum.optional(),
  status: UserStatusEnum.optional(),
  departmentId: z.string().min(1).optional(),
  employeeId: z.string().max(50).nullable().optional(),
  designation: z.string().max(100).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export const createDepartmentSchema = z.object({
  name: z
    .string()
    .min(1, "Department name is required")
    .max(100, "Department name must be at most 100 characters"),
  code: z
    .string()
    .min(1, "Department code is required")
    .max(20, "Department code must be at most 20 characters")
    .regex(/^[A-Z0-9_-]+$/, "Code can only contain uppercase letters, numbers, hyphens, and underscores"),
  managerId: z.string().nullable().optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/)
    .optional(),
  managerId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(100, "Category name must be at most 100 characters"),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(50, "Tag name must be at most 50 characters"),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
});

export const createSLAConfigSchema = z.object({
  priority: TicketPriorityEnum,
  responseTimeMinutes: z
    .number()
    .int()
    .min(1, "Response time must be at least 1 minute")
    .max(43200, "Response time must be at most 43200 minutes (30 days)"),
  resolutionTimeMinutes: z
    .number()
    .int()
    .min(1, "Resolution time must be at least 1 minute")
    .max(43200, "Resolution time must be at most 43200 minutes (30 days)"),
});

export const updateSLAConfigSchema = z.object({
  responseTimeMinutes: z
    .number()
    .int()
    .min(1)
    .max(43200)
    .optional(),
  resolutionTimeMinutes: z
    .number()
    .int()
    .min(1)
    .max(43200)
    .optional(),
});

export const updateOrgSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  timezone: z.string().max(50).optional(),
});
