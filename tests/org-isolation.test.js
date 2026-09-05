import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/db/prisma", () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    ticket: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    department: {
      findFirst: vi.fn(),
    },
    organization: {
      findFirst: vi.fn(),
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
import { requireAuth } from "@/lib/authz";
import { requireSameOrganization } from "@/lib/authz";

const org1User = {
  id: "user-1",
  username: "org1user",
  email: "user@org1.com",
  role: "USER",
  status: "ACTIVE",
  organizationId: "org-1",
  departmentId: "dept-1",
};

const org2User = {
  id: "user-2",
  username: "org2user",
  email: "user@org2.com",
  role: "AGENT",
  status: "ACTIVE",
  organizationId: "org-2",
  departmentId: "dept-2",
};

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

describe("organization isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("user from org-1 cannot access org-2 resources", async () => {
    const token = await signAccessToken({
      userId: org1User.id,
      role: org1User.role,
      organizationId: org1User.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(org1User);

    const request = createMockRequest(token);
    const authResult = await requireAuth(request);

    expect(authResult.user).toBeDefined();
    expect(authResult.user.organizationId).toBe("org-1");

    // Attempt cross-org access
    const crossOrgResult = requireSameOrganization(authResult.user, "org-2");
    expect(crossOrgResult.response).toBeDefined();
    expect(crossOrgResult.response.status).toBe(403);
  });

  it("user from org-2 cannot access org-1 resources", async () => {
    const token = await signAccessToken({
      userId: org2User.id,
      role: org2User.role,
      organizationId: org2User.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(org2User);

    const request = createMockRequest(token);
    const authResult = await requireAuth(request);

    expect(authResult.user).toBeDefined();
    expect(authResult.user.organizationId).toBe("org-2");

    // Attempt cross-org access
    const crossOrgResult = requireSameOrganization(authResult.user, "org-1");
    expect(crossOrgResult.response).toBeDefined();
    expect(crossOrgResult.response.status).toBe(403);
  });

  it("same-org access is allowed", async () => {
    const token = await signAccessToken({
      userId: org1User.id,
      role: org1User.role,
      organizationId: org1User.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(org1User);

    const request = createMockRequest(token);
    const authResult = await requireAuth(request);

    const sameOrgResult = requireSameOrganization(authResult.user, "org-1");
    expect(sameOrgResult.ok).toBe(true);
  });

  it("JWT contains organizationId for scoping", async () => {
    const token = await signAccessToken({
      userId: org1User.id,
      role: org1User.role,
      organizationId: org1User.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(org1User);

    const request = createMockRequest(token);
    const authResult = await requireAuth(request);

    // Verify org ID is in the token payload
    expect(authResult.user.organizationId).toBe("org-1");
  });

  it("user cannot modify another org's user", async () => {
    const token = await signAccessToken({
      userId: org1User.id,
      role: org1User.role,
      organizationId: org1User.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(org1User);

    const request = createMockRequest(token);
    const authResult = await requireAuth(request);

    // Simulate trying to update org-2 user
    const targetUserOrg2 = { ...org2User, organizationId: "org-2" };
    const result = requireSameOrganization(authResult.user, targetUserOrg2.organizationId);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(403);
  });

  it("user cannot access another org's ticket", async () => {
    const token = await signAccessToken({
      userId: org1User.id,
      role: org1User.role,
      organizationId: org1User.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(org1User);

    const request = createMockRequest(token);
    const authResult = await requireAuth(request);

    // Simulate trying to access a ticket from org-2
    const ticketFromOrg2 = { id: "ticket-2", organizationId: "org-2" };
    const result = requireSameOrganization(authResult.user, ticketFromOrg2.organizationId);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(403);
  });

  it("user cannot access another org's department", async () => {
    const token = await signAccessToken({
      userId: org1User.id,
      role: org1User.role,
      organizationId: org1User.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(org1User);

    const request = createMockRequest(token);
    const authResult = await requireAuth(request);

    const deptFromOrg2 = { id: "dept-2", organizationId: "org-2" };
    const result = requireSameOrganization(authResult.user, deptFromOrg2.organizationId);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(403);
  });
});
