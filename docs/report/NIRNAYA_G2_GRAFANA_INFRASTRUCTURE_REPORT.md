# NIRNAYA G2 — Grafana Infrastructure & Secure Visualization Connection

## Executive Summary

G2 introduces Grafana as an optional visualization layer for the analytics foundation established in G1. Grafana connects to NIRNAYA through authenticated HTTP API endpoints — **not** through direct database access. NIRNAYA remains the sole authorization boundary. Grafana cannot bypass NIRNAYA's organization or agent isolation.

**G2 Status: COMPLETE**

---

## Baseline

| Metric | Value |
|--------|-------|
| V1 baseline tests | 1233 |
| G1 tests | 62 |
| Pre-G2 total | 1295 |
| G2 tests | 50 |
| Post-G2 total | **1345** |
| All tests passing | ✅ 1345/1345 |

---

## Architecture Decision Record

### Decision: Grafana consumes NIRNAYA analytics via authenticated HTTP API

**Chosen approach: Option C — Grafana querying NIRNAYA analytics endpoints through HTTP datasource**

| Approach | Security | Complexity | Recommendation |
|----------|----------|------------|----------------|
| A. Direct PostgreSQL access | ❌ Bypasses NIRNAYA auth | Low | Rejected |
| B. PostgreSQL views | ⚠️ Partial bypass | Medium | Rejected |
| **C. NIRNAYA API proxy** | ✅ Full auth preserved | Low | **Selected** |
| D. Custom analytics service | ✅ Full auth preserved | High | Rejected (unnecessary) |

**Rationale:**
- NIRNAYA already has G1 analytics endpoints with full authorization
- HTTP datasource is the simplest Grafana integration pattern
- No database credentials exposed to Grafana
- Organization and agent isolation preserved at all times
- Grafana is purely a visualization consumer — zero write access

### Architecture Diagram

```
Browser (Grafana UI)
    │
    │ HTTP + Bearer token
    ▼
NIRNAYA /api/grafana/* (service token validation)
    │
    │ Server-derived scope (org/agent ID)
    ▼
G1 Analytics Services (admin-analytics-service / agent-analytics-service)
    │
    │ Prisma queries with org/agent WHERE clauses
    ▼
PostgreSQL (Supabase)
```

**Key invariant:** `organizationId` and `agentId` are derived from the validated service token (environment variables), **never** from Grafana query parameters or dashboard variables.

---

## Grafana Version

**Grafana 11.6.0** (pinned in `docker-compose.yml`)

---

## Installation Method

### Local Development (Docker Compose)

```bash
# Start Grafana
docker compose up -d

# View logs
docker compose logs -f grafana

# Access Grafana UI
open http://localhost:3100

# Stop Grafana
docker compose down
```

### Standalone (without Docker)

Download from https://grafana.com/grafana/download and run:

```bash
grafana-server --homepath=/path/to/grafana --config=custom.ini
```

---

## Datasource Architecture

### Datasource Configuration

Grafana uses the **JSON API datasource** plugin (`marcusolsson-json-datasource`) to query NIRNAYA's analytics endpoints.

Two datasources are provisioned:

| Datasource | Scope | Token Variable | Endpoint |
|------------|-------|-----------------|----------|
| NIRNAYA-Admin | Organization-wide | `GRAFANA_SERVICE_TOKEN` | `/api/grafana/analytics/admin` |
| NIRNAYA-Agent | Agent self-only | `GRAFANA_AGENT_SERVICE_TOKEN` | `/api/grafana/analytics/agent` |

### How it works

1. Grafana dashboard panel sends request to NIRNAYA API endpoint
2. Request includes `Authorization: Bearer <service-token>` header
3. NIRNAYA validates the token against environment variables
4. NIRNAYA maps the token to a user context (admin or agent)
5. NIRNAYA calls G1 analytics services with server-derived scope
6. NIRNAYA returns analytics data
7. Grafana renders the visualization

---

## Security Boundary

### What Grafana CAN do
- Query NIRNAYA analytics API endpoints with a valid service token
- Receive analytics data for the token's mapped scope
- Render visualizations in dashboards

### What Grafana CANNOT do
- Access the database directly
- Bypass NIRNAYA authorization
- Modify NIRNAYA data
- Access data outside the token's scope
- Change organizationId or agentId via query parameters
- Access other agents' data
- Access other organizations' data

### Token-to-scope mapping (server-controlled)

```
GRAFANA_SERVICE_TOKEN → admin scope → organization-wide analytics
GRAFANA_AGENT_SERVICE_TOKEN → agent scope → agent's own tickets only
```

The mapping is defined entirely in environment variables. The browser/Grafana cannot influence which scope a token grants.

---

## Database Permissions

