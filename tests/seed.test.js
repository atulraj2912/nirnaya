import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Phase 2 tests — Seed script validation.
 *
 * Tests that the seed script structure is correct and follows
 * the idempotency requirements from spec §28.
 */

const SEED_PATH = resolve(import.meta.dirname, "../prisma/seed.js");
const seedContent = readFileSync(SEED_PATH, "utf-8");

describe("Seed script structure", () => {
  it("is an ESM module (uses import syntax)", () => {
    expect(seedContent).toContain('import { PrismaClient }');
    expect(seedContent).toContain('import bcrypt');
  });

  it("uses bcrypt for password hashing", () => {
    expect(seedContent).toContain("bcrypt.hash");
    expect(seedContent).toContain("SALT_ROUNDS");
  });

  it("does not hardcode real credentials in source", () => {
    // The seed script should use env vars or development-only defaults
    expect(seedContent).toContain("process.env.SEED_ADMIN_PASSWORD");
    // Should have clearly documented dev-only defaults
    expect(seedContent).toMatch(/default:.*admin.*123/i);
  });

  it("is idempotent — uses upsert or checks for existing records", () => {
    // Must check for existing records before creating
    expect(seedContent).toContain("findFirst");
    // Must use upsert or conditional create
    expect(seedContent).toMatch(/upsert|existing/);
  });

  it("creates the required organization", () => {
    expect(seedContent).toContain("Acme Corporation");
    expect(seedContent).toContain("acme-corp");
  });

  it("creates departments with codes", () => {
    expect(seedContent).toContain("IT Support");
    expect(seedContent).toContain("Network Operations");
    expect(seedContent).toContain("Software Engineering");
    expect(seedContent).toContain("Human Resources");
    expect(seedContent).toContain("Finance");
  });

  it("creates users with different roles (ADMIN, AGENT, USER)", () => {
    expect(seedContent).toContain('role: "ADMIN"');
    expect(seedContent).toContain('role: "AGENT"');
    expect(seedContent).toContain('role: "USER"');
  });

  it("creates all 8 required categories", () => {
    const categories = [
      "NETWORK", "HARDWARE", "SOFTWARE", "EMAIL",
      "ACCOUNT", "DATABASE", "SECURITY", "INFRASTRUCTURE",
    ];
    for (const cat of categories) {
      expect(seedContent).toContain(`"${cat}"`);
    }
  });

  it("creates SLA configurations for all priorities", () => {
    expect(seedContent).toContain('"LOW"');
    expect(seedContent).toContain('"MEDIUM"');
    expect(seedContent).toContain('"HIGH"');
    expect(seedContent).toContain('"CRITICAL"');
    expect(seedContent).toContain("responseTimeMinutes");
    expect(seedContent).toContain("resolutionTimeMinutes");
  });

  it("creates sample tickets with different statuses", () => {
    expect(seedContent).toContain('"OPEN"');
    expect(seedContent).toContain('"ASSIGNED"');
    expect(seedContent).toContain('"IN_PROGRESS"');
    expect(seedContent).toContain('"RESOLVED"');
    expect(seedContent).toContain('"WAITING_FOR_USER"');
  });

  it("creates comments with both PUBLIC and INTERNAL visibility", () => {
    expect(seedContent).toContain('visibility: "PUBLIC"');
    expect(seedContent).toContain('visibility: "INTERNAL"');
  });

  it("creates watchers for relevant tickets", () => {
    expect(seedContent).toContain("watcher");
    expect(seedContent).toContain("Watcher");
  });

  it("creates assignment history records", () => {
    expect(seedContent).toContain("AssignmentHistory");
    expect(seedContent).toContain("assignedToId");
    expect(seedContent).toContain("assignedById");
    expect(seedContent).toContain("reason");
  });

  it("creates saved replies", () => {
    expect(seedContent).toContain("savedReply");
    expect(seedContent).toContain("Ticket Received");
    expect(seedContent).toContain("Password Reset Instructions");
  });

  it("uses atomic counter for ticket numbering", () => {
    expect(seedContent).toContain("ticketCounter");
    expect(seedContent).toContain("increment");
  });

  it("disconnects Prisma client after seeding", () => {
    expect(seedContent).toContain("$disconnect");
  });

  it("has a main() function that orchestrates all seed steps", () => {
    expect(seedContent).toContain("async function main()");
    expect(seedContent).toContain("main()");
  });

  it("logs progress during seeding", () => {
    expect(seedContent).toContain("console.log");
    expect(seedContent).toMatch(/✓|✅|seed/i);
  });

  it("displays test credentials after seeding", () => {
    expect(seedContent).toContain("Test credentials");
    expect(seedContent).toContain("admin@acme-corp.com");
    expect(seedContent).toContain("sarah.chen@acme-corp.com");
    expect(seedContent).toContain("john.smith@acme-corp.com");
  });
});
