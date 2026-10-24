import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ============================================================
// G3 — Admin Grafana Dashboard Tests
//
// Validates the provisioned Grafana dashboard JSON:
// - Dashboard artifact exists
// - Datasource references correct NIRNAYA-Admin datasource
// - No direct PostgreSQL references
// - No hardcoded secrets
// - All 7 required sections present
// - Expected panels and queries exist
// - Dashboard survives docker compose restart (provisioned from repo)
// ============================================================

const DASHBOARD_PATH = join(process.cwd(), "grafana", "dashboards", "admin-analytics.json");
const HOME_DASHBOARD_PATH = join(process.cwd(), "grafana", "dashboards", "home.json");
const DATASOURCE_PATH = join(process.cwd(), "grafana", "provisioning", "datasources", "nirnaya.yml");
const DOCKER_COMPOSE_PATH = join(process.cwd(), "docker-compose.yml");

const dashboardRaw = readFileSync(DASHBOARD_PATH, "utf-8");
const dashboard = JSON.parse(dashboardRaw);

// ============================================================
// A. Dashboard Artifact Existence
// ============================================================
describe("G3 — Dashboard Artifacts", () => {
  it("admin-analytics.json exists in grafana/dashboards/", () => {
    expect(existsSync(DASHBOARD_PATH)).toBe(true);
  });

  it("home.json still exists (infrastructure health dashboard)", () => {
    expect(existsSync(HOME_DASHBOARD_PATH)).toBe(true);
  });

  it("datasource provisioning file exists", () => {
    expect(existsSync(DATASOURCE_PATH)).toBe(true);
  });

  it("docker-compose.yml exists", () => {
    expect(existsSync(DOCKER_COMPOSE_PATH)).toBe(true);
  });

  it("dashboard JSON is valid", () => {
    expect(dashboard).toBeDefined();
    expect(typeof dashboard).toBe("object");
  });

  it("dashboard has required top-level fields", () => {
    expect(dashboard.title).toBeTruthy();
    expect(dashboard.uid).toBeTruthy();
    expect(dashboard.schemaVersion).toBeDefined();
    expect(dashboard.panels).toBeDefined();
    expect(Array.isArray(dashboard.panels)).toBe(true);
  });
});

// ============================================================
// B. Datasource References
// ============================================================
describe("G3 — Datasource References", () => {
  it("dashboard uses NIRNAYA-Admin datasource", () => {
    const datasourceUids = new Set();
    for (const panel of dashboard.panels) {
      if (panel.datasource?.uid) {
        datasourceUids.add(panel.datasource.uid);
      }
      if (panel.targets) {
        for (const target of panel.targets) {
          if (target.datasource?.uid) {
            datasourceUids.add(target.datasource.uid);
          }
        }
      }
    }
    expect(datasourceUids.size).toBe(1);
    expect(datasourceUids.has("NIRNAYA-Admin")).toBe(true);
  });

  it("all panels reference the same datasource", () => {
    const datasourceUid = dashboard.panels.find(
      (p) => p.type !== "row" && p.datasource?.uid
    )?.datasource?.uid;

    for (const panel of dashboard.panels) {
      if (panel.type === "row") continue;
      if (panel.datasource?.uid) {
        expect(panel.datasource.uid).toBe(datasourceUid);
      }
    }
  });

  it("dashboard does not reference NIRNAYA-Agent datasource", () => {
    const raw = dashboardRaw;
    expect(raw).not.toContain("NIRNAYA-Agent");
  });

  it("datasource provisioning uses JSON API plugin", () => {
    const dsContent = readFileSync(DATASOURCE_PATH, "utf-8");
    expect(dsContent).toContain("marcusolsson-json-datasource");
  });

  it("datasource provisioning uses NIRNAYA-Admin name", () => {
    const dsContent = readFileSync(DATASOURCE_PATH, "utf-8");
    expect(dsContent).toContain("NIRNAYA-Admin");
  });
});

