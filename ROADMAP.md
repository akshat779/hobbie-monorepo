# Hobbie — Engineering Roadmap & Milestone Tracker

This roadmap tracks feature implementation slices across development sessions. Each milestone is built as a complete, vertically-integrated slice (Zod schema $\rightarrow$ Database/API $\rightarrow$ UI State $\rightarrow$ Native Motion/Animations $\rightarrow$ Error/Empty states $\rightarrow$ Device verification $\rightarrow$ Performance profiling).

---

## 🟢 Foundation & Scaffolding (COMPLETED)
- [x] Monorepo workspace setup (`packages/shared`, `apps/server`, `apps/mobile`)
- [x] Expo SDK 54 + React 19 + NativeWind v4 (`global.css` with Nocturnal Pulse palette)
- [x] Cloud Supabase PostGIS connection & 4 forward migrations pushed:
  - `profiles`, `activities`, `join_requests`, `activity_members`, `room_messages`, `ratings`, `kept_connections`, `reports`, `notifications`
- [x] Row Level Security (RLS) policies enabled across all tables
- [x] Auto-generated type-safe `Database` definitions in `@hobbie/shared`
- [x] Fastify API with PostGIS spatial matching and rolling trust calculation
- [x] In-app `DevPersonaSwitcher` floating drawer for instant 1-tap persona switching
- [x] 12/12 passing Vitest test suite and Maestro E2E YAML test flows
- [x] Layout-level `SafeAreaProvider` & safe area rules in `AGENTS.md` and `CLAUDE.md`

---

## 🟢 Milestone 1: Live Supabase Auth & Onboarding Flow (COMPLETED)
**Goal:** Complete, frictionless authentication and profile onboarding with dev persona bypass.
- [x] Implement `useAuthStore` (Zustand + `supabase.auth.onAuthStateChange` + type-safe profile queries)
- [x] Connect `app/(auth)/phone.tsx` to `supabase.auth.signInWithOtp` with E.164 Zod validation
- [x] Connect `app/(auth)/otp.tsx` with 6-digit auto-advancing boxes, SMS paste support, and dev code `123456`
- [x] Connect `app/(auth)/interests.tsx` to persist name, birth date, gender enum, and 10 category chips to `public.profiles`
- [x] Handle all 4 UI states (Loading spinners, validation errors, network failures, success navigation)
- [x] DevPersonaSwitcher integrated with Zustand store for instant 1-tap testing
- [x] Unit test suite (`apps/mobile/src/__tests__/auth.test.ts`) passing (16/16 monorepo tests green)

---

## 🟢 Milestone 2: Discovery Radar Map, Multi-Facet Filters & Live Pins (COMPLETED)
**Goal:** Interactive geospatial discovery canvas rendering real nearby squads with instant filtering.
- [x] Mount `react-native-maps` on `app/(main)/index.tsx` with custom dark Nocturnal map styling
- [x] Fetch nearby activities via `supabase.rpc('get_nearby_activities')` using TanStack Query
- [x] **Motion/Animation:** Hardware-accelerated ambient **Pulse Pins** (`PulsePin.tsx` & `UserLocationPin.tsx`) with dynamic scaling & opacity loop
- [x] Build interactive bottom sheet with live TTL countdown, host trust badge, and distance display
- [x] Add category filter pills horizontally scrolling with instant map pin filtering
- [x] Implement empty state ("No squads nearby. Be the first to host!")
- [x] **Multi-Facet Discovery Filter Modal (`DiscoveryFilterModal.tsx`):**
  - Continuous drag **`RadiusSlider.tsx`** using Reanimated `useSharedValue` and GPU `transform: [{ translateX }]` (1km to 50km+ Virtual/Global range)
  - Target gender filter (`all`, `women_only`, `men_only`, `coed`)
  - Demographic age group filter (`all`, `18_24`, `25_34`, `35_plus`)
  - Dynamic map `<Circle>` boundary resizing in real-time
- [x] 22/22 passing Vitest tests in `apps/mobile` (33/33 monorepo tests green)

---

## ⚡ Milestone 3: Squad Creation & Matching Handshake
**Goal:** Host posts a squad $\rightarrow$ Joiner discovers and sends request $\rightarrow$ Host accepts/declines.
- [ ] Wire `app/activity/create.tsx` modal with category picker, venue name, exact/fuzzed GPS, and TTL slider (1–4 hrs)
- [ ] Host's request management queue (view incoming joiners with trust scores & verified badges)
- [ ] Accept/Decline action buttons with instant Supabase DB updates (`public.join_requests` $\rightarrow$ `public.activity_members`)
- [ ] **Motion/Animation:** Smooth spring slide-up for `ActivityBottomSheet`, card stagger fade-in on feed, and interactive button press scaling (`active:scale-95`)
- [ ] **Motion/Animation:** Realtime handshake ripple & toast animation when a join request is accepted

---

## 💬 Milestone 4: Ephemeral Room, Live Chat & Self-Destruct
**Goal:** Locked active squad room with live chat, exact venue reveal, and TTL self-destruct.
- [ ] Wire `app/room/[id].tsx` to reveal exact venue location pin only to accepted members
- [ ] Realtime chat via Supabase Realtime channel (`room_messages` subscription)
- [ ] **Motion/Animation:** Live ticking self-destruct countdown timer banner with burning ember pulse as TTL nears 0
- [ ] **Motion/Animation:** Smooth chat message bubble enter transition & typing indicator wave
- [ ] Conclude activity trigger $\rightarrow$ routes to Post-Activity Feedback (Rating & Kept Connection prompt)

---

## 🛡️ Milestone 5: Trust & Safety, Moderation & Notifications Inbox
**Goal:** Post-activity peer review algorithm, kept connections, user reporting, and notification inbox.
- [ ] Submit 1–5 star rating + tags $\rightarrow$ updates rolling trust score
- [ ] Dual-opt-in "Keep Connection" prompt (1:1 exception) with mutual match reveal animation
- [ ] "Report User / Activity" modal inserting into `public.reports`
- [ ] In-app `app/(main)/notifications.tsx` inbox with TTL auto-cleanup
- [ ] **Motion/Animation:** Staggered list fade-out when notifications or expired squads self-destruct

---

## 🚀 Milestone 6: Production Hardening, Memory Profiling & Leak Auditing (PLANNED)
**Goal:** Comprehensive profiling, leak detection, GPU frame auditing, and production stress testing.
- [ ] **Hermes Heap Profiling & Leak Audits:**
  - Audit uncollected closures, dangling subscriptions, and detached DOM/native view nodes with Chrome DevTools & Xcode Memory Graphs
  - Verify zero memory retention when repeatedly opening/closing sheets, modals, and map screens
- [ ] **Map & Canvas VRAM Optimization:**
  - Cluster high-density pins using `Supercluster` to prevent marker view thrashing (>50+ concurrent squad pins)
  - Enforce `tracksViewChanges={false}` bitmap caching on all static map markers
- [ ] **Image Pipeline & LRU Cache Management:**
  - Migrate all avatars and activity media to `expo-image` with explicit downsampling and bounded disk/memory cache
- [ ] **Query Cache Garbage Collection:**
  - Configure strict `gcTime` (5 min) and `staleTime` windows in TanStack Query to evict unmounted discovery results
- [ ] **React Render Profiling:**
  - Run React DevTools Profiler to eliminate wasted re-renders across filter pills, bottom sheets, and timers using `React.memo`, `useCallback`, and `useMemo`
- [ ] **Network & Realtime Lifecycle Teardown:**
  - Ensure all Supabase Realtime channels and geolocation watchers immediately unsubscribe on background/unmount
