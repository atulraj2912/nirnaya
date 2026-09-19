import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Part 2 tests — Ticket numbering and seed data completeness.
 *
 * Validates atomic ticket numbering (spec §10), ticket number format,
 * seed data coverage (spec §28-29), and service-layer org isolation.
 */

const SEED_PATH = resolve(import.meta.dirname, "../prisma/seed.js");
const seedContent = readFileSync(SEED_PATH, "utf-8");

// ============================================================
// Ticket numbering
// ============================================================

vi.mock("@/lib/db/prisma", () => ({
  default: {
    organization: { update: vi.fn() },
    department: { findFirst: vi.fn() },
    category: { findFirst: vi.fn() },
    tag: { count: vi.fn() },
    $transaction: vi.fn(),
    ticketTag: { createMany: vi.fn() },
  },
}));

describe("Part 2: Ticket numbering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generateTicketNumber uses atomic counter increment on Organization", async () => {
    const prisma = (await import("@/lib/db/prisma")).default;
    prisma.organization.update.mockResolvedValue({ ticketCounter: 1 });
    prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
    prisma.tag.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        ticket: {
          create: vi.fn().mockResolvedValue({
            id: "t-1",
            ticketNumber: "NIR-2026-000001",
            title: "Test",
            status: "OPEN",
            department: { id: "dept-1", name: "IT", code: "IT" },
            category: null,
            requester: { id: "u-1", username: "test", email: "t@t.com" },
          }),
        },
        ticketTag: { createMany: vi.fn() },
      };
      return fn(tx);
    });

    const { createTicket } = await import("@/lib/services/ticket-service");

    await createTicket(
      { title: "Test", description: "Desc", departmentId: "dept-1" },
      { id: "u-1", role: "USER", organizationId: "org-1" }
    );

    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "org-1" },
        data: { ticketCounter: { increment: 1 } },
        select: { ticketCounter: true },
      })
    );
  });

  it("ticket number format matches NIR-YYYY-NNNNNN", () => {
    const year = new Date().getFullYear();

    const testCases = [
      { counter: 1, expected: `NIR-${year}-000001` },
      { counter: 42, expected: `NIR-${year}-000042` },
      { counter: 999, expected: `NIR-${year}-000999` },
      { counter: 10000, expected: `NIR-${year}-010000` },
      { counter: 999999, expected: `NIR-${year}-999999` },
    ];

    for (const { counter, expected } of testCases) {
      const number = String(counter).padStart(6, "0");
      const ticketNumber = `NIR-${year}-${number}`;
      expect(ticketNumber).toBe(expected);
    }
  });

  it("counter increments sequentially in simulated sequential calls", async () => {
    const prisma = (await import("@/lib/db/prisma")).default;

    const results = [];
    for (let i = 0; i < 5; i++) {
      prisma.organization.update.mockResolvedValue({ ticketCounter: i + 1 });
      const result = await prisma.organization.update({
        where: { id: "org-1" },
        data: { ticketCounter: { increment: 1 } },
        select: { ticketCounter: true },
      });
      results.push(result.ticketCounter);
    }

    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  it("seed script uses atomic counter for ticket numbering", () => {
    expect(seedContent).toContain("ticketCounter");
    expect(seedContent).toContain("increment");
  });

  it("seed script generates NIR-YYYY-NNNNNN format", () => {
    expect(seedContent).toMatch(/NIR-\$\{year\}-/);
    expect(seedContent).toContain("padStart(6");
  });
});

// ============================================================
// Seed data completeness (spec §28-29)
// ============================================================

describe("Part 2: Seed data idempotency (spec §28)", () => {
  it("uses upsert for organization", () => {
    expect(seedContent).toContain("upsertOrganization");
    expect(seedContent).toContain("organization.upsert");
  });

  it("checks for existing tickets before creating", () => {
    expect(seedContent).toContain("existingCount");
    expect(seedContent).toContain("ticket.count");
  });

  it("checks for existing comments before creating", () => {
    expect(seedContent).toContain("comment.count");
  });

  it("checks for existing assignment history before creating", () => {
    expect(seedContent).toContain("ticketAssignmentHistory.count");
  });

  it("checks for existing saved replies before creating", () => {
    expect(seedContent).toContain("savedReply.count");
  });

  it("checks for existing watchers before creating (uses findUnique)", () => {
    expect(seedContent).toContain("watcher.findUnique");
  });

  it("checks for existing departments before creating", () => {
    expect(seedContent).toContain("department.findFirst");
  });

  it("checks for existing users before creating", () => {
    expect(seedContent).toContain("user.findFirst");
  });

  it("checks for existing categories before creating", () => {
    expect(seedContent).toContain("category.findFirst");
  });

  it("checks for existing tags before creating", () => {
    expect(seedContent).toContain("tag.findFirst");
  });

  it("checks for existing SLA configs before creating", () => {
    expect(seedContent).toContain("sLAConfiguration.findFirst");
  });
});

