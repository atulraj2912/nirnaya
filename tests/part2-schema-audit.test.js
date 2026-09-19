import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Part 2 tests — Prisma schema audit against master specification.
 *
 * Validates indexes, constraints, relationships, onDelete behaviors,
 * and field-level compliance with spec sections §5–§11.
 */

const SCHEMA_PATH = resolve(import.meta.dirname, "../prisma/schema.prisma");
const schemaContent = readFileSync(SCHEMA_PATH, "utf-8");

function getModel(name) {
  const re = new RegExp(`model ${name}\\s*\\{[\\s\\S]*?\\n\\}`);
  return schemaContent.match(re)?.[0] || "";
}

describe("Part 2: Schema index coverage", () => {
  describe("Notification composite indexes", () => {
    it("has composite index [recipientId, isRead] for unread-count queries", () => {
      expect(schemaContent).toContain("@@index([recipientId, isRead])");
    });

    it("has individual index on recipientId", () => {
      expect(schemaContent).toContain("@@index([recipientId])");
    });

    it("has individual index on isRead", () => {
      expect(schemaContent).toContain("@@index([isRead])");
    });
  });

  describe("TicketAssignmentHistory composite indexes", () => {
    it("has composite index [ticketId, createdAt] for chronological timeline queries", () => {
      expect(schemaContent).toContain("@@index([ticketId, createdAt])");
    });

    it("has individual index on assignedToId", () => {
      expect(schemaContent).toContain("@@index([assignedToId])");
    });

    it("has index on assignedById", () => {
      expect(schemaContent).toContain("@@index([assignedById])");
    });
  });

  describe("Ticket query indexes", () => {
    it("has index on organizationId", () => {
      expect(getModel("Ticket")).toContain("@@index([organizationId])");
    });

    it("has index on status", () => {
      expect(getModel("Ticket")).toContain("@@index([status])");
    });

    it("has index on priority", () => {
      expect(getModel("Ticket")).toContain("@@index([priority])");
    });

    it("has index on requesterId", () => {
      expect(getModel("Ticket")).toContain("@@index([requesterId])");
    });

    it("has index on assignedAgentId", () => {
      expect(getModel("Ticket")).toContain("@@index([assignedAgentId])");
    });

    it("has index on categoryId", () => {
      expect(getModel("Ticket")).toContain("@@index([categoryId])");
    });

    it("has index on departmentId", () => {
      expect(getModel("Ticket")).toContain("@@index([departmentId])");
    });
  });

  describe("Watcher indexes", () => {
    it("has composite unique [ticketId, userId]", () => {
      expect(schemaContent).toContain("@@unique([ticketId, userId])");
    });

    it("has index on ticketId", () => {
      expect(getModel("Watcher")).toContain("@@index([ticketId])");
    });

    it("has index on userId", () => {
      expect(getModel("Watcher")).toContain("@@index([userId])");
    });
  });

  describe("User query indexes", () => {
    it("has index on organizationId", () => {
      expect(getModel("User")).toContain("@@index([organizationId])");
    });

    it("has index on departmentId", () => {
      expect(getModel("User")).toContain("@@index([departmentId])");
    });

    it("has index on role", () => {
      expect(getModel("User")).toContain("@@index([role])");
    });

    it("has index on status", () => {
      expect(getModel("User")).toContain("@@index([status])");
    });
  });

  describe("Other model indexes", () => {
    it("SLAConfiguration has index on organizationId", () => {
      expect(getModel("SLAConfiguration")).toContain("@@index([organizationId])");
    });

    it("Category has index on organizationId", () => {
      expect(getModel("Category")).toContain("@@index([organizationId])");
    });

    it("Tag has index on organizationId", () => {
      expect(getModel("Tag")).toContain("@@index([organizationId])");
    });

    it("SavedReply has index on organizationId", () => {
      expect(getModel("SavedReply")).toContain("@@index([organizationId])");
    });

    it("Notification has index on ticketId", () => {
      expect(getModel("Notification")).toContain("@@index([ticketId])");
    });

    it("AIPrediction has index on ticketId", () => {
      expect(getModel("AIPrediction")).toContain("@@index([ticketId])");
    });

    it("AIPrediction has index on recommendedAgentId", () => {
      expect(getModel("AIPrediction")).toContain("@@index([recommendedAgentId])");
    });

    it("Comment has index on ticketId", () => {
      expect(getModel("Comment")).toContain("@@index([ticketId])");
    });

    it("Comment has index on authorId", () => {
      expect(getModel("Comment")).toContain("@@index([authorId])");
    });
  });
});

