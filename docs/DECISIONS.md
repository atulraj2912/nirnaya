# NIRNAYA — Architectural Decisions

Record of decisions that resolve ambiguity or unspecified detail in
`NIRNAYA_MASTER_SPEC.md`, per spec §40 ("if requirements conflict, do
not silently choose one; identify the conflict and explain it").
Newest entries at the top.

---

## D-015 — Security hardening, validation, regression, and UX polish (Phase 11)

**Context:** Phase 11 implements "Security hardening, validation, regression testing
and UX polish" per spec §36. The spec does not define exact patterns for auth
standardization, UI error state strategy, pagination bounds, or regression test
scope.

**Decision:**

1. **Auth pattern standardization.** All API routes now use a single consistent
   pattern: `const { user, response } = await requireAuth(request); if (response) return response;`
   for authenticated endpoints, and `requireAdmin(request)` for admin-only routes.
   Both return `{ user, response }` — never `{ error }`. This eliminates the
   mixed patterns found during audit (some routes used destructured `error`, some
   used `user` directly).

2. **Pagination bounds.** All list endpoints enforce `Math.min(100, Math.max(1, ...))`
   on the `limit` query parameter. This prevents unbounded queries (1-100 range).
   Applied to: tickets, users, departments, categories, tags, comments, activity,
   and notifications endpoints.

3. **UI error state strategy.** Components use conditional rendering: show error
   state with retry button when `error` state is set, show empty state with icon
   when data array is empty, show loading skeleton during fetch. The `notification-list.jsx`
   accepts an `error` prop; `notification-bell.jsx` and `ticket-detail.jsx` use
   local error state with retry handlers.

4. **Socket connection status.** `useSocketStatus()` hook exposed from
   `use-realtime.js` returns `{ connected, reconnecting }` derived from Socket.IO
   client events. Header shows colored status dot: green (Connected), gray (Offline),
   amber (Reconnecting...).

5. **Regression test scope.** Security edge-case tests focus on:
   - Cross-organization data isolation (4 tests)
   - USER role restrictions at service layer (2 tests)
   - Role-based access control for AGENT and ADMIN (4 tests)
   - Ticket lifecycle protection (2 tests)
   - Authentication and authorization helpers (4 tests)
   - Data isolation in queries (2 tests)
   Total: 16 tests covering the security surface area without duplicating
   existing unit tests.

6. **`react-hooks/set-state-in-effect` lint compliance.** Admin pages (Phase 10)
   were refactored from `useCallback` + `useEffect` pattern to inline `useEffect`
   with `cancelled` flag and `refreshKey` counter for manual refresh. This
   eliminates the lint error of calling setState synchronously within an effect
   while preserving the same UX behavior.

**Rationale:**
- Standardized auth pattern reduces cognitive load and prevents subtle bugs
  from inconsistent error handling across 30+ routes.
- Pagination bounds are a basic DoS prevention measure.
- UI error states improve user experience without requiring additional state management.
- Security tests provide regression coverage for the most critical attack vectors.

**Context:** Phase 10 requires admin dashboard, analytics, and administrative
UI per spec §32. The spec defines organizational management, user administration,
category/tag management, SLA configuration, and platform settings but does not
specify exact service boundaries, admin validation rules, or last-admin protection
strategies.

**Decision:**

1. **Service-per-resource pattern for admin CRUD.** Each admin-managed entity
   (users, departments, categories, tags, SLA configs) has its own dedicated
   service file (`user-admin-service.js`, `department-service.js`, etc.) rather
   than a monolithic admin service. This follows the existing pattern from
   Phase 4 (`ticket-service.js`) and Phase 9 (`comment-service.js`,
   `watcher-service.js`) where each domain area has its own service with
   clear responsibility boundaries.

2. **Last-admin protection.** When updating or deactivating a user with
   ADMIN role, the service checks if they are the last ACTIVE admin in
   the organization. If so, the operation is rejected with a clear error
   message. This prevents accidental lockout from administrative functions.
   The check is: `count(ADMIN where ACTIVE) <= 1 && existing.role === "ADMIN"`.

3. **Tag hard delete, category soft delete.** Tags use hard delete (`prisma.tag.delete`)
   since the Tag model has no `isActive` field and tags are lightweight metadata.
   Categories use soft delete (`isActive = false`) since the Category model has
   `isActive` and categories are referenced by tickets. This preserves data
   integrity for historical ticket categorization.

4. **Dashboard stats via aggregation service.** Rather than having each admin page
   fetch its own stats, a centralized `dashboard-service.js` aggregates all
   statistics (ticket counts, SLA status, user/dept/category/tag totals) in a
   single efficient query set. The dashboard page fetches from a single
   `GET /api/admin/dashboard` endpoint.

5. **Zod validation schemas in dedicated file.** All admin mutation schemas are
   co-located in `src/lib/validation/admin.js` rather than scattered across
   service files. This follows the Phase 4 pattern (`src/lib/validation/ticket.js`)
   and keeps validation logic centralized and testable.

6. **Sidebar role-based filtering.** The Administration nav section is only visible
   to users with ADMIN role. This is a client-side filter (not a server guard)
   since the sidebar is a purely presentational component. All admin API routes
   independently enforce ADMIN role via `requireAdmin(request)`.

---

## D-013 — Comments, watchers and activity timeline architecture (Phase 9)

**Context:** Phase 9 requires comments, watchers, and activity timeline
per spec §14-§16. The spec defines comment visibility rules, watcher
operations, and activity timeline content, but does not specify exact
service boundaries, notification routing for comments, or whether the
activity timeline requires a dedicated model.

**Decision:**

1. **Activity timeline assembled from existing persisted data.** Per
   spec §16 ("Reuse existing domain history such as TicketAssignmentHistory,
   timestamps, comments, notifications, existing persisted AI prediction
   information. Avoid creating a duplicate generic audit model unless there
   is a strong architectural reason."), the timeline is built by querying
   existing domain entities (comments, assignment history, ticket timestamps)
   rather than creating a new Activity/Audit model. This avoids schema
   bloat while satisfying the specification.

2. **Comment service handles notification routing.** The comment service
   (`src/lib/services/comment-service.js`) handles notification creation
   for new comments rather than delegating to a separate orchestrator.
   This keeps the comment domain cohesive. Notifications are sent to:
   - ticket requester (if not the comment author)
   - all watchers (if not the comment author)
   Internal comments do NOT generate notifications for users who cannot
   see them (USER role), per spec §14.

3. **SLA response satisfaction integrated at comment creation boundary.**
   `satisfyResponseSLA()` is called from `createComment()` for PUBLIC
   comments by AGENT/ADMIN users, per spec §20. The call is
   fire-and-forget to avoid blocking comment creation on SLA failures.
   The SLA service's own idempotency (already satisfied = no-op) ensures
   correctness.

4. **Watcher permissions follow spec §15 rules.** USER can only watch
   tickets they created (requester). AGENT/ADMIN can watch any
   organization ticket they can access. Adding yourself as watcher is
   always allowed. Adding other users requires AGENT/ADMIN role. All
   watcher operations validate org isolation server-side.

5. **Comment visibility enforced server-side.** The comment list API
   filters INTERNAL comments before returning to USER role clients.
   The comment get API returns 404 for INTERNAL comments when accessed
   by USER. This follows spec §14's requirement that "Internal comments
   must never leak through REST responses."

6. **No comment edit/delete in V1.** Spec §14 does not explicitly require
   comment editing or deletion capabilities. The implementation provides
   create and read only, keeping V1 scope controlled. This can be added
   later if the spec is explicitly extended.

7. **Activity timeline does not expose internal comments to USER.**
   The activity service filters out INTERNAL comment entries when the
   requesting user has USER role, per spec §16 ("USER must not receive
   internal activity that reveals internal-only information").

---

## D-012 — SLA engine architecture (Phase 7)

**Context:** Phase 7 requires SLA tracking per spec §20-21. The spec
defines two independent SLA clocks (response and resolution), warning
thresholds, and lifecycle behaviors, but does not specify the exact
service architecture or evaluation mechanism.

**Decision:**

1. **Elapsed-time only.** Both SLA clocks use elapsed time from ticket
   creation (`createdAt + targetMinutes`). Business-hours calculation
   is not implemented. The UI explicitly documents "Elapsed time only —
   business hours not applied" per spec §20 which says business-hours
   is optional and the MVP can use elapsed time.

2. **Derived status from ticket fields.** `computeSLAInfo()` derives
   response/resolution status from the ticket's existing fields
   (`responseSlaStatus`, `resolutionSlaStatus`, `firstRespondedAt`,
   `waitingSince`, `status`). This avoids redundant computation and
   keeps the source of truth in the database.

3. **Fire-and-forget SLA hooks.** SLA initialization, pause, resume,
   completion, and recalculation are called via `.catch()` on promises
   in the ticket service. SLA failures never prevent ticket operations
   from succeeding. This follows the same pattern as AI classification
   (D-010).

4. **No proactive breach scan yet.** The spec does not specify how
   WARNING/BREACHED transitions are detected proactively. Per D-000
   item 4, a periodic scan will be added in Phase 8 using the
   persistent Node.js process. For now, `evaluateAndPersistSLA()` is
   called on-demand when SLA info is requested via the API.

5. **Response SLA satisfied by comment creation.** `satisfyResponseSLA()`
   is ready for integration with the comment creation endpoint (Phase 9).
   It checks author role (AGENT/ADMIN) and sets `firstRespondedAt`. No
   comments API exists yet, so the function is exported but not yet
   called from any route.

6. **Priority change recalculates from original createdAt.** Per spec
   §21, when priority changes, the resolution due time is recalculated
   as `createdAt + newPriorityConfig.resolutionTimeMinutes`. The
   existing elapsed time is used to determine if the new deadline is
   breached.

7. **Reopen resets resolution clock.** Per spec §21, reopening a ticket
   resets the resolution SLA to ON_TRACK and recalculates the deadline
   from the original creation time.

---

## D-011 — Agent recommendation architecture (Phase 6)

**Context:** Phase 6 requires intelligent agent assignment recommendation
per spec §18. The spec defines specific scoring factors, weights, tie-breaking
rules, and a confidence formula, but does not specify the exact service
architecture or whether recommendations should persist.

**Decision:**

1. **Deterministic database-driven scoring.** The recommendation engine
   computes scores entirely from database data (eligible agents, workload,
   experience). No external AI provider is called. This satisfies the
   spec's requirement that "fallback behavior must still be real
   deterministic logic" and avoids dependency on AI availability for
   assignment recommendations.

2. **Service layer in `src/lib/services/agent-recommendation-service.js`.**
   All business logic lives in the service layer, not in route handlers.
   The service handles eligibility filtering, workload calculation,
   experience lookup, scoring, confidence calculation, and explanation
   generation.

3. **No recommendation persistence.** Spec §18 does not require storing
   recommendations in the database. Recommendations are computed on
   demand from current data. This avoids stale recommendation issues
   and keeps the schema unchanged. The existing `AIPrediction` model
   already has `recommendedAgentId`, `assignmentScore`, and
   `assignmentConfidence` fields that can be used if persistence is
   later required.

4. **Sequential queries.** `calculateWorkloads` and `calculateExperience`
   run sequentially rather than via `Promise.all`. While `Promise.all`
   would be faster in production, sequential execution ensures
   predictable mock behavior in tests and clearer error isolation.

5. **Confidence formula implemented exactly as specified (D-002).**
   The formula uses gapRatio, base, candidate-count bonus, quality
   bonus, and clamps to 0.50–0.98. Tests assert the mathematical
   behavior consistent with D-002's analysis.

6. **Assignment recommendation is separate from assignment.** The
   recommendation endpoint (`GET /recommendations`) only returns ranked
   candidates. Actual assignment uses the existing `POST /assign`
   endpoint, which revalidates eligibility per spec §19.

---

## D-010 — AI classification architecture (Phase 5)

**Context:** Phase 5 requires AI-powered ticket classification with a
provider-agnostic abstraction. The Master Spec §17 specifies the
classification input/output but does not specify the exact architecture.

**Decision:**

1. **Provider abstraction in `src/lib/ai/`.** The `BaseProvider` class
   defines the `classify()` interface. Providers register themselves via
   `registerProvider()` and are resolved by name from the `AI_PROVIDER`
   env var. This allows swapping providers without changing route handlers
   or UI.

2. **Deterministic mock provider.** The mock provider uses keyword
   analysis to classify tickets into the 8 known categories. It is not
   a random stub — it produces real deterministic output based on
   ticket content, per spec §17's requirement that "fallback behavior
   must still be real deterministic logic."

3. **Non-blocking auto-classification.** Ticket creation triggers
   classification via fire-and-forget (`.catch()` on the promise).
   Classification failure never prevents ticket creation from succeeding.
   This follows the principle that AI is best-effort and should not
   degrade core functionality.

4. **Zod validation at boundaries.** Input is validated before sending
   to provider. Output is validated and normalized after receiving from
   provider. NaN, Infinity, empty strings, and oversized text are
   handled safely.

5. **AIPrediction model used as-is.** The existing schema has all
   required fields (predictedCategoryId, predictedPriority,
   predictedDepartmentId, confidence, explanation, suggestedNextSteps).
   The model does not have provider/model metadata fields — this is
   acceptable for Phase 5 since the spec does not explicitly require
   storing provider identity in the prediction record. If needed later,
   the schema can be extended.

6. **Manual classification via API.** AGENT/ADMIN can trigger
   classification via `POST /api/tickets/[id]/classify`. This supports
   re-classification and manual workflows.

---

## D-008 — jose 6.x key format and test environment (Phase 3)

**Context:** jose 6.x enforces strict key type checking via
`instanceof Uint8Array`. In jsdom (used by Vitest), the global
`Uint8Array` polyfill differs from Node.js's native `Uint8Array`,
causing `Buffer` instances (which extend `Uint8Array`) to be rejected
with "Key for the HS256 algorithm must be one of type CryptoKey,
KeyObject, JSON Web Key, or Uint8Array."

**Decision:**

1. **Use `crypto.subtle.importKey` for JWT signing/verification.**
   Instead of passing raw `Uint8Array` or `Buffer` to `jose.sign()`,
   import the secret as a proper `CryptoKey` via Web Crypto API:
   ```js
   crypto.subtle.importKey("raw", encoder.encode(secret),
     { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
   ```
   This produces a native `CryptoKey` that jose accepts regardless of
   the test environment's global scope quirks.

2. **No jose mock needed in tests.** Because `CryptoKey` is a native
   Node.js object (not polyfilled by jsdom), the real jose library
   works correctly in both production and test environments.

3. **Environment variable mocking.** Tests mock `@/lib/env` to provide
   `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values, since the real
   env.js validates against `process.env` which lacks these in the
   test environment.

---

## D-009 — Ticket service layer architecture (Phase 4)

**Context:** Phase 4 requires centralized ticket business logic that
enforces lifecycle rules, organization isolation, and role-based access
across all API routes.

**Decision:**

1. **Single service file pattern.** All ticket CRUD, status transitions,
   assignment, and listing logic lives in `src/lib/services/ticket-service.js`.
   This keeps the ticket domain cohesive and avoids circular dependencies
   between multiple service files.

2. **Centralized lifecycle validator.** `src/lib/services/lifecycle.js`
   contains the transition table from D-006 as a static lookup, with
   `canTransition()`, `getAllowedTransitions()`, and `isTerminal()`.
   This is the single source of truth for status transition rules.

3. **TicketError class.** Custom error class with HTTP status codes
   allows API routes to map service-layer errors to responses without
   try/catch gymnastics.

4. **Server-controlled timestamps.** Status transitions set their
   corresponding timestamp fields (resolvedAt, closedAt, waitingSince)
   in the service layer, not in route handlers. This prevents clients
   from manipulating these fields.

5. **Assignment auto-transition.** When a ticket in OPEN status is
   assigned to an agent, the service automatically transitions it to
   ASSIGNED, per D-006's requirement that ASSIGNED is mandatory before
   IN_PROGRESS.

6. **Zod validation at service boundary.** Input validation happens at
   the service entry point (not in route handlers), ensuring consistent
   validation regardless of how the service is called.

---

## D-007 — Prisma schema and seed approach (Phase 2)

**Context:** Spec §28 says "The original project used Prisma db push
intentionally rather than a migrations directory for the showcase
build. If the implementation chooses migrations later, document the
decision first." Phase 2 requires the complete V1 domain schema and
seed infrastructure.

**Decision:**

1. **Schema approach: `prisma db push`** (not migrations). The original
   project used `db push` intentionally for the showcase build, and
   the Supabase-hosted database may already contain data from prior
   work. Using `db push` avoids creating a migrations directory that
   would conflict with an existing database state. This is documented
   here per spec §28.

2. **Seed idempotency.** The seed script (`prisma/seed.js`) uses
   `findFirst` checks before every `create` to ensure it is safe to
   run repeatedly without duplicating data. Tickets are created only
   if zero tickets exist for the organization. Comments and assignment
   history are created only if the respective tables are empty.

3. **Ticket numbering.** Uses atomic counter increment on the
   Organization model (`ticketCounter`) to generate collision-free
   ticket numbers in NIR-YYYY-000001 format. The counter is
   incremented in a single `update` call before creating tickets.

4. **Self-referential User relations.** The User model has
   `createdBy`/`updatedBy` fields that reference other Users (for
   audit trails on Departments, Tickets, etc.). These use named
   relations (`UserCreatedBy`/`UserUpdatedBy`) with reverse fields
   (`createdUsers`/`updatedUsers`) to satisfy Prisma's requirement
   that both sides of a relation are defined.

5. **No migration directory created.** Consistent with the original
   project's approach and the Supabase-hosted database context.

---

## D-006 — Ticket lifecycle transition rules (Phase 0, pre-Phase 4)

**Context:** Spec §12 draws the canonical lifecycle path but does not
fully specify every edge case (e.g. whether `ASSIGNED` can be skipped,
what causes `WAITING_FOR_USER → IN_PROGRESS`).

**Decision:** The explicit transition table for Phase 4 is:

```
OPEN            → ASSIGNED
ASSIGNED        → IN_PROGRESS
IN_PROGRESS     → WAITING_FOR_USER
WAITING_FOR_USER→ IN_PROGRESS
IN_PROGRESS     → RESOLVED
RESOLVED        → CLOSED
RESOLVED        → REOPENED
REOPENED        → IN_PROGRESS
```

- `ASSIGNED` is mandatory before `IN_PROGRESS` — a ticket cannot enter
  `IN_PROGRESS` without an assigned agent.
- `WAITING_FOR_USER → IN_PROGRESS` (resume) happens only through an
  explicit AGENT/ADMIN action. A USER public comment does **not**
  automatically change ticket state or resume the SLA resolution
  clock.
- `CLOSED` remains terminal, exactly as specified.

This will be enforced server-side by an explicit transition-table
check in Phase 4, not inferred implicitly from other fields.

---

## D-005 — Testing toolchain: Vitest + React Testing Library + Playwright

**Context:** Spec §34 mandates comprehensive testing but does not name
a test runner.

**Decision:** Vitest + React Testing Library for unit/service/component
tests; Playwright for end-to-end regression flows. Configured in
`vitest.config.js`, `vitest.setup.js`, `playwright.config.js`.

---

## D-004 — Invitation model and email-based onboarding excluded from V1

**Context:** Spec §27 lists "invitation-related data where required"
among the core models, but the frozen stack (§3) names no email/SMTP
provider, and the UI list (§32) has no invitation screen.

**Decision:** V1 has no `Invitation` model and no email-invite flow.
Admin-created users (via the admin user-management UI in Phase 10) are
sufficient for V1. No email provider is introduced solely to support
invitations. This may be revisited in a future version if the spec is
explicitly extended.

---

## D-003 — Attachment model and workflow excluded from V1

**Context:** Spec §27 lists "attachment-related data where required"
among the core models, but §42.6 explicitly says attachments are out
of scope unless explicitly included, and no other section (UI list in
§32, API list in §30) references attachments.

**Decision:** No `Attachment` model, no file-upload/storage workflow in
V1. Will only be added if the specification is later explicitly
changed to require it.

---

## D-002 — Assignment confidence formula: implemented exactly as
specified; a known numeric inconsistency in the worked examples is
preserved, not silently corrected

**Context:** Spec §18 defines:

```
gapRatio = (topScore - runnerUpScore) / max(topScore, 1)
base     = 0.35 + gapRatio * 0.50
final    = base + candidateCountBonus(≤0.08) + qualityBonus(≤0.05)
final    = clamp(final, 0.50, 0.98)
```

Checking the worked examples against this formula:

| Scores  | gapRatio | base   | base + max bonus (0.13) | Spec's expected value |
|---------|----------|--------|--------------------------|------------------------|
| 48 v 47 | 0.0208   | 0.360  | 0.490                    | ~0.50 ✅ (consistent) |
| 60 v 59 | 0.0167   | 0.358  | 0.488                    | ~0.50 ✅ (consistent) |
| 60 v 40 | 0.333    | 0.517  | 0.647                    | ~0.63 ✅ (consistent) |
| 80 v 40 | 0.500    | 0.600  | 0.730                    | ~0.68 ✅ (consistent, mid-range bonus) |
| 90 v 20 | 0.778    | 0.739  | **0.869 (max possible)** | ~0.93 ❌ (unreachable) |

The 90-vs-20 example expects ~0.93, but even at the maximum possible
bonus (+0.13), the formula as specified can only reach ~0.869. This is
a genuine mathematical inconsistency between the formula and its own
worked example — not an implementation bug.

**Decision (per explicit instruction):** Implement the formula exactly
as specified in §18, including the 0.50–0.98 bound and the stated
bonus caps. Do **not** alter the formula's constants to force the
90-vs-20 example to reach 0.93. Unit tests in Phase 6 will assert the
formula's actual mathematical behavior (consistent with the other four
examples) and will explicitly document that the 90-vs-20 case is
expected to land near ~0.87, not ~0.93, with a comment pointing back to
this entry. If this is later clarified upstream, this decision will be
revisited.

---

## D-001 — AI provider: no provider selected yet; pluggable service
abstraction only

**Context:** Spec §17/§18 requires "an actual AI provider when
configured" plus a real deterministic fallback, but names no specific
provider.

**Decision:** No AI provider is selected or hardcoded in Phase 0. The
provider decision will be made before Phase 5 (AI ticket
classification). Phase 0/1 architecture reserves a
`lib/services/ai-classification-service.js` /
`lib/services/ai-assignment-service.js` seam (not yet implemented) so
that whichever provider is chosen later plugs in behind a stable
interface without touching route handlers or UI. This does not block
Phase 0.

---

## D-000 — Phase 0 implementation-level decisions

1. **Prisma toolchain vs. domain schema.** `prisma/schema.prisma`
   contains only the `datasource`/`generator` blocks in Phase 0 (with
   `directUrl` reserved for Supabase's pooled + direct connection
   strings). Domain models are a Phase 2 deliverable per spec §36 and
   are intentionally not created yet.

2. **Custom server for Socket.IO deferred to Phase 8.** The frozen
   stack requires Socket.IO, which needs a persistent Node process
   rather than stateless App Router route handlers. Phase 0 installs
   `socket.io`/`socket.io-client` as declared dependencies but does not
   introduce a custom `server.js` yet — `next dev`/`next start` remain
   the entry points until Phase 8 ("Notifications and realtime"),
   avoiding infrastructure ahead of the phase that needs it. See
   `ARCHITECTURE.md` for the planned Phase 8 server design (the same
   process will also host the periodic SLA warning/breach scan — see
   item 4).

3. **`create-next-app --empty` template used** to avoid the default
   marketing/demo homepage, consistent with "do not create fake/demo
   application data or screens." The bootstrap homepage
   (`src/app/page.js`) only confirms the app runs; it is not a product
   screen.

4. **SLA breach/warning detection mechanism (planned, Phase 7/8).**
   The spec does not say how WARNING/BREACHED transitions are detected
   proactively. Plan: reuse the Phase 8 persistent Node process (see
   item 2) to run a periodic in-process scan rather than introducing a
   separate queue/cron system, keeping infrastructure minimal per spec
   §3's ban on unnecessary infrastructure.

5. **`npm audit` finding (informational, not fixed).** Installing
   `prisma@6.19.3` pulls in `@prisma/config`, which currently depends
   on a vulnerable `deepmerge-ts` range (stack-exhaustion DoS advisory
   GHSA-ggr8-5vv4-36mx). This is a transitive *dev-tool* dependency of
   the Prisma CLI's config merging, not code that runs in the shipped
   application. `npm audit fix --force` would downgrade `prisma` below
   the version pinned to satisfy "Prisma 6.x," which is a worse
   trade-off than the advisory itself. Left as-is; will be revisited
   if Prisma ships a patched release, or re-evaluated if it turns out
   to affect runtime code paths.

6. **Next.js version.** `create-next-app@latest` installed Next.js
   16.3.4 (with React 19.2.8), which satisfies "Next.js with App
   Router" and "React 19.x" — no version was pinned by the spec beyond
   the major React version. Flagging that 16.x is a very recent major
   version; if a later phase hits an ecosystem-compatibility issue,
   pinning to an earlier Next 15.x LTS-style release is the fallback,
   to be recorded here if it happens.

7. **`prisma` CLI package kept as a devDependency**, `@prisma/client`
   as a runtime dependency — only the generated client is needed at
   runtime.