**G2 does NOT use direct database access.** Grafana connects to NIRNAYA's HTTP API only.

If direct database access is ever required in the future:

- Create a dedicated read-only PostgreSQL role
- Grant only SELECT on specific analytics views
- Never grant INSERT, UPDATE, DELETE, DROP, ALTER, CREATE
- Never use the main application database user
- Store credentials in environment variables only

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GRAFANA_ENABLED` | No | `false` | Enable/disable Grafana routes |
| `GRAFANA_SERVICE_TOKEN` | No | — | Bearer token for admin-scope datasource |
| `GRAFANA_AGENT_SERVICE_TOKEN` | No | — | Bearer token for agent-scope datasource |
| `GRAFANA_ADMIN_USER_ID` | If admin token set | — | User ID mapped to admin token |
| `GRAFANA_ADMIN_ORGANIZATION_ID` | If admin token set | — | Org ID for admin-scope queries |
| `GRAFANA_AGENT_USER_ID` | If agent token set | — | User ID mapped to agent token |
| `GRAFANA_AGENT_ORGANIZATION_ID` | If agent token set | — | Org ID for agent-scope queries |
| `GRAFANA_ADMIN_PASSWORD` | No | `nirnaya-dev` | Grafana web UI password (Docker) |

### Generating tokens

```bash
openssl rand -base64 32
```

### Security rules

- Never use `NEXT_PUBLIC_*` for any Grafana variable
- Never commit real tokens to Git
- Tokens must differ from `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- Use `.env` for real values (never `.env.example`)

---

## Local Development Setup

### Prerequisites

1. NIRNAYA running on port 3000 (`npm run dev`)
2. Docker Desktop installed (for Docker Compose)

### Step 1: Configure environment

Add to `.env`:

```bash
GRAFANA_ENABLED=true
GRAFANA_SERVICE_TOKEN="<generated-admin-token>"
GRAFANA_AGENT_SERVICE_TOKEN="<generated-agent-token>"
GRAFANA_ADMIN_USER_ID="<admin-user-id-from-db>"
GRAFANA_ADMIN_ORGANIZATION_ID="<org-id-from-db>"
GRAFANA_AGENT_USER_ID="<agent-user-id-from-db>"
GRAFANA_AGENT_ORGANIZATION_ID="<org-id-from-db>"
GRAFANA_ADMIN_PASSWORD="nirnaya-dev"
```

### Step 2: Start Grafana

```bash
docker compose up -d
```

### Step 3: Access Grafana

- URL: http://localhost:3100
- Username: `admin`
- Password: `nirnaya-dev` (or your `GRAFANA_ADMIN_PASSWORD`)

### Step 4: Verify connectivity

The infrastructure health dashboard (`NIRNAYA — Infrastructure Health`) will show:
- Grafana Connectivity: OK
- NIRNAYA Version: 0.1.0
- Datasource Status: OK
- Authorization: OK

### Step 5: Stop Grafana

```bash
docker compose down
```

---

## Production Considerations

- Deploy Grafana as a separate service (Docker, Kubernetes, or managed Grafana)
- Use different `GRAFANA_SERVICE_TOKEN` values for production
- Store tokens in a secrets manager (Vault, AWS Secrets Manager, etc.)
- Enable HTTPS for Grafana
- Restrict network access to Grafana
- Monitor Grafana health via `/api/grafana/health`
- Consider OAuth/SSO for Grafana authentication in production

---

## Authentication Considerations

### Current (G2)

Service token-based authentication:
- NIRNAYA validates a bearer token from environment variables
- Token maps to a fixed user context (admin or agent)
- Simple, secure, no external dependencies

### Future (G5+)

Production SSO options:
- Grafana OAuth with NIRNAYA as identity provider
- OIDC integration
- Session-based authentication forwarding

**G2 does NOT implement SSO.** The service token approach is sufficient for infrastructure setup and local development.

---

## Admin Scope Strategy

The admin Grafana dashboard (G3) will:
1. Use `GRAFANA_SERVICE_TOKEN` → maps to admin user + org
2. Call `/api/grafana/analytics/admin` with date range params
3. Receive organization-wide analytics data
4. Render in Grafana panels

**Isolation:** Admin sees only their organization's data. The organization is determined by `GRAFANA_ADMIN_ORGANIZATION_ID` environment variable, not by any client-controllable parameter.

---

## Agent Scope Strategy

The agent Grafana dashboard (G4) will:
1. Use `GRAFANA_AGENT_SERVICE_TOKEN` → maps to specific agent user + org
2. Call `/api/grafana/analytics/agent` with date range params
3. Receive only that agent's ticket analytics
4. Render in Grafana panels

**Isolation:** Agent sees only their own tickets. Changing `agentId` in a Grafana query parameter has no effect — the agent ID is derived from the validated token's env-var mapping.

