import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";

const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "7d";

async function importSecretKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function getAccessKey() {
  const env = getEnv();
  return importSecretKey(env.JWT_ACCESS_SECRET);
}

async function getRefreshKey() {
  const env = getEnv();
  return importSecretKey(env.JWT_REFRESH_SECRET);
}

/**
 * Sign an access token for a user.
 *
 * @param {object} payload - { userId, role, organizationId }
 * @returns {Promise<string>} The signed JWT
 */
export async function signAccessToken(payload) {
  const key = await getAccessKey();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(key);
}

/**
 * Sign a refresh token for a user.
 *
 * @param {object} payload - { userId, role, organizationId }
 * @returns {Promise<string>} The signed JWT
 */
export async function signRefreshToken(payload) {
  const key = await getRefreshKey();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(key);
}

/**
 * Verify an access token.
 *
 * @param {string} token - The JWT to verify
 * @returns {Promise<object|null>} The decoded payload, or null if invalid
 */
export async function verifyAccessToken(token) {
  try {
    const key = await getAccessKey();
    const { payload } = await jwtVerify(token, key);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify a refresh token.
 *
 * @param {string} token - The JWT to verify
 * @returns {Promise<object|null>} The decoded payload, or null if invalid
 */
export async function verifyRefreshToken(token) {
  try {
    const key = await getRefreshKey();
    const { payload } = await jwtVerify(token, key);
    return payload;
  } catch {
    return null;
  }
}
