# NIRNAYA — Progress

## Current phase: Phase 9 — complete and verified

## Completed phases

### Phase 9 — Comments, Watchers and Activity Timeline

**What was implemented:**

- **Comment service** (`src/lib/services/comment-service.js`):
  - `createComment({ ticketId, content, visibility }, user)` — validates content, visibility, ticket existence, org isolation, role permissions (USER cannot create INTERNAL); creates comment; triggers SLA response satisfaction for AGENT/ADMIN PUBLIC comments; notifies requester and watchers
  - `listTicketComments(ticketId, user, options)` — org-scoped, role-filtered (USER sees PUBLIC only), paginated, ordered by createdAt ascending
  - `getComment(commentId, user)` — org-scoped, visibility-filtered (USER cannot see INTERNAL), ticket-access authorization
  - `canSeeInternalComment(user)` — helper to check if user can see INTERNAL comments
  - `filterCommentsForUser(comments, user)` — filters comments based on user role
- **Watcher service** (`src/lib/services/watcher-service.js`):
  - `addWatcher(ticketId, userId, user)` — org-scoped, validates target user, role-based permissions (USER can only watch own tickets), idempotent (returns existing watcher)
  - `removeWatcher(ticketId, userId, user)` — org-scoped, role-based, idempotent (safe to remove non-existent)
  - `listWatchers(ticketId, user)` — org-scoped, returns watchers with user details
  - `isWatching(ticketId, userId)` — utility to check watch status
- **Activity timeline service** (`src/lib/services/activity-service.js`):
  - `listTicketActivity(ticketId, user, options)` — assembles timeline from persisted domain data (no new Activity model)
  - Sources: ticket creation, status changes, assignment history, comments (PUBLIC only for USER), SLA response, resolution, closure
  - Org-scoped, role-aware (USER excluded from INTERNAL comments), chronologically ordered (newest first), paginated
- **Comment API routes**:
  - `GET /api/tickets/[id]/comments` — paginated list with visibility filtering
  - `POST /api/tickets/[id]/comments` — create comment with validation
- **Watcher API routes**:
  - `GET /api/tickets/[id]/watchers` — list watchers
  - `POST /api/tickets/[id]/watchers` — add watcher (supports adding other users for AGENT/ADMIN)
  - `DELETE /api/tickets/[id]/watchers?userId=...` — remove watcher
- **Activity timeline API route**:
  - `GET /api/tickets/[id]/activity` — paginated activity timeline
- **Notification integration**:
  - `notifyCommentAdded()` — notifies ticket requester and watchers about new PUBLIC comments; INTERNAL comments do not notify unauthorized users; self-notifications prevented
  - `notifyWatcherAdded()` — notifies when a user is added as watcher
  - Integrated into `comment-service.js` createComment flow
- **SLA response integration**:
  - `satisfyResponseSLA()` (Phase 7) now called from `createComment()` for PUBLIC comments by AGENT/ADMIN
  - Fire-and-forget, non-blocking
  - Idempotent (SLA service already handles already-satisfied case)
- **Realtime events**:
  - `ticket:comment_added` event added to `socket-client.js`
  - `onTicketCommentAdded()` callback in socket client
  - `useTicketRealtime` hook updated to listen for comment events
- **UI components**:
  - `src/components/comments/comment-list.jsx` — displays comments with author, timestamp, visibility badge, loading/empty states
  - `src/components/comments/comment-form.jsx` — textarea form with INTERNAL checkbox (AGENT/ADMIN only), validation, loading state
  - `src/components/watchers/watcher-toggle.jsx` — watch/unwatch button with watcher list toggle, loading state
  - `src/components/activity/activity-timeline.jsx` — chronological timeline with icons, timestamps, descriptions, loading/empty states
- **Ticket detail integration**:
  - Updated `ticket-detail.jsx` to include CommentForm, CommentList, WatcherToggle, and ActivityTimeline
  - Comment list auto-refreshes after adding a comment via key-based remount
  - Replaced old inline comments section with dedicated CommentList component

**Files changed/created:**

