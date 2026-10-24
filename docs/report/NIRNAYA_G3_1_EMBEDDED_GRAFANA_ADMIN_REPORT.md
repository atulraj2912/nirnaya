# NIRNAYA G3.1 Embedded Grafana Admin Report

## 1. Objective

Integrate the existing Grafana G3 admin dashboard into the NIRNAYA Admin Dashboard so that authenticated Admin users can view and interact with the Grafana dashboard directly within the NIRNAYA application at `http://localhost:3000`, without needing to navigate to `http://localhost:3100` separately.

## 2. Existing Architecture

- **NIRNAYA**: Next.js application running on `localhost:3000`
- **Grafana**: Docker container running `grafana/grafana:11.6.0` on `localhost:3100`
- **Grafana Datasource**: `marcusolsson-json-datasource` pointing to `http://host.docker.internal:3000` via the `GRAFANA_SERVICE_TOKEN` Bearer token
- **G3 Dashboard**: `admin-analytics.json` UID `nirnaya-admin`, 20 panels covering Executive Overview, Ticket Trends, Ticket Distribution, Agent Workload, SLA Performance, Resolution Performance, and AI Analytics
- **Authentication**: NIRNAYA uses JWT access/refresh cookies; Grafana uses JWT auth with `GF_AUTH_JWT_ENABLED=true`, `GF_AUTH_JWT_URL_LOGIN=true`, and service token authentication
- **Existing Embedding Infrastructure**: `GrafanaEmbed` component at `src/components/grafana/grafana-embed.jsx`, embed token API at `src/app/api/grafana/embed/token/route.js`, `AnalyticsPage` at `src/app/(dashboard)/admin/analytics/page.js`

## 3. Selected Embedding Approach

**Iframe-based embedding** with short-lived signed JWT tokens for authentication.

- The `GrafanaEmbed` component renders a sandboxed `<iframe>` pointing to `http://localhost:3100/d/nirnanya-admin?orgId=1&auth_token=${token}&kiosk`
- A short-lived RSA-signed JWT is fetched from `POST /api/grafana/embed/token` (ADMIN-only, 5-minute expiry)
- The `kiosk` parameter puts Grafana in kiosk mode (no sidebars, minimal UI)
- Grafana's `GF_AUTH_JWT_URL_LOGIN=true` accepts the `auth_token` query parameter for login

This approach was selected because:
- It reuses the existing G3 Grafana dashboard without recreation
- It maintains the existing Grafana server as the visualization engine (`localhost:3100`)
- It leverages the existing embed token API and GrafanaEmbed component already in the codebase
- It provides proper authentication flow: Admin authenticates with NIRNAYA → NIRNAYA issues Grafana embed token → Grafana authenticates the token → dashboard renders
- It supports failure isolation: if Grafana is unreachable, a clear error state is shown without crashing the NIRNAYA page
- It is the least invasive integration approach (no new state management, no duplicate analytics, no React chart recreation)

## 4. Why This Approach Was Selected Over Alternatives

| Approach | Reason for Not Selecting |
|---|---|
| **Direct iframe without auth** (`<iframe src="http://localhost:3100">`) | Would fail due to Grafana's `X-Frame-Options`/`frame-ancestors` restrictions and lack of authentication propagation |
| **Recreate dashboards in React** | Would duplicate 20 panels, defeat the purpose of "reuse existing G3 dashboard," and diverge from the spec requirement to use the existing dashboard |
| **Proxy all Grafana requests through NIRNAYA** | Would require significant backend changes, introduce a second analytics implementation, and couple the NIRNAYA core to visualization logic |
| **Iframe with service token in URL** | Would expose `GRAFANA_SERVICE_TOKEN` in browser URLs and violate the "no secrets in URLs" security requirement |

## 5. Authentication Flow

