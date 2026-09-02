# Hobbie — Hyperlocal Ephemeral Activity Coordination App

## 1. System Architecture & Boundaries

The codebase is organized as an independently-deployable monorepo (pnpm / Turborepo):

```
hobbie/
├── apps/
│   ├── mobile/                    # React Native + Expo (Managed Workflow, expo-router, NativeWind v4)
│   │   ├── app/                   # File-based routing (expo-router)
│   │   ├── src/
│   │   │   ├── components/ui/     # Reusable design system primitives (Buttons, Chips, Cards, BottomSheets)
│   │   │   ├── features/          # Domain-sliced modules (auth, discovery, room, trust, feedback)
│   │   │   ├── hooks/             # Custom React hooks
│   │   │   ├── services/          # Supabase client, Backend API client
│   │   │   ├── store/             # Zustand (client/ephemeral state), TanStack Query (server state)
│   │   │   └── global.css         # NativeWind / Tailwind CSS theme tokens & utilities
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── server/                    # Node.js + Fastify API Service (TypeScript)
│       ├── src/
│       │   ├── modules/           # Domain modules (Controller -> Service -> Repository)
│       │   │   ├── activity/      # Creation, dynamic radius matching, lifecycle
│       │   │   ├── notifications/ # Push notification dispatcher & k-anonymity gate
│       │   │   └── trust/         # Rolling average trust score calculation
│       │   ├── middleware/        # Auth verification, dev headers, error handling
│       │   └── index.ts
│       ├── Dockerfile             # Standalone deployment container (Railway/Render)
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared/                    # Shared TypeScript library
│       ├── src/
│       │   ├── schemas/           # Zod schemas (Validation for API inputs & forms)
│       │   ├── types/             # Inferred TypeScript types & DTOs
│       │   └── constants/         # Interest taxonomy, TTL defaults (2-4 hrs), k-anonymity floor (8-10)
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/                      # Database migrations & configuration
│   ├── migrations/                # Version-controlled PostGIS SQL migrations
│   ├── seed.sql                   # Seed personas & geo-coordinates for testing
│   └── functions/                 # Edge Functions (Scheduled TTL cleanup sweep)
│
├── docs/                          # Architecture & design specifications
├── CLAUDE.md                      # Source of truth for AI agents (Claude Code & Antigravity)
└── AGENTS.md                      # Antigravity agent instructions
```

---

## 2. Design System: Nocturnal Pulse (`global.css` & NativeWind v4)

The app uses **NativeWind (Tailwind CSS for React Native)** with a unified `global.css` token system.

### Color Tokens & Semantic Roles
* **`bg-void` (`#0D0B14`):** Base canvas & dark map background.
* **`bg-ink` (`#17131F`):** Surface for cards, navigation headers, bottom sheets.
* **`bg-ink-raised` (`#211C2E`):** Raised surfaces (modals, popovers, pressed states).
* **`border-hairline` (`#2C2739`):** 1px structural borders (no heavy/muddy shadows).
* **`signal-violet` (`#7B2FF7` / `#D2BBFF`):** Primary actions, active filter chips, verified badges.
* **`pulse-lilac` (`#C77DFF` / `#E1B6FF`):** Fresh/live activity indicator, full-TTL pin glow.
* **`ember` (`#FF6B5E` / `#FFB4AB`):** Expiry urgency (<30 min TTL), destructive actions, low-trust warnings.
* **`text-moonlight` (`#F5F0FF`):** Primary text (high contrast on dark).
* **`text-dusk` (`#A99BC2`):** Secondary text, timestamps, captions.

### Typography
* **Headlines & Titles:** Bricolage Grotesque / Clash Display (`font-display`).
* **Body Text:** General Sans (`font-body`).
* **Dynamic & Numeric Data:** JetBrains Mono (`font-mono` with tabular figures for TTL countdowns, distances, trust scores).

### Component Geometry
* **Cards & Sheets:** Rounded 16–20px (`rounded-2xl`).
* **Touch Targets (Buttons, Chips, Inputs):** Fully pill-shaped (`rounded-full`).
* **Signature Map Pin ("Pulse Pin"):** Circular pin with subtle animated ring shifting from `pulse-lilac` to `ember` as TTL approaches zero.