| File | Action |
|---|---|
| `src/lib/services/comment-service.js` | Created |
| `src/lib/services/watcher-service.js` | Created |
| `src/lib/services/activity-service.js` | Created |
| `src/app/api/tickets/[id]/comments/route.js` | Created |
| `src/app/api/tickets/[id]/watchers/route.js` | Created |
| `src/app/api/tickets/[id]/activity/route.js` | Created |
| `src/components/comments/comment-list.jsx` | Created |
| `src/components/comments/comment-form.jsx` | Created |
| `src/components/watchers/watcher-toggle.jsx` | Created |
| `src/components/activity/activity-timeline.jsx` | Created |
| `src/lib/services/notification-service.js` | Modified (notifyCommentAdded, notifyWatcherAdded) |
| `src/lib/realtime/socket-client.js` | Modified (onTicketCommentAdded) |
| `src/hooks/use-realtime.js` | Modified (comment event listener) |
| `src/components/tickets/ticket-detail.jsx` | Modified (integrated new components) |
| `tests/comment-service.test.js` | Created |
| `tests/watcher-service.test.js` | Created |
| `tests/activity-service.test.js` | Created |

**Tests run:**

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass (1 warning: avatar `<img>`, pre-existing) |
| Prisma schema validation | `npx prisma validate` | ✅ valid |
| Unit tests | `npm run test` (Vitest) | ✅ 441/441 passed |
| Production build | `npm run build` | ✅ compiled, 36 routes generated |
| Git diff check | `git diff --check` | ✅ only CRLF warnings |

**Known limitations / not yet done (by design — later phases):**

- No admin CRUD UI for departments/categories/tags/users yet (Phase 10)
- No advanced watcher management UI (e.g., bulk operations) — basic watch/unwatch only
- Activity timeline is assembled from existing persisted data; no dedicated Activity/Audit model was needed per spec §16
- No comment edit/delete functionality — not required by spec §14
- No watcher-specific realtime events (watcher added/removed notifications use Phase 8 notification infrastructure)

**What was implemented:**

- **Socket.IO server integration** (`server.js`):
  - Custom Node.js HTTP server wrapping Next.js with Socket.IO 4.x
  - Runs on `/api/socketio` path with WebSocket + polling transports
  - Supports both `dev` (next dev equivalent) and `production` modes
  - `npm run dev` now uses `node server.js` for Socket.IO support
- **Socket.IO server logic** (`src/lib/realtime/socket-server.js`):
  - JWT authentication middleware — extracts token from `auth.token`, cookie header, or query parameter
  - Database user verification (ACTIVE status check)
  - Room-based authorization: `user:{id}`, `org:{orgId}`, `ticket:{ticketId}`
  - Ticket subscription with org isolation + USER role restriction
  - Emit helpers: `emitToUser()`, `emitToOrg()`, `emitToTicket()`
- **Socket.IO client abstraction** (`src/lib/realtime/socket-client.js`):
  - Singleton connection management with auto-reconnection
  - Event subscriptions: `onNotification`, `onTicketUpdated`, `onTicketStatusChanged`, `onTicketAssigned`
  - Ticket subscribe/unsubscribe helpers
  - Cleanup functions for all listeners
- **Notification service** (`src/lib/services/notification-service.js`):
  - `createNotification()` — validates ticket existence, deduplicates by (type, ticketId, recipientId, organizationId)
  - `createBulkNotifications()` — batch creation with error isolation
  - `getUserNotifications()` — paginated, org-scoped, unread filter
  - `getUnreadCount()` — org-scoped unread count
  - `markAsRead()` — user ownership + org isolation validation
  - `markAllAsRead()` — bulk mark read for current user
  - Event-specific helpers: `notifyTicketAssigned()`, `notifyTicketStatusChanged()`, `notifySLABreach()`, `notifySLAWarning()`, `notifyTicketReopened()`
  - Self-notification prevention (actor ≠ recipient)
- **Notification API routes**:
  - `GET /api/notifications` — paginated list with unread filter
  - `PATCH /api/notifications` — mark single or all as read
  - `GET /api/notifications/unread-count` — unread notification count
- **Notification UI components**:
  - `src/components/notifications/notification-bell.jsx` — header bell with unread badge, dropdown toggle, auto-refresh every 30s
  - `src/components/notifications/notification-list.jsx` — notification list with type icons, time-ago display, read/unread state, ticket click-through
  - Updated `src/components/layout/header.jsx` — replaced placeholder bell with NotificationBell component
- **Ticket service integration**:
  - `createTicket()` — notifies assigned agent (when applicable)
  - `transitionStatus()` — notifies on reopen (to requester) and status change (to assigned agent)
  - `assignTicket()` — notifies newly assigned agent
  - All notification calls are fire-and-forget (`.catch()`)