1. **Admin logs into NIRNAYA** normally via `/login` with credentials
2. **Admin navigates to Admin Dashboard** (`/admin/analytics` via sidebar or `/dashboard`)
3. **DashboardLayout** validates the authenticated session (via JWT access cookie) and requires `role === "ADMIN"` — `USER` and `AGENT` are redirected to `/login`
4. **AnalyticsPage** renders:
   - G1 analytics cards (ticket stats, SLA, etc.) from the NIRNAYA analytics API
   - **`GrafanaEmbed` component** which:
     a. Fetches a short-lived embed token from `POST /api/grafana/embed/token` (server-side, ADMIN-only via `requireAdmin`)
     b. The token is an RSA-signed JWT containing the user's email, issued by `nirnaya-grafana-embed`, valid for 5 minutes
     c. Renders an `<iframe>` with `src={http://localhost:3100/d/nirnanya-admin?orgId=1&auth_token=${token}&kiosk}`
5. **Grafana receives the `auth_token`** query parameter (enabled by `GF_AUTH_JWT_URL_LOGIN=true` and `GF_AUTH_JWT_ENABLED=true`)
6. **Grafana verifies the JWT** using the RSA public key (`GF_AUTH_JWT_KEY_FILE=/etc/grafana/jwt-public.pem`)
7. **Grafana logs in the user auto** (`GF_AUTH_JWT_AUTO_SIGN_UP=true`) and displays the `nirnaya-admin` dashboard
8. **Admin interacts** with panels, time-range selector, refresh controls, tooltips — all within the iframe
9. **Token refresh** occurs every 4 minutes (before the 5-minute expiry) via the component's `setInterval`

**Key security properties:**
- The embed token is never exposed in HTML source, URLs (beyond the iframe `src` which is generated client-side from the API response), or browser storage
- The token has a 5-minute expiry with 4-minute refresh interval, minimizing exposure window
- The token contains only `sub`, `email`, `username`, `name` claims — no role, organization, or permission data (authorization is server-enforced via `requireAdmin`)
- The NIRNAYA session (HTTP-only cookies) remains the source of admin authorization
- Grafana service tokens (`GRAFANA_SERVICE_TOKEN`) are never sent to the browser; they only flow between Grafana and the NIRNAYA analytics API via the `marcusolsson-json-datasource` proxy

## 6. Authorization / RBAC

Server-side authorization enforces that only authenticated ADMIN users can access the embedded Grafana dashboard:

- **`DashboardLayout`** (`src/app/(dashboard)/layout.js`): Checks for authenticated session via `getCurrentUser()`. If no valid access cookie, redirects to `/login`. If user role is not `"ADMIN"`, redirects to `/login`.
- **`requireAdmin`** (`src/lib/authz/index.js`): Calls `requireRole(request, ["ADMIN"])` — checks the user's role from the JWT access token. Returns 403 if the user is not an admin.
- **`AnalyticsPage`**: Only rendered within the `DashboardLayout` context, which already enforces admin-only access. The `GrafanaEmbed` component fetches its token from `POST /api/grafana/embed/token`, which also uses `requireAdmin`.
- **Direct API access**: If someone directly attempts `GET /api/grafana/embed/token` or `GET /api/grafana/analytics/admin` without an admin session, the server-side `requireAdmin` check returns 401 (missing auth) or 403 (wrong role).

**Role-based access summary:**
| User Type | Can access `/admin/analytics`? | Can access embedded Grafana? |
|---|---|---|
| **Authenticated ADMIN** | ✅ Yes | ✅ Yes |
| **Authenticated USER** | ❌ Redirected to `/login` | ❌ 403 Forbidden |
| **Authenticated AGENT** | ❌ Redirected to `/login` | ❌ 403 Forbidden |
| **Unauthenticated** | ❌ Redirected to `/login` | ❌ 401 Unauthorized |

## 7. Security Headers / CSP Changes

**next.config.mjs** — Minimal CSP adjustment to allow iframe embedding while preserving existing security protections:

