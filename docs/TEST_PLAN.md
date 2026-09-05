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

## Phase 1 status

- `tests/health.test.js` (Vitest): updated to assert `phase: "phase-1"`.
- `tests/env.test.js` (Vitest): validates Zod schema for env vars
  (valid input, missing fields, short secrets, defaults applied).
- `tests/components.test.jsx` (Vitest + RTL): renders and tests Button
  (enabled/disabled), Card (children, header/footer), Badge (variants),
  Avatar (initials, image, fallback).
- `e2e/smoke.spec.js` (Playwright): redirects `/` to `/login`, renders
  login form, renders dashboard with stat cards.

Results of running these are recorded in `PROGRESS.md`.

## Phase 3 status

- `tests/password.test.js` (Vitest): bcrypt hash/verify correctness,
  salt randomness, incorrect password rejection, empty string handling.
- `tests/jwt.test.js` (Vitest): access/refresh token signing and
  verification, decoded payload contains userId/role/organizationId,
  invalid token returns null, wrong secret returns null, access token
  cannot be verified as refresh token.
- `tests/auth.test.js` (Vitest): getCurrentUser returns null when no
  token, invalid token, user INACTIVE, or user not found; returns user
  when valid and ACTIVE. Cookie helpers: set/clear/read access and
  refresh tokens.
- `tests/authz.test.js` (Vitest): requireAuth returns 401 on missing/
  invalid token, returns user on valid. requireRole returns 403 when
  role not allowed, returns user when allowed. requireAdmin rejects
  USER and AGENT, accepts ADMIN. requireAgentOrAdmin rejects USER,
  accepts AGENT and ADMIN. requireSameOrganization returns ok on match,
  403 on mismatch.
- `tests/org-isolation.test.js` (Vitest): cross-org access denied for
  users, tickets, departments; same-org access allowed; JWT
  organizationId scoping verified.

Results of running these are recorded in `PROGRESS.md`.

## Phase 5 status

- `tests/ai-validation.test.js` (Vitest): 20 tests covering
  classification input schema (valid/minimal/empty fields), raw output
  schema (all fields, null values, case normalization, invalid category,
  invalid priority, confidence bounds, NaN/Infinity handling, text
  truncation, empty string conversion), `validateClassificationOutput`
  (valid output, invalid output, provider name in error), and constants
  (all 8 categories, all 4 priorities).
- `tests/ai-provider.test.js` (Vitest): 17 tests covering mock provider
  for all 8 categories (NETWORK, HARDWARE, SOFTWARE, EMAIL, ACCOUNT,
  DATABASE, SECURITY, INFRASTRUCTURE), unrecognizable content returns
  null category, priority detection (CRITICAL, HIGH, LOW, MEDIUM default),
  suggested next steps generation, null department, model identifier.
- `tests/ai-classifier.test.js` (Vitest): 6 tests covering classifier
  integration (validated output, category classification, minimal input,
  input validation, timeout mechanism, provider name retrieval).
- `tests/ai-classification-service.test.js` (Vitest): 15 tests covering
  prediction creation for valid tickets, non-existent ticket handling,
  cross-org ticket rejection, predicted category resolution to database
  IDs, null category when not found in org, provider failure graceful
  handling, predictions retrieval with org scoping, cross-org prediction
  denial, latest prediction selection, prediction application to ticket,
  and prediction/ticket mismatch detection.

Results of running these are recorded in `PROGRESS.md`.

## Phase 6 status

- `tests/recommendation-schema.test.js` (Vitest): 16 tests covering
  factor schema (valid, negative normalized, normalized above 1),
  agent recommendation schema (valid, invalid UUID, score above 100,
  confidence below 0.5, confidence above 0.98, null department, null
  confidence), recommendation response schema (valid, negative count),
  `validateRecommendationOutput` (valid output, invalid output), and
  constants (workload statuses, no CLOSED/RESOLVED).
- `tests/agent-recommendation-service.test.js` (Vitest): 18 tests covering
  valid ticket with eligible agents, non-existent ticket, cross-org ticket,
  no eligible agents, AGENT-only role filtering, department filtering,
  workload calculation, zero workload, scoring and ranking, same-department
  advantage, lower-workload advantage, score bounds 0–100, factor structure,
  explanation generation, confidence bounds 0.50–0.98, deterministic tie-breaking,
  and graceful failure handling.

Results of running these are recorded in `PROGRESS.md`.

## Phase 4 status