- **SLA breach scan**:
  - `src/lib/services/sla-scan-service.js` — `runSLABreachScan(organizationId)`:
    - Queries tickets with active SLA (ON_TRACK/WARNING status, non-CLOSED)
    - Evaluates response and resolution SLA independently
    - Detects breach and warning transitions
    - Creates deduplicated notifications per spec §22
    - Updates ticket SLA status fields
    - Returns scan summary (scanned, breached, warned, unchanged, notifications)
  - `POST /api/admin/sla-scan` — ADMIN-only endpoint for manual scan triggering
- **React hooks** (`src/hooks/use-realtime.js`):
  - `useSocketConnection(token)` — manages Socket.IO lifecycle
  - `useTicketRealtime(ticketId, callbacks)` — subscribes to ticket room with event callbacks
  - `useNotificationRealtime(callbacks)` — listens for notification events

**Files changed/created:**

| File | Action |
|---|---|
| `server.js` | Created |
| `src/lib/realtime/socket-server.js` | Created |
| `src/lib/realtime/socket-client.js` | Created |
| `src/lib/services/notification-service.js` | Created |
| `src/lib/services/sla-scan-service.js` | Created |
| `src/app/api/notifications/route.js` | Created |
| `src/app/api/notifications/unread-count/route.js` | Created |
| `src/app/api/admin/sla-scan/route.js` | Created |
| `src/components/notifications/notification-bell.jsx` | Created |
| `src/components/notifications/notification-list.jsx` | Created |
| `src/hooks/use-realtime.js` | Created |
| `src/components/layout/header.jsx` | Modified (NotificationBell integration) |
| `src/lib/services/ticket-service.js` | Modified (notification imports + fire-and-forget calls) |
| `package.json` | Modified (dev/start scripts use server.js) |
| `tests/notification-service.test.js` | Created |
| `tests/sla-scan.test.js` | Created |
| `tests/socket-server.test.js` | Created |

**Tests run:**

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass (1 warning: avatar `<img>`, pre-existing) |
| Prisma schema validation | `npx prisma validate` | ✅ valid |
| Prisma client generation | `npx prisma generate` | ✅ generated |
| Unit tests | `npm run test` (Vitest) | ✅ 370/370 passed |
| Production build | `npm run build` | ✅ compiled, 33 routes generated |
| Git diff check | `git diff --check` | ✅ only CRLF warnings |

**Known limitations / not yet done (by design — later phases):**

- No comments system yet (Phase 9) — `notifyCommentAdded()` not yet implemented
- No watcher management UI yet (Phase 9)
- No activity timeline UI yet (Phase 9)
- Socket.IO is optional — `next dev`/`next start` still work without server.js for HTTP-only mode
- Proactive SLA breach scan requires manual trigger or external scheduler — no continuous background worker (documented limitation per D-000 item 4)
- Real-time ticket detail updates via Socket.IO are wired but not yet integrated into ticket-detail.jsx React Query cache invalidation (Phase 9 can add this)
- No admin CRUD UI for departments/categories/tags/users yet (Phase 10)

**What was implemented:**

- SLA service (`src/lib/services/sla-service.js`):
  - `computeSLAInfo(ticket)` — derives response/resolution SLA status, remaining time, and met flags from ticket fields
  - `initializeTicketSLA(ticketId, orgId, priority)` — resolves SLA config from `SLAConfiguration`, calculates deadlines from `createdAt + targetMinutes`, evaluates initial status
  - `pauseSLA(ticketId)` — sets `waitingSince`, pauses both clocks (preserves COMPLETED status)
  - `resumeSLA(ticketId)` — clears `waitingSince`, recalculates resolution status
  - `completeResolutionSLA(ticketId)` — sets `resolvedAt`, marks resolution as COMPLETED
  - `satisfyResponseSLA(ticketId, role)` — sets `firstRespondedAt`, marks response as COMPLETED (AGENT/ADMIN only)
  - `recalculateResolutionSLA(ticketId, newPriority)` — recalculates resolution due from original `createdAt` using new priority config
  - `reopenSLA(ticketId)` — resets resolution SLA to ON_TRACK with new deadline on reopen
  - `evaluateAndPersistSLA(ticketId)` — deterministic breach/warning evaluation, persists status changes
- Two independent SLA clocks per spec §20:
  - **Response SLA**: satisfied by first AGENT/ADMIN PUBLIC comment (via `satisfyResponseSLA`)
  - **Resolution SLA**: satisfied at RESOLVED, paused during WAITING_FOR_USER, resumes on IN_PROGRESS
