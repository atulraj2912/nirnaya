import { z } from "zod";

/**
 * Zod schemas for AI agent recommendation input/output validation.
 *
 * Per spec §18: "Recommendation output should include: recommended agent,
 * score, confidence, workload, relevant experience, explanation,
 * contributing factors, timestamp."
 */

const WORKLOAD_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "REOPENED",
];

/**
 * Schema for validating a single agent recommendation factor.
 */
export const factorSchema = z.object({
  name: z.string(),
  normalized: z.number().min(0).max(1),
  weight: z.number().min(0).max(1),
  contribution: z.number().min(0).max(100),
});

/**
 * Schema for validating a single agent recommendation.
 */
export const agentRecommendationSchema = z.object({
  agentId: z.string().uuid(),
  username: z.string(),
  email: z.string(),
  department: z.string().nullable(),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0.5).max(0.98).nullish(),
  workload: z.object({
    activeTickets: z.number().int().min(0),
    highPriorityTickets: z.number().int().min(0),
  }),
  experience: z.object({
    categoryResolved: z.number().int().min(0),
    totalResolved: z.number().int().min(0),
  }),
  explanation: z.string(),
  factors: z.array(factorSchema),
  rank: z.number().int().min(1),
  timestamp: z.string().datetime(),
});

/**
 * Schema for validating the full recommendation response.
 */
export const recommendationResponseSchema = z.object({
  ticketId: z.string().uuid(),
  recommendations: z.array(agentRecommendationSchema).max(10),
  totalEligibleAgents: z.number().int().min(0),
  generatedAt: z.string().datetime(),
});

/**
 * Validate recommendation output from the engine.
 * Returns validated data or throws on invalid data.
 *
 * @param {object} output - Raw recommendation output
 * @returns {object} Validated and normalized output
 */
export function validateRecommendationOutput(output) {
  const result = recommendationResponseSchema.safeParse(output);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid recommendation output: ${issues}`);
  }

  return result.data;
}

export { WORKLOAD_STATUSES };
