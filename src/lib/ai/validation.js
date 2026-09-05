import { z } from "zod";

/**
 * Zod schemas for AI classification input/output validation.
 *
 * Per spec §17: "AI output must be validated before use."
 * Per spec §40: "If an implementation detail is unspecified, choose
 * the simplest sound solution."
 */

const VALID_CATEGORIES = [
  "NETWORK",
  "HARDWARE",
  "SOFTWARE",
  "EMAIL",
  "ACCOUNT",
  "DATABASE",
  "SECURITY",
  "INFRASTRUCTURE",
];

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/**
 * Schema for validating AI provider raw output before normalization.
 * Providers may return category as a name string; we validate it
 * against known category names.
 *
 * Uses pre-processing transforms to handle NaN, Infinity, and
 * oversized strings before Zod validation.
 */
export const rawClassificationOutputSchema = z.preprocess(
  (raw) => {
    // Pre-process: coerce invalid values before Zod validation
    if (raw && typeof raw === "object") {
      const processed = { ...raw };
      // Handle NaN/Infinity confidence
      if (typeof processed.confidence === "number") {
        if (isNaN(processed.confidence) || !isFinite(processed.confidence)) {
          processed.confidence = null;
        }
      }
      // Truncate long strings
      if (typeof processed.explanation === "string" && processed.explanation.length > 2000) {
        processed.explanation = processed.explanation.slice(0, 2000);
      }
      if (typeof processed.suggestedNextSteps === "string" && processed.suggestedNextSteps.length > 2000) {
        processed.suggestedNextSteps = processed.suggestedNextSteps.slice(0, 2000);
      }
      return processed;
    }
    return raw;
  },
  z.object({
    categoryName: z
      .string()
      .nullable()
      .optional()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return null;
        return val.toUpperCase().trim();
      })
      .refine(
        (val) => val === null || VALID_CATEGORIES.includes(val),
        { message: "Invalid category name" }
      ),
    predictedPriority: z
      .string()
      .nullable()
      .optional()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return null;
        return val.toUpperCase().trim();
      })
      .refine(
        (val) => val === null || VALID_PRIORITIES.includes(val),
        { message: "Invalid priority" }
      ),
    departmentName: z
      .string()
      .nullable()
      .optional()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return null;
        return val.trim();
      }),
    confidence: z
      .number()
      .min(0, "Confidence must be >= 0")
      .max(1, "Confidence must be <= 1")
      .nullable()
      .optional()
      .transform((val) => {
        if (val === null || val === undefined) return null;
        return Math.round(val * 1000) / 1000; // 3 decimal places
      }),
    explanation: z
      .string()
      .max(2000, "Explanation too long")
      .nullable()
      .optional()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return null;
        return val.trim();
      }),
    suggestedNextSteps: z
      .string()
      .max(2000, "Suggested next steps too long")
      .nullable()
      .optional()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return null;
        return val.trim();
      }),
  })
);

/**
 * Input schema for the classifier.
 * Normalizes and validates ticket context before sending to provider.
 */
export const classificationInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  type: z.enum(["INCIDENT", "SERVICE_REQUEST"]).optional(),
  source: z.enum(["WEB", "EMAIL", "API"]).optional(),
  departmentName: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
});

/**
 * Normalize and validate raw provider output.
 * Returns validated output or throws on invalid data.
 *
 * @param {object} rawOutput - Raw output from AI provider
 * @param {string} providerName - Provider identifier
 * @returns {object} Validated and normalized output
 */
export function validateClassificationOutput(rawOutput, providerName) {
  const result = rawClassificationOutputSchema.safeParse(rawOutput);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid AI classification output from ${providerName}: ${issues}`);
  }

  return {
    categoryName: result.data.categoryName,
    predictedPriority: result.data.predictedPriority,
    departmentName: result.data.departmentName,
    confidence: result.data.confidence,
    explanation: result.data.explanation,
    suggestedNextSteps: result.data.suggestedNextSteps,
    provider: providerName,
  };
}

export { VALID_CATEGORIES, VALID_PRIORITIES };
