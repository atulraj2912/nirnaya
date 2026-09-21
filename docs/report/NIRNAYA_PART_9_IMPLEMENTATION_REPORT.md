# Part 9: Notifications & Realtime - Implementation Report

**Date:** 2026-09-21
**Status:** COMPLETE
**Test Baseline:** 1126 -> 1179 tests (53 new tests, 0 regressions)

---

## 1. Executive Summary

Implemented the Notifications & Realtime system per NIRNAYA master spec section 23 (Notifications) and section 24 (Realtime/Socket.IO). The system uses a **persist-first, emit-second** architecture: notifications are always persisted to the database before any realtime emission occurs, and realtime failures are caught and logged without rolling back business operations.

Key changes:
- Added realtime emission to all business services (notifications, tickets, comments, watchers)
- Created a shared Socket.IO instance module for cross-service access
- Built React Query hooks for notification state management
- Rewrote notification-bell.jsx to use React Query + Socket.IO realtime updates
- Comprehensive test coverage for all new functionality

---

## 2. Spec Compliance

### Section 23 - Notifications

| Requirement | Status | Notes |
|---|---|---|
| NotificationType enum: 11 types | PASS | Pre-existing |
| Notification model with relations | PASS | Pre-existing with proper indexes |
| Create notification on ticket events | PASS | createNotification called after all mutations |
| Persist before emit | PASS | await prisma.notification.create() before emit |
| Realtime emission (best-effort) | PASS | try/catch pattern on all emissions |
| Notification read endpoints | PASS | Pre-existing GET/PATCH /api/notifications |
| Unread count endpoint | PASS | Pre-existing |
| User can only read own notifications | PASS | recipientId filter in all queries |
| Org-scoped queries | PASS | organizationId filter in list/unread |
| Mark as read (single + bulk) | PASS | Pre-existing with ownership verification |
| Dedup SLA notifications | PASS | createNotification checks existing warning/breach |

### Section 24 - Realtime / Socket.IO

| Requirement | Status | Notes |
|---|---|---|
| JWT auth on connection | PASS | Pre-existing |
| User room (user:{userId}) | PASS | Auto-joined on connect |
| Org room (org:{orgId}) | PASS | Auto-joined on connect |
| Ticket room (ticket:{ticketId}) | PASS | Subscribe/unsubscribe via events |
| USER restricted to own tickets | PASS | Ownership check in subscribe handler |
| AGENT/ADMIN access org tickets | PASS | Org membership check |
| ticket:updated event | PASS | Emitted from updateTicket, addWatcher, removeWatcher |
| ticket:comment_added event | PASS | Safe metadata only (no content) |
| ticket:assignment_changed event | PASS | Emitted from assignTicket |
| ticket:status-changed event | PASS | Emitted from transitionStatus |
| notification:new event | PASS | Emitted to user:{recipientId} after persist |
| notification:read event | PASS | Emitted after markAsRead |
| notification:read_all event | PASS | Emitted after markAllAsRead |
| Comment events leak no content | PASS | Only commentId, isInternal, authorId, authorName, createdAt |
| Status events leak no description | PASS | Only ticketId, status, updatedBy, updatedAt |
| Realtime failure != rollback | PASS | All emit calls wrapped in try/catch |

---

## 3. Files Created

### src/lib/realtime/socket-instance.js
Shared Socket.IO instance accessor. Services call getIO() to emit events without importing the full socket-server module (avoiding circular dependencies).

### src/hooks/use-notification-queries.js
React Query hooks for notification state:
- useNotifications(options) - paginated list with org scoping
- useUnreadNotificationCount() - reactive unread count
- useMarkNotificationRead() - mutation with cache invalidation
- useMarkAllNotificationsRead() - bulk mutation with cache invalidation

### tests/ai-part9-notifications-realtime.test.js
48 tests covering notification service realtime, socket server room management, ticket service emission, comment service payload safety, watcher service notification, and shared socket instance.

---

## 4. Files Modified

### server.js
- Imports setIO from socket-instance.js
- Calls setIO(io) after Socket.IO server setup

### src/lib/services/notification-service.js
- createNotification: emits notification:new to user:{recipientId} after persist
- markAsRead: emits notification:read to user after persist
- markAllAsRead: emits notification:read_all to user after persist
- All emissions wrapped in try/catch (best-effort, no rollback on failure)

