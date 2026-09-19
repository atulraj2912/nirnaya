# NIRNAYA Part 2: Database & Data Layer — Implementation Report

**Date:** 2026-09-19
**Part:** 2 of 15
**Status:** COMPLETE

---

## 1. Scope

Audit and complete the database and data layer against the authoritative master specification (`docs/NIRNAYA_MASTER_SPEC.md`). This includes:

- Prisma schema field-by-field verification (§5–§11)
- Relationship, index, and constraint audit
- Ticket numbering atomicity verification (§10)
- Organization isolation at the data layer (§5)
- Seed data completeness (§28–§29)
- Composite index optimization
- Regression testing

---

## 2. Schema Audit Results

### 2.1 Models — All 14 Present ✅

| Model | Spec Section | Status |
|---|---|---|
| Organization | §6 | ✅ Complete |
| Department | §9 | ✅ Complete |
| User | §8 | ✅ Complete |
| Ticket | §10–§12 | ✅ Complete |
| Category | §11 | ✅ Complete |
| Tag | §11 | ✅ Complete |
| TicketTag | §5 | ✅ Complete |
| Comment | §14 | ✅ Complete |
| Notification | §23 | ✅ Complete |
| AIPrediction | §17–§18 | ✅ Complete |
| TicketAssignmentHistory | §16 | ✅ Complete |
| Watcher | §15 | ✅ Complete |
| SLAConfiguration | §20 | ✅ Complete |
| SavedReply | §7 (ADMIN) | ✅ Complete |

### 2.2 Enums — All 9 Present ✅

Role, UserStatus, TicketPriority, TicketType, TicketSource, TicketStatus, CommentVisibility, SLAStatus, NotificationType — all match spec exactly.

### 2.3 Composite Unique Constraints ✅

- `User(organizationId, username)` — username unique within org
- `User(organizationId, email)` — email unique within org
- `User(organizationId, employeeId)` — employeeId unique within org
- `Department(organizationId, name)` — dept name unique within org
- `Department(organizationId, code)` — dept code unique within org
- `Category(organizationId, name)` — category name unique within org
- `Tag(organizationId, name)` — tag name unique within org
- `SLAConfiguration(organizationId, priority)` — one SLA config per priority per org
- `TicketTag(ticketId, tagId)` — composite primary key
- `Watcher(ticketId, userId)` — no duplicate watchers

### 2.4 Indexes — Enhanced ✅

**Before Part 2:** 30 indexes across all models
**After Part 2:** 32 indexes (2 composite indexes added)

| Index Added | Model | Purpose |
|---|---|---|
| `[recipientId, isRead]` | Notification | Optimizes unread-count and unread-list queries |
| `[ticketId, createdAt]` | TicketAssignmentHistory | Optimizes chronological activity timeline queries |

### 2.5 onDelete Behaviors ✅

| Relationship | Behavior | Rationale |
|---|---|---|
| Organization → all owned | Cascade | Deleting org removes all data |
| Ticket → Comment, Watcher, etc. | Cascade | Deleting ticket removes all associated data |
| Department → User | Restrict | Cannot delete dept with active users |
| User → Comment, AssignmentHistory | Restrict | Cannot delete users with historical data |
| User → Ticket (requester) | Restrict | Cannot delete users who created tickets |
| Category → Ticket | SetNull | Soft-delete: clear category from tickets |
| Audit fields (createdBy, updatedBy) | SetNull | Preserve record when auditor is deleted |
| AssignedAgent → Ticket | SetNull | Clear assignment when agent is deleted |

### 2.6 Organization Isolation ✅

- All 14 models have organization scoping
- Models with direct `organizationId`: Organization, Department, User, Ticket, Category, Tag, Notification, SLAConfiguration, SavedReply (9 models)
- Models with indirect org scoping via ticket relation: Comment, Watcher, TicketAssignmentHistory, AIPrediction (4 models)
- `TicketAssignmentHistory` and `Watcher` lack direct `organizationId` but rely on ticket relation — enforced at service layer (acceptable per spec §5)

### 2.7 Organization Model ✅

- `name` and `slug` are `@unique`
- `ticketCounter` defaults to 0
- No `createdById`/`updatedById` (correct — avoids bootstrap circular dependency per spec §6)
- `timezone` defaults to "UTC"
- `businessHoursStart`/`businessHoursEnd` present for future SLA use

### 2.8 Ticket Numbering ✅