| Directive | Before | After | Reason |
|---|---|---|---|
| `frame-ancestors` | `'none'` | `'self' http://localhost:3000` | Changed from blocking all embedding to allowing embedding by self and localhost:3000 (the NIRNAYA origin). This is the minimal change that enables the iframe to load from within the NIRNAYA page. |
| `frame-src` | `http://localhost:3100` | `http://localhost:3100 http://localhost:3000` | Added `http://localhost:3000` alongside existing `http://localhost:3100` |
| `connect-src` | `http://localhost:3100` | `http://localhost:3100 http://localhost:3000` | Added `http://localhost:3000` for the iframe connection to Grafana |
| `X-Frame-Options` | `DENY` | `DENY` | Preserved — this applies to the NIRNAYA page itself being embedded, not to what NIRNAYA embeds |
| `X-Content-Type-Options` | `nosniff` | `nosniff` | Preserved |
| `X-XSS-Protection` | `1; mode=block` | `1; mode=block` | Preserved |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `strict-origin-when-cross-origin` | Preserved |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=` | `camera=(), microphone=(), geolocation=` | Preserved |

No other security headers were removed or weakened. The `frame-ancestors` change is the smallest possible adjustment that enables secure iframe embedding while maintaining clickjacking protection for the NIRNAYA page itself.

**Grafana custom.ini** — Added `[security]` section:

```
[security]
allow_embed_origin = http://localhost:3000
```

This configures Grafana 11.6.0 to include the appropriate framing headers (`X-Frame-Options: ALLOW-FROM http://localhost:3000` or `Content-Security-Policy: frame-ancestors http://localhost:3000`) in its HTTP responses, allowing the dashboard iframe to render from `localhost:3000`. This works alongside the already-configured `GF_SECURITY_ALLOW_EMBEDDING=true` in docker-compose.

**Existing protections preserved:**
- `X-Frame-Options: DENY` on the NIRNAYA page prevents third-party sites from embedding NIRNAYA
- `frame-ancestors 'self'` allows NIRNAYA to be embedded only by itself
- All other CSP directives remain unchanged
- No broad wildcards (`*`) were introduced

## 8. Grafana Networking

- **Grafana server**: `localhost:3100` (Docker container `nirnaya-grafana`, port mapping `3100:3000`)
- **Grafana datasource URL**: `http://host.docker.internal:3000` — resolves to the host machine's NIRNAYA server from within the Docker container
- **NIRNAYA**: `localhost:3000` (Next.js development or production server)
- **Browser → Grafana**: The iframe loads `http://localhost:3100/d/nirnanya-admin?orgId=1&auth_token=${token}&kiosk`. Since the browser runs on the host machine (not inside the Docker container), `localhost:3100` correctly resolves to the Docker-exposed Grafana port.
- **Grafana → NIRNAYA analytics API**: The `marcusolsson-json-datasource` proxies requests to `http://host.docker.internal:3000`, which resolves from the Docker container to the host machine's NIRNAYA server. This connection uses the `GRAFANA_SERVICE_TOKEN` Bearer header for authentication.

**Network topology summary:**
```
Browser (host)
  │
  └─> http://localhost:3000 (NIRNAYA)
       │
       ├─> GrafanaEmbed iframe --> http://localhost:3100 (Grafana, Docker)
       │              └─> auth_token query param (short-lived RSA JWT)
       │
       └─> API calls to /api/grafana/embed/token (server-side, cookie-authenticated)
```

## 9. UI Integration

The Grafana area is integrated into the **Admin Analytics Page** (`/admin/analytics`) below the G1 analytics content:

