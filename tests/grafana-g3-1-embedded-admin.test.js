import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ============================================================
// G3.1 — Embedded Grafana Admin Dashboard Tests
//
// Validates:
// - Embed token API endpoint exists
// - GrafanaEmbed component exists
// - CSP headers allow Grafana iframe
// - Grafana JWT auth configured in docker-compose
// - No secrets exposed in client-side code
// - Admin-only access enforced
// - Existing G3 dashboard remains intact
// ============================================================

const DOCKER_COMPOSE_PATH = join(process.cwd(), "docker-compose.yml");
const NEXT_CONFIG_PATH = join(process.cwd(), "next.config.mjs");
const EMBED_TOKEN_ROUTE = join(process.cwd(), "src", "app", "api", "grafana", "embed", "token", "route.js");
const GRAFANA_EMBED_COMPONENT = join(process.cwd(), "src", "components", "grafana", "grafana-embed.jsx");
const ADMIN_ANALYTICS_PAGE = join(process.cwd(), "src", "app", "(dashboard)", "admin", "analytics", "page.js");
const ADMIN_DASHBOARD_JSON = join(process.cwd(), "grafana", "dashboards", "admin-analytics.json");

const dockerCompose = readFileSync(DOCKER_COMPOSE_PATH, "utf-8");
const nextConfig = readFileSync(NEXT_CONFIG_PATH, "utf-8");
const embedTokenRoute = readFileSync(EMBED_TOKEN_ROUTE, "utf-8");
const grafanaEmbedComponent = readFileSync(GRAFANA_EMBED_COMPONENT, "utf-8");
const adminAnalyticsPage = readFileSync(ADMIN_ANALYTICS_PAGE, "utf-8");
const adminDashboard = JSON.parse(readFileSync(ADMIN_DASHBOARD_JSON, "utf-8"));

// ============================================================
// A. File Existence
// ============================================================
describe("G3.1 — File Artifacts", () => {
  it("embed token API route exists", () => {
    expect(existsSync(EMBED_TOKEN_ROUTE)).toBe(true);
  });

  it("GrafanaEmbed component exists", () => {
    expect(existsSync(GRAFANA_EMBED_COMPONENT)).toBe(true);
  });

  it("admin analytics page exists", () => {
    expect(existsSync(ADMIN_ANALYTICS_PAGE)).toBe(true);
  });

  it("admin dashboard JSON exists", () => {
    expect(existsSync(ADMIN_DASHBOARD_JSON)).toBe(true);
  });

  it("docker-compose.yml exists", () => {
    expect(existsSync(DOCKER_COMPOSE_PATH)).toBe(true);
  });

  it("next.config.mjs exists", () => {
    expect(existsSync(NEXT_CONFIG_PATH)).toBe(true);
  });
});

// ============================================================
// B. Grafana JWT Auth Configuration
// ============================================================
describe("G3.1 — Grafana JWT Auth Configuration", () => {
  it("GF_AUTH_JWT_ENABLED is set to true in docker-compose", () => {
    expect(dockerCompose).toContain("GF_AUTH_JWT_ENABLED");
    expect(dockerCompose).toMatch(/GF_AUTH_JWT_ENABLED.*true/);
  });

  it("GF_AUTH_JWT_URL_LOGIN is enabled for query parameter auth", () => {
    expect(dockerCompose).toContain("GF_AUTH_JWT_URL_LOGIN");
    expect(dockerCompose).toMatch(/GF_AUTH_JWT_URL_LOGIN.*true/);
  });

  it("GF_AUTH_JWT_EMAIL_CLAIM is configured", () => {
    expect(dockerCompose).toContain("GF_AUTH_JWT_EMAIL_CLAIM");
  });

  it("GF_AUTH_JWT_AUTO_SIGN_UP is enabled", () => {
    expect(dockerCompose).toContain("GF_AUTH_JWT_AUTO_SIGN_UP");
    expect(dockerCompose).toMatch(/GF_AUTH_JWT_AUTO_SIGN_UP.*true/);
  });

  it("GF_AUTH_JWT_KEY_FILE references RSA public key (Grafana 11.6 requires asymmetric)", () => {
    expect(dockerCompose).toContain("GF_AUTH_JWT_KEY_FILE");
    expect(dockerCompose).toContain("jwt-public.pem");
  });

  it("GF_AUTH_ANONYMOUS_ENABLED remains false", () => {
    expect(dockerCompose).toMatch(/GF_AUTH_ANONYMOUS_ENABLED.*false/);
  });

  it("GF_SECURITY_ALLOW_EMBEDDING is enabled for iframe embedding", () => {
    expect(dockerCompose).toContain("GF_SECURITY_ALLOW_EMBEDDING");
    expect(dockerCompose).toMatch(/GF_SECURITY_ALLOW_EMBEDDING.*true/);
  });
});