- `tests/lifecycle.test.js` (Vitest): 27 tests covering all valid
  transitions (OPEN→ASSIGNED, ASSIGNED→IN_PROGRESS, IN_PROGRESS→
  WAITING_FOR_USER, IN_PROGRESS→RESOLVED, WAITING_FOR_USER→IN_PROGRESS,
  RESOLVED→CLOSED, RESOLVED→REOPENED, REOPENED→IN_PROGRESS, same-status
  no-op), invalid transitions (skipping ASSIGNED, terminal CLOSED,
  unknown status), USER role restrictions (can only reopen own RESOLVED
  tickets, cannot perform agent transitions), ADMIN permissions,
  `getAllowedTransitions` correctness, and `isTerminal` behavior.
- `tests/ticket-service.test.js` (Vitest): 18 tests covering ticket
  creation with valid data and department/category validation, ticket
  retrieval with org isolation and role-based access (USER sees own
  only, AGENT sees all in org), status transition enforcement (valid
  and invalid transitions, cross-org rejection), ticket assignment
  with agent validation (same org, active status, AGENT/ADMIN role),
  auto-transition OPEN→ASSIGNED on assignment, and listing with
  pagination, org scoping, and USER restriction.

Results of running these are recorded in `PROGRESS.md`.

## Phase 7 status

- `tests/sla-service.test.js` (Vitest): 43 tests covering
  `computeSLAInfo` (active ticket, met response, met resolution, null
  remaining when met, paused info, no config), `initializeTicketSLA`
  (sets deadlines, returns empty on no config, calculates from createdAt),
  `pauseSLA` (sets waitingSince, preserves COMPLETED status, null on
  not found), `resumeSLA` (clears waitingSince, null on not found),
  `completeResolutionSLA` (sets resolvedAt, null on not found),
  `satisfyResponseSLA` (AGENT role, ADMIN role, USER rejected, already
  satisfied, not found), `recalculateResolutionSLA` (new priority config,
  not found, no config, breached when past), `reopenSLA` (resets to
  ON_TRACK, not found, no config), `evaluateAndPersistSLA` (no config,
  breached detection, warning at 20%, no update when correct, not found,
  skips RESOLVED/CLOSED), org isolation (correct org ID), and edge cases
  (no createdAt, 1-minute window, 30-day window).

Results of running these are recorded in `PROGRESS.md`.

## Phase 9 status

- `tests/comment-service.test.js` (Vitest): 33 tests covering
  `createComment` (valid PUBLIC comment, empty comment rejected,
  whitespace-only rejected, excessive length rejected, invalid visibility
  rejected, nonexistent ticket rejected, cross-org rejected, USER access
  denied on other's ticket, USER INTERNAL creation rejected, AGENT INTERNAL
  allowed, ADMIN INTERNAL allowed, content trimming, SLA satisfaction for
  AGENT PUBLIC, SLA satisfaction for ADMIN PUBLIC, USER comment no SLA,
  INTERNAL comment no SLA, notification to requester, notification to
  watchers, no self-notification, default PUBLIC visibility),
  `listTicketComments` (authorized access, INTERNAL filtered for USER,
  INTERNAL shown for AGENT, nonexistent ticket, cross-org, USER access
  denied, pagination, ordering by createdAt asc),
  `getComment` (authorized access, nonexistent comment, INTERNAL rejected
  for USER, AGENT INTERNAL allowed, cross-org rejected).
- `tests/watcher-service.test.js` (Vitest): 23 tests covering
  `addWatcher` (self-watch, AGENT adds other user, USER cannot add other,
  nonexistent ticket, cross-org, USER access denied, cross-org target user,
  inactive target user, idempotent existing watcher, ADMIN adds other),
  `removeWatcher` (self-remove, idempotent non-existent, USER cannot remove
  other, nonexistent ticket, cross-org, AGENT removes other),
  `listWatchers` (authorized access, nonexistent ticket, cross-org, USER
  access denied, empty list), `isWatching` (true/false cases).
- `tests/activity-service.test.js` (Vitest): 15 tests covering
  `listTicketActivity` (ticket creation activity, assignment history,
  public comments, internal comments excluded for USER, internal comments
  shown for AGENT, SLA response activity, resolution activity, closure
  activity, timestamp ordering descending, nonexistent ticket, cross-org,
  USER access denied, pagination, pagination metadata, status change
  activity).

Results of running these are recorded in `PROGRESS.md`.

## Phase 2 status

- `tests/schema.test.js` (Vitest): validates Prisma schema structure
  — datasource/generator config, all 9 enums with correct values,
  all 14 models present, composite unique constraints (Department,
  User, TicketTag, Watcher, SLAConfiguration, Category, Tag),
  required indexes, SLA tracking fields on Ticket, onDelete
  behaviors (Cascade/Restrict/SetNull).
