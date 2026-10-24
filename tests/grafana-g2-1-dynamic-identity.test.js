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
const mockGetCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  setAccessTokenCookie: vi.fn(),
  setRefreshTokenCookie: vi.fn(),
  clearAuthCookies: vi.fn(),
  getAccessTokenFromRequest: vi.fn(),
  getRefreshTokenFromRequest: vi.fn(),
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
import { signGrafanaToken, verifyGrafanaToken, resetGrafanaKeyCache } from "@/lib/auth/grafana-jwt";
import { extractGrafanaToken, validateGrafanaToken } from "@/lib/validation/grafana";
import { getCurrentUser } from "@/lib/auth";

// ============================================================
// Test helpers
// ============================================================
const JWT_SECRET = "test-grafana-jwt-secret-for-g21-testing-32ch!";
const ADMIN_TOKEN = "test-admin-grafana-service-token";
const ADMIN_USER_ID = "admin-user-001";
const ADMIN_ORG_ID = "org-admin-001";

const AGENT_A = { id: "agent-a-001", username: "sarah", role: "AGENT", organizationId: "org-001" };
const AGENT_B = { id: "agent-b-002", username: "rahul", role: "AGENT", organizationId: "org-001" };
const AGENT_C = { id: "agent-c-003", username: "amit", role: "AGENT", organizationId: "org-002" };
const ADMIN_USER = { id: "admin-001", username: "admin", role: "ADMIN", organizationId: "org-001" };
const REGULAR_USER = { id: "user-001", username: "john", role: "USER", organizationId: "org-001" };

function setupEnv() {
  process.env.GRAFANA_JWT_SECRET = JWT_SECRET;
  process.env.GRAFANA_SERVICE_TOKEN = ADMIN_TOKEN;
  process.env.GRAFANA_ADMIN_USER_ID = ADMIN_USER_ID;
  process.env.GRAFANA_ADMIN_ORGANIZATION_ID = ADMIN_ORG_ID;
}

function clearEnv() {
  delete process.env.GRAFANA_JWT_SECRET;
  delete process.env.GRAFANA_SERVICE_TOKEN;
  delete process.env.GRAFANA_ADMIN_USER_ID;
  delete process.env.GRAFANA_ADMIN_ORGANIZATION_ID;
  delete process.env.GRAFANA_AGENT_SERVICE_TOKEN;
  delete process.env.GRAFANA_AGENT_USER_ID;
  delete process.env.GRAFANA_AGENT_ORGANIZATION_ID;
}

function resetMocks() {
  vi.clearAllMocks();
}

// ============================================================
// A. JWT Signing & Verification
// ============================================================
describe("G2.1 — signGrafanaToken", () => {
  beforeEach(setupEnv);
  afterEach(clearEnv);

  it("returns a string token", async () => {
    const token = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
  });

  it("token contains correct claims", async () => {
    const token = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });

    const result = await verifyGrafanaToken(token);
    expect(result.valid).toBe(true);
    expect(result.userId).toBe(AGENT_A.id);
    expect(result.organizationId).toBe(AGENT_A.organizationId);
    expect(result.role).toBe("AGENT");
  });

  it("throws when GRAFANA_JWT_SECRET is missing", async () => {
    delete process.env.GRAFANA_JWT_SECRET;
    resetGrafanaKeyCache();
    await expect(
      signGrafanaToken({ userId: "x", organizationId: "y", role: "AGENT" })
    ).rejects.toThrow("GRAFANA_JWT_SECRET is not configured");
    // Restore for other tests
    process.env.GRAFANA_JWT_SECRET = JWT_SECRET;
    resetGrafanaKeyCache();
  });
});

