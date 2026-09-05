import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton for NIRNAYA.
 *
 * In development, Next.js hot-reloads modules on every request, which
 * would create a new PrismaClient instance each time and exhaust the
 * connection pool. The global cache pattern prevents this.
 *
 * In production and test environments, a fresh client is created
 * normally.
 */

const globalForPrisma = /** @type {any} */ (globalThis);

const prisma =
  globalForPrisma.__prismaClient ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prismaClient = prisma;
}

export default prisma;