describe("Part 2: Schema onDelete behaviors", () => {
  it("Organization to Department: Cascade", () => {
    expect(getModel("Department")).toContain("onDelete: Cascade");
  });

  it("Organization to Ticket: Cascade", () => {
    expect(getModel("Ticket")).toContain("onDelete: Cascade");
  });

  it("Organization to Notification: Cascade", () => {
    expect(getModel("Notification")).toContain("onDelete: Cascade");
  });

  it("Ticket to Comment: Cascade", () => {
    expect(getModel("Comment")).toContain("onDelete: Cascade");
  });

  it("Ticket to Watcher: Cascade", () => {
    expect(getModel("Watcher")).toContain("onDelete: Cascade");
  });

  it("Ticket to TicketAssignmentHistory: Cascade", () => {
    expect(getModel("TicketAssignmentHistory")).toContain("onDelete: Cascade");
  });

  it("Ticket to AIPrediction: Cascade", () => {
    expect(getModel("AIPrediction")).toContain("onDelete: Cascade");
  });

  it("Category to Ticket: SetNull (soft-delete category)", () => {
    expect(getModel("Ticket")).toContain("onDelete: SetNull");
  });

  it("User to Comment: Restrict (prevent deleting users with comments)", () => {
    expect(getModel("Comment")).toContain("onDelete: Restrict");
  });

  it("User to Ticket requester: Restrict", () => {
    expect(getModel("Ticket")).toContain("onDelete: Restrict");
  });

  it("Department to User: Restrict (prevent deleting dept with users)", () => {
    expect(getModel("User")).toContain("onDelete: Restrict");
  });

  it("Optional audit fields use SetNull (>=5 occurrences)", () => {
    const matches = schemaContent.match(/onDelete: SetNull/g);
    expect(matches).toBeTruthy();
    expect(matches.length).toBeGreaterThanOrEqual(5);
  });

  it("User to Notification recipient: Cascade (cleanup on user delete)", () => {
    const notif = getModel("Notification");
    const recipientRelation = notif.match(/recipient[\s\S]*?onDelete:\s*(\w+)/);
    expect(recipientRelation).toBeTruthy();
    expect(recipientRelation[1]).toBe("Cascade");
  });
});

describe("Part 2: Composite unique constraints", () => {
  it("User: (organizationId, username)", () => {
    expect(schemaContent).toContain("@@unique([organizationId, username])");
  });

  it("User: (organizationId, email)", () => {
    expect(schemaContent).toContain("@@unique([organizationId, email])");
  });

  it("User: (organizationId, employeeId)", () => {
    expect(schemaContent).toContain("@@unique([organizationId, employeeId])");
  });

  it("Department: (organizationId, name)", () => {
    expect(schemaContent).toContain("@@unique([organizationId, name])");
  });

  it("Department: (organizationId, code)", () => {
    expect(schemaContent).toContain("@@unique([organizationId, code])");
  });

  it("Category: (organizationId, name)", () => {
    expect(getModel("Category")).toContain("@@unique([organizationId, name])");
  });

  it("Tag: (organizationId, name)", () => {
    expect(getModel("Tag")).toContain("@@unique([organizationId, name])");
  });

  it("SLAConfiguration: (organizationId, priority)", () => {
    expect(getModel("SLAConfiguration")).toContain("@@unique([organizationId, priority])");
  });

  it("TicketTag: (ticketId, tagId) primary key", () => {
    expect(schemaContent).toContain("@@id([ticketId, tagId])");
  });

  it("Watcher: (ticketId, userId)", () => {
    expect(schemaContent).toContain("@@unique([ticketId, userId])");
  });
});

describe("Part 2: Organization model constraints", () => {
  it("name is @unique", () => {
    expect(getModel("Organization")).toMatch(/name\s+String\s+@unique/);
  });

  it("slug is @unique", () => {
    expect(getModel("Organization")).toMatch(/slug\s+String\s+@unique/);
  });

  it("ticketCounter defaults to 0", () => {
    expect(getModel("Organization")).toMatch(/ticketCounter\s+Int\s+@default\(0\)/);
  });

  it("does NOT have createdById/updatedById", () => {
    const org = getModel("Organization");
    expect(org).not.toContain("createdById");
    expect(org).not.toContain("updatedById");
  });

  it("has timezone with UTC default", () => {
    expect(getModel("Organization")).toMatch(/timezone\s+String\s+@default\("UTC"\)/);
  });
});