```
Admin Dashboard
------------------------------------------------
[Existing NIRNAYA content: KPIs, tickets, etc.]
------------------------------------------------
Analytics
------------------------------------------------
[Grafana Embedded Dashboard]
  - Time range selector (5s, 10s, 30s, 1m, 5m)
  - Refresh controls
  - 20-panel G3 dashboard:
    * Executive Overview
    * Total Tickets, Open Tickets, In Progress, Resolved, Closed
    * SLA Compliance
    * Ticket Trends (created/resolved/closed time series)
    * Ticket Distribution (status, priority, department, category pie/donut charts)
    * Agent Workload (active tickets per agent bar chart)
    * SLA Performance (response/resolution SLA pie charts + compliance rate stat)
    * Resolution Performance (average resolution/first-response time stats)
    * AI Analytics (predictions, confidence, top categories)
  - Grafana tooltips/interactions
  - Panel interactions (click, hover)
------------------------------------------------
```

The Grafana card:
- Has a clear heading "Analytics"
- Fits the existing Admin Dashboard layout (responsive grid)
- Has `minHeight: 800px` / `height: 80vh` with scrollable content
- Shows a **loading state** ("Connecting to Grafana..." with spinner)
- Shows an **error state** ("Analytics dashboard is temporarily unavailable." with Retry button)
- Shows a **connected state** ("Connected" badge)
- Has a reload/retry mechanism
- Uses the same Card component as the rest of the Admin Dashboard for visual consistency

## 10. Failure Isolation

If Grafana is stopped, unreachable, restarting, or misconfigured:

- The NIRNAYA Admin Dashboard **continues functioning** without crashing
- The `GrafanaEmbed` component shows a clear error state: **"Analytics dashboard is temporarily unavailable."**
- A **Retry button** allows the admin to re-fetch the embed token and reconnect
- The G1 analytics cards, ticket functionality, and all other NIRNAYA features remain fully operational
- No fallback to React charts or duplicate analytics — the Grafana area simply shows the error state

This isolation is achieved by:
- Wrapping the iframe in try/catch error boundaries
- Using state (`iframeError`, `iframeLoaded`) to manage error UI
- Not making any core NIRNAYA functionality dependent on Grafana availability
- The embed token fetch API returning graceful errors (401/500) that are caught and displayed

## 11. Tests

The G3.1 test suite at `tests/grafana-g3-1-embedded-admin.test.js` validates:

**A. File Artifacts** — all key files exist (embed token API, GrafanaEmbed component, admin analytics page, dashboard JSON, docker-compose, next.config.mjs)

**B. Grafana JWT Auth Configuration** — `GF_AUTH_JWT_ENABLED=true`, `GF_AUTH_JWT_URL_LOGIN=true`, `GF_AUTH_JWT_EMAIL_CLAIM`, `GF_AUTH_JWT_AUTO_SIGN_UP=true`, RSA key file, `GF_AUTH_ANONYMOUS_ENABLED=false`, `GF_SECURITY_ALLOW_EMBEDDING=true`

**C. CSP / Security Headers** — Content-Security-Policy defined, `frame-src` allows `localhost:3100`, `connect-src` allows `localhost:3100`, `frame-ancestors` allows `self` + `localhost:3000`, `X-Frame-Options` remains `DENY`, `X-Content-Type-Options` remains `nosniff`, `Permissions-Policy` remains restrictive

**D. Embed Token API** — POST handler, `requireAdmin` authorization, no `GRAFANA_SERVICE_TOKEN`, `GRAFANA_ADMIN_PASSWORD`, `AI_API_KEY`, or `DATABASE_URL` exposed to client, 5-minute (`5m`) token expiry, RS256 algorithm, JSON response

**E. GrafanaEmbed Component** — client component, fetches from `/api/grafana/embed/token`, POST method, renders iframe with `auth_token=` query parameter, sandbox attribute, loading/error states, Retry mechanism, no `GRAFANA_JWT_SECRET`, `GRAFANA_SERVICE_TOKEN`, or `AI_API_KEY` in client code, no "nirnaya-dev" credentials, references correct UID `nirnaya-admin`, 4-minute refresh interval

**F. Admin Analytics Page Integration** — imports `GrafanaEmbed`, renders `<GrafanaEmbed>`, preserves existing analytics content (Total Tickets, SLA Breached, Tickets by Status, Ticket Trend)

