import { describe, it, expect, vi } from "vitest";

// Mock env to provide JWT secrets
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    JWT_ACCESS_SECRET: "test-access-secret-that-is-at-least-16-chars",
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-16-chars",
    NODE_ENV: "test",
  }),
}));

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/lib/auth/jwt";

const testPayload = {
  userId: "user-123",
  role: "AGENT",
  organizationId: "org-456",
};

async function importTestKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

describe("JWT helpers", () => {
  describe("access tokens", () => {
    it("signAccessToken returns a string token", async () => {
      const token = await signAccessToken(testPayload);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("verifyAccessToken returns decoded payload for valid token", async () => {
      const token = await signAccessToken(testPayload);
      const payload = await verifyAccessToken(token);
      expect(payload).toBeDefined();
      expect(payload.userId).toBe("user-123");
      expect(payload.role).toBe("AGENT");
      expect(payload.organizationId).toBe("org-456");
    });

    it("verifyAccessToken returns null for invalid token", async () => {
      const result = await verifyAccessToken("invalid.token.here");
      expect(result).toBeNull();
    });

    it("verifyAccessToken returns null for token signed with wrong secret", async () => {
      const { SignJWT } = await import("jose");
      const wrongKey = await importTestKey("wrong-secret-key-12345678");
      const token = await new SignJWT(testPayload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(wrongKey);

      const result = await verifyAccessToken(token);
      expect(result).toBeNull();
    });
  });

  describe("refresh tokens", () => {
    it("signRefreshToken returns a string token", async () => {
      const token = await signRefreshToken(testPayload);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("verifyRefreshToken returns decoded payload for valid token", async () => {
      const token = await signRefreshToken(testPayload);
      const payload = await verifyRefreshToken(token);
      expect(payload).toBeDefined();
      expect(payload.userId).toBe("user-123");
      expect(payload.role).toBe("AGENT");
    });

    it("verifyRefreshToken returns null for invalid token", async () => {
      const result = await verifyRefreshToken("garbage");
      expect(result).toBeNull();
    });

    it("access token cannot be verified as refresh token", async () => {
      const accessToken = await signAccessToken(testPayload);
      const result = await verifyRefreshToken(accessToken);
      expect(result).toBeNull();
    });
  });
});
