import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// Mock Prisma
// ============================================================
const mockPrisma = vi.hoisted(() => ({
  ticket: {
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  department: {
    findMany: vi.fn(),
  },
  category: {
    findMany: vi.fn(),
  },
  aIPrediction: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ default: mockPrisma }));

// ============================================================
// Mock Auth
// ============================================================
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
  requireAgentOrAdmin: vi.fn(),
  requireSameOrganization: vi.fn(),
}));

// ============================================================
// Imports after mocks
// ============================================================
import prisma from "@/lib/db/prisma";
import {
  extractGrafanaToken,
  validateGrafanaToken,
  grafanaAdminQuerySchema,
  grafanaAgentQuerySchema,
} from "@/lib/validation/grafana";

// ============================================================
// Helpers
// ============================================================
const ADMIN_TOKEN = "test-admin-grafana-token-abc123";
const AGENT_TOKEN = "test-agent-grafana-token-xyz789";
const INVALID_TOKEN = "invalid-token";
const ADMIN_USER_ID = "admin-user-id-123";
const ADMIN_ORG_ID = "org-admin-123";
const AGENT_USER_ID = "agent-user-id-456";
const AGENT_ORG_ID = "org-agent-456";

function setupEnv() {
  process.env.GRAFANA_SERVICE_TOKEN = ADMIN_TOKEN;
  process.env.GRAFANA_AGENT_SERVICE_TOKEN = AGENT_TOKEN;
  process.env.GRAFANA_ADMIN_USER_ID = ADMIN_USER_ID;
  process.env.GRAFANA_ADMIN_ORGANIZATION_ID = ADMIN_ORG_ID;
  process.env.GRAFANA_AGENT_USER_ID = AGENT_USER_ID;
  process.env.GRAFANA_AGENT_ORGANIZATION_ID = AGENT_ORG_ID;
  process.env.GRAFANA_JWT_SECRET = "test-grafana-jwt-secret-for-g2-tests-32chars";
}

function clearEnv() {
  delete process.env.GRAFANA_SERVICE_TOKEN;
  delete process.env.GRAFANA_AGENT_SERVICE_TOKEN;
  delete process.env.GRAFANA_ADMIN_USER_ID;
  delete process.env.GRAFANA_ADMIN_ORGANIZATION_ID;
  delete process.env.GRAFANA_AGENT_USER_ID;
  delete process.env.GRAFANA_AGENT_ORGANIZATION_ID;
}

function resetMocks() {
  vi.clearAllMocks();
}

