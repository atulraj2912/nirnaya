import { z } from "zod";

/**
 * Server-side environment variable validation.
 *
 * Validates required env vars at startup using Zod. Client-side code
 * must NOT import this module — it accesses process.env directly and
 * should only run in Node.js (route handlers, middleware, server
 * components with "use server", etc.).
 */

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // Database — required from Phase 2, validated here for early fail-fast
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),

  // Auth — required from Phase 3, validated here for early fail-fast
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),

  // AI — optional, validated from Phase 5
  AI_PROVIDER: z.string().optional(),
  AI_PROVIDER_API_KEY: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_API_BASE_URL: z.string().optional(),
  AI_MODEL: z.string().optional(),
});

let _validatedEnv = null;

/**
 * Parse and validate process.env against the server schema.
 * Caches the result so validation runs at most once per process.
 *
 * @returns {z.infer<typeof serverEnvSchema>}
 */
export function getEnv() {
  if (_validatedEnv) return _validatedEnv;

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const errors = Object.entries(formatted)
      .filter(([key]) => key !== "_errors")
      .flatMap(([, val]) => val._errors || [])
      .filter(Boolean);

    throw new Error(
      `Environment validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }

  _validatedEnv = result.data;
  return _validatedEnv;
}

/**
 * Type-safe accessor for an env var that is known to exist.
 * Throws if env has not been validated yet.
 *
 * @param {string} key
 * @returns {string}
 */
export function requireEnv(key) {
  const env = getEnv();
  if (!(key in env)) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return env[key];
}