- Warning threshold at 20% remaining time per spec §21
- Elapsed time only (no business hours) — documented in UI
- Priority changes recalculate resolution due from original ticket creation time
- SLA initialization on ticket creation (fire-and-forget)
- SLA lifecycle hooks in status transitions (pause/resume/complete/reopen)
- SLA recalculation on priority change in `updateTicket`
- API route:
  - `GET /api/tickets/[id]/sla` — returns computed SLA info with evaluation
- UI component:
  - `src/components/tickets/sla-info.jsx` — SLA status panel showing response and resolution clocks, due times, remaining time, and status badges
  - Updated `ticket-detail.jsx` to include SLA info panel
- Phase 7 unit tests:
  - `tests/sla-service.test.js` — 43 tests: config resolution, deadline calculation, initialization, pause/resume, completion, response satisfaction, recalculation, reopen, breach evaluation, org isolation, edge cases

**Files changed/created:**

| File | Action |
|---|---|
| `src/lib/services/sla-service.js` | Created |
| `src/lib/services/ticket-service.js` | Modified (SLA imports, initialization, transition hooks, priority recalculation) |
| `src/app/api/tickets/[id]/sla/route.js` | Created |
| `src/components/tickets/sla-info.jsx` | Created |
| `src/components/tickets/ticket-detail.jsx` | Modified (added SLAInfo import and panel) |
| `tests/sla-service.test.js` | Created |

**Tests run:**

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass (1 warning: avatar `<img>`, acceptable) |
| Prisma schema validation | `npx prisma validate` | ✅ valid |
| Unit tests | `npm run test` (Vitest) | ✅ 321/321 passed |
| Production build | `npm run build` | ✅ compiled, 30 routes generated |

**Known limitations / not yet done (by design — later phases):**

- Response SLA is satisfied via `satisfyResponseSLA()` — no comment creation API exists yet (Phase 9). The function is ready for integration.
- No proactive SLA breach scan yet (planned for Phase 8 with Socket.IO persistent process).
- Business-hours SLA not implemented — elapsed time only. Documented in UI.
- No realtime SLA notifications yet (Phase 8).
- No admin CRUD UI for SLA configurations yet (Phase 10).
- No SLA reporting/analytics yet (future phase).

**What was implemented:**

- Recommendation validation schemas (`src/lib/ai/recommendation-schema.js`):
  - `factorSchema` — validates individual scoring factors (name, normalized, weight, contribution)
  - `agentRecommendationSchema` — validates a single agent recommendation (agentId, score, confidence, workload, experience, explanation, factors, rank, timestamp)
  - `recommendationResponseSchema` — validates the full recommendation response
  - `validateRecommendationOutput()` — validates engine output before returning
  - Workload statuses constant (ASSIGNED, IN_PROGRESS, WAITING_FOR_USER, REOPENED)
- Agent recommendation service (`src/lib/services/agent-recommendation-service.js`):
  - `getRecommendations(ticketId, user)` — full recommendation flow with org isolation
  - Eligible-agent filtering: role=AGENT, same org, ACTIVE, same department when known (per spec §18)
  - Deterministic scoring with spec §18 weights: Department 30%, Category Experience 30%, Workload 25%, Priority Readiness 10%, Historical Experience 5%
  - Workload calculation using Prisma groupBy (avoids N+1 queries) — counts ASSIGNED, IN_PROGRESS, WAITING_FOR_USER, REOPENED
  - Category experience with diminishing returns (logarithmic scaling)
  - Historical experience across all categories
  - Priority readiness for HIGH/CRITICAL tickets
  - Deterministic tie-breaking: score → category experience → workload → high/critical workload → stable agent ID
  - Confidence formula per spec §18 and D-002: gapRatio, base, candidate-count bonus, quality bonus, bounded 0.50–0.98
  - Human-readable explanations for each recommendation
  - Graceful failure handling — recommendation errors don't break ticket functionality
- API route:
  - `GET /api/tickets/[id]/recommendations` — AGENT/ADMIN only, org-scoped, returns ranked recommendations
- UI components:
  - `src/components/tickets/agent-recommendation.jsx` — AI Agent Recommendation panel
    - Shows top 3 recommendations with score bar, confidence badge, workload/experience metrics
    - Scoring breakdown (expandable for top recommendation)
    - Refresh button for recalculation
    - Role-gated (AGENT/ADMIN only)
    - Loading, empty, and error states
  - Updated `ticket-detail.jsx` to include recommendation panel
