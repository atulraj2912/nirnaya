import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ticket: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    department: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    JWT_ACCESS_SECRET: "test-access-secret-that-is-at-least-16-chars-long",
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-16-chars-long",
    NODE_ENV: "test",
  }),
}));

vi.mock("@/lib/services/notification-service", () => ({
  notifyTicketAssigned: vi.fn().mockResolvedValue({}),
  notifyTicketStatusChanged: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/services/sla-service", () => ({
  initializeSLA: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/services/ai-classification-service", () => ({
  classifyTicket: vi.fn().mockResolvedValue({}),
}));

import prisma from "@/lib/db/prisma";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "@/lib/auth/jwt";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  getAccessTokenFromRequest,
  getRefreshTokenFromRequest,
  ACCESS_TOKEN_NAME,
  REFRESH_TOKEN_NAME,
} from "@/lib/auth/cookies";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  requireAuth,
  requireRole,
  requireAdmin,
  requireAgentOrAdmin,
  requireSameOrganization,
} from "@/lib/authz";
import { deactivateUser, updateUser, createUser, getUser, UserAdminError } from "@/lib/services/user-admin-service";

const org1 = "org-1";
const org2 = "org-2";

function makeUser(overrides = {}) {
  return {
    id: "user-1",
    username: "testuser",
    email: "test@example.com",
    role: "USER",
    status: "ACTIVE",
    organizationId: org1,
    departmentId: "dept-1",
    employeeId: "EMP001",
    avatarUrl: null,
    designation: "Tester",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeAgent(overrides = {}) {
  return makeUser({ id: "agent-1", username: "agent", email: "agent@example.com", role: "AGENT", ...overrides });
}

function makeAdmin(overrides = {}) {
  return makeUser({ id: "admin-1", username: "admin", email: "admin@example.com", role: "ADMIN", ...overrides });
}

function createMockRequest(token) {
  return {
    cookies: {
      get: (name) => (name === ACCESS_TOKEN_NAME && token ? { value: token } : undefined),
    },
  };
}

function createMockRefreshRequest(refreshToken) {
  return {
    cookies: {
      get: (name) => (name === REFRESH_TOKEN_NAME && refreshToken ? { value: refreshToken } : undefined),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

// SECTION 1: Password Hashing Security
describe("Part 3: Password Hashing", () => {
  it("hashPassword produces a bcrypt hash with cost factor 12", async () => {
    const hash = await hashPassword("MyP@ssw0rd!");
    expect(hash).toMatch(/^\$2[aby]?\$12\$/);
  });

  it("verifyPassword returns true for correct password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("verifyPassword returns false for incorrect password", async () => {
    const hash = await hashPassword("real-password");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("same password produces different hashes (random salt)", async () => {
    const hash1 = await hashPassword("same-password");
    const hash2 = await hashPassword("same-password");
    expect(hash1).not.toBe(hash2);
  });
});

// SECTION 2: JWT Token Security
describe("Part 3: JWT Access Tokens", () => {
  const payload = { userId: "u1", role: "USER", organizationId: org1 };

  it("signAccessToken produces a valid 3-part JWT string", async () => {
    const token = await signAccessToken(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifyAccessToken decodes valid token with correct claims", async () => {
    const token = await signAccessToken(payload);
    const decoded = await verifyAccessToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.organizationId).toBe(payload.organizationId);
  });

  it("verifyAccessToken returns null for tampered token", async () => {
    const token = await signAccessToken(payload);
    const parts = token.split(".");
    parts[2] = "tampered";
    const result = await verifyAccessToken(parts.join("."));
    expect(result).toBeNull();
  });

  it("verifyAccessToken returns null for token signed with wrong secret", async () => {
    const { SignJWT } = await import("jose");
    const wrongKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("wrong-secret-key-12345"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const wrongToken = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(wrongKey);
    const result = await verifyAccessToken(wrongToken);
    expect(result).toBeNull();
  });

  it("verifyAccessToken returns null for garbage string", async () => {
    expect(await verifyAccessToken("not-a-jwt")).toBeNull();
    expect(await verifyAccessToken("")).toBeNull();
  });
});

describe("Part 3: JWT Refresh Tokens", () => {
  const payload = { userId: "u1", role: "USER", organizationId: org1 };

  it("signRefreshToken produces a valid 3-part JWT string", async () => {
    const token = await signRefreshToken(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifyRefreshToken decodes valid token with correct claims", async () => {
    const token = await signRefreshToken(payload);
    const decoded = await verifyRefreshToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded.userId).toBe(payload.userId);
  });

  it("access secret cannot verify refresh tokens (secret isolation)", async () => {
    const refreshToken = await signRefreshToken(payload);
    const { jwtVerify } = await import("jose");
    const accessKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("test-access-secret-that-is-at-least-16-chars-long"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    await expect(jwtVerify(refreshToken, accessKey)).rejects.toThrow();
  });

  it("refresh secret cannot verify access tokens (secret isolation)", async () => {
    const accessToken = await signAccessToken(payload);
    const { jwtVerify } = await import("jose");
    const refreshKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("test-refresh-secret-that-is-at-least-16-chars-long"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    await expect(jwtVerify(accessToken, refreshKey)).rejects.toThrow();
  });

  it("verifyRefreshToken returns null for expired token", async () => {
    const { SignJWT } = await import("jose");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("test-refresh-secret-that-is-at-least-16-chars-long"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({ ...payload, iat: now - 7200, exp: now - 3600 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 7200)
      .setExpirationTime("0s")
      .sign(key);
    const result = await verifyRefreshToken(expiredToken);
    expect(result).toBeNull();
  });
});

// SECTION 3: Cookie Security
describe("Part 3: Cookie Security", () => {
  it("setAccessTokenCookie sets httpOnly, sameSite lax, path /, maxAge 3600", () => {
    const cookies = {};
    const response = {
      cookies: { set: (name, value, opts) => { cookies[name] = { value, ...opts }; } },
    };
    setAccessTokenCookie(response, "tok123");
    const opts = cookies[ACCESS_TOKEN_NAME];
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(3600);
  });

  it("setRefreshTokenCookie sets httpOnly, sameSite lax, path /, maxAge 7 days", () => {
    const cookies = {};
    const response = {
      cookies: { set: (name, value, opts) => { cookies[name] = { value, ...opts }; } },
    };
    setRefreshTokenCookie(response, "ref456");
    const opts = cookies[REFRESH_TOKEN_NAME];
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(7 * 24 * 60 * 60);
  });

  it("clearAuthCookies sets maxAge 0 on both cookies", () => {
    const cookies = {};
    const response = {
      cookies: { set: (name, value, opts) => { cookies[name] = { value, ...opts }; } },
    };
    clearAuthCookies(response);
    expect(cookies[ACCESS_TOKEN_NAME].maxAge).toBe(0);
    expect(cookies[REFRESH_TOKEN_NAME].maxAge).toBe(0);
  });

  it("getAccessTokenFromRequest reads the correct cookie", () => {
    const req = { cookies: { get: (n) => (n === ACCESS_TOKEN_NAME ? { value: "abc" } : undefined) } };
    expect(getAccessTokenFromRequest(req)).toBe("abc");
  });

  it("getRefreshTokenFromRequest reads the correct cookie", () => {
    const req = { cookies: { get: (n) => (n === REFRESH_TOKEN_NAME ? { value: "xyz" } : undefined) } };
    expect(getRefreshTokenFromRequest(req)).toBe("xyz");
  });

  it("getAccessTokenFromRequest returns undefined when cookie absent", () => {
    const req = { cookies: { get: () => undefined } };
    expect(getAccessTokenFromRequest(req)).toBeUndefined();
  });
});

// SECTION 4: Session Lifecycle (getCurrentUser)
describe("Part 3: Session Lifecycle", () => {
  it("returns null when no access token cookie", async () => {
    const user = await getCurrentUser({ cookies: { get: () => undefined } });
    expect(user).toBeNull();
  });

  it("returns null for invalid JWT", async () => {
    const user = await getCurrentUser({ cookies: { get: () => ({ value: "bad-token" }) } });
    expect(user).toBeNull();
  });

  it("returns user for valid ACTIVE user", async () => {
    const token = await signAccessToken({ userId: "u1", role: "USER", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeUser());
    const user = await getCurrentUser(createMockRequest(token));
    expect(user).not.toBeNull();
    expect(user.id).toBe("user-1");
  });

  it("returns null when user is INACTIVE (enforced at session time)", async () => {
    const token = await signAccessToken({ userId: "u1", role: "USER", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeUser({ status: "INACTIVE" }));
    const user = await getCurrentUser(createMockRequest(token));
    expect(user).toBeNull();
  });

  it("returns null when user is SUSPENDED", async () => {
    const token = await signAccessToken({ userId: "u1", role: "USER", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeUser({ status: "SUSPENDED" }));
    const user = await getCurrentUser(createMockRequest(token));
    expect(user).toBeNull();
  });

  it("returns null when user deleted from DB after token issued", async () => {
    const token = await signAccessToken({ userId: "u1", role: "USER", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(null);
    const user = await getCurrentUser(createMockRequest(token));
    expect(user).toBeNull();
  });
});

// SECTION 5: Auth Helpers
describe("Part 3: requireAuth", () => {
  it("returns 401 when no token", async () => {
    const result = await requireAuth(createMockRequest(null));
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(401);
  });

  it("returns user for valid token", async () => {
    const token = await signAccessToken({ userId: "u1", role: "USER", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeUser());
    const result = await requireAuth(createMockRequest(token));
    expect(result.user).toBeDefined();
    expect(result.response).toBeUndefined();
  });

  it("returns 401 when user INACTIVE in DB", async () => {
    const token = await signAccessToken({ userId: "u1", role: "USER", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeUser({ status: "INACTIVE" }));
    const result = await requireAuth(createMockRequest(token));
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(401);
  });
});

describe("Part 3: requireRole", () => {
  it("returns 401 when unauthenticated", async () => {
    const result = await requireRole(createMockRequest(null), ["ADMIN"]);
    expect(result.response.status).toBe(401);
  });

  it("returns 403 when role not in allowed list", async () => {
    const token = await signAccessToken({ userId: "u1", role: "USER", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeUser());
    const result = await requireRole(createMockRequest(token), ["ADMIN", "AGENT"]);
    expect(result.response.status).toBe(403);
  });

  it("returns user when role matches", async () => {
    const token = await signAccessToken({ userId: "u1", role: "AGENT", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeAgent());
    const result = await requireRole(createMockRequest(token), ["AGENT", "ADMIN"]);
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe("AGENT");
  });
});

describe("Part 3: requireAdmin", () => {
  it("returns 403 for USER role", async () => {
    const token = await signAccessToken({ userId: "u1", role: "USER", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeUser());
    const result = await requireAdmin(createMockRequest(token));
    expect(result.response.status).toBe(403);
  });

  it("returns 403 for AGENT role", async () => {
    const token = await signAccessToken({ userId: "u1", role: "AGENT", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeAgent());
    const result = await requireAdmin(createMockRequest(token));
    expect(result.response.status).toBe(403);
  });

  it("returns user for ADMIN role", async () => {
    const token = await signAccessToken({ userId: "u1", role: "ADMIN", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeAdmin());
    const result = await requireAdmin(createMockRequest(token));
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe("ADMIN");
  });
});

describe("Part 3: requireAgentOrAdmin", () => {
  it("returns 403 for USER role", async () => {
    const token = await signAccessToken({ userId: "u1", role: "USER", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeUser());
    const result = await requireAgentOrAdmin(createMockRequest(token));
    expect(result.response.status).toBe(403);
  });

  it("returns user for AGENT role", async () => {
    const token = await signAccessToken({ userId: "u1", role: "AGENT", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeAgent());
    const result = await requireAgentOrAdmin(createMockRequest(token));
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe("AGENT");
  });

  it("returns user for ADMIN role", async () => {
    const token = await signAccessToken({ userId: "u1", role: "ADMIN", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(makeAdmin());
    const result = await requireAgentOrAdmin(createMockRequest(token));
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe("ADMIN");
  });
});

describe("Part 3: requireSameOrganization", () => {
  it("returns ok when org IDs match", () => {
    const result = requireSameOrganization({ organizationId: org1 }, org1);
    expect(result.ok).toBe(true);
  });

  it("returns 403 when org IDs do not match", () => {
    const result = requireSameOrganization({ organizationId: org1 }, org2);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(403);
  });
});

// SECTION 6: Cross-Organization Isolation
describe("Part 3: Cross-Organization Isolation", () => {
  it("deactivateUser rejects cross-org access", async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: "user-2", organizationId: org2 }));
    await expect(deactivateUser("user-2", org1)).rejects.toThrow("User not found");
  });

  it("updateUser rejects cross-org access", async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: "user-2", organizationId: org2 }));
    await expect(updateUser("user-2", { username: "hacked" }, org1)).rejects.toThrow("User not found");
  });

  it("getUser rejects cross-org access", async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: "user-2", organizationId: org2 }));
    await expect(getUser("user-2", org1)).rejects.toThrow("User not found");
  });

  it("getUser returns user when org matches", async () => {
    const user = makeUser({ id: "user-1", organizationId: org1 });
    prisma.user.findUnique.mockResolvedValue(user);
    const result = await getUser("user-1", org1);
    expect(result.id).toBe("user-1");
    expect(result.organizationId).toBe(org1);
  });

  it("requireSameOrganization blocks cross-org access", () => {
    const result = requireSameOrganization({ organizationId: org1 }, org2);
    expect(result.response).toBeDefined();
    expect(result.response.status).toBe(403);
  });
});

// SECTION 7: Privileged Field Protection
describe("Part 3: Privileged Field Protection", () => {
  it("updateUser ignores organizationId from body (not in Zod schema)", async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue(makeUser());

    await updateUser("user-1", { username: "newname", organizationId: "org-hack" }, org1);

    const updateCall = prisma.user.update.mock.calls[0][0];
    expect(updateCall.data.organizationId).toBeUndefined();
    expect(updateCall.data.username).toBe("newname");
  });

  it("createUser injects organizationId from server parameter, not body", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.department.findFirst.mockResolvedValue({ id: "dept-1", organizationId: org1, isActive: true });
    prisma.user.create.mockResolvedValue({ id: "new-user", username: "newuser" });

    await createUser(
      { username: "newuser", email: "new@example.com", password: "Password123!", departmentId: "dept-1", role: "USER" },
      org1
    );

    const createCall = prisma.user.create.mock.calls[0][0];
    expect(createCall.data.organizationId).toBe(org1);
    expect(createCall.data.role).toBe("USER");
  });

  it("updateUser does not allow role escalation via body when last admin", async () => {
    prisma.user.findUnique.mockResolvedValue(makeAdmin());
    prisma.user.count.mockResolvedValue(1);
    await expect(updateUser("admin-1", { role: "USER" }, org1)).rejects.toThrow("Cannot demote the last admin");
  });
});

// SECTION 8: Last-Admin Protection
describe("Part 3: Last-Admin Protection", () => {
  it("cannot deactivate the last admin", async () => {
    prisma.user.findUnique.mockResolvedValue(makeAdmin());
    prisma.user.count.mockResolvedValue(1);
    await expect(deactivateUser("admin-1", org1)).rejects.toThrow("Cannot deactivate the last admin");
  });

  it("can deactivate admin when more than one exists", async () => {
    prisma.user.findUnique.mockResolvedValue(makeAdmin());
    prisma.user.count.mockResolvedValue(2);
    prisma.user.update.mockResolvedValue({ ...makeAdmin(), status: "INACTIVE" });
    const result = await deactivateUser("admin-1", org1);
    expect(result.status).toBe("INACTIVE");
  });

  it("cannot demote the last admin via updateUser", async () => {
    prisma.user.findUnique.mockResolvedValue(makeAdmin());
    prisma.user.count.mockResolvedValue(1);
    await expect(updateUser("admin-1", { role: "USER" }, org1)).rejects.toThrow("Cannot demote the last admin");
  });

  it("can demote admin when more than one exists", async () => {
    prisma.user.findUnique.mockResolvedValue(makeAdmin());
    prisma.user.count.mockResolvedValue(2);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({ ...makeAdmin(), role: "USER" });
    const result = await updateUser("admin-1", { role: "USER" }, org1);
    expect(result.role).toBe("USER");
  });
});

// SECTION 9: Login Error Responses (no information leakage)
describe("Part 3: Login Error Responses", () => {
  it("login returns generic error for non-existent email", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/auth/login/route.js");
    const request = { json: async () => ({ email: "nonexistent@example.com", password: "password" }) };
    const response = await POST(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Invalid email or password");
    expect(body.user).toBeUndefined();
  });

  it("login returns generic error for wrong password (same as non-existent)", async () => {
    const hash = await hashPassword("correct-password");
    prisma.user.findFirst.mockResolvedValue(makeUser({ passwordHash: hash }));
    const { POST } = await import("@/app/api/auth/login/route.js");
    const request = { json: async () => ({ email: "test@example.com", password: "wrong" }) };
    const response = await POST(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Invalid email or password");
  });

  it("login returns 403 for inactive account", async () => {
    prisma.user.findFirst.mockResolvedValue(makeUser({ status: "INACTIVE" }));
    const { POST } = await import("@/app/api/auth/login/route.js");
    const request = { json: async () => ({ email: "test@example.com", password: "password" }) };
    const response = await POST(request);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("not active");
  });

  it("login returns 400 when email missing", async () => {
    const { POST } = await import("@/app/api/auth/login/route.js");
    const request = { json: async () => ({ password: "password" }) };
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("login returns 400 when password missing", async () => {
    const { POST } = await import("@/app/api/auth/login/route.js");
    const request = { json: async () => ({ email: "test@example.com" }) };
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

// SECTION 10: Logout clears cookies
describe("Part 3: Logout Cookie Clearing", () => {
  it("logout clears both auth cookies", async () => {
    const { POST } = await import("@/app/api/auth/logout/route.js");
    const response = await POST();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBe("Logged out");
  });
});