### src/lib/services/ticket-service.js
- transitionStatus: emits ticket:status-changed + notifies watchers
- assignTicket: emits ticket:assignment_changed + notifies watchers
- Both functions fire-and-forget watcher notifications (do not block return)

### src/lib/services/comment-service.js
- createComment: emits ticket:comment_added with safe metadata only
- Payload: commentId, ticketId, authorId, authorName, isInternal, createdAt (NO content)

### src/lib/services/watcher-service.js
- addWatcher: notifies existing watchers (WATCHER_ADDED), emits ticket:updated with watcher_added
- removeWatcher: emits ticket:updated with watcher_removed
- Both fire-and-forget (do not block return)

### src/components/notifications/notification-bell.jsx
- Rewritten from raw fetch + setInterval polling to React Query hooks
- Realtime invalidation via Socket.IO onNotification and onNotificationReadAll listeners
- Uses useNotifications, useUnreadNotificationCount, useMarkAllNotificationsRead hooks

---

## 5. Test Results

### New Tests (53)
- Notification service realtime: 7 tests (create emits, read emits, read_all emits, error resilience)
- Socket server room management: 8 tests (auth, rooms, subscribe, user vs admin restrictions)
- Ticket service emission: 8 tests (status-changed, assignment_changed, watcher notifications)
- Comment service payload safety: 8 tests (event names, safe metadata, no content leaks, internal flag)
- Watcher service notification: 7 tests (WATCHER_ADDED, ticket:updated events, user/agent/admin)
- Shared socket instance: 5 tests (setIO/getIO, null default, multiple calls)
- Notification React Query hooks: 5 tests (useNotifications, useUnreadCount, mutations)

### Regression Fix
- Added prisma.watcher mock to ticket-service.test.js and part4-ticket-domain-audit.test.js
- Added prisma.notification mock to watcher-service.test.js
- Added socket-instance/socket-server mocks to all affected test files
- Fixed time-sensitive SLA test (used dynamic dates instead of fixed)

### Final Counts
- Test files: 50 passed (0 failed)
- Tests: 1179 passed (0 failed)
- Lint: 0 errors, 1 pre-existing warning (avatar img element)
- Prisma: schema valid
- Build: compiled successfully

---

## 6. Architecture Decisions

1. **Shared IO instance** (socket-instance.js): Avoids circular dependency between services and socket-server. server.js sets the IO instance once on startup; all services access it via getIO().

2. **Persist-first, emit-second**: Every mutation completes the database write before attempting emission. If emission fails, the business operation is NOT rolled back.

3. **Fire-and-forget watcher notifications**: When a ticket is updated or a comment is added, existing watchers are notified asynchronously. This does not block the API response.

4. **Safe event payloads**: Comment events never include content. Status events never include description or requesterId. Only metadata (IDs, timestamps, flags) is sent over the wire.

5. **React Query + Socket.IO integration**: The notification bell uses React Query for data fetching/caching, and listens for Socket.IO events to invalidate the cache immediately when new notifications arrive or are marked read.

---

## 7. Final Security Verification

**Date:** 2026-09-21
**Baseline:** 1174 tests -> 1179 tests (5 new security regression tests)

### 1. Organization Room Security — PASS

**Verification method:** Code inspection of `socket-server.js:46-67`

- `organizationId` is derived from `socket.data.user.organizationId` (line 67)
- `socket.data.user` is set by the auth middleware (line 55) via JWT verification → `prisma.user.findUnique` (line 30-39)
- No client-provided organizationId is used for room joining
- No client event handler exists to join arbitrary organization rooms
- Only `ticket:subscribe` and `ticket:unsubscribe` events are registered

**Regression test added:** "org room join uses server-derived organizationId, not client input"

### 2. User Room Security — PASS

**Verification method:** Code inspection of `socket-server.js:66`, `notification-service.js:57-73,172-179,194-201`

- `socket.join("user:${user.id}")` uses server-resolved user.id from JWT → DB lookup
- No client event handler exists for joining arbitrary user rooms
- `notification:new` is emitted via `emitToUser(io, recipientId)` where recipientId comes from the service layer, never from client input
- `notification:read` emits to `user:${userId}` where userId is the authenticated user from the service function parameter
- `notification:read_all` emits to `user:${userId}` where userId is the authenticated user from the service function parameter
- No client can subscribe to another user's notification room

**Regression tests added:**
- "no client event handler exists for joining arbitrary user rooms"
- "notification:new only reaches the intended recipient user room"

