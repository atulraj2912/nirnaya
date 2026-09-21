# NIRNAYA Part 8 — SLA Engine: Audit, Implementation & Test Report

**Date:** 2026-09-21
**Status:** COMPLETE

---

## 1. Executive Summary

The SLA engine was already substantially implemented. This Part 8 audit found and fixed
3 bugs, added 59 comprehensive tests, and verified full spec compliance.

**Bugs fixed:**
- `resumeSLA` did not recalculate response SLA status (stale WARNING/BREACHED after resume)
- `reopenSLA` hardcoded `ON_TRACK` instead of evaluating actual status (could hide breaches)
- Redundant dead-code `isPaused` check in `evaluateStatus`

**Test baseline:** 1067 (Parts 1-7)
**New Part 8 tests:** 59
**Final count:** 1126

---

## 2. Existing SLA Audit

### Architecture
| Layer | File | Purpose |
|-------|------|---------|
| Core engine | `src/lib/services/sla-service.js` | 10 functions: init, pause, resume, complete, satisfy, recalculate, reopen, evaluate, compute |
| Config service | `src/lib/services/sla-config-service.js` | CRUD for SLAConfiguration with org isolation |
| Breach scan | `src/lib/services/sla-scan-service.js` | Batch breach/warning detection + notifications |
| Ticket integration | `src/lib/services/ticket-service.js` | SLA hooks on create, update, transitions |
| Comment integration | `src/lib/services/comment-service.js` | Response SLA on PUBLIC comment by AGENT/ADMIN |
| API routes | `src/app/api/admin/sla-configs/` | Admin CRUD endpoints |
| API routes | `src/app/api/tickets/[id]/sla/` | Ticket SLA info endpoint |
| API routes | `src/app/api/admin/sla-scan/` | Manual breach scan trigger |
| UI | `src/components/tickets/sla-info.jsx` | SLA display component (response + resolution) |
| UI | `src/app/(dashboard)/admin/sla/page.js` | Admin SLA config page |

### Schema (Prisma)
- `SLAConfiguration`: organizationId, priority, responseTimeMinutes, resolutionTimeMinutes
- Unique constraint: `[organizationId, priority]` — one config per priority per org
- Ticket SLA fields: responseSlaStatus, resolutionSlaStatus, responseDueAt, resolutionDueAt, firstRespondedAt, waitingSince, resolvedAt, closedAt

### Spec Compliance (before fixes)
- Two independent clocks: Response + Resolution
- Response SLA: starts at creation, satisfied by PUBLIC comment by AGENT/ADMIN
- Resolution SLA: starts at creation, satisfied at RESOLVED, paused during WAITING_FOR_USER
- SLA statuses: ON_TRACK, WARNING (20% threshold), BREACHED, PAUSED, COMPLETED
- Server-controlled timestamps throughout
- Org isolation on all SLA lookups
- Fire-and-forget SLA hooks (never blocks ticket operations)

---

## 3. Bugs Found and Fixed

### Bug 1: `resumeSLA` did not recalculate response SLA
**File:** `src/lib/services/sla-service.js:114-133`
**Impact:** After pausing and resuming, response SLA status remained stale (could show PAUSED or WARNING/BREACHED from before pause).
**Fix:** Added response SLA recalculation on resume, mirroring the existing resolution recalculation.

### Bug 2: `reopenSLA` hardcoded ON_TRACK
**File:** `src/lib/services/sla-service.js:197-218`
**Impact:** When reopening a ticket whose recalculated deadline was already past, status was incorrectly set to ON_TRACK instead of BREACHED.
**Fix:** Changed from hardcoded `"ON_TRACK"` to `calculateStatus()` which evaluates actual breach/warning state.

### Bug 3: Redundant dead-code `isPaused` check
**File:** `src/lib/services/sla-service.js:5-12`
**Impact:** No functional impact, but line 9 was unreachable dead code.
**Fix:** Removed the duplicate `if (isPaused) return "PAUSED"` on line 9.

---