// ============================================================
// C. CSP / Security Headers
// ============================================================
describe("G3.1 — CSP Security Headers", () => {
  it("Content-Security-Policy header is defined", () => {
    expect(nextConfig).toContain("Content-Security-Policy");
  });

  it("frame-src allows Grafana origin", () => {
    expect(nextConfig).toMatch(/frame-src.*http:\/\/localhost:3100/);
  });

  it("connect-src allows Grafana origin", () => {
    expect(nextConfig).toMatch(/connect-src.*http:\/\/localhost:3100/);
  });

  it("frame-ancestors allows embedding from localhost:3000", () => {
    expect(nextConfig).toMatch(/frame-ancestors\s+'self' http:\/\/localhost:3000/);
  });

  it("X-Frame-Options remains DENY", () => {
    expect(nextConfig).toMatch(/X-Frame-Options.*DENY/);
  });

  it("X-Content-Type-Options remains nosniff", () => {
    expect(nextConfig).toMatch(/X-Content-Type-Options.*nosniff/);
  });

  it("Permissions-Policy remains restrictive", () => {
    expect(nextConfig).toMatch(/Permissions-Policy.*camera=\(\)/);
  });
});

// ============================================================
// D. Embed Token API Endpoint
// ============================================================
describe("G3.1 — Embed Token API", () => {
  it("exports a POST handler", () => {
    expect(embedTokenRoute).toContain("export async function POST");
  });

  it("uses requireAdmin for authorization", () => {
    expect(embedTokenRoute).toContain("requireAdmin");
  });

  it("does NOT expose GRAFANA_SERVICE_TOKEN to client", () => {
    expect(embedTokenRoute).not.toContain("process.env.GRAFANA_SERVICE_TOKEN");
  });

  it("does NOT expose GRAFANA_ADMIN_PASSWORD to client", () => {
    expect(embedTokenRoute).not.toContain("GRAFANA_ADMIN_PASSWORD");
  });

  it("does NOT expose AI_API_KEY to client", () => {
    expect(embedTokenRoute).not.toContain("AI_API_KEY");
  });

  it("does NOT expose DATABASE_URL to client", () => {
    expect(embedTokenRoute).not.toContain("DATABASE_URL");
  });

  it("generates short-lived token (5 minutes)", () => {
    expect(embedTokenRoute).toContain("5m");
  });

  it("signs with RS256 algorithm (Grafana requires asymmetric keys)", () => {
    expect(embedTokenRoute).toContain("RS256");
  });

  it("returns token in JSON response (not URL or HTML)", () => {
    expect(embedTokenRoute).toContain('return NextResponse.json({ token })');
  });
});

// ============================================================
// E. GrafanaEmbed Component
// ============================================================
describe("G3.1 — GrafanaEmbed Component", () => {
  it("is a client component", () => {
    expect(grafanaEmbedComponent).toContain('"use client"');
  });

  it("fetches token from /api/grafana/embed/token", () => {
    expect(grafanaEmbedComponent).toContain("/api/grafana/embed/token");
  });

  it("uses POST method for token fetch", () => {
    expect(grafanaEmbedComponent).toContain('method: "POST"');
  });

  it("renders iframe with Grafana URL", () => {
    expect(grafanaEmbedComponent).toContain("<iframe");
  });

  it("iframe uses auth_token query parameter", () => {
    expect(grafanaEmbedComponent).toContain("auth_token=");
  });

  it("iframe has sandbox attribute for security", () => {
    expect(grafanaEmbedComponent).toContain("sandbox=");
  });

  it("shows loading state", () => {
    expect(grafanaEmbedComponent).toContain("Loading analytics dashboard");
  });

  it("shows error state on failure", () => {
    expect(grafanaEmbedComponent).toContain("temporarily unavailable");
  });

  it("has retry mechanism", () => {
    expect(grafanaEmbedComponent).toContain("Retry");
  });

  it("does NOT expose GRAFANA_JWT_SECRET in client code", () => {
    expect(grafanaEmbedComponent).not.toContain("GRAFANA_JWT_SECRET");
  });

  it("does NOT expose GRAFANA_SERVICE_TOKEN in client code", () => {
    expect(grafanaEmbedComponent).not.toContain("GRAFANA_SERVICE_TOKEN");
  });

  it("does NOT expose AI_API_KEY in client code", () => {
    expect(grafanaEmbedComponent).not.toContain("AI_API_KEY");
  });

  it("does NOT contain Grafana admin credentials", () => {
    expect(grafanaEmbedComponent).not.toContain("nirnaya-dev");
  });

  it("references correct Grafana dashboard UID", () => {
    expect(grafanaEmbedComponent).toContain("nirnaya-admin");
  });

  it("refreshes token before expiry (4 minute interval)", () => {
    expect(grafanaEmbedComponent).toContain("4 * 60 * 1000");
  });
});