### Layout-Level Safe Area Enforcement (`react-native-safe-area-context`)
* **Root Provider:** `SafeAreaProvider` is mounted at root `apps/mobile/app/_layout.tsx`.
* **Layout-Level Handling:** Handle top/bottom edge insets at layout levels (`(auth)/_layout.tsx`, `(main)/_layout.tsx`) so child screens do not duplicate boilerplate.
* **Keyboard Insets:** All forms use `KeyboardAvoidingView` / dismiss wrappers to prevent virtual keyboard overlaps.

### Aesthetic & Iconography Directive
* **Zero Neon/Cyber Slop:** Sleek, understated modern dark luxury canvas with subtle hairline borders (`#2C2739`) and elegant typography.
* **Vector Glyphs:** `lucide-react-native` for all UI icons (minimalist, scalable, tinted via Tailwind).


---

## 3. Testing Strategy & Quality Assurance

To prevent technical debt, testing is mandatory across all layers:

### A. Unit Tests (Vitest)
* **Shared Schemas:** Validate all Zod schemas in `packages/shared` against valid/invalid payloads.
* **Backend Domain Logic:** Pure unit tests for matching algorithms, dynamic radius calculations, $k$-anonymity checks, and rolling trust decay math.
* **Mobile Components:** React Native Testing Library for UI components (buttons, countdown timers, bottom sheets).

### B. Integration Tests (Supertest + Fastify)
* API endpoint testing verifying database persistence, auth headers, and status codes against a local Supabase test instance.

### C. Mobile E2E Flow Testing (Maestro)
* Declarative YAML flows in `apps/mobile/.maestro/` for:
  1. `onboarding_flow.yaml`: Phone input -> OTP -> Interest selection.
  2. `create_activity_flow.yaml`: Host creates an activity -> pin appears on map.
  3. `join_and_room_flow.yaml`: Joiner requests -> Host accepts -> Ephemeral room unlocks.

---

## 4. Multi-User Testing & Auth Strategy (Simulators & Devices)

To eliminate phone OTP friction and enable multi-user interaction testing:

1. **Local Supabase Fixed OTP:** In local development, entering any phone number with OTP `123456` immediately signs in.
2. **In-App Dev Persona Switcher (`__DEV__` only):**
   * Floating quick-switch drawer in development builds to instantly toggle between seeded user sessions:
     * **User A (Host):** Alex (Football enthusiast at Tech Park coordinate A)
     * **User B (Joiner):** Sam (Looking for Football within 1km)
     * **User C (Joiner):** Priya (Badminton player)
     * **User D (Low-Trust):** Unverified test profile
3. **Backend Dev Auth Bypass:** In non-production environments, Fastify accepts an `X-Dev-User-Id` header to test API endpoints directly without signing in via SMS.
4. **Multi-Client Verification:** Run iOS Simulator (as Host) alongside Android Emulator / Expo Go device (as Joiner) to observe live Supabase Realtime synchronization.

---

## 5. Engineering Standards & Conventions

1. **Strict TypeScript:** `noImplicitAny: true`, `strict: true`. No untyped data across API boundaries.
2. **Single Source of Truth:** All DTOs and request validation schemas live in `packages/shared`.
3. **Clean Layered Architecture (Server):**
   * `Controller` -> Request parsing & HTTP response.
   * `Service` -> Pure business rules (no direct DB queries).
   * `Repository` -> Direct PostGIS / Supabase SQL execution.
4. **State Separation (Mobile):**
   * TanStack Query for remote API data caching and invalidation.
   * Zustand for client-only UI state (active map filter selections, local drafts).
   * Supabase Realtime channels for active room chat and live join request alerts.
5. **Ephemerality by Design:** Activities, rooms, and chat rows auto-expire after TTL (2–4 hrs) via Supabase scheduled cleanup. Notifications expire with activity TTL.

---

## 6. Type-Safe Supabase Client Convention (STRICT)

TypeScript database types are generated directly from the live database schema into `packages/shared/src/types/database.types.ts` via the Supabase CLI (`supabase gen types typescript`).

Whenever instantiating or using a Supabase client in the mobile app or backend service, **ALWAYS** import and bind the `Database` generic from `@hobbie/shared`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { Database } from '@hobbie/shared';

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);
```

### Mandatory Rules:
* Never write untyped Supabase queries (`createClient()` without `<Database>`).
* All table queries (`.from('activities')`, `.from('profiles')`), RPC calls (`.rpc('get_nearby_activities')`), and Realtime subscriptions must be 100% type-safe with zero `any` casts.

