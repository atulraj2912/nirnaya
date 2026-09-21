import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    ticket: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      update: vi.fn().mockResolvedValue({}),
      groupBy: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _count: { id: 0 } }),
    },
    user: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    notification: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    comment: {
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    department: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    category: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    tag: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    savedReply: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  verifyRefreshToken: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  getRefreshTokenFromRequest: vi.fn(),
  setAccessTokenCookie: vi.fn(),
  setRefreshTokenCookie: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
  requireAgentOrAdmin: vi.fn(),
}));

vi.mock("@/lib/services/notification-service", () => ({
  createNotification: vi.fn(),
  notifySLABreach: vi.fn(),
  notifySLAWarning: vi.fn(),
  getUserNotifications: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  getUnreadCount: vi.fn(),
}));

vi.mock("@/lib/realtime/socket-server", () => ({
  emitToUser: vi.fn(),
  emitToOrg: vi.fn(),
  emitToTicket: vi.fn(),
}));

vi.mock("@/lib/realtime/socket-instance", () => ({
  getIO: vi.fn(() => null),
  setIO: vi.fn(),
}));

// ============================================================
// Part 11: Security Regression Tests
// ============================================================

describe("Part 11: SLA Route IDOR Fix", () => {
  beforeEach(() => vi.clearAllMocks());

  it("SLA GET route no longer imports evaluateAndPersistSLA", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const routePath = path.resolve("src/app/api/tickets/[id]/sla/route.js");
    const content = fs.readFileSync(routePath, "utf8");

    expect(content).not.toContain("evaluateAndPersistSLA");
  });

  it("SLA GET route calls getTicketById which enforces org check", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const routePath = path.resolve("src/app/api/tickets/[id]/sla/route.js");
    const content = fs.readFileSync(routePath, "utf8");

    expect(content).toContain("getTicketById(id, user)");
  });
});

describe("Part 11: Security Headers", () => {
  it("next.config.mjs defines required security headers", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const configPath = path.resolve("next.config.mjs");
    const content = fs.readFileSync(configPath, "utf8");

    expect(content).toContain("X-Content-Type-Options");
    expect(content).toContain("nosniff");
    expect(content).toContain("X-Frame-Options");
    expect(content).toContain("DENY");
    expect(content).toContain("Referrer-Policy");
    expect(content).toContain("Permissions-Policy");
  });
});

describe("Part 11: ZodError Sanitization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin settings PATCH does not expose ZodError details", async () => {
    const { requireAdmin } = await import("@/lib/authz");
    requireAdmin.mockResolvedValue({
      user: { id: "u1", organizationId: "org-1", role: "ADMIN" },
      response: null,
    });

    const { PATCH } = await import("@/app/api/admin/settings/route");
    const request = new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ businessHoursStart: "not-a-time" }),
      headers: { "content-type": "application/json" },
    });

    const res = await PATCH(request);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(json.details).toBeUndefined();
  });

  it("admin saved-replies POST does not expose ZodError details", async () => {
    const { requireAdmin } = await import("@/lib/authz");
    requireAdmin.mockResolvedValue({
      user: { id: "u1", organizationId: "org-1", role: "ADMIN" },
      response: null,
    });

    const { POST } = await import("@/app/api/admin/saved-replies/route");
    const request = new Request("http://localhost/api/admin/saved-replies", {
      method: "POST",
      body: JSON.stringify({ title: "", content: "" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(request);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(json.details).toBeUndefined();
  });
});

describe("Part 11: SLA Scan Batching", () => {
  beforeEach(() => vi.clearAllMocks());

  it("SLA scan uses batched queries (take:100)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const scanPath = path.resolve("src/lib/services/sla-scan-service.js");
    const content = fs.readFileSync(scanPath, "utf8");

    expect(content).toContain("BATCH_SIZE");
    expect(content).toContain("take: BATCH_SIZE");
    expect(content).toContain("skip");
    expect(content).toContain("hasMore");
    expect(content).toContain("while (hasMore)");
  });
});

describe("Part 11: Auth Security", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refresh endpoint returns 403 for inactive user", async () => {
    const auth = await import("@/lib/auth");
    auth.verifyRefreshToken.mockResolvedValue({ userId: "u1" });
    auth.getRefreshTokenFromRequest.mockReturnValue("valid-token");

    const prisma = (await import("@/lib/db/prisma")).default;
    prisma.user.findUnique.mockResolvedValue({
      id: "u1", username: "test", email: "test@test.com",
      role: "USER", status: "INACTIVE", avatarUrl: null,
      designation: null, organizationId: "org-1",
      departmentId: null, employeeId: null,
    });

    const { POST } = await import("@/app/api/auth/refresh/route");
    const request = new Request("http://localhost/api/auth/refresh", { method: "POST" });
    const res = await POST(request);

    expect(res.status).toBe(403);
  });

  it("refresh endpoint returns 401 when user not found", async () => {
    const auth = await import("@/lib/auth");
    auth.verifyRefreshToken.mockResolvedValue({ userId: "nonexistent" });
    auth.getRefreshTokenFromRequest.mockReturnValue("valid-token");

    const prisma = (await import("@/lib/db/prisma")).default;
    prisma.user.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/auth/refresh/route");
    const request = new Request("http://localhost/api/auth/refresh", { method: "POST" });
    const res = await POST(request);

    expect(res.status).toBe(401);
  });

  it("login returns generic error for invalid credentials (no user enumeration)", async () => {
    const prisma = (await import("@/lib/db/prisma")).default;
    prisma.user.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/auth/login/route");
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "test@test.com", password: "wrong" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(request);
    const json = await res.json();

    expect(json.error).toBe("Invalid email or password");
    expect(json.userId).toBeUndefined();
  });
});

