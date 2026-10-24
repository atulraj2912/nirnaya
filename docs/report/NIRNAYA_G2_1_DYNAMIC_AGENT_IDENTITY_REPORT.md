# NIRNAYA G2.1 — Dynamic Agent Identity (JWT-Based Authentication)

## Executive Summary

G2.1 replaces hardcoded per-agent environment variables with dynamic, short-lived JWT-based authentication for Grafana agent analytics. Instead of requiring each agent's credentials to be pre-configured as environment variables, agents authenticate through NIRNAYA's existing session system and receive a signed, time-limited Grafana identity token. Admin analytics continue to use the static `GRAFANA_SERVICE_TOKEN` for backward compatibility.

**G2.1 Status: COMPLETE**

---

## Baseline

| Metric | Value |
|--------|-------|
| V1 baseline tests | 1233 |
| G1 tests | 62 |
| G2 tests | 49 (updated for async) |
| Pre-G2.1 total | 1344 |
| G2.1 tests | 42 |
| Post-G2.1 total | **1386** |
| All tests passing | ✅ 1386/1386 |

---

## Architecture Decision Record

### Decision: NIRNAYA-issued short-lived signed JWTs for agent identity

**Chosen approach: Option A — NIRNAYA signs identity JWTs with a dedicated secret**

| Approach | Security | Complexity | Scalability | Recommendation |
|----------|----------|------------|-------------|----------------|
| **A. NIRNAYA-signed JWTs** | ✅ Short-lived, revocable | Low | ✅ Any # agents | **Selected** |
| B. OAuth2 token exchange | ✅ Industry standard | High | ✅ Any # agents | Rejected (overkill) |
| C. Database-backed tokens | ✅ Revocable | Medium | ⚠️ DB queries | Rejected (unnecessary) |
| D. Keep per-agent env vars | ⚠️ Static, manual | Low | ❌ N agents = N secrets | Rejected |

**Rationale:**
- No per-agent secrets to manage — agents authenticate via NIRNAYA sessions
- 5-minute token expiry limits exposure window
- `GRAFANA_JWT_SECRET` is the single secret to rotate (not N agent secrets)
- Admin analytics remain unchanged — backward compatible
- Token embeds `userId`, `organizationId`, `role: "AGENT"` — server-derived, never client-supplied

### Architecture Diagram

```
Agent Browser
    │
    │ POST /api/grafana/auth/token (authenticated via NIRNAYA session)
    ▼
NIRNAYA Token Issuance
    │
    │ Signs JWT with GRAFANA_JWT_SECRET (HS256, 5-min expiry)
    │ Claims: sub=userId, org=organizationId, role=AGENT, aud=grafana, iss=nirnaya-grafana
    ▼
Agent receives signed JWT
    │
    │ Uses JWT as Bearer token in Grafana API calls
    ▼
Grafana HTTP Datasource → NIRNAYA /api/grafana/analytics/agent
    │
    │ validateGrafanaToken() verifies JWT signature + claims
    │ Server-derived userId/organizationId (never from client)
    ▼
G1 agent-analytics-service → PostgreSQL
```

---

## What Changed

### New Files

| File | Purpose |
|------|---------|
| `src/lib/auth/grafana-jwt.js` | `signGrafanaToken()` and `verifyGrafanaToken()` using jose library |
| `src/app/api/grafana/auth/token/route.js` | `POST /api/grafana/auth/token` — JWT issuance endpoint |
| `tests/grafana-g2-1-dynamic-identity.test.js` | 42 tests covering JWT lifecycle, validation, isolation, backward compat |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/validation/grafana.js` | `validateGrafanaToken()` now **async** — supports both service tokens and signed JWTs |
| `src/app/api/grafana/health/route.js` | Added `await` for async `validateGrafanaToken` |
| `src/app/api/grafana/analytics/admin/route.js` | Added `await` for async `validateGrafanaToken` |
| `src/app/api/grafana/analytics/agent/route.js` | Added `await` for async `validateGrafanaToken` |
| `tests/grafana-g2-infrastructure.test.js` | Updated G2 tests: async validation, JWT-based agent auth, `GRAFANA_JWT_SECRET` in setupEnv |
| `.env.example` | Added `GRAFANA_JWT_SECRET`, marked `GRAFANA_AGENT_SERVICE_TOKEN` as deprecated |

### No Changes

| Component | Reason |
|-----------|--------|
| Grafana dashboards | Unchanged — they query NIRNAYA endpoints, not agents directly |
| Docker Compose | Unchanged — no new services |
| `docker-compose.yml` | Unchanged |

---

## JWT Design

### Token Claims

```json
{
  "sub": "agent-user-id",
  "org": "org-123",
  "role": "AGENT",
  "purpose": "analytics",
  "iat": 1789900000,
  "exp": 1789900300,
  "iss": "nirnaya-grafana",
  "aud": "grafana"
}
```

### Signing Configuration

| Property | Value |
|----------|-------|
| Algorithm | HS256 |
| Expiry | 5 minutes |
| Issuer | `nirnaya-grafana` |
| Audience | `grafana` |
| Secret | `GRAFANA_JWT_SECRET` (separate from `JWT_ACCESS_SECRET`) |

### Validation Flow

```
Authorization: Bearer <token>
    │
    ▼
