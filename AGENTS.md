# Antigravity Agent Guidelines — Hobbie Project

This repository follows the architecture, design system, and development guidelines defined in [CLAUDE.md](file:///Users/akshatsharma/Vscode/hobbie/CLAUDE.md) and [docs/](file:///Users/akshatsharma/Vscode/hobbie/docs).

## Key Directives for Agent Turns:

1. **Independent Deployability:** Never couple `apps/mobile` dependencies into `apps/server` or vice versa. Shared contracts must strictly live in `packages/shared`.
2. **Design Tokens & Styling:** Always use Tailwind/NativeWind classes adhering to the **Nocturnal Pulse** palette (`bg-void`, `bg-ink`, `bg-ink-raised`, `signal-violet`, `pulse-lilac`, `ember`, `text-moonlight`, `text-dusk`, `border-hairline`).
3. **No Untyped Code:** Maintain strict TypeScript everywhere (`noImplicitAny`, exact DTO validation with Zod).
4. **Testing First:** Every business logic function in `apps/server` or `packages/shared` must have a corresponding `.test.ts` with Vitest. Mobile UI flows should be accompanied by Maestro YAML specs.
5. **Multi-User Dev Personas:** Ensure mock authentication and `__DEV__` persona switcher utilities remain intact to facilitate multi-user simulator testing.

---

## 🏛️ System Design & Clean Architecture Directives (STRICT — NO DUCT-TAPE):

1. **No Duct-Taped Code / Separation of Concerns:**
   * Strictly maintain decoupled architecture across layers: `Presentation UI (app/)` $\rightarrow$ `Reactive State & Hooks (src/features/)` $\rightarrow$ `Data Access Layer` $\rightarrow$ `Shared Domain Contracts (packages/shared)` $\rightarrow$ `Database (Postgres)`.
   * **Never embed multi-step business logic or multi-table mutations directly inside JSX event handlers.** Always encapsulate behind typed service functions or repository modules.
2. **Single Responsibility Principle (SRP):**
   * UI components must focus strictly on layout and user interactions.
   * State machines/hooks manage reactive lifecycle and caching.
   * Algorithms (Haversine math, privacy fuzzing, trust decay scoring) must live in pure, deterministic service modules with 100% unit test coverage.
3. **Domain Contracts Single Source of Truth:**
   * All DTOs, request/response validation schemas, domain enums, and business constraints MUST be defined in `packages/shared/src/schemas`.
   * Never redefine duplicate validation logic separately in client or server.

---

## ⚡ ACID Properties, Concurrency & Transactional Boundaries (STRICT):

1. **Atomic Multi-Entity Transitions:**
   * Any operation mutating multiple tables (e.g. *Accept Join Request* $\rightarrow$ *Insert `activity_members`* $\rightarrow$ *Increment `current_participants_count`* $\rightarrow$ *Set Activity Status to `full`*) **MUST NEVER** be executed as disjointed sequential client-side queries.
   * Multi-step mutations **MUST** be implemented as atomic PostgreSQL stored procedures with transactional rollback on failure (`SECURITY DEFINER` plpgsql functions).
2. **Concurrency & Race Condition Prevention:**
   * Slot bookings and join approvals must use explicit row-level locking (`SELECT ... FOR UPDATE OF activities`) to eliminate race-condition over-booking when multiple users join simultaneously.
3. **Consistency & Invariants:**
   * Enforce relational integrity with foreign keys (`ON DELETE CASCADE` / `ON DELETE SET NULL`), check constraints (`CHECK (score >= 1 AND score <= 5)`), and domain enums.

---

## 🗄️ Database Normalization & Schema Integrity (STRICT):

1. **Third Normal Form (3NF) Standard:**
   * All database tables must adhere to 3NF. Every non-key column must depend solely on the primary key (no transitive dependencies).
   * Composite uniqueness constraints must be enforced at the database level (`UNIQUE(activity_id, user_id)`, `UNIQUE(user_a, user_b, interest_id)`).
2. **Forward-Only Timestamped Migrations:**
   * All schema updates must be written as discrete, timestamped SQL files inside `supabase/migrations/` (e.g. `20260830000004_add_atomic_handshake_tx.sql`).
   * Never mutate applied migrations. Schema updates are only pushed via `supabase db push`.
3. **Spatial Indexing Standard:**
   * All geospatial geometry/geography columns must be indexed with **GiST** indexes (`USING GIST (fuzzed_location)`) for sub-millisecond $O(\log N)$ radius searches.

---

## 📱 Layout-Level Safe Area Enforcement (`react-native-safe-area-context` ONLY):

1. **Package Standard:** ALWAYS use `SafeAreaView` or `useSafeAreaInsets` strictly from **`react-native-safe-area-context`**. NEVER use the buggy, iOS-only `SafeAreaView` from default `react-native`.
2. **Layout-Level Handling:** Handle top and bottom safe area insets at the **Layout level** (`app/(auth)/_layout.tsx`, `app/(main)/_layout.tsx`, modal containers) using `<SafeAreaView edges={['top', 'bottom']}>` rather than scattering manual insets across every child screen.
3. **Keyboard Avoidance:** All input flows must be wrapped in `KeyboardAvoidingView` / dismiss wrappers so buttons and forms are never obscured by the mobile keyboard.

---

## 🎨 Minimalist Aesthetic & Iconography Directive (STRICT):

1. **No Neon / Cyber Slop:** Avoid garish neon glows, excessive shadows, and distracting visual clutter.
2. **Clean Minimalist Luxury:** Maintain a sleek, understated modern dark aesthetic—deep charcoal/void canvas (`#0D0B14`, `#17131F`), refined 1px hairline borders (`#2C2739`), crisp typography, and purposeful accent touches (`#7B2FF7`, `#C77DFF`).
3. **Vector Iconography:** Use `lucide-react-native` for all UI icons. Keep icons minimalist, geometrically balanced, and tinted via Tailwind classes (`text-moonlight`, `text-dusk`, `text-signal-violet`).

---

## 📦 Type-Safe Supabase Client Convention (STRICT):

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

---

## 🎬 Animation, Layout Cascade & Gesture Directives (STRICT):

1. **Impact Analysis Before Code Edits:**
   * **NEVER** apply a UI animation, state change, or layout modification without first tracing all parent, child, and adjacent component dependencies.
   * If a component moves (e.g. bottom sheet, modal, drawer), explicitly check how floating action buttons (FABs), map controls, header overlays, and adjacent views will respond.

2. **Zero Desync Animation Hierarchy:**
   * **NEVER** mix un-animated JS state toggles (e.g. `bottom: active ? 310 : 50`) with asynchronous GPU animations (`Animated.spring`).
   * UI elements that move together **MUST** be unified under the exact same native driver animation thread (`useNativeDriver: true`) or rendered inside the same `Animated.View` parent layout container.

3. **Stale Closure Prevention in Custom Gesture Handlers:**
   * Any custom `PanResponder` or gesture responder reading dynamic coordinates or layout dimensions **MUST** back those values with a `useRef` (e.g. `trackWidthRef`) and use `measureInWindow` to prevent stale closure touch bugs inside modals or scroll views.

