import { z } from "zod";

/**
 * Analytics query parameter validation schemas.
 *
 * All analytics parameters are validated server-side before use.
 * organizationId and agentId are NEVER accepted from client input.
 */

const MAX_DATE_RANGE_DAYS = 365;

/**
 * Parse a date string or null. Returns Date object or undefined.
 */
function parseDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) return undefined;
  return date;
}

/**
 * Admin analytics query schema.
 * Supports timeWindow (legacy) or explicit start/end date range.
 */
export const adminAnalyticsQuerySchema = z
  .object({
    timeWindow: z.enum(["today", "7d", "30d", "month"]).optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    granularity: z.enum(["hour", "day", "week", "month"]).default("day"),
  })
  .refine(
    (data) => {
      // Either timeWindow or start/end, not both
      if (data.timeWindow && (data.start || data.end)) return false;
      return true;
    },
    { message: "Cannot use both timeWindow and start/end parameters" }
  )
  .refine(
    (data) => {
      if (data.start && data.end) {
        const startDate = parseDate(data.start);
        const endDate = parseDate(data.end);
        if (!startDate || !endDate) return false;
        if (endDate < startDate) return false;
        const diffDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
        if (diffDays > MAX_DATE_RANGE_DAYS) return false;
      }
      return true;
    },
    {
      message: `Invalid date range. start and end must be valid dates, end must be after start, and range must not exceed ${MAX_DATE_RANGE_DAYS} days`,
    }
  );

/**
 * Agent analytics query schema.
 * Same structure as admin but scope is always the authenticated agent.
 */
export const agentAnalyticsQuerySchema = z
  .object({
    timeWindow: z.enum(["today", "7d", "30d", "month"]).optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    granularity: z.enum(["hour", "day", "week", "month"]).default("day"),
  })
  .refine(
    (data) => {
      if (data.timeWindow && (data.start || data.end)) return false;
      return true;
    },
    { message: "Cannot use both timeWindow and start/end parameters" }
  )
  .refine(
    (data) => {
      if (data.start && data.end) {
        const startDate = parseDate(data.start);
        const endDate = parseDate(data.end);
        if (!startDate || !endDate) return false;
        if (endDate < startDate) return false;
        const diffDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
        if (diffDays > MAX_DATE_RANGE_DAYS) return false;
      }
      return true;
    },
    {
      message: `Invalid date range. start and end must be valid dates, end must be after start, and range must not exceed ${MAX_DATE_RANGE_DAYS} days`,
    }
  );

/**
 * Resolve a time window or explicit date range into start/end Date objects.
 * Always returns server-controlled dates.
 *
 * @param {object} params
 * @param {string} [params.timeWindow]
 * @param {string} [params.start]
 * @param {string} [params.end]
 * @returns {{ start: Date, end: Date }}
 */
export function resolveDateRange({ timeWindow, start, end }) {
  const now = new Date();
  let startDate;

  if (start && end) {
    startDate = new Date(start);
    const endDate = new Date(end);
    return { start: startDate, end: endDate };
  }

  switch (timeWindow) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { start: startDate, end: now };
}