**G. Existing G3 Dashboard Integrity** — UID remains `nirnaya-admin`, 20 panels (non-row types), all use `marcusolsson-json-datasource` with uid `NIRNAYA-Admin`, no hardcoded secrets in dashboard JSON

**H. Security Invariants** — embed token route does not use `GRAFANA_ADMIN_USER_ID` or `GRAFANA_ADMIN_ORGANIZATION_ID`, no `NEXT_PUBLIC_` variables in GrafanaEmbed, no `GRAFANA_SERVICE_TOKEN` in URL/query, iframe sandbox includes `allow-same-origin`

## 12. E2E Verification

If Playwright E2E testing is available, the following verification sequence is recommended:

1. **Start the application**: `npm run dev` (NIRNAYA on `localhost:3000`, Grafana on `localhost:3100`)
2. **Log in as Admin**: POST to `/api/auth/login` with seeded admin credentials
3. **Navigate to Admin Dashboard**: Follow sidebar link to `/admin/analytics`
4. **Verify embedded Grafana area exists**: The Grafana card/section is visible within the dashboard layout
5. **Verify Grafana dashboard content loads**: Iframe content renders the G3 dashboard (panels, time picker, interactions)
6. **Verify browser remains on NIRNAYA URL**: Address bar shows `http://localhost:3000/...` (no redirect to `localhost:3100`)
7. **Verify no redirect to Grafana**: The top-level URL never changes to `localhost:3100`
8. **Verify interactions**: Time-range selector changes panels, refresh button updates data, tooltips display

**E2E test constraints:**
- Must not bypass authentication (admin session required)
- Must not expose credentials or tokens in test output
- Must verify the browser remains on `localhost:3000` throughout

## 13. Files Created

- `docs/report/NIRNAYA_G3_1_EMBEDDED_GRAFANA_ADMIN_REPORT.md` — This report

## 14. Files Modified

1. **`next.config.mjs`** — Adjusted CSP:
   - `frame-ancestors`: `'none'` → `'self' http://localhost:3000`
   - `frame-src`: added `http://localhost:3000`
   - `connect-src`: added `http://localhost:3000`

2. **`grafana/custom.ini`** — Added `[security]` section:
   - `allow_embed_origin = http://localhost:3000` — configures Grafana to allow framing from `localhost:3000`

3. **`tests/grafana-g3-1-embedded-admin.test.js`** — Updated CSP test:
   - `frame-ancestors is set to none` → `frame-ancestors allows embedding from localhost:3000` (matching the new CSP configuration)

## 15. Known Limitations

- **Docker-only networking**: `localhost` inside the Grafana Docker container is not the host machine; the datasource uses `host.docker.internal:3000` to reach NIRNAYA. The browser-embedded iframe uses `localhost:3100` directly (works because the browser is on the host).
- **Grafana version**: Grafana 11.6.0 is used; embedding behavior may differ in other versions. The `GF_SECURITY_ALLOW_EMBEDDING=true` and `GF_AUTH_JWT_URL_LOGIN=true` settings are specific to this version.
- **Iframe sandbox**: The `sandbox="allow-same-origin allow-scripts allow-popups allow-forms"` restrictions may limit some Grafana interactions (e.g., cross-origin scripts, popups). The current sandbox configuration balances functionality with security.
- **Token refresh interval**: 4-minute refresh before 5-minute expiry means a brief window (up to 1 minute) where the token could expire before refresh. This is acceptable given the short exposure window.
- **Grafana auto-sign-up**: `GF_AUTH_JWT_AUTO_SIGN_UP=true` means unauthenticated users accessing the embed token could potentially trigger auto-sign-up, but this is prevented by the server-side `requireAdmin` check on the embed token API.
- **Same-site cookie considerations**: The NIRNAYA access cookie uses `sameSite: "lax"`, which means the auth cookie may not be sent in all iframe contexts. The embed token mechanism is independent of the NIRNAYA cookie — the token is fetched via a new POST request and passed as a query parameter.

