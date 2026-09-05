import { describe, expect, it } from "vitest";
import {
  classificationInputSchema,
  rawClassificationOutputSchema,
  validateClassificationOutput,
  VALID_CATEGORIES,
  VALID_PRIORITIES,
} from "@/lib/ai/validation";

describe("AI validation schemas", () => {
  describe("classificationInputSchema", () => {
    it("accepts valid input with all fields", () => {
      const result = classificationInputSchema.safeParse({
        title: "WiFi not working",
        description: "Cannot connect to wifi in office",
        type: "INCIDENT",
        source: "WEB",
        departmentName: "IT Support",
        categoryName: "NETWORK",
      });
      expect(result.success).toBe(true);
    });

    it("accepts minimal input (title + description only)", () => {
      const result = classificationInputSchema.safeParse({
        title: "Test ticket",
        description: "Test description",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty title", () => {
      const result = classificationInputSchema.safeParse({
        title: "",
        description: "Test description",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty description", () => {
      const result = classificationInputSchema.safeParse({
        title: "Test",
        description: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("rawClassificationOutputSchema", () => {
    it("accepts valid output with all fields", () => {
      const result = rawClassificationOutputSchema.safeParse({
        categoryName: "NETWORK",
        predictedPriority: "HIGH",
        departmentName: "IT Support",
        confidence: 0.85,
        explanation: "Classified as network issue",
        suggestedNextSteps: "Check router",
      });
      expect(result.success).toBe(true);
      expect(result.data.categoryName).toBe("NETWORK");
      expect(result.data.predictedPriority).toBe("HIGH");
    });

    it("accepts null values", () => {
      const result = rawClassificationOutputSchema.safeParse({
        categoryName: null,
        predictedPriority: null,
        confidence: null,
      });
      expect(result.success).toBe(true);
      expect(result.data.categoryName).toBeNull();
    });

    it("normalizes category name to uppercase", () => {
      const result = rawClassificationOutputSchema.safeParse({
        categoryName: "network",
      });
      expect(result.success).toBe(true);
      expect(result.data.categoryName).toBe("NETWORK");
    });

    it("rejects invalid category name", () => {
      const result = rawClassificationOutputSchema.safeParse({
        categoryName: "INVALID_CATEGORY",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid priority", () => {
      const result = rawClassificationOutputSchema.safeParse({
        predictedPriority: "URGENT",
      });
      expect(result.success).toBe(false);
    });

    it("rejects confidence below 0", () => {
      const result = rawClassificationOutputSchema.safeParse({
        confidence: -0.1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects confidence above 1", () => {
      const result = rawClassificationOutputSchema.safeParse({
        confidence: 1.5,
      });
      expect(result.success).toBe(false);
    });

    it("handles NaN confidence", () => {
      const result = rawClassificationOutputSchema.safeParse({
        confidence: NaN,
      });
      expect(result.success).toBe(true);
      expect(result.data.confidence).toBeNull();
    });

    it("handles Infinity confidence", () => {
      const result = rawClassificationOutputSchema.safeParse({
        confidence: Infinity,
      });
      expect(result.success).toBe(true);
      expect(result.data.confidence).toBeNull();
    });

    it("truncates long explanation", () => {
      const longExplanation = "x".repeat(3000);
      const result = rawClassificationOutputSchema.safeParse({
        explanation: longExplanation,
      });
      expect(result.success).toBe(true);
      expect(result.data.explanation.length).toBeLessThanOrEqual(2000);
    });

    it("converts empty string category to null", () => {
      const result = rawClassificationOutputSchema.safeParse({
        categoryName: "",
      });
      expect(result.success).toBe(true);
      expect(result.data.categoryName).toBeNull();
    });
  });

  describe("validateClassificationOutput", () => {
    it("returns validated output for valid data", () => {
      const output = validateClassificationOutput(
        {
          categoryName: "SOFTWARE",
          predictedPriority: "MEDIUM",
          confidence: 0.75,
          explanation: "Software issue detected",
        },
        "mock"
      );
      expect(output.categoryName).toBe("SOFTWARE");
      expect(output.predictedPriority).toBe("MEDIUM");
      expect(output.confidence).toBe(0.75);
      expect(output.provider).toBe("mock");
    });

    it("throws for invalid output", () => {
      expect(() =>
        validateClassificationOutput(
          { categoryName: "INVALID", confidence: 2.0 },
          "mock"
        )
      ).toThrow("Invalid AI classification output");
    });

    it("includes provider name in error message", () => {
      expect(() =>
        validateClassificationOutput(
          { predictedPriority: "URGENT" },
          "test-provider"
        )
      ).toThrow("test-provider");
    });
  });

  describe("constants", () => {
    it("has all required categories", () => {
      expect(VALID_CATEGORIES).toContain("NETWORK");
      expect(VALID_CATEGORIES).toContain("HARDWARE");
      expect(VALID_CATEGORIES).toContain("SOFTWARE");
      expect(VALID_CATEGORIES).toContain("EMAIL");
      expect(VALID_CATEGORIES).toContain("ACCOUNT");
      expect(VALID_CATEGORIES).toContain("DATABASE");
      expect(VALID_CATEGORIES).toContain("SECURITY");
      expect(VALID_CATEGORIES).toContain("INFRASTRUCTURE");
    });

    it("has all required priorities", () => {
      expect(VALID_PRIORITIES).toContain("LOW");
      expect(VALID_PRIORITIES).toContain("MEDIUM");
      expect(VALID_PRIORITIES).toContain("HIGH");
      expect(VALID_PRIORITIES).toContain("CRITICAL");
    });
  });
});
