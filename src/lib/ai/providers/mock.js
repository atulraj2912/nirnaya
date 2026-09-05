import { BaseProvider, registerProvider } from "../provider";

/**
 * Deterministic mock AI provider for development and testing.
 *
 * Per spec §17: "A deterministic fallback may be provided for local
 * development/testing when no AI provider key exists. Fallback behavior
 * must still be real deterministic logic, not fake hardcoded demo results."
 *
 * This provider uses keyword analysis to produce real deterministic
 * classifications based on ticket content. It is not a random stub.
 */

const CATEGORY_KEYWORDS = {
  NETWORK: ["network", "wifi", "internet", "connection", "router", "switch", "dns", "ip", "tcp", "lan", "wan", "vpn", "firewall port"],
  HARDWARE: ["hardware", "laptop", "desktop", "monitor", "keyboard", "mouse", "printer", "disk", "ram", "cpu", "battery", "screen", "device"],
  SOFTWARE: ["software", "application", "install", "update", "bug", "error", "crash", "version", "patch", "program", "app", "license"],
  EMAIL: ["email", "mail", "outlook", "inbox", "spam", "attachment", "smtp", "exchange", "calendar sync"],
  ACCOUNT: ["account", "password", "login", "access", "permission", "reset", "locked", "sso", "mfa", "authentication"],
  DATABASE: ["database", "sql", "query", "table", "backup", "data", "mysql", "postgres", "oracle", "redis", "migration"],
  SECURITY: ["security", "virus", "malware", "phishing", "breach", "encrypt", "ransomware", "suspicious", "compromised", "threat"],
  INFRASTRUCTURE: ["server", "infrastructure", "cloud", "aws", "azure", "deployment", "hosting", "vm", "container", "kubernetes", "docker"],
};

const PRIORITY_KEYWORDS = {
  CRITICAL: ["critical", "urgent", "down", "outage", "production down", "all users affected", "security breach", "data loss"],
  HIGH: ["high", "important", "multiple users", "blocking", "deadline", "escalat"],
  LOW: ["low", "minor", "cosmetic", "when convenient", "nice to have", "suggestion"],
};

function matchCategory(text) {
  const lower = text.toLowerCase();
  let bestCategory = null;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestScore > 0 ? bestCategory : null;
}

function matchPriority(text) {
  const lower = text.toLowerCase();
  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return priority;
    }
  }
  return null;
}

function calculateConfidence(text, category, priority) {
  const lower = text.toLowerCase();
  let matches = 0;
  if (category) {
    const catKeywords = CATEGORY_KEYWORDS[category] || [];
    for (const kw of catKeywords) {
      if (lower.includes(kw)) matches++;
    }
  }
  // Base confidence from keyword matches, bounded 0.45–0.85
  const base = Math.min(0.85, 0.45 + matches * 0.08);
  // Lower confidence if priority is uncertain
  return priority ? base : Math.max(0.45, base - 0.1);
}

function generateExplanation(title, description, category, priority) {
  const parts = [];
  if (category) {
    parts.push(`Classified as ${category} based on content analysis.`);
  }
  if (priority) {
    parts.push(`Priority assessed as ${priority}.`);
  }
  if (parts.length === 0) {
    parts.push("Unable to determine classification from provided content.");
  }
  return parts.join(" ");
}

function generateNextSteps(category, priority) {
  const steps = [];
  if (category === "SECURITY" || priority === "CRITICAL") {
    steps.push("Escalate to security team immediately.");
  }
  if (category === "NETWORK") {
    steps.push("Check network monitoring dashboard for related alerts.");
  }
  if (category === "HARDWARE") {
    steps.push("Verify hardware inventory and warranty status.");
  }
  if (category === "SOFTWARE") {
    steps.push("Check software version compatibility and known issues.");
  }
  if (category === "EMAIL") {
    steps.push("Verify email server status and mail queue.");
  }
  if (category === "ACCOUNT") {
    steps.push("Verify account status in identity provider.");
  }
  if (category === "DATABASE") {
    steps.push("Check database health and recent backup status.");
  }
  if (category === "INFRASTRUCTURE") {
    steps.push("Review infrastructure monitoring and resource utilization.");
  }
  if (priority === "HIGH" || priority === "CRITICAL") {
    steps.push("Notify assigned agent for immediate attention.");
  }
  return steps.length > 0 ? steps.join(" ") : null;
}

export class MockProvider extends BaseProvider {
  get name() {
    return "mock";
  }

  async classify(input) {
    const text = `${input.title} ${input.description}`;
    const category = matchCategory(text);
    const priority = matchPriority(text) || "MEDIUM";
    const confidence = calculateConfidence(text, category, priority);

    return {
      categoryName: category,
      predictedPriority: priority,
      departmentName: null, // Mock doesn't predict department
      confidence,
      explanation: generateExplanation(input.title, input.description, category, priority),
      suggestedNextSteps: generateNextSteps(category, priority),
      provider: this.name,
      model: "mock-keyword-v1",
    };
  }
}

// Auto-register
registerProvider("mock", MockProvider);
