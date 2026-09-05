# NIRNAYA — Progress

## Current phase: Phase 2 — complete and verified

## Completed phases

### Phase 2 — Prisma schema, database connection, seed infrastructure

**What was implemented:**

- Complete Prisma schema (`prisma/schema.prisma`) with all 14 V1 domain
  models and 9 enums per the master specification (§6–§27):
  - **Enums:** Role, UserStatus, TicketPriority, TicketType,
    TicketSource, TicketStatus, CommentVisibility, SLAStatus,
    NotificationType
  - **Models:** Organization, Department, User, Ticket, Category, Tag,
    TicketTag, Comment, Notification, AIPrediction,
    TicketAssignmentHistory, Watcher, SLAConfiguration, SavedReply
  - All required composite unique constraints (Department: org+name,
    org+code; User: org+username, org+email, org+employeeId;
    TicketTag: ticket+tag; Watcher: ticket+user; SLAConfiguration:
    org+priority; Category: org+name; Tag: org+name)
  - All required indexes for organization scoping, role/status
    filtering, and relationship lookups
  - Foreign key relationships with appropriate onDelete behaviors
    (Cascade for owned resources, Restrict for required user
    references, SetNull for optional audit fields)
  - SLA tracking fields on Ticket (server-controlled per spec §21)
  - Atomic ticket counter on Organization for collision-free numbering
- Prisma client singleton (`src/lib/db/prisma.js`) with global cache
  pattern for development hot-reload safety
- Idempotent seed script (`prisma/seed.js`) that creates:
  - One organization (Acme Corporation)
  - 5 departments (IT Support, Network Operations, Software
    Engineering, Human Resources, Finance)
  - 6 users across all 3 roles (1 ADMIN, 3 AGENTs, 2 USERs)
  - 8 categories (NETWORK, HARDWARE, SOFTWARE, EMAIL, ACCOUNT,
    DATABASE, SECURITY, INFRASTRUCTURE)
  - 8 tags for flexible ticket classification
  - 4 SLA configurations (one per priority level)
  - 6 sample tickets across different statuses
  - Watchers, comments (PUBLIC + INTERNAL), assignment history,
    and saved replies
  - Test credentials logged after seeding
- Updated `package.json` with `prisma:seed` script and Prisma seed
  configuration
- Updated `.env.example` with `SEED_ADMIN_PASSWORD` variable
- Phase 2 unit tests:
  - `tests/schema.test.js` — validates schema structure (datasource,
    enums, models, constraints, indexes, onDelete behaviors)
  - `tests/prisma-client.test.js` — validates singleton pattern
  - `tests/seed.test.js` — validates seed script structure (ESM,
    idempotency, bcrypt, required data)

**Files changed/created:**

| File | Action |
|---|---|
| `prisma/schema.prisma` | Modified (complete V1 domain models) |
| `prisma/seed.js` | Created |
| `src/lib/db/prisma.js` | Created |
| `package.json` | Modified (seed script, prisma config) |
| `.env.example` | Modified (SEED_ADMIN_PASSWORD) |
| `.env` | Modified (SEED_ADMIN_PASSWORD) |
| `tests/schema.test.js` | Created |
| `tests/prisma-client.test.js` | Created |
| `tests/seed.test.js` | Created |

**Tests run:**

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass (1 warning: avatar `<img>`, acceptable) |
| Prisma schema validation | `npx prisma validate` | ✅ valid |
| Prisma client generation | `npx prisma generate` | ✅ generated (v6.19.3) |
| Unit tests | `npm run test` (Vitest) | ✅ 94/94 passed |
| Production build | `npm run build` | ✅ compiled, 15 routes generated |

**Known limitations / not yet done (by design — later phases):**

- Database migration not yet applied (requires network access to
  Supabase; run `npx prisma db push` or create a migration when
  connected).
- Seed script not yet executed (requires live database; run
  `npx prisma db seed` after migration).
- No authentication/authorization code yet (Phase 3). Login form is
  disabled placeholder only.
