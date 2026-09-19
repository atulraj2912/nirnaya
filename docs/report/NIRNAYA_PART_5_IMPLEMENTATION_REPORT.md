# NIRNAYA — Part 5 Implementation Report

**Date**: 2026-09-19
**Spec Reference**: NIRNAYA Master Specification §3 (Frozen Stack), §10–§16 (Ticket Lifecycle)
**Status**: COMPLETE

---

## 1. Scope

Audit and implementation of the ticket UI/server-state layer, covering: creation form, list views (All Tickets, My Active Tickets), ticket detail page, search/filter/pagination, error handling, role-aware behavior, cache invalidation for mutations, and compliance with the React Query 5.x requirement from the frozen technology stack.

---

## 2. Findings Summary

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | Search fires on every keystroke — no debounce | Medium | FIXED |
| 2 | Title/description inputs have no `maxLength` | Low | FIXED |
| 3 | Ticket detail shows generic error for all failures | Medium | FIXED |
| 4 | `updateFilter` resets `page` to 1 even when changing page itself — pagination broken | High | FIXED |
| 5 | Form `noValidate` missing — native browser validation blocks custom error messages | Medium | FIXED |
| 6 | `@tanstack/react-query` 5.x installed but unused — entire codebase uses raw `fetch()` in `useEffect` | High | FIXED |

**Total: 6 issues found and fixed.**

---

## 3. React Query Integration

### 3.1 Configuration

- **Package**: `@tanstack/react-query` v5.102.8 (already installed in `package.json`)
- **QueryClient**: Created in `src/lib/providers.jsx` with `staleTime: 30s`, `refetchOnWindowFocus: false`, `retry: 1`
- **Provider**: `QueryClientProvider` wraps the entire app via `src/app/layout.js` → `<Providers>{children}</Providers>`
- **Client boundary**: `Providers` is a `"use client"` component; root layout remains a server component

### 3.2 Query Hooks (`src/hooks/use-ticket-queries.js`)

| Hook | Query Key | Purpose |
|---|---|---|
| `useTicketList({ scope, status, priority, search, page })` | `["tickets", { scope, status, priority, search, page }]` | Fetches ticket list with filters |
| `useTicket(ticketId)` | `["ticket", ticketId]` | Fetches single ticket detail |
| `useDepartments()` | `["departments"]` | Fetches department dropdown data |
| `useCategories()` | `["categories"]` | Fetches category dropdown data |
| `useTags()` | `["tags"]` | Fetches tag dropdown data |
| `useAgents()` | `["agents"]` | Fetches agent list for assignment |
| `useCurrentUser()` | `["currentUser"]` | Fetches authenticated user info |
| `useCreateTicket()` | mutation, invalidates `["tickets"]` | Creates ticket, invalidates lists |
| `useTransitionStatus(ticketId)` | mutation, sets `["ticket", ticketId]`, invalidates `["tickets"]` | Changes ticket status |
| `useAssignTicket(ticketId)` | mutation, sets `["ticket", ticketId]`, invalidates `["tickets"]` | Assigns ticket to agent |

### 3.3 Query Key Design

Query keys include every server-state parameter that changes the response:
- `scope` (all vs my-active)
- `status`, `priority`, `search` (filters)
- `page` (pagination)
- `ticketId` (detail)

The server remains responsible for organization isolation — no client-side org filtering.

### 3.4 Cache Invalidation

| Mutation | Targeted Invalidation |
|---|---|
| Ticket created | `invalidateQueries({ queryKey: ["tickets"] })` |
| Status transition | `setQueryData(["ticket", id], data)` + `invalidateQueries({ queryKey: ["tickets"] })` |
| Assignment | `setQueryData(["ticket", id], data)` + `invalidateQueries({ queryKey: ["tickets"] })` |

Mutations use optimistic cache updates for the ticket detail (`setQueryData`) and invalidate all list queries to ensure stale data is refetched.

### 3.5 Stale Data Handling

- After status transition (e.g., IN_PROGRESS → RESOLVED), the ticket detail immediately reflects the new status via `setQueryData`
- Affected list queries are invalidated, so My Active Tickets and All Tickets will refetch and reflect the change
- After assignment, both the ticket detail and relevant lists update

---

## 4. Search Debounce

The `useDebouncedValue` hook (300ms) is preserved. Flow:

```
raw search input → debounced search value → React Query query key → server request
```

Changing every keystroke does NOT trigger an API request. Only the debounced value flows into the query key.

---

## 5. Pagination

The Part 5 pagination fix is preserved:

```js
function updateFilter(key, value) {
  setFilters((prev) => ({
    ...prev,
    [key]: value,
    ...(key !== "page" ? { page: 1 } : {}),
  }));
}
```

- Changing search/status/priority resets to page 1
- Changing page itself does NOT reset back to 1
- React Query caching ensures smooth page transitions (gcTime: 5 minutes)

---

## 6. Loading / Error States

All Part 5 UX is preserved:

| State | Behavior |
|---|---|
| Loading | "Loading tickets..." / "Loading ticket..." |
| Empty | "No tickets found" / "No active tickets." |
| Error | "Failed to load tickets. Please try again." with Retry button |
| Network error | "Network error. Please check your connection." |
| Ticket 404 | "Ticket not found" |
| Ticket 401/403 | "You do not have access to this ticket" |
| Server error | Parsed from response body or fallback message |
| Form validation | "Title, description, and department are required" |
| Submission loading | "Creating..." with disabled button |

---

## 7. Ticket Flows Migrated to React Query