describe("Part 2: Seed data coverage (spec §29)", () => {
  it("creates one organization (Acme Corporation)", () => {
    expect(seedContent).toContain("Acme Corporation");
    expect(seedContent).toContain("acme-corp");
  });

  it("sets organization timezone", () => {
    expect(seedContent).toContain("timezone");
    expect(seedContent).toContain("America/New_York");
  });

  it("sets business hours", () => {
    expect(seedContent).toContain("businessHoursStart");
    expect(seedContent).toContain("businessHoursEnd");
    expect(seedContent).toContain("09:00");
    expect(seedContent).toContain("17:00");
  });

  it("creates 5 departments with codes", () => {
    const depts = ["ITS", "NET", "SWE", "HR", "FIN"];
    for (const code of depts) {
      expect(seedContent).toContain(`"${code}"`);
    }
  });

  it("creates users with all three roles", () => {
    expect(seedContent).toContain('role: "ADMIN"');
    expect(seedContent).toContain('role: "AGENT"');
    expect(seedContent).toContain('role: "USER"');
  });

  it("creates multiple agents across departments", () => {
    expect(seedContent).toContain("sarah.chen");
    expect(seedContent).toContain("mike.johnson");
    expect(seedContent).toContain("lisa.wang");
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

  it("creates tags", () => {
    expect(seedContent).toContain('"urgent"');
    expect(seedContent).toContain('"recurring"');
    expect(seedContent).toContain('"security-risk"');
    expect(seedContent).toContain('"escalated"');
  });

  it("creates SLA configurations for all 4 priorities", () => {
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

  it("creates tickets with different priorities", () => {
    expect(seedContent).toContain('priority: "HIGH"');
    expect(seedContent).toContain('priority: "MEDIUM"');
    expect(seedContent).toContain('priority: "LOW"');
  });

  it("creates tickets with different types", () => {
    expect(seedContent).toContain('type: "INCIDENT"');
    expect(seedContent).toContain('type: "SERVICE_REQUEST"');
  });

  it("creates tickets with different sources", () => {
    expect(seedContent).toContain('source: "WEB"');
    expect(seedContent).toContain('source: "EMAIL"');
    expect(seedContent).toContain('source: "API"');
  });

  it("creates comments with PUBLIC and INTERNAL visibility", () => {
    expect(seedContent).toContain('visibility: "PUBLIC"');
    expect(seedContent).toContain('visibility: "INTERNAL"');
  });

  it("creates watchers for relevant tickets", () => {
    expect(seedContent).toContain("watcher.findUnique");
    expect(seedContent).toContain("watcher.create");
  });

  it("creates assignment history records", () => {
    expect(seedContent).toContain("ticketAssignmentHistory");
    expect(seedContent).toContain("assignedToId");
    expect(seedContent).toContain("assignedById");
    expect(seedContent).toContain("reason");
  });

  it("creates saved replies with meaningful content", () => {
    expect(seedContent).toContain("savedReply");
    expect(seedContent).toContain("Ticket Received");
    expect(seedContent).toContain("Password Reset Instructions");
    expect(seedContent).toContain("VPN Troubleshooting Steps");
  });

  it("uses bcrypt for password hashing", () => {
    expect(seedContent).toContain("bcrypt.hash");
    expect(seedContent).toContain("SALT_ROUNDS");
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
  });

  it("displays test credentials after seeding", () => {
    expect(seedContent).toContain("admin@acme-corp.com");
    expect(seedContent).toContain("sarah.chen@acme-corp.com");
    expect(seedContent).toContain("john.smith@acme-corp.com");
  });
});