- Phase 6 unit tests:
  - `tests/recommendation-schema.test.js` — 16 tests: factor schema, recommendation schema, response schema, validation function, constants
  - `tests/agent-recommendation-service.test.js` — 18 tests: eligibility, workload, scoring, ranking, confidence, tie-breaking, org isolation, failure handling

**Files changed/created:**

| File | Action |
|---|---|
| `src/lib/ai/recommendation-schema.js` | Created |
| `src/lib/services/agent-recommendation-service.js` | Created |
| `src/app/api/tickets/[id]/recommendations/route.js` | Created |
| `src/components/tickets/agent-recommendation.jsx` | Created |
| `src/components/tickets/ticket-detail.jsx` | Modified (added AgentRecommendation import and panel) |
| `tests/recommendation-schema.test.js` | Created |
| `tests/agent-recommendation-service.test.js` | Created |

**Tests run:**

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass (1 warning: avatar `<img>`, acceptable) |
| Prisma schema validation | `npx prisma validate` | ✅ valid |
| Unit tests | `npm run test` (Vitest) | ✅ 278/278 passed |
| Production build | `npm run build` | ✅ compiled, 29 routes generated |

**Known limitations / not yet done (by design — later phases):**

- No real AI provider integrated yet (only mock provider for classification). OpenAI or other provider to be configured via AI_PROVIDER env var.
- AIPrediction model does not store provider/model metadata — this is a schema limitation noted in D-010.
- Recommendation does not persist to database (computed on demand per spec §18).
- ~~No SLA engine yet (Phase 7).~~ ✅ Done (Phase 7).
- No realtime notifications yet (Phase 8).
- No admin CRUD UI for departments/categories/tags/users yet (Phase 10).

### Phase 5 — AI ticket classification

**What was implemented:**

- AI provider abstraction (`src/lib/ai/provider.js`):
  - `BaseProvider` class with `classify()` method
  - Provider registry (`registerProvider`, `getProvider`)
  - Pluggable architecture for swapping providers
- AI validation schemas (`src/lib/ai/validation.js`):
  - `classificationInputSchema` — validates ticket context before provider
  - `rawClassificationOutputSchema` — validates provider output with Zod
  - `validateClassificationOutput()` — normalizes and validates raw output
  - Handles NaN, Infinity, empty strings, oversized text
  - Validates category names against 8 known categories (per spec §17)
  - Validates priorities against 4 known levels
  - Bounded confidence scores (0.0–1.0)
- Mock AI provider (`src/lib/ai/providers/mock.js`):
  - Deterministic keyword-based classification (per spec §17)
  - Maps ticket content to NETWORK, HARDWARE, SOFTWARE, EMAIL, ACCOUNT, DATABASE, SECURITY, INFRASTRUCTURE
  - Detects priority from keywords (CRITICAL, HIGH, LOW, MEDIUM default)
  - Calculates confidence based on keyword matches (0.45–0.85 range)
  - Generates explanations and suggested next steps
  - Registered as "mock" provider, auto-selected when no AI_PROVIDER configured
- Classifier orchestrator (`src/lib/ai/classifier.js`):
  - Resolves provider from AI_PROVIDER env var (falls back to "mock")
  - Input validation via Zod before provider call
  - Configurable timeout (default 10s) with provider race
  - Output validation and normalization
- AI classification service (`src/lib/services/ai-classification-service.js`):
  - `classifyTicket(ticketId, user)` — full classification flow with org isolation
  - Resolves predicted category/department to real database IDs (same org)
  - Persists prediction to AIPrediction model
  - `getPredictions(ticketId, user)` — org-scoped prediction list
  - `getLatestPrediction(ticketId, user)` — most recent prediction
  - `applyPrediction(ticketId, predictionId, user)` — applies prediction to ticket fields
  - Graceful failure handling — classification errors don't propagate
- API routes:
  - `POST /api/tickets/[id]/classify` — trigger classification (AGENT/ADMIN only)
  - `GET /api/tickets/[id]/ai` — get predictions for a ticket
- Auto-classification on ticket creation:
  - `POST /api/tickets` now triggers async classification after creation
  - Fire-and-forget pattern — ticket creation never waits on AI
  - Classification failure logged server-side, doesn't affect user response
- UI components:
  - `src/components/tickets/ai-classification.jsx` — AI classification panel
    - Shows latest prediction: category, priority, department, confidence
    - Displays explanation and suggested next steps
    - "Run Classification" button for AGENT/ADMIN
    - History of earlier predictions (collapsible)
    - Loading and error states
