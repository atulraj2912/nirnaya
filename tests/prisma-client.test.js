import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Phase 2 tests — Prisma client singleton.
 *
 * Tests the singleton pattern used in src/lib/db/prisma.js to prevent
 * connection pool exhaustion in development hot-reload scenarios.
 */

describe("Prisma client singleton", () => {
  const originalGlobal = globalThis;

  beforeEach(() => {
    // Clear the cached singleton between tests
    vi.resetModules();
    delete globalThis.__prismaClient;
  });

  afterEach(() => {
    globalThis = originalGlobal;
  });

  it("exports a default PrismaClient instance", async () => {
    const mod = await import("@/lib/db/prisma");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default.$connect).toBe("function");
    expect(typeof mod.default.$disconnect).toBe("function");
  });

  it("returns the same instance on repeated imports (singleton)", async () => {
    const mod1 = await import("@/lib/db/prisma");
    const mod2 = await import("@/lib/db/prisma");
    expect(mod1.default).toBe(mod2.default);
  });

  it("caches instance on globalThis in non-production", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const mod = await import("@/lib/db/prisma");
    expect(globalThis.__prismaClient).toBe(mod.default);

    process.env.NODE_ENV = originalEnv;
  });
});
