import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/db/prisma", () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock env
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    JWT_ACCESS_SECRET: "test-access-secret-that-is-at-least-16-chars",
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-16-chars",
    NODE_ENV: "test",
  }),
}));

import prisma from "@/lib/db/prisma";
import { signAccessToken } from "@/lib/auth/jwt";
import {
  requireAuth,
  requireRole,
  requireAdmin,
  requireAgentOrAdmin,
  requireSameOrganization,
} from "@/lib/authz";

function createMockRequest(token) {
  return {
    cookies: {
      get: (name) =>
        name === "nirnaya_access_token" && token
          ? { value: token }
          : undefined,
    },
  };
}

const activeUser = {
  id: "user-1",
  username: "testuser",
  email: "test@example.com",
  role: "USER",
  status: "ACTIVE",
  organizationId: "org-1",
  departmentId: "dept-1",
};

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no token present", async () => {
    const request = createMockRequest(null);
    const result = await requireAuth(request);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    const request = createMockRequest("bad-token");
    const result = await requireAuth(request);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(401);
  });

  it("returns user when token is valid and user is ACTIVE", async () => {
    const token = await signAccessToken({
      userId: activeUser.id,
      role: activeUser.role,
      organizationId: activeUser.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(activeUser);
    const request = createMockRequest(token);
    const result = await requireAuth(request);
    expect(result.user).toBeDefined();
    expect(result.user.id).toBe(activeUser.id);
    expect(result.response).toBeUndefined();
  });

  it("returns 401 when user is INACTIVE", async () => {
    const token = await signAccessToken({
      userId: activeUser.id,
      role: activeUser.role,
      organizationId: activeUser.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue({ ...activeUser, status: "INACTIVE" });
    const request = createMockRequest(token);
    const result = await requireAuth(request);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(401);
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    const request = createMockRequest(null);
    const result = await requireRole(request, ["ADMIN"]);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(401);
  });

  it("returns 403 when user role not in allowed roles", async () => {
    const token = await signAccessToken({
      userId: activeUser.id,
      role: "USER",
      organizationId: activeUser.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue({ ...activeUser, role: "USER" });
    const request = createMockRequest(token);
    const result = await requireRole(request, ["ADMIN", "AGENT"]);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(403);
  });

  it("returns user when role is in allowed roles", async () => {
    const agentUser = { ...activeUser, role: "AGENT" };
    const token = await signAccessToken({
      userId: agentUser.id,
      role: agentUser.role,
      organizationId: agentUser.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(agentUser);
    const request = createMockRequest(token);
    const result = await requireRole(request, ["AGENT", "ADMIN"]);
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe("AGENT");
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for USER role", async () => {
    const token = await signAccessToken({
      userId: activeUser.id,
      role: "USER",
      organizationId: activeUser.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue({ ...activeUser, role: "USER" });
    const request = createMockRequest(token);
    const result = await requireAdmin(request);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(403);
  });

  it("returns 403 for AGENT role", async () => {
    const token = await signAccessToken({
      userId: activeUser.id,
      role: "AGENT",
      organizationId: activeUser.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue({ ...activeUser, role: "AGENT" });
    const request = createMockRequest(token);
    const result = await requireAdmin(request);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(403);
  });

  it("returns user for ADMIN role", async () => {
    const adminUser = { ...activeUser, role: "ADMIN" };
    const token = await signAccessToken({
      userId: adminUser.id,
      role: adminUser.role,
      organizationId: adminUser.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(adminUser);
    const request = createMockRequest(token);
    const result = await requireAdmin(request);
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe("ADMIN");
  });
});

describe("requireAgentOrAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for USER role", async () => {
    const token = await signAccessToken({
      userId: activeUser.id,
      role: "USER",
      organizationId: activeUser.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue({ ...activeUser, role: "USER" });
    const request = createMockRequest(token);
    const result = await requireAgentOrAdmin(request);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(403);
  });

  it("returns user for AGENT role", async () => {
    const agentUser = { ...activeUser, role: "AGENT" };
    const token = await signAccessToken({
      userId: agentUser.id,
      role: agentUser.role,
      organizationId: agentUser.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(agentUser);
    const request = createMockRequest(token);
    const result = await requireAgentOrAdmin(request);
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe("AGENT");
  });

  it("returns user for ADMIN role", async () => {
    const adminUser = { ...activeUser, role: "ADMIN" };
    const token = await signAccessToken({
      userId: adminUser.id,
      role: adminUser.role,
      organizationId: adminUser.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(adminUser);
    const request = createMockRequest(token);
    const result = await requireAgentOrAdmin(request);
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe("ADMIN");
  });
});

describe("requireSameOrganization", () => {
  it("returns ok when org IDs match", () => {
    const user = { organizationId: "org-1" };
    const result = requireSameOrganization(user, "org-1");
    expect(result.ok).toBe(true);
  });

  it("returns 403 when org IDs do not match", () => {
    const user = { organizationId: "org-1" };
    const result = requireSameOrganization(user, "org-2");
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(403);
  });
});