- Updated ticket detail page to include AI classification panel
- Phase 5 unit tests:
  - `tests/ai-validation.test.js` — 20 tests: input/output schemas, NaN/Infinity handling, truncation, category validation, confidence bounds
  - `tests/ai-provider.test.js` — 17 tests: mock provider for all 8 categories, priority detection, confidence calculation, edge cases
  - `tests/ai-classifier.test.js` — 6 tests: classifier integration, provider resolution, timeout, input validation
  - `tests/ai-classification-service.test.js` — 16 tests: prediction creation, org isolation, category resolution, apply prediction, stale ID handling, failure handling

**Files changed/created:**

| File | Action |
|---|---|
| `src/lib/ai/provider.js` | Created |
| `src/lib/ai/validation.js` | Created |
| `src/lib/ai/classifier.js` | Created |
| `src/lib/ai/providers/mock.js` | Created |
| `src/lib/services/ai-classification-service.js` | Created |
| `src/app/api/tickets/route.js` | Modified (added POST handler + auto-classification) |
| `src/app/api/tickets/[id]/classify/route.js` | Created |
| `src/app/api/tickets/[id]/ai/route.js` | Created |
| `src/components/tickets/ai-classification.jsx` | Created |
| `src/components/tickets/ticket-detail.jsx` | Modified (added AI panel, current user fetch) |
| `tests/ai-validation.test.js` | Created |
| `tests/ai-provider.test.js` | Created |
| `tests/ai-classifier.test.js` | Created |
| `tests/ai-classification-service.test.js` | Created |

**Tests run:**

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass (1 warning: avatar `<img>`, acceptable) |
| Prisma schema validation | `npx prisma validate` | ✅ valid |
| Unit tests | `npm run test` (Vitest) | ✅ 244/244 passed |
| Production build | `npm run build` | ✅ compiled, 28 routes generated |

**Known limitations / not yet done (by design — later phases):**

- No real AI provider integrated yet (only mock provider). OpenAI or other provider to be configured via AI_PROVIDER env var.
- AIPrediction model does not store provider/model metadata — this is a schema limitation noted in D-010.
- No AI assignment recommendation yet (Phase 6).
- No SLA engine yet (Phase 7).
- No realtime notifications yet (Phase 8).
- No admin CRUD UI for departments/categories/tags/users yet (Phase 10).

---

### Phase 4 — Core ticket system and lifecycle

**What was implemented:**

- Ticket validation schemas (`src/lib/validation/ticket.js`) using Zod:
  - `createTicketSchema` — title, description, priority, type, source, departmentId, categoryId, tagIds
  - `updateTicketSchema` — partial update with same fields
  - `statusTransitionSchema` — status enum validation
  - `assignTicketSchema` — agentId + optional reason
  - `ticketListQuerySchema` — filters, pagination, sorting
- Ticket lifecycle service (`src/lib/services/lifecycle.js`):
  - Centralized transition table enforcement (D-006)
  - `canTransition(from, to, role, options?)` — returns `{allowed, reason?}`
  - `getAllowedTransitions(status)` — returns list of valid next statuses
  - `isTerminal(status)` — checks if status has no outgoing transitions
  - USER role restricted to only reopening own RESOLVED tickets
- Ticket service (`src/lib/services/ticket-service.js`):
  - `createTicket(data, user)` — validates department/category/tags, atomic ticket number generation, creates with tags in transaction
  - `listTickets(query, user)` — org-scoped, role-aware (USER sees own only), filters, pagination, sorting
  - `getTicketById(id, user)` — org-scoped, includes relations (department, category, requester, assignedAgent, tags, comments, assignmentHistory), filters internal comments for USER
  - `updateTicket(id, data, user)` — org-scoped, validates department/category/tags, handles tag replacement in transaction
  - `transitionStatus(id, newStatus, user)` — enforces lifecycle rules, sets server-controlled timestamps (resolvedAt, closedAt, waitingSince)
  - `assignTicket(id, data, user)` — validates agent eligibility (same org, active, AGENT/ADMIN role), auto-transitions OPEN→ASSIGNED, records assignment history
  - `TicketError` class with status codes
- API routes:
  - `POST /api/tickets` — create ticket
  - `GET /api/tickets` — list with filters/pagination
  - `GET /api/tickets/[id]` — detail with all relations
  - `PATCH /api/tickets/[id]` — update (AGENT/ADMIN only)
  - `POST /api/tickets/[id]/status` — status transition
  - `POST /api/tickets/[id]/assign` — assign to agent (AGENT/ADMIN only)
  - `GET /api/categories` — org-scoped categories
  - `GET /api/departments` — org-scoped departments
  - `GET /api/tags` — org-scoped tags
  - `GET /api/users` — org-scoped agents for assignment
