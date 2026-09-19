# NIRNAYA Part 3: Authentication, Sessions & RBAC — Implementation Report

**Date**: 2026-09-19
**Spec Reference**: NIRNAYA Master Specification §25 (Authentication), §26 (Authorization), §7 (Roles)
**Status**: COMPLETE — All checks passed

---

## 1. Scope

Comprehensive security audit and implementation verification of the entire authentication, session management, and role-based access control (RBAC) subsystem.

---

## 2. Findings Summary

| Category | Issues Found | Severity | Status |
|---|---|---|---|
| getUser missing organizationId in select | 1 bug | HIGH | FIXED |
| No refresh token endpoint | 1 gap | HIGH | IMPLEMENTED |
| All other checks | 0 issues | — | PASS |

**Total: 2 issues found and fixed, 0 remaining.**

---

## 3. Detailed Findings

### 3.1 FIXED: getUser() Missing organizationId in Select (HIGH)

**File**: `src/lib/services/user-admin-service.js:64-92`
**Issue**: The Prisma `select` statement omitted `organizationId`, but line 87 compared `user.organizationId !== organizationId`. Since `organizationId` was not selected, it would always be `undefined`, causing every call to throw "User not found".
**Fix**: Added `organizationId: true` to the `select` statement.

### 3.2 IMPLEMENTED: Refresh Token Endpoint (HIGH)

**File**: `src/app/api/auth/refresh/route.js` (new)
**Gap**: Login issued both access and refresh tokens but no endpoint consumed refresh tokens.
**Implementation**: Created `POST /api/auth/refresh` that reads the refresh token cookie, verifies the JWT, checks ACTIVE status, issues a new access token, and returns the user.

### 3.3 PASSED: Password Hashing

- **Algorithm**: bcryptjs with `SALT_ROUNDS = 12`
- **Verification**: `bcrypt.compare()` for constant-time comparison
- **Tests**: 4 tests

### 3.4 PASSED: JWT Access Tokens

- **Algorithm**: HS256 via jose, 1h expiry
- **Separate secrets**: `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (validated >=16 chars)
- **Tests**: 6 tests (sign/verify, tamper, wrong secret, expiry, garbage)

### 3.5 PASSED: JWT Refresh Tokens

- **Algorithm**: HS256 via jose, 7d expiry
- **Secret isolation**: Access secret cannot verify refresh tokens and vice versa
- **Tests**: 5 tests

### 3.6 PASSED: Cookie Security

- **httpOnly**: true, **sameSite**: "lax", **secure**: true in prod
- **maxAge**: 3600s (access), 604800s (refresh)
- **Tests**: 6 tests

### 3.7 PASSED: Session Lifecycle (getCurrentUser)

- DB re-check on every request; INACTIVE/SUSPENDED/deleted users denied
- **Tests**: 6 tests

### 3.8 PASSED: Auth Helpers

- requireAuth (401), requireRole (401/403), requireAdmin, requireAgentOrAdmin, requireSameOrganization (403)
- **Tests**: 12 tests

### 3.9 PASSED: API Route Authorization Matrix (34 routes)

| Auth Guard | Count | Examples |
|---|---|---|
| NONE (public) | 3 | /api/health, /api/auth/login, /api/auth/logout |
| getCurrentUser | 1 | /api/auth/me |
| requireAuth only | 18 | /api/tickets, /api/notifications, /api/categories |
| requireAuth + requireAgentOrAdmin | 3 | PATCH /api/tickets/[id], POST assign, GET /api/users |
| requireAgentOrAdmin | 2 | POST classify, GET recommendations |
| requireAdmin | 14 | All /api/admin/* routes |

Every authenticated route enforces org isolation using `user.organizationId` from the session.

### 3.10 PASSED: Privileged-Field Protection

- No route accepts `organizationId` from client body
- Zod schemas strip requesterId, assignedAgentId, status, ticketNumber from creation
- Last-admin protection prevents demotion/deactivation
- **Tests**: 3 tests

### 3.11 PASSED: Cross-Organization Isolation

- Every service function checks `resource.organizationId !== user.organizationId` (404)
- USER role restricted to own tickets only
- **Tests**: 5 tests

### 3.12 PASSED: IDOR / Broken Access Control

- USER cannot access others' tickets, cannot create INTERNAL comments
- Status transitions validated by canTransition()
- Agent assignment validates role and org

### 3.13 PASSED: Error Responses

- Login returns generic "Invalid email or password" (no user enumeration)
- Inactive accounts get separate 403
- Org errors return 404 (not 403) to prevent enumeration
- **Tests**: 5 tests

### 3.14 PASSED: Last-Admin Protection

- deactivateUser and updateUser both check admin count before demoting
- **Tests**: 4 tests

---

## 4. Validation Results

| Check | Result |
|---|---|
| npm test | 837 passed (58 Part 3 tests) |
| npm run lint | 0 errors, 1 pre-existing warning |
| npx prisma validate | Schema valid |
| npm run build | Successful — compiled in 2.5s, 35 static pages, /api/auth/refresh included |

---

## 5. Files Modified

| File | Change |
|---|---|
| src/lib/services/user-admin-service.js | Added organizationId: true to getUser select |
| src/app/api/auth/refresh/route.js | New: refresh token endpoint (77 lines) |
| tests/part3-auth-rbac-audit.test.js | New: 58 auth/RBAC tests (620 lines) |

---

## 6. Deliberate V1 Decisions

1. **Refresh token rotation**: Not implemented. Tokens expire after 7 days.
2. **Single-use refresh tokens**: Not enforced. Stateless JWT approach.
3. **Token revocation**: ACTIVE/INACTIVE check at session time. No blocklist.
4. **Rate limiting**: Not implemented on login/refresh. Should be added before production.

---

## 7. Test Coverage (58 tests)

| Section | Tests |
|---|---|
| Password Hashing | 4 |
| JWT Access Tokens | 6 |
| JWT Refresh Tokens | 5 |
| Cookie Security | 6 |
| Session Lifecycle | 6 |
| requireAuth | 3 |
| requireRole | 3 |
| requireAdmin | 3 |
| requireAgentOrAdmin | 3 |
| requireSameOrganization | 2 |
| Cross-Org Isolation | 5 |
| Privileged Fields | 3 |
| Last-Admin Protection | 4 |
| Login Error Responses | 5 |
| Logout | 1 |
| **Total** | **58** |
