# NIRNAYA — Architecture

This document describes the technical architecture, directory
structure, data flow, and service boundaries. It is updated as each
phase lands real code; sections marked "(planned)" describe the
target shape for a phase that has not been implemented yet.

## Overview

NIRNAYA is a **single Next.js (App Router) application** — no separate
backend, no microservices. Next.js provides the frontend, the API
(route handlers), server-side business logic, authentication
integration, and database access (via Prisma). See
`docs/NIRNAYA_MASTER_SPEC.md` §3–§4 for the frozen stack and layering
rules this repository must not deviate from.

```
Browser (React 19 + Tailwind 4 + React Query 5)
        │  HTTP (cookies: access/refresh JWT)      │ WebSocket (planned, Phase 8)
        ▼                                           ▼
Next.js App Router route handlers        Socket.IO (planned, Phase 8,
  (auth, tickets, comments, ...)          hosted in a custom server.js)
        │
        ▼
Service layer (lib/services/*)  ──►  AI service abstraction (planned, Phase 5/6)
        │                             SLA engine (planned, Phase 7)
        ▼
Prisma Client  ──►  Supabase PostgreSQL
```

## Layering rules (enforced across all phases)

- **app routes/pages** (`src/app/**`) — composition and presentation
  only.
- **components** (`src/components/**`, introduced as phases need them)
  — reusable, presentational UI.
- **API route handlers** (`src/app/api/**/route.js`) — thin: parse
  request, call `authz` + service layer, return response. No large
  business rules live here.
- **authentication** (planned: `src/lib/auth/*`, Phase 3) — password
  hashing (bcrypt), JWT issuing/verification (jose), HTTP-only cookie
  handling.
- **authorization** (planned: `src/lib/authz/*`, Phase 3) —
  `requireAuth`, `requireRole`, `requireAdmin`, `requireAgentOrAdmin`,
  and organization-scoping helpers, used by every route handler that
  touches organization-owned data.
- **business/service logic** (planned: `src/lib/services/*`, from
  Phase 4 onward) — ticket lifecycle, comments, watchers, activity,
  notifications, assignment, etc. This is where spec rules actually
  live, not in components or route handlers (spec §4).
- **environment validation** (`src/lib/env.js`, Phase 1) — server-side
  only; Zod-validated env vars with fail-fast behavior. Must not be
  imported from client components.
- **database/Prisma** (`prisma/schema.prisma`, planned
  `src/lib/db/prisma.js` singleton client, Phase 2) — schema and
  connection only; no query logic beyond thin data-access use inside
  services.
- **validation** (planned: `src/lib/validation/*`, Zod schemas, from
  Phase 4 onward).
- **AI services** (planned: `src/lib/services/ai-classification-service.js`,
  `ai-assignment-service.js`, Phase 5/6) — provider-agnostic interface;
  see "AI provider abstraction" below.
- **SLA engine** (planned: `src/lib/services/sla-engine.js`, Phase 7).
- **notifications** (planned: `src/lib/services/notification-service.js`,
  Phase 8).
- **realtime/socket functionality** (planned: `src/lib/realtime/*` +
  custom `server.js`, Phase 8).

## Directory structure

Current (Phase 1):

