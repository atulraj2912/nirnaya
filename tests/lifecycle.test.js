import { describe, expect, it } from "vitest";
import { canTransition, getAllowedTransitions, isTerminal } from "@/lib/services/lifecycle";

describe("Ticket lifecycle transition rules", () => {
  describe("canTransition", () => {
    it("allows OPEN → ASSIGNED", () => {
      const result = canTransition("OPEN", "ASSIGNED", "AGENT");
      expect(result.allowed).toBe(true);
    });

    it("allows ASSIGNED → IN_PROGRESS", () => {
      const result = canTransition("ASSIGNED", "IN_PROGRESS", "AGENT");
      expect(result.allowed).toBe(true);
    });

    it("allows IN_PROGRESS → WAITING_FOR_USER", () => {
      const result = canTransition("IN_PROGRESS", "WAITING_FOR_USER", "AGENT");
      expect(result.allowed).toBe(true);
    });

    it("allows IN_PROGRESS → RESOLVED", () => {
      const result = canTransition("IN_PROGRESS", "RESOLVED", "AGENT");
      expect(result.allowed).toBe(true);
    });

    it("allows WAITING_FOR_USER → IN_PROGRESS", () => {
      const result = canTransition("WAITING_FOR_USER", "IN_PROGRESS", "AGENT");
      expect(result.allowed).toBe(true);
    });

    it("allows RESOLVED → CLOSED", () => {
      const result = canTransition("RESOLVED", "CLOSED", "AGENT");
      expect(result.allowed).toBe(true);
    });

    it("allows RESOLVED → REOPENED", () => {
      const result = canTransition("RESOLVED", "REOPENED", "AGENT");
      expect(result.allowed).toBe(true);
    });

    it("allows REOPENED → IN_PROGRESS", () => {
      const result = canTransition("REOPENED", "IN_PROGRESS", "AGENT");
      expect(result.allowed).toBe(true);
    });

    it("allows same status (no-op)", () => {
      const result = canTransition("OPEN", "OPEN", "AGENT");
      expect(result.allowed).toBe(true);
    });

    it("rejects OPEN → IN_PROGRESS (skips ASSIGNED)", () => {
      const result = canTransition("OPEN", "IN_PROGRESS", "AGENT");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not allowed");
    });

    it("rejects OPEN → CLOSED (terminal status)", () => {
      const result = canTransition("OPEN", "CLOSED", "AGENT");
      expect(result.allowed).toBe(false);
    });

    it("rejects CLOSED → OPEN (terminal)", () => {
      const result = canTransition("CLOSED", "OPEN", "ADMIN");
      expect(result.allowed).toBe(false);
    });

    it("rejects transitions from unknown status", () => {
      const result = canTransition("INVALID", "OPEN", "AGENT");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Unknown current status");
    });

    it("allows ADMIN to perform all transitions", () => {
      const result = canTransition("OPEN", "ASSIGNED", "ADMIN");
      expect(result.allowed).toBe(true);
    });

    it("allows USER to reopen own ticket from RESOLVED", () => {
      const result = canTransition("RESOLVED", "REOPENED", "USER", {
        requesterId: "user-1",
        actorId: "user-1",
      });
      expect(result.allowed).toBe(true);
    });

    it("rejects USER reopening ticket they didn't request", () => {
      const result = canTransition("RESOLVED", "REOPENED", "USER", {
        requesterId: "user-1",
        actorId: "user-2",
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("own tickets");
    });

    it("rejects USER from performing agent transitions", () => {
      const result = canTransition("OPEN", "ASSIGNED", "USER");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Users cannot");
    });

    it("rejects USER from resolving a ticket", () => {
      const result = canTransition("IN_PROGRESS", "RESOLVED", "USER");
      expect(result.allowed).toBe(false);
    });
  });

  describe("getAllowedTransitions", () => {
    it("returns ASSIGNED from OPEN", () => {
      expect(getAllowedTransitions("OPEN")).toEqual(["ASSIGNED"]);
    });

    it("returns IN_PROGRESS from ASSIGNED", () => {
      expect(getAllowedTransitions("ASSIGNED")).toEqual(["IN_PROGRESS"]);
    });

    it("returns WAITING_FOR_USER and RESOLVED from IN_PROGRESS", () => {
      const allowed = getAllowedTransitions("IN_PROGRESS");
      expect(allowed).toContain("WAITING_FOR_USER");
      expect(allowed).toContain("RESOLVED");
      expect(allowed.length).toBe(2);
    });

    it("returns empty array for CLOSED", () => {
      expect(getAllowedTransitions("CLOSED")).toEqual([]);
    });

    it("returns empty array for unknown status", () => {
      expect(getAllowedTransitions("INVALID")).toEqual([]);
    });
  });

  describe("isTerminal", () => {
    it("returns true for CLOSED", () => {
      expect(isTerminal("CLOSED")).toBe(true);
    });

    it("returns false for OPEN", () => {
      expect(isTerminal("OPEN")).toBe(false);
    });

    it("returns false for IN_PROGRESS", () => {
      expect(isTerminal("IN_PROGRESS")).toBe(false);
    });

    it("returns false for unknown status", () => {
      expect(isTerminal("INVALID")).toBe(false);
    });
  });
});
