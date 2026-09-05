import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("env validation (Zod schema)", () => {
  it("validates a correct env object", () => {
    const schema = z.object({
      NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
      PORT: z.coerce.number().int().min(1).max(65535).default(3000),
      DATABASE_URL: z.string().min(1),
      DIRECT_URL: z.string().min(1),
      JWT_ACCESS_SECRET: z.string().min(16),
      JWT_REFRESH_SECRET: z.string().min(16),
    });

    const result = schema.safeParse({
      NODE_ENV: "development",
      PORT: "3000",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
      JWT_ACCESS_SECRET: "a-strong-secret-that-is-long-enough",
      JWT_REFRESH_SECRET: "a-different-strong-secret-long-enough",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing DATABASE_URL", () => {
    const schema = z.object({
      DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    });

    const result = schema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects short JWT_ACCESS_SECRET", () => {
    const schema = z.object({
      JWT_ACCESS_SECRET: z.string().min(16),
    });

    const result = schema.safeParse({ JWT_ACCESS_SECRET: "short" });
    expect(result.success).toBe(false);
  });

  it("applies defaults for NODE_ENV and PORT", () => {
    const schema = z.object({
      NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
      PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    });

    const result = schema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
      expect(result.data.PORT).toBe(3000);
    }
  });
});