// ============================================================
// C. No Direct PostgreSQL Access
// ============================================================
describe("G3 — No PostgreSQL Direct Access", () => {
  it("dashboard JSON does not reference PostgreSQL", () => {
    const raw = dashboardRaw.toLowerCase();
    expect(raw).not.toContain("postgresql");
    expect(raw).not.toContain("postgres");
  });

  it("dashboard does not use PostgreSQL datasource type", () => {
    const raw = dashboardRaw;
    expect(raw).not.toContain('"type": "postgres"');
    expect(raw).not.toContain('"type":"postgres"');
  });

  it("dashboard does not contain SQL queries", () => {
    const raw = dashboardRaw.toLowerCase();
    expect(raw).not.toContain("select ");
    expect(raw).not.toContain("from tickets");
    expect(raw).not.toContain("where organizationid");
  });

  it("datasource provisioning does not expose PostgreSQL connection", () => {
    const dsContent = readFileSync(DATASOURCE_PATH, "utf-8").toLowerCase();
    expect(dsContent).not.toContain("postgresql://");
    expect(dsContent).not.toContain("postgres://");
    expect(dsContent).not.toContain("5432");
    expect(dsContent).not.toContain("6543");
  });
});

// ============================================================
// D. No Hardcoded Secrets
// ============================================================
describe("G3 — No Hardcoded Secrets", () => {
  it("dashboard JSON does not contain service tokens", () => {
    const raw = dashboardRaw;
    // Should not contain actual token values, only environment variable references
    expect(raw).not.toMatch(/Bearer [A-Za-z0-9+/=]{20,}/);
  });

  it("dashboard JSON does not contain passwords", () => {
    const raw = dashboardRaw.toLowerCase();
    expect(raw).not.toContain("password");
    expect(raw).not.toContain("secret");
  });

  it("dashboard JSON does not contain database credentials", () => {
    const raw = dashboardRaw.toLowerCase();
    expect(raw).not.toContain("database_url");
    expect(raw).not.toContain("direct_url");
    expect(raw).not.toContain("pgbouncer");
  });

  it("dashboard JSON does not contain JWT secrets", () => {
    const raw = dashboardRaw.toLowerCase();
    expect(raw).not.toContain("jwt_access_secret");
    expect(raw).not.toContain("jwt_refresh_secret");
    expect(raw).not.toContain("grafana_jwt_secret");
  });

  it("datasource provisioning uses env var substitution, not hardcoded tokens", () => {
    const dsContent = readFileSync(DATASOURCE_PATH, "utf-8");
    // Should reference ${GRAFANA_SERVICE_TOKEN} not an actual token
    expect(dsContent).toContain("${GRAFANA_SERVICE_TOKEN}");
    // Should not contain a bare base64 token
    expect(dsContent).not.toMatch(/Bearer [A-Za-z0-9+/=]{20,}/);
  });
});

// ============================================================
// E. Dashboard Sections (7 Required Sections)
// ============================================================
describe("G3 — Dashboard Sections", () => {
  const rows = dashboard.panels.filter((p) => p.type === "row");

  it("has at least 7 row sections", () => {
    expect(rows.length).toBeGreaterThanOrEqual(7);
  });

  it("has Executive Overview section", () => {
    const titles = rows.map((r) => r.title);
    expect(titles).toContain("Executive Overview");
  });

  it("has Ticket Trends section", () => {
    const titles = rows.map((r) => r.title);
    expect(titles).toContain("Ticket Trends");
  });

  it("has Ticket Distribution section", () => {
    const titles = rows.map((r) => r.title);
    expect(titles).toContain("Ticket Distribution");
  });

  it("has Agent Workload section", () => {
    const titles = rows.map((r) => r.title);
    expect(titles).toContain("Agent Workload");
  });

  it("has SLA Performance section", () => {
    const titles = rows.map((r) => r.title);
    expect(titles).toContain("SLA Performance");
  });

  it("has Resolution Performance section", () => {
    const titles = rows.map((r) => r.title);
    expect(titles).toContain("Resolution Performance");
  });

  it("has AI Analytics section", () => {
    const titles = rows.map((r) => r.title);
    expect(titles).toContain("AI Analytics");
  });
});

