import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password helpers", () => {
  it("hashPassword returns a bcrypt hash", async () => {
    const hash = await hashPassword("test123");
    expect(typeof hash).toBe("string");
    expect(hash).toMatch(/^\$2[aby]?\$/);
  });

  it("verifyPassword returns true for correct password", async () => {
    const hash = await hashPassword("mypassword");
    const result = await verifyPassword("mypassword", hash);
    expect(result).toBe(true);
  });

  it("verifyPassword returns false for incorrect password", async () => {
    const hash = await hashPassword("mypassword");
    const result = await verifyPassword("wrongpassword", hash);
    expect(result).toBe(false);
  });

  it("different hashes produced for same password (salt randomness)", async () => {
    const hash1 = await hashPassword("same");
    const hash2 = await hashPassword("same");
    expect(hash1).not.toBe(hash2);
  });

  it("verifyPassword returns false for empty string against hash", async () => {
    const hash = await hashPassword("real");
    const result = await verifyPassword("", hash);
    expect(result).toBe(false);
  });
});