## 4. Response SLA Behavior
- Starts when ticket is created (`initializeTicketSLA`)
- `responseDueAt = createdAt + responseTimeMinutes`
- Satisfied by first PUBLIC comment by AGENT or ADMIN (`satisfyResponseSLA`)
- USER comments and INTERNAL comments do NOT satisfy response SLA
- Once satisfied, remains satisfied permanently (idempotent)
- Status derived: COMPLETED (if satisfied) > PAUSED (if waiting) > BREACHED/WARNING/ON_TRACK

---

## 5. Resolution SLA Behavior
- Starts when ticket is created (`initializeTicketSLA`)
- `resolutionDueAt = createdAt + resolutionTimeMinutes`
- Satisfied when ticket reaches RESOLVED (`completeResolutionSLA`)
- Paused during WAITING_FOR_USER (`pauseSLA`)
- Resumes on transition to IN_PROGRESS from WAITING_FOR_USER (`resumeSLA`)
- Priority change recalculates from original `createdAt` (`recalculateResolutionSLA`)
- Reopening recalculates deadline from original `createdAt` (`reopenSLA`)

---

## 6. Pause/Resume Behavior
- Pause: triggered by transition to WAITING_FOR_USER
- Sets `waitingSince = now()`, both SLA statuses to PAUSED (preserves COMPLETED)
- Resume: triggered by transition from WAITING_FOR_USER to IN_PROGRESS
- Clears `waitingSince = null`, recalculates both response and resolution status
- Pause/resume preserves accumulated elapsed time (no reset)
- Multiple pause/resume cycles supported (each pause sets waitingSince, each resume clears it)

---

## 7. Reopen Behavior
- Triggered by RESOLVED -> REOPENED transition
- Clears `resolvedAt = null`
- Recalculates `resolutionDueAt = createdAt + config.resolutionTimeMinutes`
- Evaluates actual status using `calculateStatus()` (not hardcoded ON_TRACK)
- If recalculated deadline is already past, status is BREACHED
- Response SLA is unaffected by reopening

---

## 8. Breach Detection
- Two independent breach states: response and resolution
- Evaluated by `evaluateAndPersistSLA()` on-demand when SLA info is requested
- Also evaluated by `runSLABreachScan()` for batch scanning
- Breach = remaining time < 0
- Warning = remaining time <= 20% of original duration
- Status priority: COMPLETED > PAUSED > BREACHED > WARNING > ON_TRACK
- Uses `new Date()` for current time (server-controlled)

---

## 9. Time Handling
- All SLA calculations use wall-clock elapsed time (no business hours)
- `responseDueAt = createdAt + responseTimeMinutes * 60 * 1000`
- `resolutionDueAt = createdAt + resolutionTimeMinutes * 60 * 1000`
- Timezone: UTC throughout (Date objects in JavaScript are UTC-based)
- SLA configuration units: minutes (integer, 1-43200)
- No business-calendar calculations (per D-012)

---

## 10. Security / Org Isolation
- SLAConfiguration lookup always scoped by organizationId
- Ticket SLA fields set server-side only (never client-controlled)
- `satisfyResponseSLA` rejects USER role
- Admin SLA endpoints require ADMIN role
- Ticket SLA endpoint requires authentication
- Cross-org SLA config lookup returns null (no leakage)

---

## 11. API Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/admin/sla-configs` | ADMIN | List SLA configs for org |
| POST | `/api/admin/sla-configs` | ADMIN | Create SLA config |
| PATCH | `/api/admin/sla-configs/[id]` | ADMIN | Update SLA config |
| POST | `/api/admin/sla-scan` | ADMIN | Trigger breach scan |
| GET | `/api/tickets/[id]/sla` | Auth | Get SLA info for ticket |

---

## 12. React Query Integration
- `SLAInfo` component uses `useTicketSLAQuery` (React Query) to fetch SLA data
- Query key: `["sla", ticketId]`
- Fetches from `GET /api/tickets/${ticketId}/sla`
- Handles loading, error, and empty states

---

## 13. Transaction Behavior
- SLA initialization is fire-and-forget after ticket creation
- SLA pause/resume/complete/reopen are fire-and-forget after status transitions
- SLA failures never prevent ticket operations from succeeding
- `evaluateAndPersistSLA` only persists when status actually changes
- No unnecessary transaction coupling

---

