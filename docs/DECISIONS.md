# NIRNAYA — Architectural Decisions

Record of decisions that resolve ambiguity or unspecified detail in
`NIRNAYA_MASTER_SPEC.md`, per spec §40 ("if requirements conflict, do
not silently choose one; identify the conflict and explain it").
Newest entries at the top.

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
