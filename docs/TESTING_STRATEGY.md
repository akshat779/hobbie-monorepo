# Testing Strategy & Execution Runbook

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