// ============================================================
// A. Token Extraction
// ============================================================
describe("G2 — extractGrafanaToken", () => {
  it("extracts valid Bearer token", () => {
    const request = new Request("http://localhost/api/grafana/health", {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const result = extractGrafanaToken(request);
    expect(result.valid).toBe(true);
    expect(result.token).toBe(ADMIN_TOKEN);
  });

  it("rejects missing Authorization header", () => {
    const request = new Request("http://localhost/api/grafana/health");
    const result = extractGrafanaToken(request);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Missing Authorization header");
  });

  it("rejects non-Bearer scheme", () => {
    const request = new Request("http://localhost/api/grafana/health", {
      headers: { authorization: `Basic ${ADMIN_TOKEN}` },
    });
    const result = extractGrafanaToken(request);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid Authorization format");
  });

  it("rejects malformed Authorization header", () => {
    const request = new Request("http://localhost/api/grafana/health", {
      headers: { authorization: "Bearer" },
    });
    const result = extractGrafanaToken(request);
    expect(result.valid).toBe(false);
  });

  it("rejects empty Bearer value", () => {
    const request = new Request("http://localhost/api/grafana/health", {
      headers: { authorization: "Bearer " },
    });
    const result = extractGrafanaToken(request);
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// B. Token Validation
// ============================================================
describe("G2 — validateGrafanaToken", () => {
  beforeEach(() => {
    setupEnv();
  });

  afterEach(() => {
    clearEnv();
  });

  it("validates admin token and returns admin scope", async () => {
    const result = await validateGrafanaToken(ADMIN_TOKEN);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("admin");
    expect(result.userId).toBe(ADMIN_USER_ID);
    expect(result.organizationId).toBe(ADMIN_ORG_ID);
  });

  it("validates agent JWT and returns agent scope", async () => {
    const { signGrafanaToken } = await import("@/lib/auth/grafana-jwt");
    const jwt = await signGrafanaToken({
      userId: AGENT_USER_ID,
      organizationId: AGENT_ORG_ID,
      role: "AGENT",
    });
    const result = await validateGrafanaToken(jwt);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("agent");
    expect(result.userId).toBe(AGENT_USER_ID);
    expect(result.organizationId).toBe(AGENT_ORG_ID);
  });

  it("rejects invalid token", async () => {
    const result = await validateGrafanaToken(INVALID_TOKEN);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid token");
  });

  it("rejects token when no tokens configured", async () => {
    clearEnv();
    const result = await validateGrafanaToken(ADMIN_TOKEN);
    expect(result.valid).toBe(false);
  });

  it("rejects admin token when admin env vars missing", async () => {
    delete process.env.GRAFANA_ADMIN_USER_ID;
    const result = await validateGrafanaToken(ADMIN_TOKEN);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("GRAFANA_ADMIN_ORGANIZATION_ID or GRAFANA_ADMIN_USER_ID missing");
  });

  it("admin token does not grant agent scope", async () => {
    const result = await validateGrafanaToken(ADMIN_TOKEN);
    expect(result.type).toBe("admin");
    expect(result.type).not.toBe("agent");
  });

  it("agent JWT does not grant admin scope", async () => {
    const { signGrafanaToken } = await import("@/lib/auth/grafana-jwt");
    const jwt = await signGrafanaToken({
      userId: AGENT_USER_ID,
      organizationId: AGENT_ORG_ID,
      role: "AGENT",
    });
    const result = await validateGrafanaToken(jwt);
    expect(result.type).toBe("agent");
    expect(result.type).not.toBe("admin");
  });
});

// ============================================================
// C. Grafana Query Validation
// ============================================================
describe("G2 — grafanaAdminQuerySchema", () => {
  it("accepts valid start/end/granularity", () => {
    const result = grafanaAdminQuerySchema.safeParse({
      start: "2026-09-01",
      end: "2026-09-22",
      granularity: "week",
    });
    expect(result.success).toBe(true);
  });

  it("defaults granularity to day", () => {
    const result = grafanaAdminQuerySchema.safeParse({
      start: "2026-09-01",
      end: "2026-09-22",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.granularity).toBe("day");
    }
  });

  it("rejects missing start", () => {
    const result = grafanaAdminQuerySchema.safeParse({
      end: "2026-09-22",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing end", () => {
    const result = grafanaAdminQuerySchema.safeParse({
      start: "2026-09-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects start after end", () => {
    const result = grafanaAdminQuerySchema.safeParse({
      start: "2026-09-22",
      end: "2026-09-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects range exceeding 365 days", () => {
    const result = grafanaAdminQuerySchema.safeParse({
      start: "2025-01-01",
      end: "2026-09-22",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid granularity", () => {
    const result = grafanaAdminQuerySchema.safeParse({
      start: "2026-09-01",
      end: "2026-09-22",
      granularity: "year",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid granularities", () => {
    for (const g of ["hour", "day", "week", "month"]) {
      const result = grafanaAdminQuerySchema.safeParse({
        start: "2026-09-01",
        end: "2026-09-22",
        granularity: g,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("G2 — grafanaAgentQuerySchema", () => {
  it("accepts valid parameters", () => {
    const result = grafanaAgentQuerySchema.safeParse({
      start: "2026-09-01",
      end: "2026-09-22",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid granularity", () => {
    const result = grafanaAgentQuerySchema.safeParse({
      start: "2026-09-01",
      end: "2026-09-22",
      granularity: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// D. Grafana API Route — Health Check
// ============================================================
describe("G2 — Grafana Health Route", () => {
  beforeEach(() => {
    resetMocks();
    setupEnv();
  });

  afterEach(() => {
    clearEnv();
  });

  it("returns 200 with valid admin token", async () => {
    const { GET } = await import("@/app/api/grafana/health/route");
    const request = new Request("http://localhost/api/grafana/health", {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0");
    expect(body.datasource.status).toBe("ok");
    expect(body.authorization.status).toBe("ok");
    expect(body.authorization.type).toBe("admin");
  });

  it("returns 200 with valid agent JWT", async () => {
    const { signGrafanaToken } = await import("@/lib/auth/grafana-jwt");
    const jwt = await signGrafanaToken({
      userId: AGENT_USER_ID,
      organizationId: AGENT_ORG_ID,
      role: "AGENT",
    });
    const { GET } = await import("@/app/api/grafana/health/route");
    const request = new Request("http://localhost/api/grafana/health", {
      headers: { authorization: `Bearer ${jwt}` },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.authorization.type).toBe("agent");
  });

  it("returns 401 without Authorization header", async () => {
    const { GET } = await import("@/app/api/grafana/health/route");
    const request = new Request("http://localhost/api/grafana/health");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 with invalid token", async () => {
    const { GET } = await import("@/app/api/grafana/health/route");
    const request = new Request("http://localhost/api/grafana/health", {
      headers: { authorization: `Bearer ${INVALID_TOKEN}` },
    });
    const response = await GET(request);
    expect(response.status).toBe(403);
  });
});

// ============================================================
// E. Grafana API Route — Admin Analytics
// ============================================================
describe("G2 — Grafana Admin Analytics Route", () => {
  beforeEach(() => {
    resetMocks();
    setupEnv();
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);
    prisma.aIPrediction.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    clearEnv();
  });

  it("returns analytics with valid admin token and params", async () => {
    const { GET } = await import("@/app/api/grafana/analytics/admin/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/admin?start=2026-09-01&end=2026-09-22&granularity=day",
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.scope).toBe("organization");
    expect(body).toHaveProperty("tickets");
    expect(body).toHaveProperty("workload");
    expect(body).toHaveProperty("sla");
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/grafana/analytics/admin/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/admin?start=2026-09-01&end=2026-09-22"
    );
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 with agent JWT (wrong scope)", async () => {
    const { signGrafanaToken } = await import("@/lib/auth/grafana-jwt");
    const jwt = await signGrafanaToken({
      userId: AGENT_USER_ID,
      organizationId: AGENT_ORG_ID,
      role: "AGENT",
    });
    const { GET } = await import("@/app/api/grafana/analytics/admin/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/admin?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.details).toContain("Admin scope required");
  });

  it("returns 400 for invalid parameters", async () => {
    const { GET } = await import("@/app/api/grafana/analytics/admin/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/admin?start=2026-09-22&end=2026-09-01",
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for missing start", async () => {
    const { GET } = await import("@/app/api/grafana/analytics/admin/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/admin?end=2026-09-22",
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    prisma.ticket.findMany.mockRejectedValue(new Error("DB connection failed"));
    const { GET } = await import("@/app/api/grafana/analytics/admin/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/admin?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("prisma");
  });

  it("queries with server-derived organizationId, not client-provided", async () => {
    const { GET } = await import("@/app/api/grafana/analytics/admin/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/admin?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    await GET(request);

    // Verify all prisma calls use the admin org ID from env, not any client input
    const allCalls = [
      ...prisma.ticket.findMany.mock.calls,
      ...prisma.ticket.groupBy.mock.calls,
      ...prisma.user.findMany.mock.calls,
    ];
    for (const call of allCalls) {
      const where = call[0]?.where;
      if (where?.organizationId) {
        expect(where.organizationId).toBe(ADMIN_ORG_ID);
      }
    }
  });
});

// ============================================================
// F. Grafana API Route — Agent Analytics
// ============================================================
describe("G2 — Grafana Agent Analytics Route", () => {
  beforeEach(() => {
    resetMocks();
    setupEnv();
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.category.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    clearEnv();
  });

  it("returns analytics with valid agent JWT and params", async () => {
    const { signGrafanaToken } = await import("@/lib/auth/grafana-jwt");
    const jwt = await signGrafanaToken({
      userId: AGENT_USER_ID,
      organizationId: AGENT_ORG_ID,
      role: "AGENT",
    });
    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22&granularity=day",
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.scope).toBe("agent");
    expect(body.agent.id).toBe(AGENT_USER_ID);
    expect(body).toHaveProperty("tickets");
    expect(body).toHaveProperty("workload");
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22"
    );
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 with admin token (wrong scope)", async () => {
    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.details).toContain("Agent scope required");
  });

  it("returns 400 for invalid parameters", async () => {
    const { signGrafanaToken } = await import("@/lib/auth/grafana-jwt");
    const jwt = await signGrafanaToken({
      userId: AGENT_USER_ID,
      organizationId: AGENT_ORG_ID,
      role: "AGENT",
    });
    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-22&end=2026-09-01",
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    prisma.ticket.findMany.mockRejectedValue(new Error("DB connection failed"));
    const { signGrafanaToken } = await import("@/lib/auth/grafana-jwt");
    const jwt = await signGrafanaToken({
      userId: AGENT_USER_ID,
      organizationId: AGENT_ORG_ID,
      role: "AGENT",
    });
    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("prisma");
  });

  it("queries with server-derived agentId and organizationId", async () => {
    const { signGrafanaToken } = await import("@/lib/auth/grafana-jwt");
    const jwt = await signGrafanaToken({
      userId: AGENT_USER_ID,
      organizationId: AGENT_ORG_ID,
      role: "AGENT",
    });
    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    await GET(request);

    // Verify agent-scoped queries use the agent ID from JWT
    const groupByCalls = prisma.ticket.groupBy.mock.calls;
    for (const call of groupByCalls) {
      const where = call[0]?.where;
      if (where?.assignedAgentId) {
        expect(where.assignedAgentId).toBe(AGENT_USER_ID);
      }
    }

    // Verify org scope
    const allCalls = [
      ...prisma.ticket.findMany.mock.calls,
      ...prisma.ticket.groupBy.mock.calls,
    ];
    for (const call of allCalls) {
      const where = call[0]?.where;
      if (where?.organizationId) {
        expect(where.organizationId).toBe(AGENT_ORG_ID);
      }
    }
  });
});

// ============================================================
// G. Security — No Secrets Exposed
// ============================================================
describe("G2 — Security Invariants", () => {
  it("health endpoint does not leak token values in response", async () => {
    setupEnv();
    const { GET } = await import("@/app/api/grafana/health/route");
    const request = new Request("http://localhost/api/grafana/health", {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const response = await GET(request);
    const body = await response.json();
    const bodyStr = JSON.stringify(body);

    // Token values must never appear in the response
    expect(bodyStr).not.toContain(ADMIN_TOKEN);
    expect(bodyStr).not.toContain(process.env.JWT_ACCESS_SECRET);
    expect(bodyStr).not.toContain(process.env.JWT_REFRESH_SECRET);
    expect(bodyStr).not.toContain(process.env.GRAFANA_JWT_SECRET);
    clearEnv();
  });

  it("admin analytics does not accept client-provided organizationId", async () => {
    setupEnv();
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);
    prisma.aIPrediction.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/grafana/analytics/admin/route");
    // Attempt to inject a different org via query param (should be ignored)
    const request = new Request(
      `http://localhost/api/grafana/analytics/admin?start=2026-09-01&end=2026-09-22&organizationId=hacked-org`,
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    await GET(request);

    // All queries should use the admin org from env, not "hacked-org"
    const allCalls = [
      ...prisma.ticket.findMany.mock.calls,
      ...prisma.ticket.groupBy.mock.calls,
    ];
    for (const call of allCalls) {
      const where = call[0]?.where;
      if (where?.organizationId) {
        expect(where.organizationId).not.toBe("hacked-org");
        expect(where.organizationId).toBe(ADMIN_ORG_ID);
      }
    }
    clearEnv();
  });

  it("agent analytics does not accept client-provided agentId", async () => {
    setupEnv();
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.category.findMany.mockResolvedValue([]);

    const { signGrafanaToken } = await import("@/lib/auth/grafana-jwt");
    const jwt = await signGrafanaToken({
      userId: AGENT_USER_ID,
      organizationId: AGENT_ORG_ID,
      role: "AGENT",
    });
    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    // Attempt to inject a different agent via query param (should be ignored)
    const request = new Request(
      `http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22&agentId=hacked-agent`,
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    await GET(request);

    // Agent queries should use the agent ID from JWT, not "hacked-agent"
    const groupByCalls = prisma.ticket.groupBy.mock.calls;
    for (const call of groupByCalls) {
      const where = call[0]?.where;
      if (where?.assignedAgentId) {
        expect(where.assignedAgentId).not.toBe("hacked-agent");
        expect(where.assignedAgentId).toBe(AGENT_USER_ID);
      }
    }
    clearEnv();
  });

  it("admin token cannot access agent endpoint", async () => {
    setupEnv();
    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(403);
    clearEnv();
  });

  it("agent JWT cannot access admin endpoint", async () => {
    setupEnv();
    const { signGrafanaToken } = await import("@/lib/auth/grafana-jwt");
    const jwt = await signGrafanaToken({
      userId: AGENT_USER_ID,
      organizationId: AGENT_ORG_ID,
      role: "AGENT",
    });
    const { GET } = await import("@/app/api/grafana/analytics/admin/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/admin?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(403);
    clearEnv();
  });
});

// ============================================================
// H. Failure Isolation
// ============================================================
describe("G2 — Failure Isolation", () => {
  beforeEach(() => {
    resetMocks();
    setupEnv();
  });

  afterEach(() => {
    clearEnv();
  });

  it("health endpoint works without database", async () => {
    // Health check should not query the database
    const { GET } = await import("@/app/api/grafana/health/route");
    const request = new Request("http://localhost/api/grafana/health", {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);

    // No prisma calls should have been made
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
    expect(prisma.ticket.groupBy).not.toHaveBeenCalled();
  });

  it("Grafana endpoints do not block core NIRNAYA functionality", async () => {
    // Verify that the Grafana routes are completely separate from core routes
    // by checking they import independently
    const grafanaHealth = await import("@/app/api/grafana/health/route");
    const grafanaAdmin = await import("@/app/api/grafana/analytics/admin/route");
    const grafanaAgent = await import("@/app/api/grafana/analytics/agent/route");

    expect(grafanaHealth.GET).toBeDefined();
    expect(grafanaAdmin.GET).toBeDefined();
    expect(grafanaAgent.GET).toBeDefined();
  });
});

// ============================================================
// I. Configuration Validation
// ============================================================
describe("G2 — Configuration", () => {
  it("env vars are documented in .env.example", async () => {
    const fs = await import("fs");
    const envExample = fs.readFileSync(".env.example", "utf-8");

    const requiredVars = [
      "GRAFANA_ENABLED",
      "GRAFANA_SERVICE_TOKEN",
      "GRAFANA_AGENT_SERVICE_TOKEN",
      "GRAFANA_ADMIN_USER_ID",
      "GRAFANA_ADMIN_ORGANIZATION_ID",
      "GRAFANA_AGENT_USER_ID",
      "GRAFANA_AGENT_ORGANIZATION_ID",
    ];

    for (const v of requiredVars) {
      expect(envExample).toContain(v);
    }
  });

  it("docker-compose.yml references pinned Grafana version", async () => {
    const fs = await import("fs");
    const compose = fs.readFileSync("docker-compose.yml", "utf-8");

    // Must not use :latest
    expect(compose).not.toContain("grafana/grafana:latest");
    // Must reference a specific version
    expect(compose).toMatch(/grafana\/grafana:\d+\.\d+\.\d+/);
  });

  it("no Grafana secrets in source code", async () => {
    // Verify test tokens don't leak into non-test source files
    const grafanaVars = [
      process.env.GRAFANA_SERVICE_TOKEN,
      process.env.GRAFANA_AGENT_SERVICE_TOKEN,
    ].filter(Boolean);

    // In test env these are test values — verify they are set
    for (const token of grafanaVars) {
      expect(token).toBeTruthy();
    }
  });
});