- UI components:
  - `src/components/ui/select.jsx` — accessible select with label/error
  - `src/components/tickets/status-badge.jsx` — StatusBadge + PriorityBadge
  - `src/components/tickets/ticket-list.jsx` — filterable list with search, status/priority dropdowns, pagination
  - `src/components/tickets/ticket-form.jsx` — creation form with department/category/tag dropdowns
  - `src/components/tickets/ticket-detail.jsx` — detail view with status actions, assignment, history, comments
- Pages updated:
  - `src/app/(dashboard)/tickets/page.js` — real ticket list with "New Ticket" button
  - `src/app/(dashboard)/tickets/new/page.js` — ticket creation form
  - `src/app/(dashboard)/tickets/[id]/page.js` — ticket detail page
  - `src/app/(dashboard)/tickets/mine/page.js` — "My Tickets" (USER-filtered)
- Phase 4 unit tests:
  - `tests/lifecycle.test.js` — 27 tests: all valid transitions, invalid transitions, terminal status, USER role restrictions, ADMIN/AGENT permissions
  - `tests/ticket-service.test.js` — 18 tests: creation, validation, org isolation, role-based access, status transitions, assignment, listing/pagination

**Files changed/created:**

| File | Action |
|---|---|
| `src/lib/validation/ticket.js` | Created |
| `src/lib/services/lifecycle.js` | Created |
| `src/lib/services/ticket-service.js` | Created |
| `src/app/api/tickets/route.js` | Created |
| `src/app/api/tickets/[id]/route.js` | Created |
| `src/app/api/tickets/[id]/status/route.js` | Created |
| `src/app/api/tickets/[id]/assign/route.js` | Created |
| `src/app/api/categories/route.js` | Created |
| `src/app/api/departments/route.js` | Created |
| `src/app/api/tags/route.js` | Created |
| `src/app/api/users/route.js` | Created |
| `src/components/ui/select.jsx` | Created |
| `src/components/tickets/status-badge.jsx` | Created |
| `src/components/tickets/ticket-list.jsx` | Created |
| `src/components/tickets/ticket-form.jsx` | Created |
| `src/components/tickets/ticket-detail.jsx` | Created |
| `src/app/(dashboard)/tickets/page.js` | Modified (real list) |
| `src/app/(dashboard)/tickets/new/page.js` | Modified (real form) |
| `src/app/(dashboard)/tickets/[id]/page.js` | Created (detail page) |
| `src/app/(dashboard)/tickets/mine/page.js` | Modified (real list) |
| `tests/lifecycle.test.js` | Created |
| `tests/ticket-service.test.js` | Created |

**Tests run:**

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass (1 warning: avatar `<img>`, acceptable) |
| Prisma schema validation | `npx prisma validate` | ✅ valid |
| Unit tests | `npm run test` (Vitest) | ✅ 185/185 passed |
| Production build | `npm run build` | ✅ compiled, 26 routes generated |

**Known limitations / not yet done (by design — later phases):**

- Database migration not yet applied (requires network access to Supabase).
- Seed script not yet executed (requires live database).
- No comment creation/management UI yet (Phase 9).
- No watcher management UI yet (Phase 9).
- No SLA engine yet (Phase 7).
- No AI classification/assignment yet (Phase 5/6).
- No realtime notifications yet (Phase 8).
- No admin CRUD UI for departments/categories/tags/users yet (Phase 10).

---

### Phase 3 — Authentication and authorization

**What was implemented:**

- Password hashing library (`src/lib/auth/password.js`) using bcrypt
  with 12 salt rounds: `hashPassword()` and `verifyPassword()`
- JWT token library (`src/lib/auth/jwt.js`) using jose 6.x with
  `crypto.subtle.importKey` for HMAC-SHA256:
  - `signAccessToken()` — 1 hour expiry
  - `signRefreshToken()` — 7 day expiry
  - `verifyAccessToken()` / `verifyRefreshToken()` — returns null
    on invalid/expired tokens
  - JWT payload contains: `userId`, `role`, `organizationId`
- HTTP-only cookie helpers (`src/lib/auth/cookies.js`):
  - `setAccessTokenCookie()` / `setRefreshTokenCookie()` — Secure,
    SameSite=Lax, HttpOnly, path=/
  - `clearAuthCookies()` — for logout
  - `getAccessTokenFromRequest()` / `getRefreshTokenFromRequest()`