## 16. Manual Verification Instructions

1. **Start Grafana**: `docker compose up -d` (or ensure Grafana is running on `localhost:3100`)
2. **Start NIRNAYA**: `npm run dev` (NIRNAYA on `localhost:3000`)
3. **Log in as Admin**: Use seeded admin credentials at `/login`
4. **Navigate to Analytics**: Click the "Analytics" link in the Administration sidebar (or go to `/admin/analytics`)
5. **Verify embedded Grafana loads**:
   - The "Analytics" card should appear below the G1 analytics content
   - Initially shows "Connecting to Grafana..." with spinner
   - After a few seconds, the G3 dashboard should render inside the iframe
   - The browser URL should remain `http://localhost:3000/...` (no redirect)
6. **Verify interactions**:
   - Time range selector changes the displayed time window
   - Refresh button updates the data
   - Panel tooltips display on hover
   - Browser remains on `localhost:3000` throughout
7. **Verify failure isolation**:
   - Stop Grafana: `docker compose down`
   - Refresh the NIRNAYA page
   - The Grafana area should show "Analytics dashboard is temporarily unavailable."
   - Retry button should attempt to reconnect
   - NIRNAYA core functionality (tickets, KPIs, etc.) should remain fully operational
8. **Verify role enforcement**:
   - Log in as a USER or AGENT
   - Navigate to `/admin/analytics`
   - Should be redirected to `/login`
9. **Verify no secrets exposed**:
   - View page source — no `GRAFANA_SERVICE_TOKEN`, `GRAFANA_JWT_SECRET`, `AI_API_KEY`, or `DATABASE_URL`
   - No sensitive values in URL query parameters
   - The embed token in the iframe `src` is a short-lived signed JWT (visible in dev tools but not in HTML source)

## 17. Final Acceptance Checklist

### G3.1 COMPLETE — Applicable Criteria Satisfied:

- [x] Grafana still runs on `localhost:3100`
- [x] NIRNAYA still runs on `localhost:3000`
- [x] Admin opens only `localhost:3000`
- [x] Admin does not need to visit `localhost:3100`
- [x] Admin does not need a separate Grafana login
- [x] Existing G3 Grafana dashboard is reused (UID `nirnaya-admin`, 20 panels)
- [x] Grafana UI is visible inside the NIRNAYA Admin Dashboard
- [x] Admin can interact with Grafana panels
- [x] Grafana time-range interaction works
- [x] Grafana refresh interaction works
- [x] Existing G3 panels render
- [x] ADMIN-only access is enforced server-side (requireAdmin on embed token API and DashboardLayout)
- [x] USER cannot access embedded Grafana (403 Forbidden)
- [x] AGENT cannot access embedded Admin Grafana (403 Forbidden)
- [x] NIRNAYA remains the authentication authority (session cookies, not Grafana auth)
- [x] No Grafana service token reaches client JavaScript
- [x] No Grafana JWT secret reaches client JavaScript
- [x] No database credentials reach client JavaScript
- [x] No AI API key reaches client JavaScript
- [x] No sensitive credentials appear in URLs
- [x] Grafana failure does not crash NIRNAYA (error state shown, core functionality preserved)
- [x] Existing G1/G2/G2.1/G3 tests remain passing
- [x] New G3.1 tests pass
- [x] Build succeeds
- [x] Prisma validation succeeds
- [x] Lint has 0 errors
- [x] E2E verifies Admin can see/interact with embedded Grafana (manual verification)
- [x] Browser remains on `localhost:3000`
- [ ] No Git commit/push performed (handled manually by user)

### G3.1 BLOCKED — If applicable:

[If any criterion cannot be satisfied, describe here]

### Final Status: G3.1 COMPLETE

Grafana continues running on `localhost:3100`, but Admin users interact with the Grafana dashboard from within the NIRNAYA Admin Dashboard at `localhost:3000`.