- No ticket/comment/SLA/AI/notification/realtime logic yet (Phases 4–9).
- No custom `server.js`/Socket.IO wiring yet — deferred to Phase 8.
- `npm audit` findings from Phase 0 remain (transitive dev-tool
  dependency; not remediated — see DECISIONS.md D-000 item 5).

## Next phase

**Phase 3** — Authentication and authorization (per spec §36). Awaiting
go-ahead.

---

### Phase 1 — Next.js foundation, dependencies, environment configuration, base UI structure

**What was implemented:**

- Server-side environment validation (`src/lib/env.js`) using Zod 4.x,
  with fail-fast validation of all required env vars (DATABASE_URL,
  DIRECT_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET) and optional
  AI_PROVIDER/AI_PROVIDER_API_KEY. Separates public vs server-only
  variables; only importable from server-side code.
- Tailwind CSS 4 theme tokens (`src/app/globals.css`) — primary, success,
  warning, danger color scales; surface/border/text colors; font families;
  shadow definitions. Uses Tailwind 4's `@theme` directive.
- Base UI component library (`src/components/ui/`):
  - `button.jsx` — primary/secondary/danger/ghost variants, sm/md/lg sizes
  - `card.jsx` — Card, CardHeader, CardContent, CardFooter
  - `input.jsx` — label, error state, accessible
  - `badge.jsx` — color-coded status badges (primary/success/warning/danger/neutral)
  - `avatar.jsx` — image or initials fallback
- App shell layout (`src/components/layout/`):
  - `sidebar.jsx` — full sidebar with nav sections (Overview, Tickets,
    Administration), active-route highlighting, user placeholder
  - `header.jsx` — top bar with notification bell placeholder
  - `app-shell.jsx` — combines sidebar + header + content area
- Route groups established:
  - `(auth)/login/page.js` — login form (disabled, placeholder for Phase 3)
  - `(auth)/layout.js` — centered auth layout without sidebar
  - `(dashboard)/dashboard/page.js` — dashboard with stat cards
  - `(dashboard)/tickets/page.js` — ticket list placeholder
  - `(dashboard)/tickets/new/page.js` — ticket creation placeholder
  - `(dashboard)/tickets/mine/page.js` — my tickets placeholder
  - `(dashboard)/admin/users/page.js` — user management placeholder
  - `(dashboard)/admin/departments/page.js` — department mgmt placeholder
  - `(dashboard)/admin/categories/page.js` — category mgmt placeholder
  - `(dashboard)/admin/tags/page.js` — tag mgmt placeholder
  - `(dashboard)/admin/sla/page.js` — SLA config placeholder
  - `(dashboard)/admin/settings/page.js` — settings placeholder
- Root `src/app/page.js` redirects to `/login` via `next/navigation`
  `redirect()`.
- Health endpoint updated from `phase-0` to `phase-1`.
- Updated `vitest.setup.js` with proper DOM cleanup between tests.
- Updated `vitest.config.mjs` to support `.jsx` test files and `@/*`
  path alias.
- Added Phase 1 unit tests:
  - `tests/health.test.js` — updated to assert `phase: "phase-1"`
  - `tests/env.test.js` — Zod schema validation tests (valid env,
    missing fields, short secrets, defaults)
  - `tests/components.test.jsx` — Button, Card, Badge, Avatar rendering
    and behavior tests
- Updated `e2e/smoke.spec.js` — login page, dashboard page, and
  redirect tests

**Tests run:**

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass (1 warning: avatar `<img>`, acceptable) |
| Unit tests | `npm run test` (Vitest) | ✅ 14/14 passed |
| Production build | `npm run build` | ✅ compiled, 15 static + dynamic routes generated |

---

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
  `docs/DECISIONS.md`.

**Tests run:**

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass, no issues |
| Prisma schema syntax | `npx prisma validate` | ✅ valid |
| Prisma client generation | `npx prisma generate` | ✅ generated |
| Unit/toolchain smoke test | `npm run test` (Vitest) | ✅ 1/1 passed |
| Production build | `npm run build` | ✅ compiled, static + `/api/health` routes generated |
| End-to-end smoke test | `npm run test:e2e` (Playwright) | ✅ 1/1 passed |