// ============================================================
// F. Panel Inventory
// ============================================================
describe("G3 — Panel Inventory", () => {
  const panels = dashboard.panels.filter((p) => p.type !== "row");

  it("has at least 15 non-row panels", () => {
    expect(panels.length).toBeGreaterThanOrEqual(15);
  });

  // --- Section 1: Executive Overview KPIs ---
  it("has Total Tickets stat panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Total Tickets");
  });

  it("has Open Tickets stat panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Open Tickets");
  });

  it("has In Progress stat panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("In Progress");
  });

  it("has Resolved stat panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Resolved");
  });

  it("has Closed stat panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Closed");
  });

  it("has SLA Compliance stat panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("SLA Compliance");
  });

  // --- Section 2: Ticket Trends ---
  it("has ticket trends time series panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles.some((t) => t.includes("Ticket Trends"))).toBe(true);
  });

  // --- Section 3: Ticket Distribution ---
  it("has Tickets by Status pie chart", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Tickets by Status");
  });

  it("has Tickets by Priority pie chart", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Tickets by Priority");
  });

  it("has Tickets by Department bar chart", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Tickets by Department");
  });

  it("has Tickets by Category bar chart", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Tickets by Category");
  });

  // --- Section 4: Agent Workload ---
  it("has Agent Workload bar chart", () => {
    const titles = panels.map((p) => p.title);
    expect(titles.some((t) => t.includes("Agent Workload"))).toBe(true);
  });

  // --- Section 5: SLA Performance ---
  it("has Response SLA Status panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Response SLA Status");
  });

  it("has Resolution SLA Status panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Resolution SLA Status");
  });

  it("has SLA Compliance Rate stat panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("SLA Compliance Rate");
  });

  // --- Section 6: Resolution Performance ---
  it("has Average Resolution Time stat panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Average Resolution Time");
  });

  it("has Average First Response Time stat panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Average First Response Time");
  });

  // --- Section 7: AI Analytics ---
  it("has AI Predictions stat panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("AI Predictions");
  });

  it("has Average AI Confidence stat panel", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Average AI Confidence");
  });

  it("has Top AI Predicted Categories bar chart", () => {
    const titles = panels.map((p) => p.title);
    expect(titles).toContain("Top AI Predicted Categories");
  });
});

