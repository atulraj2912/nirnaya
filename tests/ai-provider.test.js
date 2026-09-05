import { describe, expect, it, vi, beforeEach } from "vitest";
import { MockProvider } from "@/lib/ai/providers/mock";

describe("MockProvider", () => {
  const provider = new MockProvider();

  it("has correct name", () => {
    expect(provider.name).toBe("mock");
  });

  describe("classify", () => {
    it("classifies network-related tickets", async () => {
      const result = await provider.classify({
        title: "WiFi not working in office",
        description: "Cannot connect to wifi network, router seems down",
      });
      expect(result.categoryName).toBe("NETWORK");
      expect(result.predictedPriority).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.explanation).toBeTruthy();
      expect(result.provider).toBe("mock");
    });

    it("classifies hardware-related tickets", async () => {
      const result = await provider.classify({
        title: "Laptop screen broken",
        description: "My laptop monitor has a crack and keyboard not working",
      });
      expect(result.categoryName).toBe("HARDWARE");
    });

    it("classifies software-related tickets", async () => {
      const result = await provider.classify({
        title: "Application crash on startup",
        description: "The software keeps crashing with an error message",
      });
      expect(result.categoryName).toBe("SOFTWARE");
    });

    it("classifies email-related tickets", async () => {
      const result = await provider.classify({
        title: "Cannot send emails",
        description: "Outlook inbox is full and spam keeps coming in",
      });
      expect(result.categoryName).toBe("EMAIL");
    });

    it("classifies account-related tickets", async () => {
      const result = await provider.classify({
        title: "Password reset needed",
        description: "Account is locked, need to reset login credentials",
      });
      expect(result.categoryName).toBe("ACCOUNT");
    });

    it("classifies database-related tickets", async () => {
      const result = await provider.classify({
        title: "SQL query running slow",
        description: "Database backup failed and table migration error",
      });
      expect(result.categoryName).toBe("DATABASE");
    });

    it("classifies security-related tickets", async () => {
      const result = await provider.classify({
        title: "Suspicious virus detected",
        description: "Malware and phishing emails detected on security breach",
      });
      expect(result.categoryName).toBe("SECURITY");
    });

    it("classifies infrastructure-related tickets", async () => {
      const result = await provider.classify({
        title: "Server deployment failed",
        description: "Docker container on AWS cloud hosting is down",
      });
      expect(result.categoryName).toBe("INFRASTRUCTURE");
    });

    it("returns null category for unrecognizable content", async () => {
      const result = await provider.classify({
        title: "Hello",
        description: "The quick brown fox jumps over the lazy dog",
      });
      expect(result.categoryName).toBeNull();
    });

    it("detects critical priority", async () => {
      const result = await provider.classify({
        title: "Production system down",
        description: "Critical outage affecting all users, data loss reported",
      });
      expect(result.predictedPriority).toBe("CRITICAL");
    });

    it("detects high priority", async () => {
      const result = await provider.classify({
        title: "Important deadline approaching",
        description: "Multiple users blocked, need escalation",
      });
      expect(result.predictedPriority).toBe("HIGH");
    });

    it("detects low priority", async () => {
      const result = await provider.classify({
        title: "Minor cosmetic issue",
        description: "Nice to have improvement, when convenient",
      });
      expect(result.predictedPriority).toBe("LOW");
    });

    it("defaults to MEDIUM priority when uncertain", async () => {
      const result = await provider.classify({
        title: "General inquiry",
        description: "Need some help",
      });
      expect(result.predictedPriority).toBe("MEDIUM");
    });

    it("returns suggested next steps for security issues", async () => {
      const result = await provider.classify({
        title: "Security breach detected",
        description: "Suspicious malware activity on production server",
      });
      expect(result.suggestedNextSteps).toBeTruthy();
      expect(result.suggestedNextSteps).toContain("security");
    });

    it("returns null department (mock doesn't predict departments)", async () => {
      const result = await provider.classify({
        title: "Test ticket",
        description: "Test description",
      });
      expect(result.departmentName).toBeNull();
    });

    it("returns model identifier", async () => {
      const result = await provider.classify({
        title: "Test",
        description: "Test",
      });
      expect(result.model).toBe("mock-keyword-v1");
    });
  });
});