validateGrafanaToken(token)
    │
    ├─ 1. Check admin service token match → return admin scope
    │
    └─ 2. Try JWT verification via jose
         ├─ Invalid signature → 403
         ├─ Expired → 403
         ├─ role !== "AGENT" → 403
         └─ Valid → return agent scope (userId, organizationId from claims)
```

---

## Security Properties

### What Is Protected

1. **Agent isolation**: Each agent's JWT contains only their `userId` and `organizationId`
2. **No client manipulation**: `userId` and `organizationId` come from the JWT claims (signed by NIRNAYA), not from request parameters
3. **Short expiry**: 5-minute tokens limit exposure if compromised
4. **Separate secrets**: `GRAFANA_JWT_SECRET` is independent from `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
5. **Role restriction**: `verifyGrafanaToken` only accepts `role: "AGENT"` — admin JWTs are rejected
6. **Backward compatibility**: Admin analytics still work with static `GRAFANA_SERVICE_TOKEN`

### What Changed from G2

| Aspect | G2 | G2.1 |
|--------|----|----|
| Agent auth | Per-agent env var `GRAFANA_AGENT_SERVICE_TOKEN` | NIRNAYA-signed JWT (dynamic) |
| Admin auth | `GRAFANA_SERVICE_TOKEN` | `GRAFANA_SERVICE_TOKEN` (unchanged) |
| Secret management | N agent secrets + 1 admin secret | 1 JWT secret + 1 admin secret |
| Token lifetime | Indefinite (env var) | 5 minutes |
| Validation | Sync string comparison | Async JWT verification + string comparison |
| Scalability | Limited by env var management | Any number of agents |

---

## Test Coverage

### 42 Tests across 9 Categories

| Category | Tests | What They Verify |
|----------|-------|------------------|
| signGrafanaToken | 3 | Token generation, claims structure, missing secret error |
| verifyGrafanaToken | 8 | Valid token, expired, wrong secret, wrong audience/issuer, role=ADMIN rejection, tampered claims, empty/random strings |
| POST /api/grafana/auth/token | 5 | Agent/admin token issuance, 401 unauthenticated, 403 USER role, 500 missing secret |
| validateGrafanaToken (hybrid) | 5 | Admin service token, agent JWT, invalid token, admin precedence, agent cannot get admin scope |
| Multi-Agent Isolation | 5 | Agent A/B see only own data, cross-org isolation, query param manipulation blocked |
| Client Manipulation Prevention | 2 | agentId/orgId from body/query ignored |
| Backward Compatibility | 6 | Admin service token works for admin/health, agent JWT works for agent/health, cross-scope access denied |
| Failure Isolation | 3 | Health works without DB, token issuance handles DB failure, core NIRNAYA unaffected |
| Environment Configuration | 3 | .env.example docs, deprecated vars marked, JWT secret present |
| Concurrency Safety | 1 | Concurrent agent requests resolve independently |

---

## Verification

| Check | Status |
|-------|--------|
| All 1386 tests pass | ✅ |
| ESLint clean | ✅ |
| Prisma schema valid | ✅ |
| Next.js build succeeds | ✅ |
| No UI components modified | ✅ |
| No git commits | ✅ |

---

## Migration Notes

### For Existing Deployments

1. Generate a `GRAFANA_JWT_SECRET` (minimum 32 characters):
   ```bash
   openssl rand -base64 48
   ```

2. Add to `.env`:
   ```
   GRAFANA_JWT_SECRET=<generated-secret>
   ```

3. `GRAFANA_AGENT_SERVICE_TOKEN` is deprecated but still works for backward compatibility. Can be removed once all Grafana agent dashboards use JWT auth.

4. Agent token issuance endpoint: `POST /api/grafana/auth/token` (requires authenticated NIRNAYA session with AGENT or ADMIN role).

### For Grafana Configuration

No changes needed — Grafana HTTP datasource already sends Bearer tokens. The token format changes from a static env var string to a JWT, but the header format (`Authorization: Bearer <token>`) is identical.

---

## Files Reference

```
src/lib/auth/grafana-jwt.js                    — JWT sign/verify utilities
src/app/api/grafana/auth/token/route.js         — Token issuance endpoint
src/lib/validation/grafana.js                   — Hybrid token validation (updated)
src/app/api/grafana/health/route.js             — Health endpoint (updated: await)
src/app/api/grafana/analytics/admin/route.js    — Admin analytics (updated: await)
src/app/api/grafana/analytics/agent/route.js    — Agent analytics (updated: await)
tests/grafana-g2-1-dynamic-identity.test.js     — 42 G2.1 tests
tests/grafana-g2-infrastructure.test.js         — 49 G2 tests (updated for async)
.env.example                                    — Environment variable documentation
```