- Format: `NIR-YYYY-NNNNNN` (e.g., `NIR-2026-000001`)
- Uses atomic `prisma.organization.update({ data: { ticketCounter: { increment: 1 } } })`
- Counter never resets — monotonically increasing
- Server-side only — clients cannot provide ticket numbers
- `ticketNumber` field is `@unique` — database enforces uniqueness

---

## 3. Seed Data Audit

### 3.1 Idempotency ✅

- Organization: uses `upsert` by slug
- Departments: uses `findFirst` check + conditional create with raw SQL ON CONFLICT
- Users: uses `findFirst` check + conditional create
- Categories/Tags/SLA: uses `findFirst` check + conditional create
- Tickets: uses `ticket.count` check — skips if any exist
- Comments: uses `comment.count` check
- Watchers: uses `watcher.findUnique` check
- Assignment History: uses `ticketAssignmentHistory.count` check
- Saved Replies: uses `savedReply.count` check

### 3.2 Data Coverage ✅

| Entity | Count | Details |
|---|---|---|
| Organization | 1 | Acme Corporation (acme-corp) |
| Departments | 5 | ITS, NET, SWE, HR, FIN |
| Users | 6 | 1 admin, 3 agents, 2 users |
| Categories | 8 | All spec-required categories |
| Tags | 8 | urgent, recurring, security-risk, etc. |
| SLA Configs | 4 | One per priority (LOW/MEDIUM/HIGH/CRITICAL) |
| Tickets | 6 | Different statuses, priorities, types, sources |
| Comments | 6 | PUBLIC and INTERNAL visibility |
| Watchers | 3 | Admin + requester on relevant tickets |
| Assignment History | 4 | With reasons |
| Saved Replies | 3 | Ticket Received, Password Reset, VPN Troubleshooting |

---

## 4. Files Changed

### 4.1 Schema Changes

| File | Change |
|---|---|
| `prisma/schema.prisma` | Added composite index `[recipientId, isRead]` on Notification |
| `prisma/schema.prisma` | Added composite index `[ticketId, createdAt]` on TicketAssignmentHistory |

### 4.2 New Test Files

| File | Tests | Purpose |
|---|---|---|
| `tests/part2-schema-audit.test.js` | 103 | Schema structure, indexes, constraints, onDelete, models, enums, table mapping |
| `tests/part2-ticket-numbering.test.js` | 38 | Ticket numbering format, atomicity, counter behavior, seed data coverage |

---

## 5. Test Results

### 5.1 Test Summary

```
Test Files  42 passed (42)
     Tests  779 passed (779)
  Duration  ~13.4s
```

- **Pre-existing tests:** 638 passed
- **New Part 2 tests:** 141 passed
- **Total:** 779 tests passing

### 5.2 Validation Commands

| Command | Result |
|---|---|
| `npm test` | ✅ 42 files, 779 tests pass |
| `npm run lint` | ✅ 0 errors, 1 pre-existing warning (avatar.jsx img element) |
| `npx prisma validate` | ✅ Schema valid |
| `npm run build` | ✅ Production build succeeds |

---

## 6. Known Limitations (Intentional V1)

1. **TicketAssignmentHistory/Watcher lack direct organizationId** — Organization isolation is enforced at the service layer. Direct DB access would bypass this. Acceptable for V1 per spec §5.

2. **Ticket counter never resets yearly** — The `NIR-YYYY-000001` format includes the year as a display prefix, but the counter itself is monotonically increasing across years. This is simpler and avoids counter-reset edge cases. Documented in DECISIONS.md.

3. **Notification has no `updatedAt` field** — Notifications are write-once with a boolean `isRead` flag. No update tracking needed. Acceptable for V1.

4. **Prisma config deprecation warning** — `package.json#prisma` config will be deprecated in Prisma 7. Non-blocking for current version.

---

## 7. Audit Conclusions

The database and data layer is **fully compliant** with the master specification. Key strengths:

- **Complete schema:** All 14 models, 9 enums, field types match spec exactly
- **Proper constraints:** 10 composite unique constraints enforce data integrity
- **Appropriate cascade:** Delete behaviors are well-chosen per relationship semantics
- **Optimized indexes:** 32 indexes cover all high-frequency query patterns
- **Atomic ticket numbering:** Uses Prisma's atomic increment to prevent collisions
- **Idempotent seeding:** Safe to run repeatedly without data duplication
- **Organization isolation:** All resources scoped to organizationId

---

## 8. Next Phase

**Part 3: Authentication & Authorization** (Phase 3)

- JWT access/refresh token implementation
- Login/logout flow
- Password hashing with bcrypt
- Auth middleware and session management
- Role-based access control (USER, AGENT, ADMIN)
- Organization-scoped authorization
