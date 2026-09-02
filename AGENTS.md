# Antigravity Agent Guidelines — Hobbie Project

This repository follows the architecture, design system, and development guidelines defined in [CLAUDE.md](file:///Users/akshatsharma/Vscode/hobbie/CLAUDE.md) and [docs/](file:///Users/akshatsharma/Vscode/hobbie/docs).

## Key Directives for Agent Turns:

1. **Independent Deployability:** Never couple `apps/mobile` dependencies into `apps/server` or vice versa. Shared contracts must strictly live in `packages/shared`.
2. **Design Tokens & Styling:** Always use Tailwind/NativeWind classes adhering to the **Nocturnal Pulse** palette (`bg-void`, `bg-ink`, `bg-ink-raised`, `signal-violet`, `pulse-lilac`, `ember`, `text-moonlight`, `text-dusk`, `border-hairline`).
3. **No Untyped Code:** Maintain strict TypeScript everywhere (`noImplicitAny`, exact DTO validation with Zod).
4. **Testing First:** Every business logic function in `apps/server` or `packages/shared` must have a corresponding `.test.ts` with Vitest. Mobile UI flows should be accompanied by Maestro YAML specs.
5. **Multi-User Dev Personas:** Ensure mock authentication and `__DEV__` persona switcher utilities remain intact to facilitate multi-user simulator testing.

## 📱 Layout-Level Safe Area Enforcement (`react-native-safe-area-context` ONLY):

1. **Package Standard:** ALWAYS use `SafeAreaView` or `useSafeAreaInsets` strictly from **`react-native-safe-area-context`**. NEVER use the buggy, iOS-only `SafeAreaView` from default `react-native`.
2. **Layout-Level Handling:** Handle top and bottom safe area insets (notches, dynamic islands, home bars) at the **Layout level** (`app/(auth)/_layout.tsx`, `app/(main)/_layout.tsx`, modal containers) using `<SafeAreaView edges={['top', 'bottom']}>` rather than scattering manual insets across every child screen.
3. **Keyboard Avoidance:** All input flows must be wrapped in `KeyboardAvoidingView` / dismiss wrappers so buttons and forms are never obscured by the mobile keyboard.

## 🎨 Minimalist Aesthetic & Iconography Directive (STRICT):

1. **No Neon / Cyber Slop:** Avoid garish neon glows, excessive shadows, and distracting visual clutter.
2. **Clean Minimalist Luxury:** Maintain a sleek, understated modern dark aesthetic—deep charcoal/void canvas (`#0D0B14`, `#17131F`), refined 1px hairline borders (`#2C2739`), crisp typography, and purposeful accent touches (`#7B2FF7`, `#C77DFF`).
3. **Vector Iconography:** Use `lucide-react-native` for all UI icons. Keep icons minimalist, geometrically balanced, and tinted via Tailwind classes (`text-moonlight`, `text-dusk`, `text-signal-violet`).

## 🔒 Ironclad Database & Supabase Migration Rules (STRICT):

1. **NO Ad-Hoc DDL or SQL Editor Modifications:** NEVER execute raw `CREATE TABLE`, `ALTER TABLE`, `DROP`, or manual DDL queries directly against the database or via MCP tools.
2. **Forward-Only Timestamped Migrations:** All schema changes must be written as discrete, timestamped SQL files inside `supabase/migrations/` (e.g. `20260830000000_init_postgis_and_schema.sql`).
3. **Never Mutate Applied Migrations:** Once a migration is pushed, it must NEVER be modified in-place. Always create a new forward migration file.
4. **Execution Protocol:** Schema updates are ONLY applied using the official Supabase CLI command: `supabase db push`.
5. **MCP Tool Restrictions:** If Supabase/Postgres MCP is enabled, it must be used STRICTLY in Read-Only / `SELECT` mode for inspection, never for schema modifications.

## 📦 Type-Safe Supabase Client Convention (STRICT):

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