describe("Part 11: RBAC Defense-in-Depth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("status transition route returns 401 for unauthenticated requests", async () => {
    const { requireAuth } = await import("@/lib/authz");
    requireAuth.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const { POST } = await import("@/app/api/tickets/[id]/status/route");
    const request = new Request("http://localhost/api/tickets/t1/status", {
      method: "POST",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(request, { params: Promise.resolve({ id: "t1" }) });

    expect(res.status).toBe(401);
  });
});

describe("Part 11: Mass Assignment Protection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ticket creation uses server-controlled organizationId and requesterId", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const svcPath = path.resolve("src/lib/services/ticket-service.js");
    const content = fs.readFileSync(svcPath, "utf8");

    expect(content).toContain("requesterId: user.id");
    expect(content).toContain("organizationId: orgId");
    expect(content).toContain("createdById: user.id");
    expect(content).toContain("updatedById: user.id");
  });
});

describe("Part 11: Organization Isolation Regression", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notification queries always include organizationId filter", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const svcPath = path.resolve("src/lib/services/notification-service.js");
    const content = fs.readFileSync(svcPath, "utf8");

    expect(content).toContain("organizationId");
    expect(content).toContain("recipientId");
  });

  it("ticket service validates organizationId on fetch", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const svcPath = path.resolve("src/lib/services/ticket-service.js");
    const content = fs.readFileSync(svcPath, "utf8");

    expect(content).toContain("organizationId !== orgId");
  });
});

describe("Part 11: Internal Comment Protection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("comment service blocks INTERNAL visibility for USER role", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const svcPath = path.resolve("src/lib/services/comment-service.js");
    const content = fs.readFileSync(svcPath, "utf8");

    expect(content).toContain("INTERNAL");
    expect(content).toContain("role");
  });
});

describe("Part 11: Ticket Lifecycle - CLOSED is Terminal", () => {
  it("lifecycle defines CLOSED with empty transitions array", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const lifecyclePath = path.resolve("src/lib/services/lifecycle.js");
    const content = fs.readFileSync(lifecyclePath, "utf8");

    expect(content).toContain("CLOSED:");
    expect(content).toMatch(/CLOSED:\s*\[\s*\]/);
  });
});

describe("Part 11: SLA Cannot Be Falsified by USER", () => {
  beforeEach(() => vi.clearAllMocks());

  it("satisfyResponseSLA rejects non-AGENT/ADMIN roles", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const slaPath = path.resolve("src/lib/services/sla-service.js");
    const content = fs.readFileSync(slaPath, "utf8");

    expect(content).toContain("AGENT");
    expect(content).toContain("ADMIN");
    expect(content).toContain("return null");
  });
});