// ============================================================
// F. Admin Analytics Page Integration
// ============================================================
describe("G3.1 — Admin Analytics Page Integration", () => {
  it("imports GrafanaEmbed component", () => {
    expect(adminAnalyticsPage).toContain('import GrafanaEmbed');
  });

  it("renders GrafanaEmbed in the page", () => {
    expect(adminAnalyticsPage).toContain("<GrafanaEmbed");
  });

  it("preserves existing analytics content", () => {
    expect(adminAnalyticsPage).toContain("Total Tickets");
    expect(adminAnalyticsPage).toContain("SLA Breached");
    expect(adminAnalyticsPage).toContain("Tickets by Status");
    expect(adminAnalyticsPage).toContain("Ticket Trend");
  });
});

// ============================================================
// G. Existing G3 Dashboard Integrity
// ============================================================
describe("G3.1 — Existing G3 Dashboard Integrity", () => {
  it("admin dashboard UID remains nirnaya-admin", () => {
    expect(adminDashboard.uid).toBe("nirnaya-admin");
  });

  it("admin dashboard has 20 panels", () => {
    const panels = adminDashboard.panels.filter(p => p.type !== "row");
    expect(panels.length).toBe(20);
  });

  it("all panels use marcusolsson-json-datasource", () => {
    const panels = adminDashboard.panels.filter(p => p.type !== "row");
    for (const panel of panels) {
      expect(panel.datasource.type).toBe("marcusolsson-json-datasource");
    }
  });

  it("all panels reference NIRNAYA-Admin datasource", () => {
    const panels = adminDashboard.panels.filter(p => p.type !== "row");
    for (const panel of panels) {
      expect(panel.datasource.uid).toBe("NIRNAYA-Admin");
    }
  });

  it("no hardcoded secrets in dashboard JSON", () => {
    const dashboardRaw = readFileSync(ADMIN_DASHBOARD_JSON, "utf-8");
    expect(dashboardRaw).not.toContain("GRAFANA_SERVICE_TOKEN");
    expect(dashboardRaw).not.toContain("GRAFANA_JWT_SECRET");
    expect(dashboardRaw).not.toContain("AI_API_KEY");
    expect(dashboardRaw).not.toContain("DATABASE_URL");
  });
});

// ============================================================
// H. Security Invariants
// ============================================================
describe("G3.1 — Security Invariants", () => {
  it("embed token route does not use GRAFANA_ADMIN_USER_ID", () => {
    expect(embedTokenRoute).not.toContain("GRAFANA_ADMIN_USER_ID");
  });

  it("embed token route does not use GRAFANA_ADMIN_ORGANIZATION_ID", () => {
    expect(embedTokenRoute).not.toContain("GRAFANA_ADMIN_ORGANIZATION_ID");
  });

  it("GrafanaEmbed does not use NEXT_PUBLIC_ variables for secrets", () => {
    expect(grafanaEmbedComponent).not.toContain("NEXT_PUBLIC_");
  });

  it("no secrets in URL query parameters (token passed in iframe src only)", () => {
    // Token is in iframe src which is generated client-side from API response
    // The token itself is short-lived and signed
    expect(grafanaEmbedComponent).not.toContain("GRAFANA_SERVICE_TOKEN");
  });

  it("iframe sandbox restricts capabilities", () => {
    expect(grafanaEmbedComponent).toMatch(/sandbox="[^"]*allow-same-origin[^"]*"/);
  });
});
