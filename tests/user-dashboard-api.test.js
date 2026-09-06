import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/user-dashboard-service", () => ({
  getUserDashboardStats: vi.fn(),
}));

import { requireAuth } from "@/lib/authz";
import { getUserDashboardStats } from "@/lib/services/user-dashboard-service";

const mockUser = {
  id: "user-1",
  username: "john.doe",
  role: "USER",
  organizationId: "org-1",
};

function makeRequest(url = "http://localhost/api/dashboard/user") {
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/dashboard/user", () => {
  it("returns user-scoped dashboard stats", async () => {
    requireAuth.mockResolvedValue({ user: mockUser });
    getUserDashboardStats.mockResolvedValue({
      openTickets: 3,
      inProgressTickets: 1,
      resolvedToday: 2,
      slaBreached: 0,
      recentTickets: [],
    });

    const { GET } = await import("@/app/api/dashboard/user/route");
    const res = await GET(makeRequest());
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(data.openTickets).toBe(3);
    expect(data.inProgressTickets).toBe(1);
    expect(data.resolvedToday).toBe(2);
    expect(data.slaBreached).toBe(0);
    expect(data.recentTickets).toEqual([]);
  });

  it("calls getUserDashboardStats with user id and organizationId", async () => {
    requireAuth.mockResolvedValue({ user: mockUser });
    getUserDashboardStats.mockResolvedValue({
      openTickets: 0,
      inProgressTickets: 0,
      resolvedToday: 0,
      slaBreached: 0,
      recentTickets: [],
    });

    const { GET } = await import("@/app/api/dashboard/user/route");
    await GET(makeRequest());

    expect(getUserDashboardStats).toHaveBeenCalledWith("user-1", "org-1");
  });

  it("returns 401 when unauthenticated", async () => {
    requireAuth.mockResolvedValue({
      response: new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401 }
      ),
    });

    const { GET } = await import("@/app/api/dashboard/user/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(getUserDashboardStats).not.toHaveBeenCalled();
  });

  it("allows AGENT role and returns user-scoped stats", async () => {
    const agentUser = { id: "agent-1", username: "agent.jane", role: "AGENT", organizationId: "org-1" };
    requireAuth.mockResolvedValue({ user: agentUser });
    getUserDashboardStats.mockResolvedValue({
      openTickets: 5,
      inProgressTickets: 2,
      resolvedToday: 1,
      slaBreached: 0,
      recentTickets: [],
    });

    const { GET } = await import("@/app/api/dashboard/user/route");
    const res = await GET(makeRequest());
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(data.openTickets).toBe(5);
    expect(getUserDashboardStats).toHaveBeenCalledWith("agent-1", "org-1");
  });

  it("returns 500 on internal error", async () => {
    requireAuth.mockResolvedValue({ user: mockUser });
    getUserDashboardStats.mockRejectedValue(new Error("DB error"));

    const { GET } = await import("@/app/api/dashboard/user/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
  });

  it("includes recent tickets in response", async () => {
    requireAuth.mockResolvedValue({ user: mockUser });
    const mockTickets = [
      {
        id: "t1",
        ticketNumber: "NIR-2026-000001",
        title: "Test ticket",
        status: "OPEN",
        priority: "HIGH",
        createdAt: new Date().toISOString(),
      },
    ];
    getUserDashboardStats.mockResolvedValue({
      openTickets: 1,
      inProgressTickets: 0,
      resolvedToday: 0,
      slaBreached: 0,
      recentTickets: mockTickets,
    });

    const { GET } = await import("@/app/api/dashboard/user/route");
    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.recentTickets).toHaveLength(1);
    expect(data.recentTickets[0].ticketNumber).toBe("NIR-2026-000001");
  });
});
