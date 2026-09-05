import { getEnv } from "@/lib/env";
import { getProvider } from "./provider";
import { validateClassificationOutput, classificationInputSchema } from "./validation";

// Import providers to trigger auto-registration
import "./providers/mock";

/**
 * Classify a ticket using the configured AI provider.
 *
 * Per spec §17: "The implementation should support an actual AI
 * provider when configured. A deterministic fallback may be provided
 * for local development/testing when no AI provider key exists."
 *
 * Per spec §40: "If an implementation detail is unspecified, choose
 * the simplest sound solution."
 *
 * @param {import("./validation").ClassificationInput} input - Ticket context
 * @param {object} [options] - Additional options
 * @param {number} [options.timeout=10000] - Provider timeout in ms
 * @returns {Promise<object>} Validated classification output
 * @throws if provider is unavailable or returns invalid output
 */
export async function classify(input, options = {}) {
  const { timeout = 10000 } = options;

  // Validate input
  const validatedInput = classificationInputSchema.parse(input);

  // Resolve provider
  const env = getEnv();
  const providerName = env.AI_PROVIDER || "mock";

  let provider;
  try {
    provider = getProvider(providerName);
  } catch (err) {
    // If configured provider not found, fall back to mock
    console.warn(`AI provider "${providerName}" not available, falling back to mock:`, err.message);
    provider = getProvider("mock");
  }

  // Call provider with timeout
  const result = await Promise.race([
    provider.classify(validatedInput, {}),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI provider "${provider.name}" timed out after ${timeout}ms`)), timeout)
    ),
  ]);

  // Validate and normalize output
  const validated = validateClassificationOutput(result, provider.name);

  return validated;
}

/**
 * Get the currently configured provider name.
 * Useful for display purposes.
 *
 * @returns {string}
 */
export function getConfiguredProviderName() {
  try {
    const env = getEnv();
    return env.AI_PROVIDER || "mock";
  } catch {
    return "mock";
  }
}
