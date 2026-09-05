import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Phase 2 tests — Prisma schema structure validation.
 *
 * These tests validate the schema file structure without requiring
 * a live database connection. They ensure all required models, enums,
 * and constraints from the master specification are present.
 */

const SCHEMA_PATH = resolve(import.meta.dirname, "../prisma/schema.prisma");
const schemaContent = readFileSync(SCHEMA_PATH, "utf-8");

describe("Prisma schema structure", () => {
  describe("datasource and generator", () => {
    it("has postgresql datasource with DATABASE_URL", () => {
      expect(schemaContent).toContain('provider  = "postgresql"');
      expect(schemaContent).toContain('url       = env("DATABASE_URL")');
    });

    it("has directUrl for Supabase", () => {
      expect(schemaContent).toContain('directUrl = env("DIRECT_URL")');
    });

    it("has prisma-client-js generator", () => {
      expect(schemaContent).toContain('provider = "prisma-client-js"');
    });
  });

  describe("enums", () => {
    it("defines Role enum with USER, AGENT, ADMIN", () => {
      expect(schemaContent).toMatch(/enum Role\s*\{[^}]*USER[^}]*AGENT[^}]*ADMIN[^}]*\}/s);
    });

    it("defines UserStatus enum with ACTIVE, INACTIVE, SUSPENDED", () => {
      expect(schemaContent).toMatch(/enum UserStatus\s*\{[^}]*ACTIVE[^}]*INACTIVE[^}]*SUSPENDED[^}]*\}/s);
    });

    it("defines TicketPriority enum with LOW, MEDIUM, HIGH, CRITICAL", () => {
      expect(schemaContent).toMatch(/enum TicketPriority\s*\{[^}]*LOW[^}]*MEDIUM[^}]*HIGH[^}]*CRITICAL[^}]*\}/s);
    });

    it("defines TicketType enum with INCIDENT, SERVICE_REQUEST", () => {
      expect(schemaContent).toMatch(/enum TicketType\s*\{[^}]*INCIDENT[^}]*SERVICE_REQUEST[^}]*\}/s);
    });

    it("defines TicketSource enum with WEB, EMAIL, API", () => {
      expect(schemaContent).toMatch(/enum TicketSource\s*\{[^}]*WEB[^}]*EMAIL[^}]*API[^}]*\}/s);
    });

    it("defines TicketStatus enum with all lifecycle states", () => {
      expect(schemaContent).toMatch(/enum TicketStatus\s*\{/s);
      expect(schemaContent).toContain("OPEN");
      expect(schemaContent).toContain("ASSIGNED");
      expect(schemaContent).toContain("IN_PROGRESS");
      expect(schemaContent).toContain("WAITING_FOR_USER");
      expect(schemaContent).toContain("RESOLVED");
      expect(schemaContent).toContain("CLOSED");
      expect(schemaContent).toContain("REOPENED");
    });

    it("defines CommentVisibility enum with PUBLIC, INTERNAL", () => {
      expect(schemaContent).toMatch(/enum CommentVisibility\s*\{[^}]*PUBLIC[^}]*INTERNAL[^}]*\}/s);
    });

    it("defines SLAStatus enum with ON_TRACK, WARNING, BREACHED, PAUSED, COMPLETED", () => {
      expect(schemaContent).toMatch(/enum SLAStatus\s*\{[^}]*ON_TRACK[^}]*WARNING[^}]*BREACHED[^}]*PAUSED[^}]*COMPLETED[^}]*\}/s);
    });

    it("defines NotificationType enum", () => {
      expect(schemaContent).toContain("enum NotificationType");
      expect(schemaContent).toContain("TICKET_CREATED");
      expect(schemaContent).toContain("TICKET_ASSIGNED");
      expect(schemaContent).toContain("COMMENT_ADDED");
      expect(schemaContent).toContain("SLA_WARNING");
      expect(schemaContent).toContain("SLA_BREACHED");
    });
  });

  describe("models", () => {
    const requiredModels = [
      "Organization",
      "Department",
      "User",
      "Ticket",
      "Category",
      "Tag",
      "TicketTag",
      "Comment",
      "Notification",
      "AIPrediction",
      "TicketAssignmentHistory",
      "Watcher",
      "SLAConfiguration",
      "SavedReply",
    ];

    for (const model of requiredModels) {
      it(`defines ${model} model`, () => {
        expect(schemaContent).toContain(`model ${model} {`);
      });
    }
  });

  describe("Organization model", () => {
    it("has unique name and slug", () => {
      expect(schemaContent).toMatch(/model Organization\s*\{[^}]*name\s+String\s+@unique/s);
      expect(schemaContent).toMatch(/model Organization\s*\{[^}]*slug\s+String\s+@unique/s);
    });

    it("has ticketCounter defaulting to 0", () => {
      expect(schemaContent).toMatch(/model Organization\s*\{[^}]*ticketCounter\s+Int\s+@default\(0\)/s);
    });

    it("has businessHoursStart and businessHoursEnd", () => {
      expect(schemaContent).toContain("businessHoursStart");
      expect(schemaContent).toContain("businessHoursEnd");
    });

    it("has timezone field", () => {
      expect(schemaContent).toMatch(/model Organization\s*\{[^}]*timezone\s+String/s);
    });

    it("does NOT have createdById/updatedById (bootstrap circular dependency)", () => {
      const orgMatch = schemaContent.match(/model Organization\s*\{[\s\S]*?\n\}/);
      expect(orgMatch).toBeTruthy();
      expect(orgMatch[0]).not.toContain("createdById");
      expect(orgMatch[0]).not.toContain("updatedById");
    });
  });

  describe("Department model", () => {
    it("has composite unique constraints for (organizationId, name) and (organizationId, code)", () => {
      expect(schemaContent).toMatch(/@@unique\(\[organizationId, name\]\)/);
      expect(schemaContent).toMatch(/@@unique\(\[organizationId, code\]\)/);
    });

    it("has optional managerId", () => {
      expect(schemaContent).toMatch(/managerId\s+String\?/);
    });

    it("has organizationId, createdById, updatedById", () => {
      const deptMatch = schemaContent.match(/model Department\s*\{[\s\S]*?\n\}/);
      expect(deptMatch).toBeTruthy();
      expect(deptMatch[0]).toContain("organizationId");
      expect(deptMatch[0]).toContain("createdById");
      expect(deptMatch[0]).toContain("updatedById");
    });
  });

  describe("User model", () => {
    it("has composite unique for (organizationId, username)", () => {
      expect(schemaContent).toMatch(/@@unique\(\[organizationId, username\]\)/);
    });

    it("has composite unique for (organizationId, email)", () => {
      expect(schemaContent).toMatch(/@@unique\(\[organizationId, email\]\)/);
    });

    it("has composite unique for (organizationId, employeeId)", () => {
      expect(schemaContent).toMatch(/@@unique\(\[organizationId, employeeId\]\)/);
    });

    it("has role and status fields", () => {
      const userMatch = schemaContent.match(/model User\s*\{[\s\S]*?\n\}/);
      expect(userMatch).toBeTruthy();
      expect(userMatch[0]).toContain("role");
      expect(userMatch[0]).toContain("status");
    });

    it("has avatarUrl as @db.Text", () => {
      expect(schemaContent).toMatch(/avatarUrl\s+String\?\s+@db\.Text/);
    });

    it("has designation field", () => {
      expect(schemaContent).toMatch(/designation\s+String\?/);
    });

    it("has proper indexes for organization/department/role/status", () => {
      expect(schemaContent).toContain("@@index([organizationId])");
      expect(schemaContent).toContain("@@index([departmentId])");
      expect(schemaContent).toContain("@@index([role])");
      expect(schemaContent).toContain("@@index([status])");
    });
  });

  describe("Ticket model", () => {
    it("has ticketNumber field (unique)", () => {
      expect(schemaContent).toMatch(/model Ticket\s*\{[^}]*ticketNumber\s+String\s+@unique/s);
    });

    it("has title as @db.VarChar(200)", () => {
      expect(schemaContent).toMatch(/title\s+String\s+@db\.VarChar\(200\)/);
    });

    it("has description as @db.Text", () => {
      expect(schemaContent).toMatch(/description\s+String\s+@db\.Text/);
    });

    it("has SLA tracking fields", () => {
      const ticketMatch = schemaContent.match(/model Ticket\s*\{[\s\S]*?\n\}/);
      expect(ticketMatch).toBeTruthy();
      expect(ticketMatch[0]).toContain("responseSlaStatus");
      expect(ticketMatch[0]).toContain("resolutionSlaStatus");
      expect(ticketMatch[0]).toContain("responseDueAt");
      expect(ticketMatch[0]).toContain("resolutionDueAt");
      expect(ticketMatch[0]).toContain("firstRespondedAt");
      expect(ticketMatch[0]).toContain("waitingSince");
      expect(ticketMatch[0]).toContain("resolvedAt");
      expect(ticketMatch[0]).toContain("closedAt");
    });

    it("has organizationId, departmentId, requesterId, assignedAgentId", () => {
      const ticketMatch = schemaContent.match(/model Ticket\s*\{[\s\S]*?\n\}/);
      expect(ticketMatch).toBeTruthy();
      expect(ticketMatch[0]).toContain("organizationId");
      expect(ticketMatch[0]).toContain("departmentId");
      expect(ticketMatch[0]).toContain("requesterId");
      expect(ticketMatch[0]).toContain("assignedAgentId");
    });

    it("has proper indexes", () => {
      const ticketIdx = [
        "@@index([organizationId])",
        "@@index([departmentId])",
        "@@index([categoryId])",
        "@@index([requesterId])",
        "@@index([assignedAgentId])",
        "@@index([status])",
        "@@index([priority])",
      ];
      for (const idx of ticketIdx) {
        expect(schemaContent).toContain(idx);
      }
    });
  });

  describe("Category and Tag models", () => {
    it("Category has composite unique (organizationId, name)", () => {
      expect(schemaContent).toMatch(/model Category\s*\{[\s\S]*?@@unique\(\[organizationId, name\]\)/s);
    });

    it("Tag has composite unique (organizationId, name)", () => {
      expect(schemaContent).toMatch(/model Tag\s*\{[\s\S]*?@@unique\(\[organizationId, name\]\)/s);
    });
  });

  describe("Watcher model", () => {
    it("has composite unique (ticketId, userId)", () => {
      expect(schemaContent).toMatch(/@@unique\(\[ticketId, userId\]\)/);
    });
  });

  describe("SLAConfiguration model", () => {
    it("has composite unique (organizationId, priority)", () => {
      expect(schemaContent).toMatch(/model SLAConfiguration\s*\{[\s\S]*?@@unique\(\[organizationId, priority\]\)/s);
    });

    it("has responseTimeMinutes and resolutionTimeMinutes", () => {
      const slaMatch = schemaContent.match(/model SLAConfiguration\s*\{[\s\S]*?\n\}/);
      expect(slaMatch).toBeTruthy();
      expect(slaMatch[0]).toContain("responseTimeMinutes");
      expect(slaMatch[0]).toContain("resolutionTimeMinutes");
    });
  });

  describe("AIPrediction model", () => {
    it("has confidence, explanation, suggestedNextSteps", () => {
      const aiMatch = schemaContent.match(/model AIPrediction\s*\{[\s\S]*?\n\}/);
      expect(aiMatch).toBeTruthy();
      expect(aiMatch[0]).toContain("confidence");
      expect(aiMatch[0]).toContain("explanation");
      expect(aiMatch[0]).toContain("suggestedNextSteps");
    });

    it("has assignment fields (recommendedAgentId, assignmentScore, assignmentConfidence, factors)", () => {
      const aiMatch = schemaContent.match(/model AIPrediction\s*\{[\s\S]*?\n\}/);
      expect(aiMatch).toBeTruthy();
      expect(aiMatch[0]).toContain("recommendedAgentId");
      expect(aiMatch[0]).toContain("assignmentScore");
      expect(aiMatch[0]).toContain("assignmentConfidence");
      expect(aiMatch[0]).toContain("factors");
    });

    it("factors field is Json type", () => {
      expect(schemaContent).toMatch(/model AIPrediction\s*\{[^}]*factors\s+Json\?/s);
    });
  });

  describe("onDelete behaviors", () => {
    it("Organization onDelete is Cascade for owned resources", () => {
      // Department should cascade on org delete
      expect(schemaContent).toMatch(/model Department\s*\{[\s\S]*?onDelete:\s*Cascade[\s\S]*?\n\}/s);
    });

    it("User references use SetNull for optional audit fields", () => {
      expect(schemaContent).toContain("onDelete: SetNull");
    });

    it("Ticket references use Restrict for required user references", () => {
      expect(schemaContent).toContain("onDelete: Restrict");
    });
  });
});