- `tests/prisma-client.test.js` (Vitest): validates singleton pattern
  — default export, repeated imports return same instance, globalThis
  caching in development.
- `tests/seed.test.js` (Vitest): validates seed script structure —
  ESM imports, bcrypt hashing, env-var credentials, idempotency
  (findFirst checks), required data (org, departments, users with
  all 3 roles, 8 categories, SLA configs, tickets, watchers,
  comments, assignment history, saved replies), atomic ticket
  counter, progress logging.

Results of running these are recorded in `PROGRESS.md`.

## Phase 10 status

- `tests/user-admin-service.test.js` (Vitest): 18 tests covering
  `listUsers` (paginated results, search filter, role filter, status
  filter, org isolation), `getUser` (authorized access, 404 for missing,
  404 for cross-org), `createUser` (valid creation with hashed password,
  duplicate username rejected, duplicate email rejected, department
  validation), `updateUser` (field updates, duplicate username during
  update rejected, last admin demotion prevented, cross-org rejected),
  `deactivateUser` (sets INACTIVE, last admin deactivation prevented,
  non-existent user rejected).
- `tests/department-service.test.js` (Vitest): 8 tests covering
  `listDepartments` (results with counts, search filter), `createDepartment`
  (valid creation, duplicate name rejected, duplicate code rejected),
  `updateDepartment` (field updates, cross-org rejected).
- `tests/category-admin-service.test.js` (Vitest): 8 tests covering
  `listCategories` (results with counts, search filter, isActive filter),
  `createCategory` (valid creation, duplicate name rejected), `updateCategory`
  (field updates, toggle isActive, cross-org rejected, duplicate name
  during update rejected).
- `tests/tag-admin-service.test.js` (Vitest): 8 tests covering
  `listTags` (results with usage counts, search filter), `createTag`
  (valid creation, duplicate name rejected), `deleteTag` (hard delete,
  non-existent rejected, cross-org rejected).
- `tests/sla-config-service.test.js` (Vitest): 10 tests covering
  `listSLAConfigs` (ordered by priority), `getSLAConfig` (authorized,
  non-existent, cross-org), `createSLAConfig` (valid, resolution < response
  rejected, duplicate priority rejected), `updateSLAConfig` (field updates,
  cross-field validation, non-existent, cross-org).
- `tests/dashboard-service.test.js` (Vitest): 2 tests covering
  `getDashboardStats` (comprehensive stats with all counters, recent
  tickets retrieval).
- `tests/admin-validation.test.js` (Vitest): 18 tests covering all
  Zod schemas — `createUserSchema` (valid, missing required fields,
  invalid role, short password), `updateUserSchema` (partial, empty),
  `createDepartmentSchema` (valid, missing required), `createCategorySchema`
  (valid, missing name), `createTagSchema` (valid, missing name),
  `createSLAConfigSchema` (valid, invalid priority, non-numeric times),
  `updateOrgSettingsSchema` (partial, timezone).
- `tests/admin-api-routes.test.js` (Vitest): 8 tests covering auth
  guards (403 for non-admin, 401 for unauthenticated) and successful
  responses (users list, user creation, dashboard stats, departments,
  categories, tags, SLA configs).

Results of running these are recorded in `PROGRESS.md`.

## Phase 11 status

- `tests/security-edge-cases.test.js` (Vitest): 16 tests covering
  security surface area:
  - Cross-organization data isolation (4 tests): user cannot access
    other org's ticket, agent cannot update other org's ticket, admin
    cannot assign other org's ticket, admin cannot deactivate other
    org's user.
  - USER role restrictions at service layer (2 tests): USER cannot
    assign tickets (service validates target agent role), USER list
    tickets filters by requesterId.
  - Role-based access control (4 tests): AGENT can update tickets in
    their org, ADMIN can update tickets in their org, ADMIN cannot
    deactivate last admin, ADMIN can deactivate other admins.
  - Ticket lifecycle protection (2 tests): cannot transition from
    CLOSED status, cannot skip lifecycle states.
  - Authentication and authorization (4 tests): requireAuth returns
    response for missing token, requireAuth returns user for valid
    token, requireAdmin returns 403 for non-admin, requireAdmin
    allows ADMIN role.
  - Data isolation in queries (2 tests): list tickets filters by
    organization, USER list tickets filters by requesterId.

Results of running these are recorded in `PROGRESS.md`.
