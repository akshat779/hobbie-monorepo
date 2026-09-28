# Testing Strategy & Execution Runbook

## 0. Testing would require the supabase service role key

### get the service role key and execute this snippet
```bash
read -s "SUPABASE_SERVICE_ROLE_KEY?Paste service-role key: "
export SUPABASE_SERVICE_ROLE_KEY

npm run test:integration:mobile

unset SUPABASE_SERVICE_ROLE_KEY
```

## 1. Automated Vitest Suites

### Run all tests across workspaces:
```bash
npm run test
```

### Run specific workspaces:
```bash
npm run test:shared   # Shared Zod schemas
npm run test:server   # Fastify endpoints, matching & trust engines
npm run test:mobile   # React Native UI unit tests
```

---

## 2. Multi-User Simulator Flow Testing (Maestro)

Install Maestro:
```bash
curl -FsSL "https://get.maestro.mobile.dev" | bash
```

Run test flows against iOS Simulator or Android Emulator:
```bash
# Onboarding flow
maestro test apps/mobile/.maestro/onboarding_flow.yaml

# Activity creation flow
maestro test apps/mobile/.maestro/create_activity_flow.yaml

# Join request & ephemeral room lifecycle
maestro test apps/mobile/.maestro/join_and_room_flow.yaml
```

---

## 3. Dev User Switcher

When running the mobile client in `__DEV__` mode (`npm run dev:mobile`), open the
**Profile** tab and use the **Dev User Switcher** card. It lists every real
account in `public.profiles` (i.e. every profile created through onboarding) and
switches the active session in place, so you can test two-sided squad flows
(request → accept → room) without re-signing in.

Switching mints an authentic session server-side via the `dev-phone-login`
Edge Function, which is denied by default and only enabled when the
`DEV_AUTH_ALLOWED=true` function secret is set (never in production). The
switcher itself is compiled out of release builds because it is gated on
`__DEV__`.

### Onboarding steps

New accounts go through a 5-step wizard (`app/(auth)/interests.tsx` →
`src/features/onboarding/OnboardingWizard.tsx`): **Photos → Name → Birthday →
Gender → Interests**. Each step is one question with a top progress bar and a
bottom-pinned CTA. Photos require at least one (the first is the cover /
`avatar_url`); languages and bio are edited later from the profile edit screen.
Because the photo step opens the native image picker, the Maestro onboarding
flow's photo selection is best-effort.

## 4. Remote Supabase Integration Flow

The mobile integration suite uses the real development Supabase project and the
`dev-phone-login` Edge Function. Keep these values in the local ignored
`apps/mobile/.env` (or CI secrets):

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_DEV_AUTH_ENABLED=true
EXPO_PUBLIC_USE_REAL_SMS=false
SUPABASE_SERVICE_ROLE_KEY=... # test runner/CI only; never ship to the app
RUN_SUPABASE_INTEGRATION=true
```

For the deployed Edge Function, set `DEV_AUTH_ALLOWED=true` and
`ENVIRONMENT=development` as function secrets. Never set `DEV_AUTH_ALLOWED` in a
production project — the function is inert (403) without it. Optionally set
`DEV_AUTH_ALLOWED_PHONES` (comma-separated E.164 numbers) to restrict the phone
sign-in path to a specific allowlist.

Run it with:

```bash
npm run --workspace=apps/mobile test:integration
```

The suite creates a unique activity and removes it in teardown. It does not
delete the long-lived development persona users.
