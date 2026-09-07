import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";

vi.mock("next/link", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ href, children, ...props }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

const mockTwoRecommendations = {
  recommendations: [
    {
      agentId: "agent-1",
      username: "alice",
      email: "alice@test.com",
      department: "IT Support",
      score: 85.5,
      confidence: 0.78,
      workload: { activeTickets: 3, highPriorityTickets: 1 },
      experience: { categoryResolved: 10, totalResolved: 25 },
      explanation: "Recommended because alice belongs to the ticket's department.",
      factors: [
        { name: "Department Match", normalized: 1, weight: 0.3, contribution: 30 },
        { name: "Category Experience", normalized: 0.5, weight: 0.3, contribution: 15 },
        { name: "Workload", normalized: 0.85, weight: 0.25, contribution: 21.25 },
        { name: "Priority Readiness", normalized: 1, weight: 0.1, contribution: 10 },
        { name: "Historical Experience", normalized: 0.6, weight: 0.05, contribution: 3 },
      ],
      rank: 1,
      timestamp: "2026-01-15T10:00:00Z",
    },
    {
      agentId: "agent-2",
      username: "bob",
      email: "bob@test.com",
      department: "Network Ops",
      score: 62.3,
      confidence: null,
      workload: { activeTickets: 8, highPriorityTickets: 2 },
      experience: { categoryResolved: 3, totalResolved: 15 },
      explanation: "Recommended because bob is in a different department.",
      factors: [
        { name: "Department Match", normalized: 0, weight: 0.3, contribution: 0 },
        { name: "Category Experience", normalized: 0.2, weight: 0.3, contribution: 6 },
        { name: "Workload", normalized: 0.6, weight: 0.25, contribution: 15 },
        { name: "Priority Readiness", normalized: 0.8, weight: 0.1, contribution: 8 },
        { name: "Historical Experience", normalized: 0.5, weight: 0.05, contribution: 2.5 },
      ],
      rank: 2,
      timestamp: "2026-01-15T10:00:00Z",
    },
  ],
  totalEligibleAgents: 2,
  generatedAt: "2026-01-15T10:00:00Z",
  aiEnhanced: false,
};

const mockOneRecommendation = {
  recommendations: [mockTwoRecommendations.recommendations[0]],
  totalEligibleAgents: 1,
  generatedAt: "2026-01-15T10:00:00Z",
  aiEnhanced: false,
};

const mockEmptyRecommendations = {
  recommendations: [],
  totalEligibleAgents: 0,
  generatedAt: "2026-01-15T10:00:00Z",
  aiEnhanced: false,
};

let fetchSpy;

beforeEach(() => {
  fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockTwoRecommendations),
  });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
});

import AgentRecommendation from "@/components/tickets/agent-recommendation";

describe("AgentRecommendation UI", () => {
  describe("renders header", () => {
    it("displays AI Agent Recommendations (plural) title", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("AI Agent Recommendations")).toBeInTheDocument();
      });
    });

    it("does not display singular AI Agent Recommendation", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("AI Agent Recommendations")).toBeInTheDocument();
      });

      expect(screen.queryByText("AI Agent Recommendation")).not.toBeInTheDocument();
    });
  });

  describe("two recommendations", () => {
    it("renders two recommendation cards", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("alice")).toBeInTheDocument();
        expect(screen.getByText("bob")).toBeInTheDocument();
      });
    });

    it("shows TOP PICK badge for rank 1", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("TOP PICK")).toBeInTheDocument();
      });
    });

    it("does not show TOP PICK for rank 2", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("alice")).toBeInTheDocument();
      });

      const bobSection = screen.getByText("bob").closest("[class*='rounded-lg']");
      expect(within(bobSection).queryByText("TOP PICK")).not.toBeInTheDocument();
    });

    it("shows confidence badge for top recommendation", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("78% confidence")).toBeInTheDocument();
      });
    });

    it("shows scores for both agents", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText(/Score: 85\.5/)).toBeInTheDocument();
        expect(screen.getByText(/Score: 62\.3/)).toBeInTheDocument();
      });
    });

    it("shows scoring breakdown for rank 1 only", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("alice")).toBeInTheDocument();
      });

      const breakdown = screen.getAllByText("Scoring breakdown");
      expect(breakdown).toHaveLength(1);
    });

    it("shows eligible agents count", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText(/2 eligible agents/)).toBeInTheDocument();
      });
    });

    it("shows Top recommendations text (plural)", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText(/Top recommendations shown below/)).toBeInTheDocument();
      });
    });
  });

  describe("one recommendation", () => {
    beforeEach(() => {
      fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOneRecommendation),
      });
      vi.stubGlobal("fetch", fetchSpy);
    });

    it("renders one recommendation card", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("alice")).toBeInTheDocument();
      });

      expect(screen.queryByText("bob")).not.toBeInTheDocument();
    });

    it("shows eligible agent count as singular", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText(/1 eligible agent in/)).toBeInTheDocument();
      });
    });
  });

  describe("zero recommendations", () => {
    beforeEach(() => {
      fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEmptyRecommendations),
      });
      vi.stubGlobal("fetch", fetchSpy);
    });

    it("shows empty state message", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("No eligible agents found in this department.")).toBeInTheDocument();
      });
    });
  });

  describe("role gating", () => {
    it("renders for ADMIN role", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("AI Agent Recommendations")).toBeInTheDocument();
      });
    });

    it("renders for AGENT role", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="AGENT" />);

      await waitFor(() => {
        expect(screen.getByText("AI Agent Recommendations")).toBeInTheDocument();
      });
    });

    it("does not render for USER role", () => {
      const { container } = render(<AgentRecommendation ticketId="ticket-1" userRole="USER" />);

      expect(container.innerHTML).toBe("");
    });
  });

  describe("refresh", () => {
    it("has a refresh button", async () => {
      render(<AgentRecommendation ticketId="ticket-1" userRole="ADMIN" />);

      await waitFor(() => {
        expect(screen.getByText("Refresh")).toBeInTheDocument();
      });
    });
  });
});
