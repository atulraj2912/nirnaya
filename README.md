# NIRNAYA

AI-powered internal Enterprise IT Service Management (ITSM) and
intelligent IT help desk platform.

Status: **V1 — production-build ready.** All 12 phases complete.
See `docs/PROGRESS.md` for full history.

## Core Features

- **Ticket Management** — Create, track, assign, and resolve IT support tickets
- **Ticket Lifecycle** — State machine with enforced transitions (OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED)
- **AI Classification** — Automatic ticket categorization and priority detection via pluggable AI providers
- **Agent Recommendation** — Algorithmic scoring engine for optimal agent assignment based on workload, experience, and availability
- **SLA Engine** — Priority-based response/resolution tracking with configurable thresholds
- **Real-time Notifications** — Socket.IO-powered live updates for ticket changes, assignments, and SLA alerts
- **Comments & Activity** — Public/internal comments with full activity timeline
- **Watchers** — Subscribe to ticket updates
- **Admin Dashboard** — User, department, category, tag, and SLA configuration management
- **Multi-tenancy** — Organization-scoped data isolation with role-based access control (USER, AGENT, ADMIN)

## Architecture

```
Browser (React 19 + Tailwind CSS 4)
    │  HTTP (cookies: access/refresh JWT)
    ▼
Next.js App Router (route handlers + pages)
    │
    ▼
Service Layer (lib/services/*)
    │
    ▼
Prisma Client → Supabase PostgreSQL
    │
    ▼
Socket.IO (real-time notifications)
```

- Single Next.js application — no separate backend
- JavaScript only — no TypeScript
- JWT authentication via HTTP-only cookies
- RBAC with organization isolation
- Zod validation on all inputs

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, React Query 5 |
| Framework | Next.js 16.3.4 (App Router) |
| Database | Supabase PostgreSQL via Prisma 6.19.3 |
| Auth | jose 6.2.11 (JWT), bcrypt 6.0.0 |
| Realtime | Socket.IO 4.8.3 |
| Validation | Zod 4.5.4 |
| Testing | Vitest 5, Playwright 1.62 |

## Prerequisites

- Node.js >= 22.0.0
- Supabase PostgreSQL database (or compatible PostgreSQL)
- npm or compatible package manager

## Environment Setup

```bash
# Copy the template and fill in real values
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (pooled, Supabase port 6543) |
| `DIRECT_URL` | PostgreSQL direct connection (for Prisma schema operations, port 5432) |
| `JWT_ACCESS_SECRET` | Strong random secret for access token signing (min 16 chars) |
| `JWT_REFRESH_SECRET` | Strong random secret for refresh token signing (min 16 chars) |
| `SEED_ADMIN_PASSWORD` | Password for the bootstrap admin user (development only) |

Optional:

| Variable | Description |
|----------|-------------|
| `AI_PROVIDER` | AI provider: `"real"` for LLM, `"mock"` for keyword-based (default: `"mock"`) |
| `AI_API_KEY` | API key for the real AI provider (OpenAI-compatible) |
| `AI_API_BASE_URL` | API base URL (default: `https://api.openai.com/v1`) |
| `AI_MODEL` | Model name (default: `gpt-4o-mini`) |
| `PORT` | Server port (defaults to 3000) |

## Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Synchronize schema with database
npx prisma db push

# Seed demo data (optional, for development)
npx prisma db seed
# or
npm run prisma:seed
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin@acme-corp.com | Value of `SEED_ADMIN_PASSWORD` (default: `admin123`) |
| AGENT | sarah.chen@acme-corp.com | agent123 |
| USER | john.smith@acme-corp.com | user123 |

## Production Build

```bash
npm run build
npm run start
```

The production server uses a custom `server.js` that integrates Socket.IO
for real-time notifications alongside the Next.js application.

## Testing

```bash
# Unit/service/component tests
npm run test

# Watch mode
npm run test:watch

# End-to-end tests
npm run test:e2e

# Lint
npm run lint

# Prisma validation
npx prisma validate
```

## Security Notes

- JWT tokens are stored in HTTP-only, SameSite=Lax cookies
- All API routes enforce authentication and role-based authorization
- Organization data is strictly isolated — no cross-org access possible
- Input validation via Zod on all endpoints
- Pagination bounded (1-100) on all list endpoints
- No secrets or credentials are committed to the repository

## Documentation

- `docs/NIRNAYA_MASTER_SPEC.md` — Authoritative product/technical spec
- `docs/ARCHITECTURE.md` — Technical architecture, directory structure, data flow
- `docs/PROGRESS.md` — Phase status and completion history
- `docs/TEST_PLAN.md` — Testing strategy and coverage inventory
- `docs/DECISIONS.md` — Architectural decisions and rationale

## V1 Limitations

- AI classification uses a deterministic mock provider by default (configure `AI_PROVIDER` for real AI)
- SLA tracking is elapsed-time only (no business hours calculation)
- No file attachments on tickets
- No email notifications (in-app and real-time only)
- No internationalization (English only)
- Single-organization setup (multi-organization requires separate deployments)
