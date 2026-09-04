# NIRNAYA — Test Plan

## Strategy

- **Unit / service / component tests:** Vitest + React Testing Library.
  Fast, run against the service layer and components in isolation
  (mocking Prisma/network where appropriate).
- **End-to-end tests:** Playwright, driving the real built app
  (`npm run build && npm run start`) through full user flows.
- Per spec §37, every phase adds tests for what it implements, runs
  them, and only reports the phase complete once they pass — code
  compiling is not sufficient.
- Per spec §34, testing is mandatory, not optional polish.

## Commands

```bash
npm run test        # Vitest — unit/service/component
npm run test:watch   # Vitest, watch mode
npm run test:e2e      # Playwright — end-to-end
```

## Coverage expectations by category (spec §34)

Each category becomes real test suites as its owning phase lands.
Phase 0 establishes only the harness and one smoke test
(`tests/health.test.js`, `e2e/smoke.spec.js`); everything below is the
target coverage for later phases, listed here so the expectation is
recorded up front.

| Category | Owning phase | Key cases |
|---|---|---|
| Auth | 3 | login validation, password verification, JWT verification, inactive-user rejection |
| RBAC | 3–4 | USER restrictions, AGENT permissions, ADMIN permissions |
| Organization isolation | 3–10 | cross-org denial for tickets, users, departments, categories/tags, watchers, assignment, AI data |
| Tickets | 4 | creation, validation, numbering, lifecycle, invalid transitions, reopening, terminal CLOSED, assignment history |
| AI classification | 5 | category/priority/department resolution, confidence bounds, unresolved-entity nulls, fallback behavior, persistence |
| AI assignment | 6 | candidate eligibility, department filtering, workload, category experience, historical experience, priority readiness, scoring, tie-breaking, confidence formula (incl. the documented D-002 inconsistency), acceptance revalidation |
| SLA | 7 | response clock, resolution clock, qualifying-comment rules, internal/USER comment exclusion, pause/resume, priority-change recalculation, warning/breach thresholds, deduplication |
| Comments | 9 | public/internal creation, USER visibility exclusion, AGENT/ADMIN visibility |
| Watchers | 9 | add/remove/list, duplicate prevention, authorization, cross-org protection |
| Realtime | 8 | event names, ticket-room authorization, payload security (no comment content/internal leakage), notification read sync, socket-failure isolation |
| Activity | 9 | ordering, actor attribution, pagination, authorization, internal-visibility exclusion for USER |
| Regression | 11–12 | full suite + production build, every phase |

## Phase 0 status

- `tests/health.test.js` (Vitest): asserts `GET /api/health` returns
  `{ status: "ok", phase: "phase-0" }` — validates the App Router route
  handler + Vitest + jsdom + path-alias toolchain end-to-end.
- `e2e/smoke.spec.js` (Playwright): loads `/` and asserts the "NIRNAYA"
  heading renders — validates the Playwright + production-build
  toolchain end-to-end.

Results of running these are recorded in `PROGRESS.md`.