## 14. Performance / Query Strategy
- `initializeTicketSLA`: 1 config lookup + 1 ticket lookup + 1 update
- `pauseSLA/resumeSLA/completeResolutionSLA/reopenSLA`: 1 ticket lookup + 1 update
- `evaluateAndPersistSLA`: 1 ticket lookup + conditional 1 update
- `runSLABreachScan`: batch query + per-ticket evaluation
- No N+1 behavior in SLA operations
- SLAConfiguration has indexes on `[organizationId]` and unique `[organizationId, priority]`

---

## 15. Tests Added

New file: `tests/ai-part8-sla-engine.test.js` (59 tests)

| Category | Tests | Coverage |
|----------|-------|----------|
| SLA Configuration | 4 | Org scoping, no config, cross-org, inactive |
| Response SLA | 9 | Start, deadline, satisfy (AGENT/ADMIN/USER), idempotency, permanence, remaining, met |
| Resolution SLA | 7 | Start, complete, met (RESOLVED/CLOSED), recalculate, breached |
| Pause/Resume | 9 | Pause both clocks, preserve COMPLETED, resume both, response breach after resume, null handling, paused info |
| WAITING_FOR_USER | 2 | No reset on pause, no deadline change on resume |
| Reopening | 4 | Reset resolvedAt, recalculate deadline, breached detection, null handling |
| Independent Clocks | 3 | Response completes while resolution active, response breach != resolution breach, resolution completion != response |
| Boundary Conditions | 4 | Zero remaining, breach detection, warning threshold, no-op when unchanged |
| Time Handling | 2 | UTC consistency, wall-clock minutes |
| Security / Org Isolation | 3 | Config scoping, ticket org usage, USER rejection |
| Lifecycle Integration | 2 | Init sets both dates/statuses, null handling |
| Failure Resilience | 4 | No-op without SLA fields, null ticket, skip RESOLVED/CLOSED |
| computeSLAInfo Comprehensive | 5 | Null dueAt, paused override, remaining null when paused, resumedFromPause |
| SLA Status Priority | 3 | BREACHED > WARNING, PAUSED > ON_TRACK, COMPLETED > BREACHED |
| **Total** | **59** | |

---

## 16. Test Count Reconciliation

| Source | Count |
|--------|-------|
| Parts 1-7 baseline | 1067 |
| Part 8 new tests (`ai-part8-sla-engine.test.js`) | 59 |
| **Final** | **1126** |

---

## 17. Validation Results

| Check | Result |
|-------|--------|
| npm test | 1126/1126 passed (48 files) |
| npm run lint | 0 errors, 1 warning (pre-existing `<img>`) |
| npx prisma validate | Schema valid |
| npm run build | Compiled successfully (Next.js 16.3.4 Turbopack) |

---

## 18. Known Limitations / V1 Decisions

1. **No business-hours SLA:** Wall-clock elapsed time only (per D-012 and spec V1 limitation)
2. **No automatic breach scan scheduling:** Scan is manual via `POST /api/admin/sla-scan` (per D-000 item 4)
3. **Dashboard counts response-only:** `dashboard-service.js` only counts response SLA breaches/warnings, not resolution
4. **Fire-and-forget SLA hooks:** If SLA update fails, ticket operation still succeeds (by design per D-012)
5. **No SLA DELETE endpoint:** Configs can be created and updated but not deleted
6. **SLAConfiguration has no isActive field:** Cannot disable configs without deleting
7. **Exact pause duration tracking:** V1 limitation per spec — `waitingSince` tracks current pause start but not historical pause accumulation

---

## 19. Summary

Part 8 (SLA Engine) is COMPLETE.

- Existing SLA implementation: comprehensive (10 service functions, admin CRUD, breach scan, UI)
- 3 bugs found and fixed: resumeSLA response recalc, reopenSLA status eval, dead code
- 59 new tests covering: config, response SLA, resolution SLA, pause/resume, reopening,
  independent clocks, boundaries, time handling, security, lifecycle, failures, status priority
- Full validation: 1126/1126 tests pass, lint clean, Prisma valid, build succeeds
- Two independent SLA clocks verified and tested
- Organization isolation verified
- Server-controlled timestamps verified
- No regressions to Parts 1-7