describe("Part 2: Ticket model field types", () => {
  it("ticketNumber is @unique", () => {
    expect(getModel("Ticket")).toMatch(/ticketNumber\s+String\s+@unique/);
  });

  it("title is @db.VarChar(200)", () => {
    expect(schemaContent).toMatch(/title\s+String\s+@db\.VarChar\(200\)/);
  });

  it("description is @db.Text", () => {
    expect(getModel("Ticket")).toMatch(/description\s+String\s+@db\.Text/);
  });

  it("has all SLA tracking fields", () => {
    const ticket = getModel("Ticket");
    const slaFields = [
      "responseSlaStatus",
      "resolutionSlaStatus",
      "responseDueAt",
      "resolutionDueAt",
      "firstRespondedAt",
      "waitingSince",
      "resolvedAt",
      "closedAt",
    ];
    for (const field of slaFields) {
      expect(ticket).toContain(field);
    }
  });

  it("has source field with default WEB", () => {
    expect(getModel("Ticket")).toMatch(/source\s+TicketSource\s+@default\(WEB\)/);
  });
});

describe("Part 2: User model field types", () => {
  it("avatarUrl is @db.Text", () => {
    expect(schemaContent).toMatch(/avatarUrl\s+String\?\s+@db\.Text/);
  });

  it("has designation field", () => {
    expect(getModel("User")).toMatch(/designation\s+String\?/);
  });

  it("has passwordHash field", () => {
    expect(getModel("User")).toMatch(/passwordHash\s+String/);
  });

  it("has employeeId field (optional)", () => {
    expect(getModel("User")).toMatch(/employeeId\s+String\?/);
  });
});

describe("Part 2: All 14 models present", () => {
  const requiredModels = [
    "Organization", "Department", "User", "Ticket", "Category",
    "Tag", "TicketTag", "Comment", "Notification", "AIPrediction",
    "TicketAssignmentHistory", "Watcher", "SLAConfiguration", "SavedReply",
  ];

  for (const model of requiredModels) {
    it(`defines ${model} model`, () => {
      expect(schemaContent).toContain(`model ${model} {`);
    });
  }
});

describe("Part 2: All 9 enums present", () => {
  const requiredEnums = [
    "Role", "UserStatus", "TicketPriority", "TicketType", "TicketSource",
    "TicketStatus", "CommentVisibility", "SLAStatus", "NotificationType",
  ];

  for (const enumName of requiredEnums) {
    it(`defines ${enumName} enum`, () => {
      expect(schemaContent).toContain(`enum ${enumName} {`);
    });
  }
});

describe("Part 2: Table mapping", () => {
  it("Organization maps to organizations", () => {
    expect(getModel("Organization")).toContain('@map("organizations")');
  });

  it("Department maps to departments", () => {
    expect(getModel("Department")).toContain('@map("departments")');
  });

  it("User maps to users", () => {
    expect(getModel("User")).toContain('@map("users")');
  });

  it("Ticket maps to tickets", () => {
    expect(getModel("Ticket")).toContain('@map("tickets")');
  });

  it("Comment maps to comments", () => {
    expect(getModel("Comment")).toContain('@map("comments")');
  });

  it("Notification maps to notifications", () => {
    expect(getModel("Notification")).toContain('@map("notifications")');
  });

  it("AIPrediction maps to ai_predictions", () => {
    expect(getModel("AIPrediction")).toContain('@map("ai_predictions")');
  });

  it("TicketAssignmentHistory maps to ticket_assignment_history", () => {
    expect(getModel("TicketAssignmentHistory")).toContain('@map("ticket_assignment_history")');
  });

  it("Watcher maps to watchers", () => {
    expect(getModel("Watcher")).toContain('@map("watchers")');
  });

  it("SLAConfiguration maps to sla_configurations", () => {
    expect(getModel("SLAConfiguration")).toContain('@map("sla_configurations")');
  });

  it("SavedReply maps to saved_replies", () => {
    expect(getModel("SavedReply")).toContain('@map("saved_replies")');
  });

  it("TicketTag maps to ticket_tags", () => {
    expect(getModel("TicketTag")).toContain('@map("ticket_tags")');
  });

  it("Category maps to categories", () => {
    expect(getModel("Category")).toContain('@map("categories")');
  });

  it("Tag maps to tags", () => {
    expect(getModel("Tag")).toContain('@map("tags")');
  });
});
