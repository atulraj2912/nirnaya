import { describe, expect, it } from "vitest";
import {
  createUserSchema,
  updateUserSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  createCategorySchema,
  updateCategorySchema,
  createTagSchema,
  updateTagSchema,
  createSLAConfigSchema,
  updateSLAConfigSchema,
  updateOrgSettingsSchema,
} from "@/lib/validation/admin";

describe("Admin validation schemas", () => {
  describe("createUserSchema", () => {
    it("accepts valid user data", () => {
      const result = createUserSchema.safeParse({
        username: "john.doe",
        email: "john@example.com",
        password: "secret123",
        role: "USER",
        departmentId: "uuid",
      });
      expect(result.success).toBe(true);
    });

    it("requires username, email, password, role", () => {
      const result = createUserSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects invalid role", () => {
      const result = createUserSchema.safeParse({
        username: "u",
        email: "e@e.com",
        password: "p",
        role: "SUPERADMIN",
      });
      expect(result.success).toBe(false);
    });

    it("rejects short password", () => {
      const result = createUserSchema.safeParse({
        username: "u",
        email: "e@e.com",
        password: "12345",
        role: "USER",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateUserSchema", () => {
    it("accepts partial updates", () => {
      const result = updateUserSchema.safeParse({ username: "new.name" });
      expect(result.success).toBe(true);
    });

    it("accepts empty update", () => {
      const result = updateUserSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("createDepartmentSchema", () => {
    it("accepts valid department", () => {
      const result = createDepartmentSchema.safeParse({
        name: "Engineering",
        code: "ENG",
      });
      expect(result.success).toBe(true);
    });

    it("requires name and code", () => {
      const result = createDepartmentSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("createCategorySchema", () => {
    it("accepts valid category", () => {
      const result = createCategorySchema.safeParse({ name: "Software" });
      expect(result.success).toBe(true);
    });

    it("requires name", () => {
      const result = createCategorySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("createTagSchema", () => {
    it("accepts valid tag", () => {
      const result = createTagSchema.safeParse({ name: "urgent" });
      expect(result.success).toBe(true);
    });

    it("requires name", () => {
      const result = createTagSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("createSLAConfigSchema", () => {
    it("accepts valid SLA config", () => {
      const result = createSLAConfigSchema.safeParse({
        priority: "HIGH",
        responseTimeMinutes: 30,
        resolutionTimeMinutes: 240,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid priority", () => {
      const result = createSLAConfigSchema.safeParse({
        priority: "URGENT",
        responseTimeMinutes: 30,
        resolutionTimeMinutes: 240,
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-numeric times", () => {
      const result = createSLAConfigSchema.safeParse({
        priority: "HIGH",
        responseTimeMinutes: "fast",
        resolutionTimeMinutes: 240,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateOrgSettingsSchema", () => {
    it("accepts partial org updates", () => {
      const result = updateOrgSettingsSchema.safeParse({ name: "New Name" });
      expect(result.success).toBe(true);
    });

    it("accepts timezone", () => {
      const result = updateOrgSettingsSchema.safeParse({ timezone: "Asia/Kolkata" });
      expect(result.success).toBe(true);
    });
  });
});