```
/prisma
  schema.prisma               # datasource + generator only (no models yet)
/src
  /app
    layout.js                  # root HTML layout
    page.js                    # redirects to /login
    globals.css                # Tailwind 4 @theme tokens
    (auth)/
      layout.js                # centered auth layout (no sidebar)
      login/page.js            # login form placeholder (Phase 3)
    (dashboard)/
      dashboard/page.js        # dashboard with stat cards
      tickets/page.js          # ticket list placeholder
      tickets/new/page.js      # ticket creation placeholder
      tickets/mine/page.js     # my tickets placeholder
      admin/
        users/page.js          # user management placeholder
        departments/page.js    # department mgmt placeholder
        categories/page.js     # category mgmt placeholder
        tags/page.js           # tag mgmt placeholder
        sla/page.js            # SLA config placeholder
        settings/page.js       # settings placeholder
    /api
      /health/route.js         # toolchain smoke-test endpoint
  /components
    /ui/
      button.jsx               # primary/secondary/danger/ghost
      card.jsx                 # Card, CardHeader, CardContent, CardFooter
      input.jsx                # label, error state, accessible
      badge.jsx                # color-coded status badges
      avatar.jsx               # image or initials fallback
    /layout/
      sidebar.jsx              # nav sidebar with sections
      header.jsx               # top bar with notifications
      app-shell.jsx            # sidebar + header + content
  /lib
    env.js                     # server-side env validation (Zod)
/tests
  health.test.js               # Vitest — health endpoint
  env.test.js                  # Vitest — env validation schema
  components.test.jsx          # Vitest — UI components
/e2e
  smoke.spec.js                # Playwright — login, dashboard, redirect
/docs
  NIRNAYA_MASTER_SPEC.md
  ARCHITECTURE.md
  PROGRESS.md
  TEST_PLAN.md
  DECISIONS.md
.env.example
vitest.config.mjs / vitest.setup.js
playwright.config.js
next.config.mjs / jsconfig.json / eslint.config.mjs / postcss.config.mjs
```

Planned growth (later phases), not created yet:

```
/src
  /app
    (dashboard)/tickets/[id]/page.js             [Phase 4/9]
    /api/auth/{login,logout,refresh,me}/route.js  [Phase 3]
    /api/tickets/route.js                           [Phase 4]
    /api/tickets/[id]/route.js                       [Phase 4]
    /api/tickets/[id]/comments/route.js               [Phase 9]
    /api/tickets/[id]/watchers/route.js                [Phase 9]
    /api/tickets/[id]/activity/route.js                 [Phase 9]
    /api/notifications/*                                 [Phase 8]
    /api/users|departments|categories|tags/route.js       [Phase 10]
    /api/sla/route.js                                       [Phase 7]
    /api/ai/{classify,assignment-recommendation}/route.js    [Phase 5/6]
    /api/admin/**/route.js                                     [Phase 10]
  /lib
    /auth/{jwt,password,cookies,session}.js                       [Phase 3]
    /authz/{requireAuth,requireRole,...}.js                         [Phase 3]
    /db/prisma.js                                                    [Phase 2]
    /validation/*.js                                                  [Phase 4+]
    /services/*.js                                                     [Phase 4+]
    /realtime/{socket-server,emit,rooms}.js                              [Phase 8]
  /hooks/*.js  (React Query hooks)                                        [as needed]
server.js  (custom Next.js + Socket.IO host)                                [Phase 8]
```

## Multi-tenancy

Every organization-owned Prisma model carries `organizationId`, and
every query in the service layer must filter by it (spec §5, §26).
This is a cross-cutting rule enforced at the service layer, not
something delegated to individual route handlers to remember.

## AI provider abstraction (planned, Phase 5/6)

No AI provider is selected yet (see `DECISIONS.md`, D-001). The
service layer will expose a stable interface, e.g.:

```js
// src/lib/services/ai-classification-service.js (shape, not yet implemented)
export async function classifyTicket({ title, description, context }) { ... }
```

The concrete provider call (or the deterministic local fallback) is an
implementation detail behind this function; route handlers and UI only
depend on the function's return shape (`category`, `priority`,
`department`, `confidence`, `explanation`, `suggestedNextSteps`).

## Realtime architecture (planned, Phase 8)

A custom `server.js` will wrap Next.js's request handler with a
persistent `http` server hosting Socket.IO, because App Router route
handlers cannot host long-lived WebSocket connections. The same
process is the natural place for the periodic SLA warning/breach scan
(see `DECISIONS.md`, D-000 item 4), avoiding a separate cron/queue
system. Event names, rooms, and payload shape follow spec §24 exactly
(no comment content over sockets; only safe metadata).

## Data flow for a mutation (planned pattern, from Phase 4 onward)

1. Route handler: parse + Zod-validate input, call `authz` helpers.
2. Service layer: enforce business rules (lifecycle transitions, SLA
   rules, organization scoping), perform the Prisma mutation.
3. Persist any resulting notification.
4. Emit the realtime event (failure here must not roll back the
   mutation — spec §24).
5. Return a normalized response to the route handler.
