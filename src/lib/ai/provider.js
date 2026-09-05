/**
 * AI Provider abstraction layer.
 *
 * Each provider implements the classify() method, which accepts
 * ticket context and returns structured classification output.
 * The concrete provider is selected based on the AI_PROVIDER env var.
 *
 * Per spec §17: "The implementation should support an actual AI
 * provider when configured."
 */

/**
 * @typedef {object} ClassificationInput
 * @property {string} title - Ticket title
 * @property {string} description - Ticket description
 * @property {string} [type] - INCIDENT or SERVICE_REQUEST
 * @property {string} [source] - WEB, EMAIL, or API
 * @property {string} [departmentName] - Current department name if known
 * @property {string} [categoryName] - Current category name if known
 */

/**
 * @typedef {object} ClassificationOutput
 * @property {string|null} categoryName - Predicted category name (must match a real Category in same org)
 * @property {string|null} predictedPriority - Predicted priority (LOW, MEDIUM, HIGH, CRITICAL)
 * @property {string|null} departmentName - Predicted department name
 * @property {number|null} confidence - Confidence score 0.0–1.0
 * @property {string|null} explanation - Reasoning text
 * @property {string|null} suggestedNextSteps - Suggested actions
 * @property {string} provider - Provider identifier used
 * @property {string} [model] - Model name if applicable
 */

/**
 * Base class for AI classification providers.
 * All providers must implement classify().
 */
export class BaseProvider {
  /** @returns {string} Provider identifier */
  get name() {
    throw new Error("Provider must implement get name()");
  }

  /**
   * Classify a ticket based on its content.
   *
   * @param {ClassificationInput} input
   * @param {object} context - Additional context (organizationId, etc.)
   * @returns {Promise<ClassificationOutput>}
   */
  async classify(_input, _context) {
    throw new Error("Provider must implement classify()");
  }
}

/**
 * Registry of available providers.
 * Providers register themselves here.
 */
const providers = new Map();

/**
 * Register a provider class under a name.
 *
 * @param {string} name
 * @param {typeof BaseProvider} ProviderClass
 */
export function registerProvider(name, ProviderClass) {
  providers.set(name, ProviderClass);
}

/**
 * Get a provider instance by name.
 *
 * @param {string} name
 * @returns {BaseProvider}
 * @throws if provider not found
 */
export function getProvider(name) {
  const ProviderClass = providers.get(name);
  if (!ProviderClass) {
    throw new Error(`AI provider "${name}" not found. Available: ${[...providers.keys()].join(", ")}`);
  }
  return new ProviderClass();
}
