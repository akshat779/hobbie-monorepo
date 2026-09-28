# Hobbie Monorepo

Hobbie is a hyperlocal, real-time activity coordination platform focused on short-lived squads (sports, fitness, social, coworking) with trust, privacy, and geospatial discovery built in.

> Platform scope: **iOS + Android mobile app** (React Native/Expo) with a Fastify backend and Supabase/Postgres data layer.

## What this repository contains

- **`apps/mobile`**: Expo + React Native app (file routing with `expo-router`, NativeWind design system, Supabase auth/realtime).
- **`apps/server`**: Fastify API service for discovery, activity creation, join workflow, room messages, and feedback endpoints.
- **`packages/shared`**: Shared Zod schemas, constants, geo helpers, and generated Supabase `Database` types used by both apps.
- **`supabase`**: SQL migrations, seed data, and edge functions (`dev-phone-login`).
- **`docs`**: Architecture, API, design system, and testing runbooks.

## Monorepo layout

```text
hobbie-monorepo/
├── apps/
│   ├── mobile/
│   └── server/
├── packages/
│   └── shared/
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed.sql
├── docs/
├── ROADMAP.md
├── AGENTS.md
└── CLAUDE.md
```

## Core features implemented

- Phone auth + onboarding flows
- Real-time nearby discovery feed via PostGIS-backed RPC
- Activity creation with TTL expiry model (1–4 hours)
- Join request lifecycle (request / accept / decline)
- Atomic join acceptance transaction (`accept_join_request_tx`)
- Ephemeral room messaging and post-activity feedback endpoints
- Dev authentication and persona switching support for multi-user simulator testing

## Tech stack

- **Mobile**: Expo SDK 57, React Native 0.86, React 19, NativeWind, TanStack Query, Zustand
- **Backend**: Node.js, Fastify, Zod, Supabase JS
- **Database**: Supabase Postgres + PostGIS + Realtime + Edge Functions
- **Shared contracts**: TypeScript + Zod schemas + generated database types
- **Testing**: Vitest (unit/integration), Maestro (mobile E2E)

## Prerequisites

- Node.js **20+**
- npm (workspace-aware, comes with Node)
- Expo toolchain (for mobile development)
- Supabase project (for full-stack and integration testing)
- Maestro CLI (for E2E flows)

## Getting started

### 1) Install dependencies

```bash
npm install
```

### 2) Build shared package (recommended first run)

```bash
npm run build:shared
```

### 3) Configure environment variables

There are no committed `.env` files. Create local env files as needed.

#### Mobile (`apps/mobile/.env`)

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_DEV_AUTH_ENABLED=true
EXPO_PUBLIC_USE_REAL_SMS=false
```

#### Server (`apps/server/.env`)

```bash
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

#### Optional integration-test env

```bash
RUN_SUPABASE_INTEGRATION=true
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_E2E_HOST_PHONE=+919876543210
SUPABASE_E2E_JOINER_PHONE=+919876543211
```

### 4) Run the apps

```bash
# mobile app
npm run dev:mobile

# backend API
npm run dev:server
```

## Root scripts

| Command | Description |
|---|---|
| `npm run dev:mobile` | Starts Expo app (`apps/mobile`) |
| `npm run dev:server` | Starts Fastify server in watch mode (`apps/server`) |
| `npm run build:shared` | Builds `packages/shared` |
| `npm run test` | Runs shared + mobile tests |
| `npm run test:shared` | Runs shared package tests |
| `npm run test:mobile` | Runs mobile tests |
| `npm run test:integration:mobile` | Runs mobile Supabase integration test |
| `npm run test:e2e` | Runs Maestro flow suite |
| `npm run test:e2e:onboarding` | Runs onboarding Maestro flow |
| `npm run lint` | Runs workspace type/lint checks |
| `npm run typecheck` | Runs workspace type checks |

## Workspace scripts

### Server (`apps/server`)

```bash
npm run --workspace=apps/server dev
npm run --workspace=apps/server test
npm run --workspace=apps/server lint
npm run --workspace=apps/server typecheck
```

### Mobile (`apps/mobile`)

```bash
npm run --workspace=apps/mobile start
npm run --workspace=apps/mobile ios
npm run --workspace=apps/mobile android
npm run --workspace=apps/mobile test
npm run --workspace=apps/mobile test:integration
```

### Shared (`packages/shared`)

```bash
npm run --workspace=packages/shared build
npm run --workspace=packages/shared test
npm run --workspace=packages/shared typecheck
```

## API surface (Fastify)

Base: `/api/v1`

- `GET /discovery`
- `POST /activities` (auth)
- `POST /join-requests` (auth)
- `PATCH /join-requests/:id/respond` (auth)
- `POST /rooms/messages` (auth)
- `POST /ratings` (auth)

Health check:

- `GET /health`

## Database & Supabase notes

- Forward-only SQL migrations live in `supabase/migrations`.
- Seed personas and sample activities live in `supabase/seed.sql`.
- Dev auth edge function: `supabase/functions/dev-phone-login`.
- Shared generated DB types: `packages/shared/src/types/database.types.ts`.

## Testing strategy

- Unit tests: shared schemas/utils, mobile logic/components, server modules/routes
- Integration tests: mobile-to-real-Supabase workflow
- E2E tests: Maestro flows under `apps/mobile/.maestro`

Quick commands:

```bash
npm run test
npm run --workspace=apps/server test
npm run test:integration:mobile
npm run test:e2e
```

## Design & architecture docs

- `docs/ARCHITECTURE.md`
- `docs/API_SPEC.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/TESTING_STRATEGY.md`
- `ROADMAP.md`

## Development conventions

- Shared runtime contracts must be defined in `packages/shared`.
- Supabase clients should remain strongly typed with `Database` from `@hobbie/shared`.
- Keep mobile and server independently deployable.
- Follow existing Nocturnal Pulse design tokens for UI updates.

---

If you are onboarding to the codebase, start with:
1. `docs/ARCHITECTURE.md`
2. `docs/TESTING_STRATEGY.md`
3. `ROADMAP.md`
