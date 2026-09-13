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

## 3. Dev Persona Switcher

When running the mobile client in `__DEV__` mode (`npm run dev:mobile`), tap the floating **Dev Persona** pill in the top right to switch between:
1. **Alex (Host - Football)**
2. **Sam (Joiner - Football)**
3. **Priya (Joiner - Badminton)**
4. **Rohan (Unverified)**

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

For the deployed Edge Function, set `ENVIRONMENT=development` and optionally
`DEV_AUTH_ALLOWED_PHONES` (comma-separated E.164 numbers) as function secrets.

Run it with:

```bash
npm run --workspace=apps/mobile test:integration
```

The suite creates a unique activity and removes it in teardown. It does not
delete the long-lived development persona users.
