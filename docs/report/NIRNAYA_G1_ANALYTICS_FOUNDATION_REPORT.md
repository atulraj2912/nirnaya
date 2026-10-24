# NIRNAYA G1 — Analytics Foundation & Secure Data Layer

## Scope
Implement a secure, role-aware Analytics Foundation & Secure Data Layer that Grafana can consume in later phases — without installing Grafana, building dashboards, or modifying existing V1 functionality.

---

## Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/validation/analytics.js` | Created | Zod validation schemas for admin/agent analytics query params |
| `src/lib/services/admin-analytics-service.js` | Created | 12 admin analytics functions — full org-scoped dashboard |
| `src/lib/services/agent-analytics-service.js` | Created | 11 agent analytics functions — self-scoped dashboard |
| `src/app/api/admin/analytics/route.js` | Modified | Updated to support date range + granularity alongside legacy timeWindow |
| `src/app/api/analytics/agent/route.js` | Created | Agent analytics endpoint (`GET /api/analytics/agent`) |
| `tests/analytics-g1-foundation.test.js` | Created | 62 comprehensive tests across 10 categories |
| `docs/report/NIRNAYA_G1_ANALYTICS_FOUNDATION_REPORT.md` | Created | This report |

---

## Validation Schema (`src/lib/validation/analytics.js`)

### `adminAnalyticsQuerySchema`
- **timeWindow**: `"today" | "7d" | "30d" | "month"` — mutually exclusive with start/end
- **start**: ISO date string
- **end**: ISO date string
- **granularity**: `"hour" | "day" | "week" | "month"` (default: `"day"`)
- Rejects: conflicting timeWindow + start/end, end before start, range > 365 days, invalid granularity

### `agentAnalyticsQuerySchema`
- Same fields as admin (without timeWindow)

### `resolveDateRange({ start, end, timeWindow })`
- Converts timeWindow to explicit start/end dates
- Falls back to 30d if no params provided

---

## Admin Analytics Service (`src/lib/services/admin-analytics-service.js`)

### Functions (12 total)

| Function | Returns | Metric |
|----------|---------|--------|
| `getCreationTrend(org, start, end, granularity)` | `{period, count}[]` | Tickets created over time |
| `getResolutionTrend(org, start, end, granularity)` | `{period, count}[]` | Tickets resolved over time |
| `getClosureTrend(org, start, end, granularity)` | `{period, count}[]` | Tickets closed over time |
| `getStatusDistribution(org, start, end)` | `{status, count}[]` | Ticket status breakdown |
| `getPriorityDistribution(org, start, end)` | `{priority, count}[]` | Ticket priority breakdown |
| `getTicketsByDepartment(org, start, end)` | `{departmentId, name, count}[]` | Tickets per department |
| `getTicketsByCategory(org, start, end)` | `{categoryId, name, count}[]` | Tickets per category |
| `getAgentWorkload(org)` | `{agentId, username, designation, assignedCount}[]` | Agent workload |
| `getSLAPerformance(org, start, end)` | `{response: [{status, count}], resolution: [{status, count}]}` | SLA compliance |
| `getAverageResolutionTime(org, start, end)` | `{averageHours, sampleSize}` | Mean resolution time |
| `getAverageFirstResponseTime(org, start, end)` | `{averageHours, sampleSize}` | Mean first response time |
| `getAIStatistics(org, start, end)` | `{totalPredictions, averageConfidence, topCategories}` | AI classification stats |

### Orchestrator
`getAdminAnalytics(org, { startDate, endDate, granularity })` — returns all metrics in a single call, scoped to `scope: "organization"`.

---

## Agent Analytics Service (`src/lib/services/agent-analytics-service.js`)

### Functions (11 total)

| Function | Scope | Returns |
|----------|-------|---------|
| `getMyCreationTrend(agentId, org, start, end, granularity)` | Requester ID = agent | `{period, count}[]` |
| `getMyResolutionTrend(agentId, org, start, end, granularity)` | Assigned agent = agent | `{period, count}[]` |
| `getMyClosureTrend(agentId, org, start, end, granularity)` | Assigned agent = agent | `{period, count}[]` |
| `getMyWorkload(agentId, org)` | Assigned agent = agent | Number (count) |
| `getMyStatusDistribution(agentId, org, start, end)` | Assigned agent = agent | `{status, count}[]` |
| `getMyPriorityDistribution(agentId, org, start, end)` | Assigned agent = agent | `{priority, count}[]` |
| `getMyCategoryDistribution(agentId, org, start, end)` | Assigned agent = agent | `{categoryId, name, count}[]` |
| `getMySLAPerformance(agentId, org, start, end)` | Assigned agent = agent | SLA status breakdown |
| `getMyAverageResolutionTime(agentId, org, start, end)` | Assigned agent = agent | `{averageHours, sampleSize}` |
| `getMyAverageFirstResponseTime(agentId, org, start, end)` | Assigned agent = agent | `{averageHours, sampleSize}` |