### 3. Ticket Room Security — PASS

**Verification method:** Code inspection of `socket-server.js:69-98`, existing tests

- Cross-organization: rejected at line 81 (`ticket.organizationId !== user.organizationId`)
- USER viewing other user's ticket: rejected at lines 86-92 (`user.role === "USER" && ticket.requesterId !== user.id`)
- AGENT/ADMIN: can subscribe to any ticket within their organization
- `ticket:unsubscribe` has no auth check but only leaves rooms the socket has already joined (harmless)
- Existing test coverage: cross-org rejection, USER other's ticket rejection, USER own ticket acceptance

### 4. Socket Reconnect / Listener Duplication — PASS

**Verification method:** Code inspection of `socket-client.js:12-48`, `notification-bell.jsx:62-69`, `use-realtime.js:60-110`

- `socket-client.js`: Singleton pattern — `connectSocket()` calls `socket.removeAllListeners()` before creating a new socket instance
- `notification-bell.jsx`: React `useEffect` with proper cleanup — `onNotification` and `onNotificationReadAll` return cleanup functions that call `socket.off()`
- `use-realtime.js`: Uses `callbacksRef` (useRef) to avoid stale closure issues; cleanup functions properly remove listeners via the returned cleanup callbacks
- On reconnect: Socket.IO reuses the same socket instance; listeners persist correctly without duplication
- On component unmount: cleanup functions are called, removing all registered listeners
- One `notification:new` event causes exactly one `queryClient.invalidateQueries` call

### 5. Fire-and-forget Error Observability — PASS (with fix)

**Verification method:** Code inspection of `ticket-service.js:460-498,602-630`, `watcher-service.js:72-89`, `comment-service.js:98-113`

**Before fix:**
- Primary notification paths (notifyTicketAssigned, notifyTicketStatusChanged): logged via `console.error` ✅
- Comment notification failures: logged via `console.error` ✅
- Watcher notification inner `.catch(() => {})`: silently swallowed ⚠️
- Watcher `findMany().catch(() => {})`: silently swallowed ⚠️
- Realtime emissions `catch {}`: documented as best-effort ⚠️

**After fix:**
- All fire-and-forget paths now log via `console.error` with descriptive context
- Watcher notification failures: `console.error("Watcher notification failed:", err)` ✅
- Watcher lookup failures: `console.error("Watcher lookup failed:", err)` ✅
- Realtime emissions remain best-effort (empty catch with comment) — this is intentional per architecture

**Regression test added:** "watcher notification failure does not break primary mutation"

### 6. SLA Notification Deduplication — PASS

**Verification method:** Code inspection of `notification-service.js:34-45`, `sla-scan-service.js:23-163`

- **Dedup key:** (type, ticketId, recipientId, organizationId) — composite unique check via `prisma.notification.findFirst`
- If a notification with the same type/ticket/recipient/org exists, the existing record is returned without creating a duplicate
- `runSLABreachScan` only scans tickets where `responseSlaStatus: { in: ["ON_TRACK", "WARNING"] }` — once a ticket is marked BREACHED in the DB, subsequent scans skip it entirely
- Organization-safe: the dedup key includes `organizationId`, so tickets from different organizations are independent
- Ticket-safe: the dedup key includes `ticketId`, so notifications for different tickets are independent
- Within a single scan, each ticket is processed once (no double-processing)

---

## 8. Final Test Counts

| Metric | Value |
|---|---|
| Test files | 50 passed (0 failed) |
| Total tests | 1179 passed (0 failed) |
| Part 9 security regression tests | 5 new |
| Total Part 9 tests | 53 |
| Lint | 0 errors, 1 pre-existing warning |
| Prisma | schema valid |
| Build | compiled successfully |

### Security Test Summary

| Test | Area | Status |
|---|---|---|
| org room join uses server-derived organizationId | Org room security | PASS |
| no client event handler for joining user rooms | User room security | PASS |
| notification:new only reaches intended recipient | User room security | PASS |
| watcher notification failure does not break mutation | Fire-and-forget | PASS |
| realtime failure does not prevent persistence | Persist-first | PASS |

### Files Changed in Security Verification

| File | Change |
|---|---|
| `ticket-service.js` | Added `console.error` to watcher fire-and-forget catches |
| `watcher-service.js` | Added `console.error` to watcher fire-and-forget catches |
| `ai-part9-notifications-realtime.test.js` | Added 5 security regression tests (total: 53) |