**Enforcement:** The Grafana agent endpoint validates that the token type is "agent" and rejects admin tokens. Each agent would need a separate `GRAFANA_AGENT_SERVICE_TOKEN` with their specific `GRAFANA_AGENT_USER_ID`.

---

## Grafana Failure Isolation

**NIRNAYA continues working if Grafana is unavailable.**

Verified by:
- Grafana endpoints are completely independent of core NIRNAYA routes
- No blocking Grafana calls in ticket creation, updates, SLA, auth, etc.
- Grafana is downstream of the analytics layer
- Health check endpoint does not query the database

If Grafana is down:
- ✅ Ticket creation works
- ✅ Ticket updates work
- ✅ Authentication works
- ✅ AI classification works
- ✅ SLA transitions work
- ✅ Notifications work
- ✅ Existing dashboards work
- ✅ All APIs work

---

## Health / Connectivity Verification

### Endpoint

`GET /api/grafana/health`

Requires: `Authorization: Bearer <service-token>`

Response (200):
```json
{
  "status": "ok",
  "version": "0.1.0",
  "datasource": { "status": "ok", "message": "NIRNAYA reachable" },
  "authorization": { "status": "ok", "message": "Authenticated as admin scope", "type": "admin" }
}
```

This endpoint:
- Validates the service token
- Returns connectivity and authorization status
- Does NOT query the database
- Can be used for monitoring and alerting

---

## Tests

### G2 Test Coverage (50 tests)

| Category | Tests | Status |
|----------|-------|--------|
| A. Token Extraction | 5 | ✅ |
| B. Token Validation | 8 | ✅ |
| C. Query Validation (admin + agent) | 11 | ✅ |
| D. Health Route | 4 | ✅ |
| E. Admin Analytics Route | 7 | ✅ |
| F. Agent Analytics Route | 6 | ✅ |
| G. Security Invariants | 5 | ✅ |
| H. Failure Isolation | 2 | ✅ |
| I. Configuration | 3 | ✅ |

### Security Tests Verified

- ✅ No token values leaked in responses
- ✅ Client-provided organizationId ignored
- ✅ Client-provided agentId ignored
- ✅ Admin token cannot access agent endpoint
- ✅ Agent token cannot access admin endpoint
- ✅ Database errors return generic messages
- ✅ Health endpoint works without database
- ✅ Env vars documented in .env.example
- ✅ Docker Compose uses pinned version

---

## Validation Commands

| Command | Result |
|---------|--------|
| `npm test` | ✅ 1345/1345 passing |
| `npm run lint` | ✅ 0 errors (1 pre-existing warning) |
| `npx prisma validate` | ✅ Schema valid |
| `npm run build` | ✅ 52 routes built |

---

## Files Created

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Grafana service definition (Docker Compose) |
| `grafana/provisioning/datasources/nirnaya.yml` | Datasource provisioning |
| `grafana/provisioning/dashboards/dashboard.yml` | Dashboard provisioning |
| `grafana/dashboards/home.json` | Infrastructure health test dashboard |
| `src/lib/validation/grafana.js` | Grafana validation schemas + token functions |
| `src/app/api/grafana/health/route.js` | Health check endpoint |
| `src/app/api/grafana/analytics/admin/route.js` | Admin analytics proxy endpoint |
| `src/app/api/grafana/analytics/agent/route.js` | Agent analytics proxy endpoint |
| `tests/grafana-g2-infrastructure.test.js` | 50 G2 tests |
| `docs/report/NIRNAYA_G2_GRAFANA_INFRASTRUCTURE_REPORT.md` | This report |

## Files Modified

| File | Change |
|------|--------|
| `.env.example` | Added Grafana environment variables |

---

## Known Limitations

1. **Service token is a shared secret** — In production, consider per-user tokens or OAuth
2. **No live dashboard updates** — Grafana uses polling (default 30s refresh), not WebSocket push
3. **Agent dashboard requires per-agent tokens** — Each agent needs a separate token + env config
4. **No Grafana embedding** — Dashboard is standalone, not embedded in NIRNAYA UI (deferred to G5)

---

## Deferred G3/G4/G5 Work

### G3 — Admin Grafana Dashboard
- Build admin dashboard panels (ticket trends, SLA, workload, etc.)
- Configure dashboard JSON
- Test with real data

### G4 — Agent Grafana Dashboard
- Build agent self-scoped dashboard panels
- Per-agent token management
- Test agent isolation

### G5 — NIRNAYA/Grafana Integration + E2E + Production Hardening
- Embed Grafana in NIRNAYA UI (iframe or API)
- OAuth/SSO integration
- E2E tests with Playwright
- Production deployment hardening
- Monitoring and alerting
- Caching layer for analytics queries