### Orchestrator
`getAgentAnalytics(agentId, org, { startDate, endDate, granularity })` — returns all agent-scoped metrics in a single call.

---

## API Routes

### `GET /api/admin/analytics`
- **Auth**: `requireAdmin` (ADMIN only)
- **Query params**: `timeWindow`, `start`, `end`, `granularity`, `mode` (`legacy` | `full`)
- **Legacy mode**: Uses existing `analytics-service.js` for backward compatibility
- **Full mode**: Uses new `admin-analytics-service.js` with date range + granularity
- **organizationId**: Derived from session, never from client

### `GET /api/analytics/agent`
- **Auth**: `requireRole(request, ["AGENT", "ADMIN"])`
- **Query params**: `timeWindow`, `start`, `end`, `granularity`
- **agentId and organizationId**: Always derived from authenticated session
- **Client-provided agentId/org params**: IGNORED

---

## Test Coverage (62 tests)

| Category | Tests | Status |
|----------|-------|--------|
| A. Admin Analytics Service | 18 | ✅ |
| B. Agent Analytics Service | 11 | ✅ |
| C. Cross-Organization Isolation | 3 | ✅ |
| D. Cross-Agent Isolation | 3 | ✅ |
| E. RBAC Authorization | 4 | ✅ |
| F. Input Validation (schemas + resolveDateRange) | 13 | ✅ |
| G. API Route Parameter Validation | 3 | ✅ |
| H. No Fake Data Verification | 3 | ✅ |
| I. Error Handling | 2 | ✅ |
| J. Performance / Query Behavior | 4 | ✅ |

---

## Security Invariants Verified

| Invariant | Status |
|-----------|--------|
| organizationId derived from session, never from client | ✅ |
| agentId derived from session, never from client (agent route) | ✅ |
| ADMIN scoped to own organization only | ✅ |
| AGENT scoped to own tickets only | ✅ |
| USER role blocked from analytics endpoints | ✅ |
| Cross-organization data never leaked | ✅ |
| Cross-agent data never leaked | ✅ |
| Generic error messages (no Prisma internals exposed) | ✅ |
| All parameters Zod-validated before execution | ✅ |
| Date ranges bounded to max 365 days | ✅ |

---

## Data Accuracy Verified

- All metrics derived from real Prisma database queries
- Average resolution time computed from actual `createdAt` → `resolvedAt` timestamps
- Average first-response time computed from actual `createdAt` → `firstRespondedAt` timestamps
- No hardcoded, placeholder, or fake metrics anywhere in the codebase
- Time bucketing uses UTC methods (`setUTCHours`, `setUTCMinutes`) to avoid timezone drift

---

## Bug Fixed During G1

**Timezone bucketing bug in `truncateToPeriod`**:
- `setHours(0,0,0,0)` was used instead of `setUTCHours(0,0,0,0)`
- In non-UTC timezones (e.g., UTC+5:30), dates like `2026-09-01T10:00:00Z` were bucketed as `2026-08-31` because local midnight shifted the UTC date back
- Fixed in both `admin-analytics-service.js` and `agent-analytics-service.js`
- All 62 tests pass after fix

---

## Final Verification

| Check | Result |
|-------|--------|
| Total tests | **1295** (1233 baseline + 62 G1) |
| G1 tests | **62 passed** |
| Pre-existing test failure | 1 (flaky `ticket-form.test.jsx` — pre-existing) |
| Lint | **0 errors** (1 pre-existing warning in `avatar.jsx`) |
| Prisma schema | **Valid** |
| Build | **Successful** — 49 routes built |
| New route registered | `/api/analytics/agent` ✅ |

---

## Backward Compatibility

- `GET /api/admin/analytics?timeWindow=7d` → uses existing `analytics-service.js` (legacy mode)
- `GET /api/admin/analytics?mode=legacy&timeWindow=30d` → explicitly legacy
- `GET /api/admin/analytics?start=2026-09-01&end=2026-09-22` → uses new G1 service
- No existing API contracts broken
- No existing UI components modified
- No new dependencies introduced

---

## What G1 Does NOT Include (Deferred to G2+)

- Grafana installation or configuration
- Dashboard creation or UI changes
- Real-time analytics (Socket.IO push)
- Data retention policies
- Export functionality (PDF/Excel)
- Advanced filtering (complex WHERE clauses)
- Caching layer
- Historical data aggregation for large datasets
- Agent benchmarking / comparison analytics
- AI prediction accuracy tracking over time
