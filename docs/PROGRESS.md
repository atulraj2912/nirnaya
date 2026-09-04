# NIRNAYA — Progress

## Current phase: Phase 0 — complete and verified

## Completed phases

### Phase 0 — Repository/environment inspection and project bootstrap

**Inspection result:** repository was a completely empty git repo (no
commits, no branches, no files besides `.git/`) — confirmed via `git
status`/`git log` and via the GitHub API (empty-repo error on
`get_file_contents`). No prior NIRNAYA code existed to reconcile with,
and the unrelated `nirnaya01/emergency` project was not referenced.

**What was implemented:**

- Next.js (App Router, JavaScript only) scaffolded via
  `create-next-app@latest --empty` (no demo/marketing homepage) into
  `src/app`, with `src/` layout and `@/*` import alias (`jsconfig.json`
  — no TypeScript).
- Frozen-stack dependencies installed and pinned to the required major
  versions: Next.js 16.3.4, React 19.2.8, Prisma 6.19.3 (`@prisma/client`
  as a runtime dep, `prisma` CLI as a dev dep), Tailwind CSS 4,
  Zod 4.5.4, `@tanstack/react-query` 5.102.8, Socket.IO 4.8.3
  (server + client), `jose` 6.2.11, `bcrypt` 6.0.0.
- Testing toolchain: Vitest 5 + `@testing-library/react` +
  `@testing-library/jest-dom` + jsdom (`vitest.config.mjs`,
  `vitest.setup.js`), and Playwright `@playwright/test` 1.62
  (`playwright.config.js`).
- `prisma/schema.prisma` created with `datasource`/`generator` blocks
  only (`directUrl` reserved for Supabase's pooled + direct connection
  strings) — no domain models yet; those are Phase 2.
- `src/app/api/health/route.js` — a minimal toolchain smoke-test
  endpoint (not a product feature).
- `.env.example` with placeholders only, grouped by the phase that
  needs them (app/database/auth/AI), and `.gitignore` corrected so
  `.env`/`.env.*.local` are ignored while `.env.example` stays tracked.
- `package.json` updated: project metadata, `engines.node >= 22`,
  `dev`/`build`/`start`/`lint`/`test`/`test:watch`/`test:e2e`/
  `prisma:generate`/`prisma:validate`/`postinstall` scripts.
- `README.md` rewritten for the actual project (was create-next-app
  boilerplate).
- `docs/NIRNAYA_MASTER_SPEC.md`, `docs/ARCHITECTURE.md`,
  `docs/PROGRESS.md` (this file), `docs/TEST_PLAN.md`,
  `docs/DECISIONS.md` created.
- Ambiguities raised during planning were resolved and recorded in
  `docs/DECISIONS.md`: AI provider deferred to Phase 5 behind a
  pluggable service seam (D-001); assignment-confidence formula
  implemented exactly as specified, with the 90-vs-20 example's
  mathematical inconsistency documented rather than silently "fixed"
  (D-002); Attachment model excluded from V1 (D-003); Invitation model
  and email-invite flow excluded from V1 (D-004); Vitest/RTL/Playwright
  chosen as the test stack (D-005); explicit ticket-lifecycle
  transition table recorded, with `ASSIGNED` mandatory before
  `IN_PROGRESS` and manual-only resume from `WAITING_FOR_USER` (D-006).

**Files created/modified:** see the file list in the Phase 0 report
below (chat response) — everything under `prisma/`, `src/`, `tests/`,
`e2e/`, `docs/`, plus root config/toolchain files.

**Tests run:**

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass, no issues |
| Prisma schema syntax | `npx prisma validate` (transient dummy env vars, no real DB) | ✅ valid |
| Prisma client generation | `npx prisma generate` | ✅ generated |
| Unit/toolchain smoke test | `npm run test` (Vitest) | ✅ 1/1 passed |
| Production build | `npm run build` | ✅ compiled, static + `/api/health` routes generated |
| End-to-end smoke test | `npm run test:e2e` (Playwright, against the production build) | ✅ 1/1 passed |

**Known limitations / not yet done (by design — later phases):**

- No database connection, no domain models, no seed data (Phase 2).
- No authentication/authorization code yet (Phase 3).
- No ticket/comment/SLA/AI/notification/realtime logic yet (Phases 4–9).
- No custom `server.js`/Socket.IO wiring yet — deferred to Phase 8
  (see `DECISIONS.md`, D-000 item 2).
- `npm audit` reports 3 high-severity findings, all from the same
  transitive dev-tool dependency chain (`prisma` → `@prisma/config` →
  `deepmerge-ts`), not from runtime application code; not remediated
  because the suggested fix would downgrade Prisma below the required
  6.x pin (see `DECISIONS.md`, D-000 item 5).
- AI provider is not yet selected (by design — decision deferred to
  before Phase 5, per explicit instruction).

## Next phase

**Phase 1** — Next.js foundation, dependencies, environment
configuration, base UI structure (per spec §36). Awaiting go-ahead —
Phase 0 stops here per instruction.
