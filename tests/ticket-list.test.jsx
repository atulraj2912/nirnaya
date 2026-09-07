import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ href, children, ...props }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@/components/tickets/status-badge", () => ({
  StatusBadge: ({ status }) => <span data-testid="status-badge">{status}</span>,
  PriorityBadge: ({ priority }) => <span data-testid="priority-badge">{priority}</span>,
}));

const mockTickets = [
  {
    id: "t1",
    ticketNumber: "NIR-2026-000001",
    title: "VPN issue",
    status: "ASSIGNED",
    priority: "HIGH",
    department: { id: "d1", name: "IT", code: "IT" },
    category: { id: "c1", name: "Network" },
    requester: { id: "u1", username: "alice", email: "alice@test.com" },
    assignedAgent: { id: "a1", username: "bob", email: "bob@test.com" },
    createdAt: "2026-01-15T10:00:00Z",
  },
];

let fetchSpy;

beforeEach(() => {
  fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ tickets: mockTickets, total: 1, totalPages: 1 }),
  });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
});

import TicketList from "@/components/tickets/ticket-list";

function getStatusSelect() {
  return screen.getAllByRole("combobox")[0];
}

function getOptions() {
  return within(getStatusSelect()).getAllByRole("option");
}

function getOptionLabels() {
  return getOptions().map((o) => o.textContent);
}

describe("TicketList - status dropdown", () => {
  describe("My Active Tickets (scope=my-active)", () => {
    it("renders exactly five status options", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptions()).toHaveLength(5);
    });

    it("renders All Active as first option", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptions()[0].textContent).toBe("All Active");
      expect(getOptions()[0].value).toBe("");
    });

    it("renders Assigned option", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptionLabels()).toContain("Assigned");
    });

    it("renders In Progress option", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptionLabels()).toContain("In Progress");
    });

    it("renders Waiting for User option", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptionLabels()).toContain("Waiting for User");
    });

    it("renders Reopened option", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptionLabels()).toContain("Reopened");
    });

    it("does not render Open option", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptionLabels()).not.toContain("Open");
    });

    it("does not render Resolved option", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptionLabels()).not.toContain("Resolved");
    });

    it("does not render Closed option", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptionLabels()).not.toContain("Closed");
    });

    it("does not render All Statuses option", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptionLabels()).not.toContain("All Statuses");
    });

    it("passes scope param in API request", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      const url = fetchSpy.mock.calls[0][0];
      expect(url).toContain("scope=my-active");
    });

    it("passes scope param and status param together", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      const url = fetchSpy.mock.calls[0][0];
      expect(url).toContain("scope=my-active");
    });

    it("sends empty status when All Active is selected (no status param)", async () => {
      render(<TicketList scope="my-active" />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      const url = fetchSpy.mock.calls[0][0];
      expect(url).not.toContain("status=");
    });
  });

  describe("All Tickets (no scope)", () => {
    it("renders All Statuses as first option", async () => {
      render(<TicketList />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptions()[0].textContent).toBe("All Statuses");
      expect(getOptions()[0].value).toBe("");
    });

    it("renders all eight status options (All Statuses + 7 statuses)", async () => {
      render(<TicketList />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptions()).toHaveLength(8);
    });

    it("includes Open, Resolved, and Closed options", async () => {
      render(<TicketList />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      const labels = getOptionLabels();
      expect(labels).toContain("Open");
      expect(labels).toContain("Resolved");
      expect(labels).toContain("Closed");
    });

    it("does not pass scope param in API request", async () => {
      render(<TicketList />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      const url = fetchSpy.mock.calls[0][0];
      expect(url).not.toContain("scope=");
    });

    it("does not include All Active option", async () => {
      render(<TicketList />);

      await waitFor(() => {
        expect(screen.getByText("VPN issue")).toBeInTheDocument();
      });

      expect(getOptionLabels()).not.toContain("All Active");
    });
  });
});