// ============================================================
// G. API/Query Mapping
// ============================================================
describe("G3 — API/Query Mapping", () => {
  const panels = dashboard.panels.filter((p) => p.type !== "row");

  it("panels reference correct G1 analytics paths", () => {
    const allExpressions = [];
    for (const panel of panels) {
      if (panel.targets) {
        for (const target of panel.targets) {
          if (target.expression) {
            allExpressions.push(target.expression);
          }
        }
      }
    }

    // Verify key analytics paths exist
    expect(allExpressions.some((e) => e.includes("tickets.createdTrend"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("tickets.resolvedTrend"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("tickets.closedTrend"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("tickets.statusDistribution"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("tickets.priorityDistribution"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("tickets.byDepartment"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("tickets.byCategory"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("workload"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("sla"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("performance.averageResolutionTime"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("performance.averageFirstResponseTime"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("ai.totalPredictions"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("ai.averageConfidence"))).toBe(true);
    expect(allExpressions.some((e) => e.includes("ai.topCategories"))).toBe(true);
  });

  it("SLA Compliance panels use resolutionComplianceRate (pre-computed percentage)", () => {
    const slaPanels = panels.filter(
      (p) => p.title === "SLA Compliance" || p.title === "SLA Compliance Rate"
    );
    expect(slaPanels.length).toBe(2);
    for (const panel of slaPanels) {
      const expr = panel.targets[0].expression;
      expect(expr).toBe("$.sla.resolutionComplianceRate");
    }
  });

  it("SLA compliance panels use percent unit (0-100 value)", () => {
    const slaPanels = panels.filter(
      (p) => p.title === "SLA Compliance" || p.title === "SLA Compliance Rate"
    );
    for (const panel of slaPanels) {
      expect(panel.fieldConfig.defaults.unit).toBe("percent");
    }
  });

  it("AI Confidence panel uses percentunit (0-1 value from G1)", () => {
    const aiPanel = panels.find((p) => p.title === "Average AI Confidence");
    expect(aiPanel).toBeDefined();
    expect(aiPanel.fieldConfig.defaults.unit).toBe("percentunit");
  });

  it("all targets have datasource references", () => {
    for (const panel of panels) {
      if (panel.targets) {
        for (const target of panel.targets) {
          expect(target.datasource).toBeDefined();
          expect(target.datasource.type).toBe("marcusolsson-json-datasource");
          expect(target.datasource.uid).toBe("NIRNAYA-Admin");
        }
      }
    }
  });
});

// ============================================================
// H. Dashboard Configuration
// ============================================================
describe("G3 — Dashboard Configuration", () => {
  it("dashboard UID is nirnaya-admin", () => {
    expect(dashboard.uid).toBe("nirnaya-admin");
  });

  it("default time range is last 90 days", () => {
    expect(dashboard.time.from).toBe("now-90d");
    expect(dashboard.time.to).toBe("now");
  });

  it("timezone is UTC", () => {
    expect(dashboard.timezone).toBe("utc");
  });

  it("refresh interval is configured", () => {
    expect(dashboard.refresh).toBeDefined();
    expect(dashboard.refresh).toBe("10s");
  });

  it("dashboard is not editable (provisioned)", () => {
    expect(dashboard.editable).toBe(false);
  });

  it("dashboard has no dashboard variables (org-scoped, no user-selectable filters)", () => {
    expect(dashboard.templating.list.length).toBe(0);
  });

  it("dashboard has nirnaya tags", () => {
    expect(dashboard.tags).toContain("nirnaya");
    expect(dashboard.tags).toContain("admin");
  });

  it("timepicker includes 10s refresh option", () => {
    const intervals = dashboard.timepicker.refresh_intervals;
    expect(intervals).toContain("10s");
  });
});

// ============================================================
// I. Security Invariants
// ============================================================
describe("G3 — Security Invariants", () => {
  it("no organizationId variable exists (server-derived only)", () => {
    const raw = dashboardRaw;
    // Should not have a templating variable for org selection
    expect(dashboard.templating.list.length).toBe(0);
  });

  it("no agentId variable exists", () => {
    const raw = dashboardRaw;
    expect(raw).not.toContain("agentId");
  });

  it("no userId variable exists", () => {
    const raw = dashboardRaw;
    expect(raw).not.toContain("userId");
  });

  it("dashboard does not accept client-controlled scope overrides", () => {
    const raw = dashboardRaw.toLowerCase();
    expect(raw).not.toContain("organizationid=");
    expect(raw).not.toContain("organizationid:");
  });

  it("admin service token is not exposed in dashboard JSON", () => {
    const raw = dashboardRaw;
    // Should not contain any Bearer tokens or raw secret values
    expect(raw).not.toMatch(/Bearer\s+[A-Za-z0-9+/=]{20,}/);
  });
});

// ============================================================
// J. Backward Compatibility
// ============================================================
describe("G3 — Backward Compatibility", () => {
  it("home.json is unchanged (still has 4 panels)", () => {
    const home = JSON.parse(readFileSync(HOME_DASHBOARD_PATH, "utf-8"));
    expect(home.panels.length).toBe(4);
    expect(home.uid).toBe("nirnaya-home");
  });

  it("docker-compose.yml still uses Grafana 11.6.0", () => {
    const compose = readFileSync(DOCKER_COMPOSE_PATH, "utf-8");
    expect(compose).toContain("grafana/grafana:11.6.0");
  });

  it("docker-compose.yml still mounts grafana/dashboards volume", () => {
    const compose = readFileSync(DOCKER_COMPOSE_PATH, "utf-8");
    expect(compose).toContain("./grafana/dashboards:/var/lib/grafana/dashboards");
  });

  it("dashboard provisioning still loads from correct path", () => {
    const provisioning = readFileSync(
      join(process.cwd(), "grafana", "provisioning", "dashboards", "dashboard.yml"),
      "utf-8"
    );
    expect(provisioning).toContain("/var/lib/grafana/dashboards");
  });
});
