import { describe, expect, it } from "vitest";
import {
  agentRecommendationSchema,
  recommendationResponseSchema,
  validateRecommendationOutput,
  factorSchema,
  WORKLOAD_STATUSES,
} from "@/lib/ai/recommendation-schema";

describe("Recommendation validation schemas", () => {
  describe("factorSchema", () => {
    it("accepts valid factor", () => {
      const result = factorSchema.safeParse({
        name: "Department Match",
        normalized: 0.8,
        weight: 0.3,
        contribution: 24,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative normalized", () => {
      const result = factorSchema.safeParse({
        name: "Test",
        normalized: -0.1,
        weight: 0.3,
        contribution: 10,
      });
      expect(result.success).toBe(false);
    });

    it("rejects normalized above 1", () => {
      const result = factorSchema.safeParse({
        name: "Test",
        normalized: 1.5,
        weight: 0.3,
        contribution: 10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("agentRecommendationSchema", () => {
    it("accepts valid recommendation", () => {
      const result = agentRecommendationSchema.safeParse({
        agentId: "550e8400-e29b-41d4-a716-446655440000",
        username: "alice",
        email: "alice@test.com",
        department: "IT Support",
        score: 75.5,
        confidence: 0.72,
        workload: { activeTickets: 3, highPriorityTickets: 1 },
        experience: { categoryResolved: 5, totalResolved: 20 },
        explanation: "Recommended because agent is in the same department.",
        factors: [
          { name: "Department Match", normalized: 1.0, weight: 0.3, contribution: 30 },
        ],
        rank: 1,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid agentId format", () => {
      const result = agentRecommendationSchema.safeParse({
        agentId: "not-a-uuid",
        username: "alice",
        email: "alice@test.com",
        department: null,
        score: 75,
        confidence: 0.7,
        workload: { activeTickets: 0, highPriorityTickets: 0 },
        experience: { categoryResolved: 0, totalResolved: 0 },
        explanation: "Test",
        factors: [],
        rank: 1,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });

    it("rejects score above 100", () => {
      const result = agentRecommendationSchema.safeParse({
        agentId: "550e8400-e29b-41d4-a716-446655440000",
        username: "alice",
        email: "alice@test.com",
        department: null,
        score: 101,
        confidence: 0.7,
        workload: { activeTickets: 0, highPriorityTickets: 0 },
        experience: { categoryResolved: 0, totalResolved: 0 },
        explanation: "Test",
        factors: [],
        rank: 1,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });

    it("rejects confidence below 0.5", () => {
      const result = agentRecommendationSchema.safeParse({
        agentId: "550e8400-e29b-41d4-a716-446655440000",
        username: "alice",
        email: "alice@test.com",
        department: null,
        score: 75,
        confidence: 0.4,
        workload: { activeTickets: 0, highPriorityTickets: 0 },
        experience: { categoryResolved: 0, totalResolved: 0 },
        explanation: "Test",
        factors: [],
        rank: 1,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });

    it("rejects confidence above 0.98", () => {
      const result = agentRecommendationSchema.safeParse({
        agentId: "550e8400-e29b-41d4-a716-446655440000",
        username: "alice",
        email: "alice@test.com",
        department: null,
        score: 75,
        confidence: 0.99,
        workload: { activeTickets: 0, highPriorityTickets: 0 },
        experience: { categoryResolved: 0, totalResolved: 0 },
        explanation: "Test",
        factors: [],
        rank: 1,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });

    it("accepts null department", () => {
      const result = agentRecommendationSchema.safeParse({
        agentId: "550e8400-e29b-41d4-a716-446655440000",
        username: "alice",
        email: "alice@test.com",
        department: null,
        score: 75,
        confidence: 0.7,
        workload: { activeTickets: 0, highPriorityTickets: 0 },
        experience: { categoryResolved: 0, totalResolved: 0 },
        explanation: "Test",
        factors: [],
        rank: 1,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("accepts null confidence (only top has confidence)", () => {
      const result = agentRecommendationSchema.safeParse({
        agentId: "550e8400-e29b-41d4-a716-446655440000",
        username: "alice",
        email: "alice@test.com",
        department: null,
        score: 75,
        confidence: null,
        workload: { activeTickets: 0, highPriorityTickets: 0 },
        experience: { categoryResolved: 0, totalResolved: 0 },
        explanation: "Test",
        factors: [],
        rank: 2,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("recommendationResponseSchema", () => {
    it("accepts valid response", () => {
      const result = recommendationResponseSchema.safeParse({
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        recommendations: [],
        totalEligibleAgents: 0,
        generatedAt: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative totalEligibleAgents", () => {
      const result = recommendationResponseSchema.safeParse({
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        recommendations: [],
        totalEligibleAgents: -1,
        generatedAt: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("validateRecommendationOutput", () => {
    it("returns validated output for valid data", () => {
      const output = validateRecommendationOutput({
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        recommendations: [],
        totalEligibleAgents: 0,
        generatedAt: "2026-01-01T00:00:00.000Z",
      });
      expect(output.ticketId).toBeDefined();
    });

    it("throws for invalid output", () => {
      expect(() =>
        validateRecommendationOutput({
          ticketId: "not-a-uuid",
          recommendations: "not-an-array",
        })
      ).toThrow("Invalid recommendation output");
    });
  });

  describe("constants", () => {
    it("has all required workload statuses", () => {
      expect(WORKLOAD_STATUSES).toContain("ASSIGNED");
      expect(WORKLOAD_STATUSES).toContain("IN_PROGRESS");
      expect(WORKLOAD_STATUSES).toContain("WAITING_FOR_USER");
      expect(WORKLOAD_STATUSES).toContain("REOPENED");
    });

    it("does not include CLOSED or RESOLVED as active workload", () => {
      expect(WORKLOAD_STATUSES).not.toContain("CLOSED");
      expect(WORKLOAD_STATUSES).not.toContain("RESOLVED");
    });
  });
});
