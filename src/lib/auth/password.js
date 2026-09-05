import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password using bcrypt.
 *
 * @param {string} plain - The plaintext password
 * @returns {Promise<string>} The bcrypt hash
 */
export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 *
 * @param {string} plain - The plaintext password
 * @param {string} hash - The bcrypt hash to compare against
 * @returns {Promise<boolean>} True if the password matches
 */
export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
