# NIRNAYA — Architecture

This document describes the technical architecture, directory
structure, data flow, and service boundaries. It is updated as each
phase lands real code.

## Overview

NIRNAYA is a **single Next.js (App Router) application** — no separate
backend, no microservices. Next.js provides the frontend, the API
(route handlers), server-side business logic, authentication
integration, and database access (via Prisma). See
`docs/NIRNAYA_MASTER_SPEC.md` §3–§4 for the frozen stack and layering
rules this repository must not deviate from.

```
Browser (React 19 + Tailwind 4 + React Query 5)
        │  HTTP (cookies: access/refresh JWT)      │ WebSocket
        ▼                                           ▼
Next.js App Router route handlers        Socket.IO (custom server.js,
  (auth, tickets, comments, admin, ...)   real-time notifications)
        │
        ▼
Service layer (lib/services/*)  ──►  AI service abstraction (Phase 5/6)
        │                             SLA engine (Phase 7)
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
- **authentication** (`src/lib/auth/*`) — password
  hashing (bcrypt), JWT issuing/verification (jose), HTTP-only cookie
  handling.
- **authorization** (`src/lib/authz/*`) —
  `requireAuth`, `requireRole`, `requireAdmin`, `requireAgentOrAdmin`,
  and organization-scoping helpers, used by every route handler that
  touches organization-owned data.
- **business/service logic** (`src/lib/services/*`) — ticket lifecycle,
  comments, watchers, activity, notifications, assignment, admin CRUD,
  dashboard stats, etc. This is where spec rules actually
  live, not in components or route handlers (spec §4).
- **environment validation** (`src/lib/env.js`, Phase 1) — server-side
  only; Zod-validated env vars with fail-fast behavior. Must not be
  imported from client components.
- **database/Prisma** (`prisma/schema.prisma` — complete V1 schema with
  14 models and 9 enums; `src/lib/db/prisma.js` — singleton client
  with global cache) — schema and connection only; no query logic
  beyond thin data-access use inside services.
- **validation** (`src/lib/validation/*`, Zod schemas).
- **AI services** (`src/lib/ai/*`, `src/lib/services/ai-classification-service.js`,
  Phase 5) — provider-agnostic classification interface with
  mock provider; see "AI provider abstraction" below.
- **SLA engine** (`src/lib/services/sla-service.js`, Phase 7).
- **notifications** (`src/lib/services/notification-service.js`,
  Phase 8).
- **realtime/socket functionality** (`src/lib/realtime/*` +
  custom `server.js`, Phase 8).

## Directory structure

Current (Phase 10):

```
/prisma
  schema.prisma               # complete V1 domain schema (14 models, 9 enums)
  seed.js                     # idempotent seed script
/src
  /app
    layout.js                  # root HTML layout
    page.js                    # redirects to /login
    globals.css                # Tailwind 4 @theme tokens
    (auth)/
      layout.js                # centered auth layout (no sidebar)
      login/page.js            # functional login form (Phase 3)
    (dashboard)/
      layout.js                # auth-gated layout (redirects to /login)
      dashboard/page.js        # dashboard with stat cards
      tickets/page.js          # ticket list with filters
      tickets/new/page.js      # ticket creation form
      tickets/[id]/page.js     # ticket detail with AI classification + recommendations
      tickets/mine/page.js     # my tickets (USER-filtered)
      admin/
        users/page.js          # user management placeholder
        departments/page.js    # department mgmt placeholder
        categories/page.js     # category mgmt placeholder
        tags/page.js           # tag mgmt placeholder
        sla/page.js            # SLA config placeholder
        settings/page.js       # settings placeholder
    /api
      /health/route.js         # toolchain smoke-test endpoint
      /auth/login/route.js     # POST login (bcrypt + JWT + cookies)
      /auth/logout/route.js    # POST logout (clear cookies)
      /auth/me/route.js        # GET current user
      /tickets/route.js        # POST create (with auto-classification), GET list
      /tickets/[id]/route.js   # GET detail, PATCH update
      /tickets/[id]/status/route.js   # POST status transition
      /tickets/[id]/assign/route.js   # POST assign to agent
      /tickets/[id]/classify/route.js # POST trigger AI classification
      /tickets/[id]/ai/route.js       # GET AI predictions
      /tickets/[id]/recommendations/route.js # GET AI agent recommendations
      /categories/route.js     # GET org-scoped categories
      /departments/route.js    # GET org-scoped departments
      /tags/route.js           # GET org-scoped tags
      /users/route.js          # GET org-scoped agents
  /components
    /ui/
      button.jsx               # primary/secondary/danger/ghost
      card.jsx                 # Card, CardHeader, CardContent, CardFooter
      input.jsx                # label, error state, accessible
      select.jsx               # accessible select with label/error
      badge.jsx                # color-coded status badges
      avatar.jsx               # image or initials fallback
    /layout/
      sidebar.jsx              # nav sidebar with real user display
      header.jsx               # top bar with user info + logout
      app-shell.jsx            # sidebar + header + content
    /tickets/
      status-badge.jsx         # StatusBadge + PriorityBadge
      ticket-list.jsx          # filterable ticket list with pagination
      ticket-form.jsx          # ticket creation form
      ticket-detail.jsx        # detail view with AI classification + recommendations
      ai-classification.jsx    # AI classification panel (predictions, trigger)
      agent-recommendation.jsx # AI agent recommendation panel (ranked agents)
  /lib
    env.js                     # server-side env validation (Zod)
    /auth/
      password.js              # bcrypt hash/verify (12 rounds)
      jwt.js                   # jose sign/verify (HS256, CryptoKey)
      cookies.js               # HTTP-only Secure SameSite cookies
      session.js               # getCurrentUser() from request cookies
      index.js                 # re-exports
    /authz/
      index.js                 # requireAuth, requireRole, requireAdmin,
                               # requireAgentOrAdmin, requireSameOrganization
    /db/
      prisma.js                # Prisma client singleton
    /validation/
      ticket.js                # Zod schemas for ticket CRUD
    /services/
      lifecycle.js             # centralized transition table enforcement
      ticket-service.js        # ticket CRUD + assignment + transitions
      ai-classification-service.js  # AI classification orchestration
      agent-recommendation-service.js # AI agent recommendation (scoring, eligibility)
      sla-service.js           # SLA clock management (init, pause, resume, breach eval)
    /ai/
      provider.js              # BaseProvider class, provider registry
      validation.js            # Zod schemas for AI input/output
      classifier.js            # classifier orchestrator (provider resolution, timeout)
      recommendation-schema.js # Zod schemas for recommendation output validation
      /providers/
        mock.js                # deterministic keyword-based mock provider
/tests
  health.test.js               # Vitest — health endpoint
  env.test.js                  # Vitest — env validation schema
  components.test.jsx          # Vitest — UI components
  schema.test.js               # Vitest — Prisma schema structure
  prisma-client.test.js        # Vitest — Prisma client singleton
  seed.test.js                 # Vitest — seed script structure
  password.test.js             # Vitest — bcrypt hash/verify
  jwt.test.js                  # Vitest — JWT sign/verify
  auth.test.js                 # Vitest — session + cookie helpers
  authz.test.js                # Vitest — authorization helpers
  org-isolation.test.js        # Vitest — cross-org denial
  lifecycle.test.js            # Vitest — ticket lifecycle transitions
  ticket-service.test.js       # Vitest — ticket service layer
  ai-validation.test.js        # Vitest — AI validation schemas
  ai-provider.test.js          # Vitest — mock provider
  ai-classifier.test.js        # Vitest — classifier orchestrator
  ai-classification-service.test.js  # Vitest — classification service
  recommendation-schema.test.js      # Vitest — recommendation validation schemas
  agent-recommendation-service.test.js # Vitest — agent recommendation service
  sla-service.test.js                 # Vitest — SLA clock management
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
    /api/tickets/[id]/comments/route.js               [Phase 9]
    /api/tickets/[id]/watchers/route.js                [Phase 9]
    /api/tickets/[id]/activity/route.js                 [Phase 9]
    /api/notifications/*                                 [Phase 8]
    /api/sla/route.js                                       [Phase 7]
    /api/admin/**/route.js                                     [Phase 10]
  /lib
    /services/
      sla-engine.js                                   [Phase 7]
      notification-service.js                         [Phase 8]
    /realtime/{socket-server,emit,rooms}.js            [Phase 8]
  /hooks/*.js  (React Query hooks)                    [as needed]
server.js  (custom Next.js + Socket.IO host)          [Phase 8]
```

## Multi-tenancy

Every organization-owned Prisma model carries `organizationId`, and
every query in the service layer must filter by it (spec §5, §26).
This is a cross-cutting rule enforced at the service layer, not
something delegated to individual route handlers to remember.

## AI provider abstraction (Phase 5)

No real AI provider is selected yet (see `DECISIONS.md`, D-001). The
mock provider provides deterministic keyword-based classification for
development and testing.

Provider architecture (`src/lib/ai/`):

```
provider.js          # BaseProvider class, provider registry
validation.js        # Zod schemas for AI input/output
classifier.js        # orchestrator: provider resolution, timeout, validation
recommendation-schema.js # Zod schemas for recommendation output
providers/
  mock.js            # deterministic keyword-based provider
```

Adding a new provider:

1. Create `src/lib/ai/providers/<name>.js` extending `BaseProvider`
2. Implement `classify(input, context)` returning `ClassificationOutput`
3. Register with `registerProvider("<name>", ProviderClass)`
4. Set `AI_PROVIDER=<name>` in environment

The concrete provider call is an implementation detail behind the
`classify()` function; route handlers and UI only depend on the
return shape (`categoryName`, `predictedPriority`, `departmentName`,
`confidence`, `explanation`, `suggestedNextSteps`).

## Agent recommendation engine (Phase 6)

Per spec §18: "Recommendation is NOT the same thing as assignment.
AI recommends. Authorized human accepts/assigns."

The recommendation engine (`src/lib/services/agent-recommendation-service.js`)
computes deterministic, explainable agent recommendations from database
data. It does not call an external AI provider.

Eligibility rules:
- role = AGENT, same organization, ACTIVE status
- same department when ticket department is known
- exclude ADMIN, USER, inactive, cross-org agents

Scoring factors (spec §18 weights):
- Department Match: 30%
- Category Experience: 30% (diminishing returns)
- Workload: 25% (lower is better)
- Priority Readiness: 10% (HIGH/CRITICAL tickets)
- Historical Experience: 5% (diminishing returns)

Confidence formula (spec §18, D-002):
```
gapRatio = (topScore - runnerUpScore) / max(topScore, 1)
base = 0.35 + gapRatio * 0.50
+ candidate-count bonus (up to 0.08)
+ quality bonus (up to 0.05)
clamp to 0.50 – 0.98
```

Tie-breaking (deterministic):
1. Category experience
2. Lower workload
3. Lower high/critical workload
4. Stable agent ID

API: `GET /api/tickets/[id]/recommendations` (AGENT/ADMIN only)

## Realtime architecture (Phase 8)

A custom `server.js` wraps Next.js's request handler with a
persistent `http` server hosting Socket.IO, because App Router route
handlers cannot host long-lived WebSocket connections. The same
process hosts the periodic SLA warning/breach scan
(see `DECISIONS.md`, D-000 item 4), avoiding a separate cron/queue
system. Event names, rooms, and payload shape follow spec §24 exactly
(no comment content over sockets; only safe metadata).

## Data flow for a mutation (current pattern)

1. Route handler: parse + Zod-validate input, call `authz` helpers.
2. Service layer: enforce business rules (lifecycle transitions, SLA
   rules, organization scoping), perform the Prisma mutation.
3. AI classification: triggered async after ticket creation (fire-and-forget).
4. Persist any resulting notification.
5. Emit the realtime event (failure here must not roll back the
   mutation — spec §24).
6. Return a normalized response to the route handler.

## Data flow for a recommendation (Phase 6)

1. Route handler: authenticate, authorize AGENT/ADMIN, parse ticket ID.
2. Service layer: verify ticket org, find eligible agents, calculate
   workload/experience, score agents, generate confidence, build
   ranked output with explanations.
3. Return deterministic response — no external AI call, no persistence.

## SLA engine (Phase 7)

Two independent SLA clocks per spec §20-21:

- **Response SLA**: starts at ticket creation, satisfied by first
  AGENT/ADMIN PUBLIC comment (via `satisfyResponseSLA()`).
- **Resolution SLA**: starts at ticket creation, satisfied at RESOLVED,
  paused during WAITING_FOR_USER, resumes on IN_PROGRESS.

SLA status derivation (in `computeSLAInfo()`):
- `COMPLETED` — clock satisfied (firstRespondedAt set / status RESOLVED+)
- `PAUSED` — waitingSince is set
- `BREACHED` — remaining time < 0
- `WARNING` — remaining time ≤ 20% of original duration
- `ON_TRACK` — default

Integration points in `ticket-service.js`:
- `createTicket` → fire-and-forget `initializeTicketSLA()`
- `transitionStatus` → `pauseSLA()`, `resumeSLA()`, `completeResolutionSLA()`, `reopenSLA()`
- `updateTicket` → `recalculateResolutionSLA()` on priority change

API: `GET /api/tickets/[id]/sla` — evaluates and returns SLA info.
UI: `sla-info.jsx` panel on ticket detail page.

## Comments, watchers and activity timeline (Phase 9)

### Comment architecture

Comments are managed by `src/lib/services/comment-service.js`. Key
design decisions:

- **Two visibility types:** PUBLIC (visible to all authorized users)
  and INTERNAL (visible to AGENT/ADMIN only), per spec §14.
- **Server-side visibility enforcement:** The comment list API filters
  INTERNAL comments before returning to USER role. The single comment
  API returns 404 for INTERNAL comments accessed by USER.
- **SLA integration:** PUBLIC comments by AGENT/ADMIN trigger
  `satisfyResponseSLA()` (fire-and-forget, non-blocking). USER comments
  and INTERNAL comments do NOT satisfy response SLA, per spec §20.
- **Notification routing:** New PUBLIC comments notify the ticket
  requester and all watchers (excluding the comment author). INTERNAL
  comments do not notify users who cannot see them.
- **No edit/delete:** Spec §14 does not require these capabilities.
  V1 provides create and read only.

API:
- `GET /api/tickets/[id]/comments` — paginated, visibility-filtered
- `POST /api/tickets/[id]/comments` — create comment

### Watcher architecture

Watchers are managed by `src/lib/services/watcher-service.js`. Key
design decisions:

- **Duplicate prevention:** Uses the existing `@@unique([ticketId, userId])`
  constraint. Repeated watch requests return the existing record (idempotent).
- **Permission model:**
  - USER can watch own tickets (as requester) — can add/remove self
  - AGENT/ADMIN can watch any accessible ticket — can add/remove self and others
- **Org isolation:** All operations validate ticket and user belong to
  the same organization server-side.
- **Notification integration:** Watcher addition generates notifications
  via `notifyWatcherAdded()`.

API:
- `GET /api/tickets/[id]/watchers` — list watchers with user details
- `POST /api/tickets/[id]/watchers` — add watcher
- `DELETE /api/tickets/[id]/watchers?userId=...` — remove watcher

### Activity timeline architecture

The activity timeline is assembled by `src/lib/services/activity-service.js`
from existing persisted domain data. Per spec §16, no dedicated Activity/Audit
model was created — the timeline is built from:

- **Ticket creation** — from ticket `createdAt` and metadata
- **Status changes** — derived from current ticket status
- **Assignment history** — from `TicketAssignmentHistory` model
- **Comments** — from `Comment` model (INTERNAL excluded for USER)
- **SLA events** — from `firstRespondedAt`, `resolvedAt`, `closedAt`
- **Priority changes** — from ticket fields

Timeline ordering: newest first, with stable secondary sort by ID.
Paginated with configurable limit.

API: `GET /api/tickets/[id]/activity` — paginated, org/role-scoped

### Realtime integration

- New event: `ticket:comment_added` — emitted after comment creation
  with safe metadata only (commentId, isInternal, author info, timestamp).
  Comment content is NOT sent through the socket, per spec §24.
- `useTicketRealtime` hook listens for `ticket:comment_added` events.

### Data flow for comment creation

1. Route handler: authenticate, parse ticket ID + body.
2. Comment service: validate content/visibility, verify ticket org and
   user access, enforce role rules (USER cannot create INTERNAL).
3. Prisma: persist comment.
4. SLA: fire-and-forget `satisfyResponseSLA()` for qualifying comments.
5. Notifications: fire-and-forget notify requester + watchers.
6. Return created comment with author details.