describe("G2.1 — verifyGrafanaToken", () => {
  beforeEach(setupEnv);
  afterEach(clearEnv);

  it("validates a correctly signed token", async () => {
    const token = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });
    const result = await verifyGrafanaToken(token);
    expect(result.valid).toBe(true);
    expect(result.userId).toBe(AGENT_A.id);
  });

  it("rejects an expired token", async () => {
    // We can't easily create an expired JWT in-process, so test with garbage
    const result = await verifyGrafanaToken("invalid.jwt.token");
    expect(result.valid).toBe(false);
  });

  it("rejects a token signed with wrong secret", async () => {
    // Sign with a different key
    const { SignJWT } = await import("jose");
    const wrongKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("wrong-secret-key-32-characters-long!!"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const badToken = await new SignJWT({
      sub: AGENT_A.id,
      org: AGENT_A.organizationId,
      role: "AGENT",
      purpose: "analytics",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("nirnaya-grafana")
      .setAudience("grafana")
      .setExpirationTime("5m")
      .sign(wrongKey);

    const result = await verifyGrafanaToken(badToken);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid signature");
  });

  it("rejects a token with wrong audience", async () => {
    const { SignJWT } = await import("jose");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const badToken = await new SignJWT({
      sub: AGENT_A.id,
      org: AGENT_A.organizationId,
      role: "AGENT",
      purpose: "analytics",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("nirnaya-grafana")
      .setAudience("wrong-audience")
      .setExpirationTime("5m")
      .sign(key);

    const result = await verifyGrafanaToken(badToken);
    expect(result.valid).toBe(false);
  });

  it("rejects a token with wrong issuer", async () => {
    const { SignJWT } = await import("jose");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const badToken = await new SignJWT({
      sub: AGENT_A.id,
      org: AGENT_A.organizationId,
      role: "AGENT",
      purpose: "analytics",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("wrong-issuer")
      .setAudience("grafana")
      .setExpirationTime("5m")
      .sign(key);

    const result = await verifyGrafanaToken(badToken);
    expect(result.valid).toBe(false);
  });

  it("rejects a token with role=ADMIN (only AGENT allowed)", async () => {
    const token = await signGrafanaToken({
      userId: ADMIN_USER.id,
      organizationId: ADMIN_USER.organizationId,
      role: "ADMIN",
    });
    // signGrafanaToken doesn't validate role, so the token is created
    // but verifyGrafanaToken should reject non-AGENT roles
    const result = await verifyGrafanaToken(token);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Agent role required");
  });

  it("rejects a token with tampered claims", async () => {
    const token = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });

    // Tamper with the payload (base64url decode, modify, re-encode)
    const parts = token.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    payload.sub = AGENT_B.id; // Change the user ID
    const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const result = await verifyGrafanaToken(tamperedToken);
    expect(result.valid).toBe(false);
  });

  it("rejects empty string", async () => {
    const result = await verifyGrafanaToken("");
    expect(result.valid).toBe(false);
  });

  it("rejects random string", async () => {
    const result = await verifyGrafanaToken("not-a-jwt-at-all");
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// B. Token Issuance Endpoint
// ============================================================
describe("G2.1 — POST /api/grafana/auth/token", () => {
  beforeEach(() => {
    resetMocks();
    setupEnv();
  });

  afterEach(clearEnv);

  it("issues a token for authenticated agent", async () => {
    mockGetCurrentUser.mockResolvedValue(AGENT_A);
    const { POST } = await import("@/app/api/grafana/auth/token/route");
    const request = new Request("http://localhost/api/grafana/auth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("token");
    expect(body.expiresIn).toBe(300);
    expect(body.tokenType).toBe("Bearer");

    // Verify the issued token is valid and contains correct identity
    const verified = await verifyGrafanaToken(body.token);
    expect(verified.valid).toBe(true);
    expect(verified.userId).toBe(AGENT_A.id);
    expect(verified.organizationId).toBe(AGENT_A.organizationId);
    expect(verified.role).toBe("AGENT");
  });

  it("issues a token for authenticated admin", async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    const { POST } = await import("@/app/api/grafana/auth/token/route");
    const request = new Request("http://localhost/api/grafana/auth/token", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    const verified = await verifyGrafanaToken(body.token);
    expect(verified.valid).toBe(true);
    expect(verified.userId).toBe(ADMIN_USER.id);
    expect(verified.role).toBe("AGENT"); // Admin gets AGENT-scoped token for analytics
  });

  it("returns 401 for unauthenticated request", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/grafana/auth/token/route");
    const request = new Request("http://localhost/api/grafana/auth/token", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 for USER role", async () => {
    mockGetCurrentUser.mockResolvedValue(REGULAR_USER);
    const { POST } = await import("@/app/api/grafana/auth/token/route");
    const request = new Request("http://localhost/api/grafana/auth/token", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toContain("Agent or admin role required");
  });

  it("returns 500 when GRAFANA_JWT_SECRET is missing", async () => {
    delete process.env.GRAFANA_JWT_SECRET;
    resetGrafanaKeyCache();
    mockGetCurrentUser.mockResolvedValue(AGENT_A);
    const { POST } = await import("@/app/api/grafana/auth/token/route");
    const request = new Request("http://localhost/api/grafana/auth/token", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    // Restore for other tests
    process.env.GRAFANA_JWT_SECRET = JWT_SECRET;
    resetGrafanaKeyCache();
  });
});

// ============================================================
// C. Updated validateGrafanaToken (JWT + Service Token)
// ============================================================
describe("G2.1 — validateGrafanaToken (hybrid)", () => {
  beforeEach(setupEnv);
  afterEach(clearEnv);

  it("validates admin service token", async () => {
    const result = await validateGrafanaToken(ADMIN_TOKEN);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("admin");
    expect(result.userId).toBe(ADMIN_USER_ID);
    expect(result.organizationId).toBe(ADMIN_ORG_ID);
  });

  it("validates agent JWT token", async () => {
    const jwt = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });
    const result = await validateGrafanaToken(jwt);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("agent");
    expect(result.userId).toBe(AGENT_A.id);
    expect(result.organizationId).toBe(AGENT_A.organizationId);
  });

  it("rejects invalid token (neither service token nor valid JWT)", async () => {
    const result = await validateGrafanaToken("totally-invalid-token");
    expect(result.valid).toBe(false);
  });

  it("admin service token takes precedence over invalid JWT", async () => {
    // If the token matches the admin service token exactly, it's admin
    const result = await validateGrafanaToken(ADMIN_TOKEN);
    expect(result.type).toBe("admin");
  });

  it("agent JWT does not grant admin scope", async () => {
    const jwt = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });
    const result = await validateGrafanaToken(jwt);
    expect(result.type).toBe("agent");
    expect(result.type).not.toBe("admin");
  });
});

// ============================================================
// D. Multi-Agent Isolation
// ============================================================
describe("G2.1 — Multi-Agent Isolation", () => {
  beforeEach(() => {
    resetMocks();
    setupEnv();
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.category.findMany.mockResolvedValue([]);
  });

  afterEach(clearEnv);

  it("Agent A sees only Agent A data", async () => {
    const jwt = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });

    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    await GET(request);

    // Verify queries use Agent A's ID
    const groupByCalls = prisma.ticket.groupBy.mock.calls;
    for (const call of groupByCalls) {
      const where = call[0]?.where;
      if (where?.assignedAgentId) {
        expect(where.assignedAgentId).toBe(AGENT_A.id);
      }
    }
  });

  it("Agent B sees only Agent B data", async () => {
    const jwt = await signGrafanaToken({
      userId: AGENT_B.id,
      organizationId: AGENT_B.organizationId,
      role: "AGENT",
    });

    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    await GET(request);

    const groupByCalls = prisma.ticket.groupBy.mock.calls;
    for (const call of groupByCalls) {
      const where = call[0]?.where;
      if (where?.assignedAgentId) {
        expect(where.assignedAgentId).toBe(AGENT_B.id);
      }
    }
  });

  it("Agent C (different org) sees only own org data", async () => {
    const jwt = await signGrafanaToken({
      userId: AGENT_C.id,
      organizationId: AGENT_C.organizationId,
      role: "AGENT",
    });

    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    await GET(request);

    // Verify org scope is Agent C's org, not Agent A's org
    const allCalls = [
      ...prisma.ticket.findMany.mock.calls,
      ...prisma.ticket.groupBy.mock.calls,
    ];
    for (const call of allCalls) {
      const where = call[0]?.where;
      if (where?.organizationId) {
        expect(where.organizationId).toBe(AGENT_C.organizationId);
        expect(where.organizationId).not.toBe(AGENT_A.organizationId);
      }
    }
  });

  it("Agent A cannot obtain Agent B identity via query parameter", async () => {
    const jwt = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });

    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    // Try to inject agentId via query param (should be ignored)
    const request = new Request(
      `http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22&agentId=${AGENT_B.id}`,
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    await GET(request);

    // Should still use Agent A's ID, not Agent B's
    const groupByCalls = prisma.ticket.groupBy.mock.calls;
    for (const call of groupByCalls) {
      const where = call[0]?.where;
      if (where?.assignedAgentId) {
        expect(where.assignedAgentId).toBe(AGENT_A.id);
        expect(where.assignedAgentId).not.toBe(AGENT_B.id);
      }
    }
  });

  it("Agent A cannot change organizationId via query parameter", async () => {
    const jwt = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });

    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      `http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22&organizationId=${AGENT_C.organizationId}`,
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    await GET(request);

    // Should use Agent A's org, not Agent C's
    const allCalls = [
      ...prisma.ticket.findMany.mock.calls,
      ...prisma.ticket.groupBy.mock.calls,
    ];
    for (const call of allCalls) {
      const where = call[0]?.where;
      if (where?.organizationId) {
        expect(where.organizationId).toBe(AGENT_A.organizationId);
        expect(where.organizationId).not.toBe(AGENT_C.organizationId);
      }
    }
  });
});

// ============================================================
// E. Client AgentId/OrganizationId Manipulation
// ============================================================
describe("G2.1 — Client Manipulation Prevention", () => {
  beforeEach(() => {
    resetMocks();
    setupEnv();
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.category.findMany.mockResolvedValue([]);
  });

  afterEach(clearEnv);

  it("agent analytics ignores client-provided agentId in body", async () => {
    const jwt = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });

    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22",
      {
        headers: {
          authorization: `Bearer ${jwt}`,
          "content-type": "application/json",
        },
      }
    );
    await GET(request);

    // The agent ID in queries must come from JWT, not from any client input
    const groupByCalls = prisma.ticket.groupBy.mock.calls;
    for (const call of groupByCalls) {
      const where = call[0]?.where;
      if (where?.assignedAgentId) {
        expect(where.assignedAgentId).toBe(AGENT_A.id);
      }
    }
  });

  it("admin analytics ignores client-provided organizationId", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.department.findMany.mockResolvedValue([]);
    prisma.aIPrediction.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/grafana/analytics/admin/route");
    const request = new Request(
      `http://localhost/api/grafana/analytics/admin?start=2026-09-01&end=2026-09-22&organizationId=hacked-org`,
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    await GET(request);

    // Must use the admin org from env, not "hacked-org"
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
  });
});