- Session helper (`src/lib/auth/session.js`):
  - `getCurrentUser()` — verifies JWT, fetches user from DB, confirms
    ACTIVE status, returns user without passwordHash
- Authorization helpers (`src/lib/authz/index.js`):
  - `requireAuth()` — returns 401 if not authenticated
  - `requireRole(request, roles[])` — returns 403 if role not allowed
  - `requireAdmin()` — shorthand for ADMIN role
  - `requireAgentOrAdmin()` — shorthand for AGENT or ADMIN roles
  - `requireSameOrganization(user, resourceOrgId)` — returns 403 on
    cross-org access attempt
- API routes:
  - `POST /api/auth/login` — validates email/password, verifies
    bcrypt, returns user + sets access/refresh cookies
  - `POST /api/auth/logout` — clears both auth cookies
  - `GET /api/auth/me` — returns current authenticated user
- Login page (`src/app/(auth)/login/page.js`) — functional client
  component with email/password form, loading states, error display,
  redirect to `/dashboard` on success
- Dashboard layout (`src/app/(dashboard)/layout.js`) — server component
  that checks authentication via `getCurrentUser()`, redirects to
  `/login` if not authenticated, passes user to AppShell
- App shell (`src/components/layout/app-shell.jsx`) — accepts user
  prop, passes to Sidebar and Header
- Sidebar (`src/components/layout/sidebar.jsx`) — displays real user
  initials, username, and designation from session
- Header (`src/components/layout/header.jsx`) — displays user avatar
  (initials), username, role badge, and Sign Out button with logout
  functionality
- Phase 3 unit tests:
  - `tests/password.test.js` — bcrypt hash/verify, salt randomness,
    incorrect password rejection
  - `tests/jwt.test.js` — token signing/verification, wrong secret
    rejection, access/refresh token separation
  - `tests/auth.test.js` — getCurrentUser with valid/invalid/inactive
    users, cookie helpers
  - `tests/authz.test.js` — requireAuth (401 on missing/invalid token,
    user returned on valid), requireRole (403 on wrong role), requireAdmin,
    requireAgentOrAdmin, requireSameOrganization
  - `tests/org-isolation.test.js` — cross-org access denied for
    users, tickets, departments; same-org access allowed; JWT
    organizationId scoping verified

**Files changed/created:**

| File | Action |
|---|---|
| `src/lib/auth/password.js` | Created |
| `src/lib/auth/jwt.js` | Created |
| `src/lib/auth/cookies.js` | Created |
| `src/lib/auth/session.js` | Created |
| `src/lib/auth/index.js` | Created |
| `src/lib/authz/index.js` | Created |
| `src/app/api/auth/login/route.js` | Created |
| `src/app/api/auth/logout/route.js` | Created |
| `src/app/api/auth/me/route.js` | Created |
| `src/app/(auth)/login/page.js` | Modified (functional login form) |
| `src/app/(dashboard)/layout.js` | Created (auth check) |
| `src/components/layout/app-shell.jsx` | Modified (accepts user prop) |
| `src/components/layout/header.jsx` | Modified (real user, logout) |
| `src/components/layout/sidebar.jsx` | Modified (real user display) |
| `tests/password.test.js` | Created |
| `tests/jwt.test.js` | Created |
| `tests/auth.test.js` | Created |
| `tests/authz.test.js` | Created |
| `tests/org-isolation.test.js` | Created |

**Tests run:**

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ pass (1 warning: avatar `<img>`, acceptable) |
| Prisma schema validation | `npx prisma validate` | ✅ valid |
| Unit tests | `npm run test` (Vitest) | ✅ 140/140 passed |
| Production build | `npm run build` | ✅ compiled, 18 routes generated |

**Known limitations / not yet done (by design — later phases):**

- Database migration not yet applied (requires network access to
  Supabase; run `npx prisma db push` or create a migration when
  connected).
- Seed script not yet executed (requires live database; run
  `npx prisma db seed` after migration).
- No ticket/comment/SLA/AI/notification/realtime logic yet (Phases 4–9).
- No custom `server.js`/Socket.IO wiring yet — deferred to Phase 8.
- `npm audit` findings from Phase 0 remain (transitive dev-tool
  dependency; not remediated — see DECISIONS.md D-000 item 5).

## Next phase

**Phase 10** — Dashboard, analytics and administrative UI (per spec §32). Awaiting go-ahead.

---

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

**Phase 3** — Authentication and authorization (per spec §36). See Phase 3
section above.

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