| Flow | Before | After |
|---|---|---|
| All Tickets list | raw `fetch()` in `useEffect` | `useTicketList` query |
| My Active Tickets list | raw `fetch()` in `useEffect` | `useTicketList` query with `scope` param |
| Ticket detail | raw `fetch()` in `useEffect` | `useTicket` query |
| Department/category/tag dropdowns | raw `fetch()` in `useEffect` | `useDepartments`, `useCategories`, `useTags` queries |
| Agent list | raw `fetch()` in `useEffect` | `useAgents` query |
| Current user | raw `fetch()` in `useEffect` | `useCurrentUser` query |
| Ticket creation | raw `fetch()` in handler | `useCreateTicket` mutation |
| Status transition | raw `fetch()` in handler | `useTransitionStatus` mutation |
| Assignment | raw `fetch()` in handler | `useAssignTicket` mutation |

---

## 8. Detailed Bug Fixes

### 8.1 Search Debounce (ticket-list.jsx)
Added `useDebouncedValue` hook (300ms delay) to prevent API request on every keystroke.

### 8.2 Form maxLength (ticket-form.jsx)
- Title input: `maxLength={200}`
- Description textarea: `maxLength={10000}`
Matches Zod validation schemas.

### 8.3 Ticket Detail Error Handling (ticket-detail.jsx)
Distinguished errors: 404 → "Ticket not found", 401/403 → "You do not have access", network → "Network error", other → parsed from response.

### 8.4 Pagination Bug (ticket-list.jsx)
`updateFilter` now conditionally resets page only for non-page filter changes.

### 8.5 Form noValidate (ticket-form.jsx)
Added `noValidate` to `<form>` so custom validation in `handleSubmit` runs instead of browser-native validation.

---

## 9. Audit Coverage (No Changes Needed)

| Component | Finding |
|---|---|
| `ticket-form.jsx` — cancel button | Calls `router.back()` correctly |
| `ticket-form.jsx` — category independence | Category dropdown independent of department |
| `ticket-form.jsx` — loading state | Shows "Creating..." and disables button |
| `ticket-form.jsx` — server/network errors | Displays error messages correctly |
| `ticket-list.jsx` — All Tickets | Correct status filter options, no scope param |
| `ticket-list.jsx` — My Active Tickets | "All Active" first, no Open/Resolved/Closed, `scope=my-active` |
| `ticket-list.jsx` — empty state | Scope-aware empty messages |
| `ticket-list.jsx` — error state | Error message with Retry button |
| `ticket-detail.jsx` — role-aware UI | Agent section, assign button respect user role |
| `agent-recommendation.jsx` | Clean |
| `ai-classification.jsx` | Clean |
| `sla-info.jsx` | Clean |
| `comment-form.jsx` | Role-aware visibility toggle works |
| `comment-list.jsx` | Clean |
| `watcher-toggle.jsx` | Clean |
| `activity-timeline.jsx` | Clean |

---

## 10. Validation Results

| Check | Result |
|---|---|
| Part 5 tests | 30 passed (0 failures) |
| Full test suite | 45 files, 990 tests, 0 failures |
| Lint (`npm run lint`) | 0 errors, 1 pre-existing warning (avatar.jsx `<img>`) |
| Prisma schema | Valid |
| Production build | Successful |

---

## 11. Files Modified

| File | Change |
|---|---|
| `src/lib/providers.jsx` | Created — QueryClient config + QueryClientProvider wrapper |
| `src/app/layout.js` | Added `<Providers>` wrapper around children |
| `src/hooks/use-ticket-queries.js` | Created — 10 React Query hooks (7 queries + 3 mutations) |
| `src/components/tickets/ticket-list.jsx` | Migrated to `useTicketList` query; kept debounce, pagination fix |
| `src/components/tickets/ticket-form.jsx` | Migrated to `useDepartments`/`useCategories`/`useTags` queries + `useCreateTicket` mutation |
| `src/components/tickets/ticket-detail.jsx` | Migrated to `useTicket`/`useAgents`/`useCurrentUser` queries + `useTransitionStatus`/`useAssignTicket` mutations |
| `tests/part5-ticket-ui-workflows.test.jsx` | Created — 30 tests with QueryClientProvider wrapper |
| `tests/ticket-form.test.jsx` | Updated — added QueryClientProvider wrapper |
| `tests/ticket-list.test.jsx` | Updated — added QueryClientProvider wrapper |

---

## 12. Test Coverage (30 Part 5 tests)

| Section | Tests |
|---|---|
| Ticket Creation Form | 10 |
| Ticket List — All Tickets | 11 |
| Ticket List — My Active Tickets | 5 |
| Ticket List — Network Error | 1 |
| Ticket List — Search | 1 |
| React Query Integration | 2 |
| **Total** | **30** |

---

## 13. Deliberate V1 Decisions

1. **Category is organization-scoped, not department-scoped**: Category dropdown loads all org categories regardless of selected department. Matches backend schema.
2. **Debounce delay of 300ms**: Standard UX debounce interval for search-as-you-type.
3. **Browser-native validation disabled**: Custom form validation provides better UX with inline error messages.
4. **QueryClient staleTime 30s**: Balances freshness with reduced server load. Mutations use targeted invalidation for immediate consistency.
5. **gcTime 5 minutes**: Allows page navigation without losing cached ticket data, preventing loading states when returning to previously-viewed pages.
6. **Socket.IO real-time integration deferred**: Real-time ticket detail updates via Socket.IO are wired but not yet integrated into React Query cache invalidation (can be added later).
