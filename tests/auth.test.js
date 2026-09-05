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
import { getCurrentUser } from "@/lib/auth/session";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  getAccessTokenFromRequest,
  getRefreshTokenFromRequest,
} from "@/lib/auth/cookies";

const testUser = {
  id: "user-1",
  username: "testuser",
  email: "test@example.com",
  role: "USER",
  status: "ACTIVE",
  avatarUrl: null,
  designation: "Tester",
  organizationId: "org-1",
  departmentId: "dept-1",
  employeeId: "EMP001",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("session (getCurrentUser)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no access token cookie exists", async () => {
    const request = { cookies: { get: () => undefined } };
    const user = await getCurrentUser(request);
    expect(user).toBeNull();
  });

  it("returns null when token is invalid", async () => {
    const request = { cookies: { get: () => ({ value: "bad-token" }) } };
    const user = await getCurrentUser(request);
    expect(user).toBeNull();
  });

  it("returns user when token is valid and user is ACTIVE", async () => {
    const token = await signAccessToken({
      userId: testUser.id,
      role: testUser.role,
      organizationId: testUser.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue(testUser);

    const request = { cookies: { get: () => ({ value: token }) } };
    const user = await getCurrentUser(request);

    expect(user).toEqual(testUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: testUser.id },
      select: expect.objectContaining({
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
      }),
    });
  });

  it("returns null when user is INACTIVE", async () => {
    const token = await signAccessToken({
      userId: testUser.id,
      role: testUser.role,
      organizationId: testUser.organizationId,
    });

    prisma.user.findUnique.mockResolvedValue({ ...testUser, status: "INACTIVE" });

    const request = { cookies: { get: () => ({ value: token }) } };
    const user = await getCurrentUser(request);
    expect(user).toBeNull();
  });

  it("returns null when user not found in database", async () => {
    const token = await signAccessToken({
      userId: "nonexistent",
      role: "USER",
      organizationId: "org-1",
    });

    prisma.user.findUnique.mockResolvedValue(null);

    const request = { cookies: { get: () => ({ value: token }) } };
    const user = await getCurrentUser(request);
    expect(user).toBeNull();
  });
});

describe("cookies helpers", () => {
  it("getAccessTokenFromRequest reads cookie value", () => {
    const request = { cookies: { get: (name) => name === "nirnaya_access_token" ? { value: "tok123" } : undefined } };
    expect(getAccessTokenFromRequest(request)).toBe("tok123");
  });

  it("getRefreshTokenFromRequest reads cookie value", () => {
    const request = { cookies: { get: (name) => name === "nirnaya_refresh_token" ? { value: "ref456" } : undefined } };
    expect(getRefreshTokenFromRequest(request)).toBe("ref456");
  });

  it("getAccessTokenFromRequest returns undefined when cookie missing", () => {
    const request = { cookies: { get: () => undefined } };
    expect(getAccessTokenFromRequest(request)).toBeUndefined();
  });

  it("setAccessTokenCookie sets cookie on response", () => {
    const cookies = {};
    const response = {
      cookies: {
        set: (name, value, opts) => { cookies[name] = { value, ...opts }; },
      },
    };
    setAccessTokenCookie(response, "token123");
    expect(cookies["nirnaya_access_token"]).toBeDefined();
    expect(cookies["nirnaya_access_token"].value).toBe("token123");
    expect(cookies["nirnaya_access_token"].httpOnly).toBe(true);
    expect(cookies["nirnaya_access_token"].path).toBe("/");
  });

  it("setRefreshTokenCookie sets cookie on response", () => {
    const cookies = {};
    const response = {
      cookies: {
        set: (name, value, opts) => { cookies[name] = { value, ...opts }; },
      },
    };
    setRefreshTokenCookie(response, "refresh789");
    expect(cookies["nirnaya_refresh_token"]).toBeDefined();
    expect(cookies["nirnaya_refresh_token"].value).toBe("refresh789");
  });

  it("clearAuthCookies clears both cookies", () => {
    const cookies = {};
    const response = {
      cookies: {
        set: (name, value, opts) => { cookies[name] = { value, ...opts }; },
      },
    };
    clearAuthCookies(response);
    expect(cookies["nirnaya_access_token"].maxAge).toBe(0);
    expect(cookies["nirnaya_refresh_token"].maxAge).toBe(0);
  });
});
