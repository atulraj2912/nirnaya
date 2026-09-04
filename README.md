# NIRNAYA

AI-powered internal Enterprise IT Service Management (ITSM) and
intelligent IT help desk platform.

Status: **Phase 0 — project bootstrap.** See `docs/PROGRESS.md` for the
current state and `docs/NIRNAYA_MASTER_SPEC.md` for the full product
specification.

## Stack

Next.js (App Router) · React · JavaScript only · Prisma · Supabase
PostgreSQL · Tailwind CSS · Zod · React Query · Socket.IO · jose · bcrypt

## Getting started

```bash
npm install
cp .env.example .env   # fill in real values, never commit this file
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev            # start the Next.js dev server
npm run build           # production build
npm run start            # run the production build
npm run lint              # ESLint
npm run test               # Vitest unit/service/component tests
npm run test:e2e            # Playwright end-to-end tests
npm run prisma:validate      # validate prisma/schema.prisma
npm run prisma:generate       # generate the Prisma client
```

## Documentation

- `docs/NIRNAYA_MASTER_SPEC.md` — authoritative product/technical spec
- `docs/ARCHITECTURE.md` — technical architecture, directory structure, data flow
- `docs/PROGRESS.md` — phase status and remaining work
- `docs/TEST_PLAN.md` — testing strategy and coverage expectations
- `docs/DECISIONS.md` — architectural decisions and their rationale