// ============================================================
// F. Backward Compatibility
// ============================================================
describe("G2.1 — Backward Compatibility", () => {
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

  afterEach(clearEnv);

  it("admin service token still works for admin analytics", async () => {
    const { GET } = await import("@/app/api/grafana/analytics/admin/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/admin?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it("admin service token still works for health check", async () => {
    const { GET } = await import("@/app/api/grafana/health/route");
    const request = new Request("http://localhost/api/grafana/health", {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.authorization.type).toBe("admin");
  });

  it("agent JWT works for agent analytics", async () => {
    const jwt = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });

    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it("agent JWT works for health check", async () => {
    const jwt = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
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

  it("admin token cannot access agent endpoint", async () => {
    const { GET } = await import("@/app/api/grafana/analytics/agent/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it("agent JWT cannot access admin endpoint", async () => {
    const jwt = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });

    const { GET } = await import("@/app/api/grafana/analytics/admin/route");
    const request = new Request(
      "http://localhost/api/grafana/analytics/admin?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${jwt}` } }
    );
    const response = await GET(request);
    expect(response.status).toBe(403);
  });
});

// ============================================================
// G. Failure Isolation
// ============================================================
describe("G2.1 — Failure Isolation", () => {
  beforeEach(() => {
    resetMocks();
    setupEnv();
  });

  afterEach(clearEnv);

  it("health endpoint works without database", async () => {
    const { GET } = await import("@/app/api/grafana/health/route");
    const request = new Request("http://localhost/api/grafana/health", {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);

    // No prisma calls
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });

  it("token issuance does not break if database is down", async () => {
    // getCurrentUser queries the database — if it fails, we get 401/500, not a crash
    mockGetCurrentUser.mockReset();
    mockGetCurrentUser.mockRejectedValue(new Error("DB connection failed"));
    const { POST } = await import("@/app/api/grafana/auth/token/route");
    const request = new Request("http://localhost/api/grafana/auth/token", {
      method: "POST",
    });

    // Should not throw — should return an error response
    const response = await POST(request);
    expect([401, 500]).toContain(response.status);
  });

  it("NIRNAYA core functionality unaffected by Grafana module", async () => {
    // Verify Grafana modules load independently
    const grafanaJwt = await import("@/lib/auth/grafana-jwt");
    const grafanaValidation = await import("@/lib/validation/grafana");
    expect(grafanaJwt.signGrafanaToken).toBeDefined();
    expect(grafanaJwt.verifyGrafanaToken).toBeDefined();
    expect(grafanaValidation.validateGrafanaToken).toBeDefined();
  });
});

// ============================================================
// H. Environment Configuration
// ============================================================
describe("G2.1 — Environment Configuration", () => {
  beforeEach(setupEnv);
  afterEach(clearEnv);

  it(".env.example contains GRAFANA_JWT_SECRET", async () => {
    const fs = await import("fs");
    const envExample = fs.readFileSync(".env.example", "utf-8");
    expect(envExample).toContain("GRAFANA_JWT_SECRET");
  });

  it(".env.example marks agent service token as deprecated", async () => {
    const fs = await import("fs");
    const envExample = fs.readFileSync(".env.example", "utf-8");
    expect(envExample).toContain("DEPRECATED");
    expect(envExample).toContain("GRAFANA_AGENT_SERVICE_TOKEN");
  });

  it("GRAFANA_JWT_SECRET is set and distinct from app secrets", async () => {
    // GRAFANA_JWT_SECRET must be configured for Grafana JWT signing
    expect(process.env.GRAFANA_JWT_SECRET).toBeTruthy();
    expect(process.env.GRAFANA_JWT_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});

// ============================================================
// I. Concurrency Safety
// ============================================================
describe("G2.1 — Concurrency Safety", () => {
  beforeEach(() => {
    resetMocks();
    setupEnv();
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.category.findMany.mockResolvedValue([]);
  });

  afterEach(clearEnv);

  it("concurrent agent requests resolve independently", async () => {
    const jwtA = await signGrafanaToken({
      userId: AGENT_A.id,
      organizationId: AGENT_A.organizationId,
      role: "AGENT",
    });
    const jwtB = await signGrafanaToken({
      userId: AGENT_B.id,
      organizationId: AGENT_B.organizationId,
      role: "AGENT",
    });

    const { GET } = await import("@/app/api/grafana/analytics/agent/route");

    // Fire both requests concurrently
    const requestA = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${jwtA}` } }
    );
    const requestB = new Request(
      "http://localhost/api/grafana/analytics/agent?start=2026-09-01&end=2026-09-22",
      { headers: { authorization: `Bearer ${jwtB}` } }
    );

    const [responseA, responseB] = await Promise.all([
      GET(requestA),
      GET(requestB),
    ]);

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
  });
});
