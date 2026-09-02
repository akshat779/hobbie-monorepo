# Hyperlocal Activity Coordination App

_Working doc — MVP being built solo during a 2-month notice-period window._

---

## 1. The Problem

Two overlapping groups of corporate professionals in dense urban hubs (tech parks, gated communities) have a real, specific, currently-unsolved coordination gap:

1. **Newcomers / freshers relocated to a new city.** They live within 1-2km of thousands of people who share their interests but have zero functional mechanism to spontaneously cross paths. This pain is acute but time-limited (roughly 2-6 months post-relocation) — it fades once a real local circle forms.
2. **Settled professionals with a niche-interest gap.** Even people with an established friend group hit a wall whenever their specific want (badminton, table tennis, a coding partner, a gym partner) doesn't intersect with what their existing friends are into or have time for after work. This is a _permanent_, recurring gap, not a temporary one — friend groups are finite, interest surface area isn't.

**Why existing tools don't solve it:**

- **Dating apps (Bumble BFF, Hinge):** high social friction, romantic/performative pressure, look-based evaluation anxiety, awkward 1-on-1 dynamics.
- **Group platforms (Meetup, WhatsApp, Telegram):** too slow/structured — built for plans days or weeks out, not "I want to play football right now."
- **Social feeds (Instagram):** async, vanity-metric-optimized, not built for real-time physical-world utility.

---

## 2. The Product

An ephemeral, intent-driven, hyper-local activity coordination **matching engine** — explicitly _not_ an events-management platform, _not_ a dating app, _not_ a social feed.

### Core mechanics

- **Activity-anchored, not profile-anchored.** Focus is entirely on the activity ("need 2 more for 5-a-side turf football at 7:30 PM"), not curated profiles.
- **Hyper-local, real-time discovery.** Live open requests within physical proximity, not static directories.
- **Strict ephemerality.** Activity broadcasts auto-expire (TTL 2-4 hrs) and self-destruct after — no lingering chat clutter or stale rooms.
  - **Exception:** after an activity concludes, host and joiner get an opt-in "keep in touch for [activity]" option — a private 1:1 connection scoped to that specific activity tag, so a recurring niche-activity partner (e.g. a badminton partner) isn't thrown away every time. Everything else about the room still dies on schedule.

### Two activity tiers

- **Physical:** range-capped. Cap should be **dynamic**, not hardcoded — start wide enough to match the acquisition/marketing radius (so the feed doesn't look empty), tighten toward ~2km only once density in a sub-area supports it.
- **Virtual** (gaming/PS5 co-op, no distance cap): **deferred out of MVP scope** — it's a different competitive category (Discord LFG, existing matchmaking) and doesn't test the core physical-proximity bet. Add later as a cheap follow-on if physical liquidity works.

### Filtering (on activity creation)

- Age gating: 18+ cannot engage with under-18.
- Adjustable date range.
- Gender filter.

---

## 3. Trust & Safety Design

- **Verification, symmetric:** live face-scan required both when **creating** an activity and when **requesting to join** one (not required at signup — keeps browsing frictionless). No verification = no "verified" badge = lower trust, visible to the other party before they commit.
- **Feedback loop:** after an activity, host and participants rate each other (e.g. "same gender as claimed," "would you hang out with them again").
- **Trust score, not cumulative ban counter:** score is a **rolling average over the last N interactions**, not lifetime-cumulative — so a single brigading incident can't permanently tank someone.
- **Soft signal is automated, hard action is human-gated:** a low trust score can reduce visibility/matches automatically. An actual **ban requires manual review** — at MVP volume this is a handful of cases a week, reviewable by hand. This exists specifically because false/coordinated reporting is a real, known attack vector in this category (see precedent below) — auto-banning on raw report volume is not safe at any launch size.
- **Catfishing/misrepresentation** → ban, subject to the same human-review gate above.

**Precedent that shaped this decision:** Down to Lunch (2015-2018), a near-identical "shared activity" coordination app, hit #1 on the App Store and then collapsed after an unsubstantiated viral rumor (later found baseless by investigators) — not from a real trust violation. The lesson: any system where anyone can report anyone is a false-flagging vector from day one, and needs a review buffer, not an auto-ban trigger.

---

## 4. Privacy Design

- **No personal location is ever revealed.** Activity location is either host-selected or randomized within ~100m; exact location is shared only after the host accepts a join request.
- **Notification targeting uses coarse geohash buckets** (a few hundred meters to ~1km), refreshed periodically — kept separate from the precise fuzz-then-reveal mechanic used for actual active activities, so "notify people nearby" and "never reveal personal location" don't conflict.
- **k-anonymity floor on interest-based notifications:** "X people near you are into football" pushes are only sent above a minimum count threshold (suggested: 8-10+). Below that floor, the signal is used silently for matching but never surfaced as a count — surfacing a low count risks deanonymizing a specific individual.
- The same minimum-count threshold also prevents nudging someone to create an activity that then gets zero joins (a bad first impression / "dead app" signal).

---

## 5. Liquidity & Notifications

- **Push notifications, two directions:**
  1. Interest-match push: "someone posted football near you" → notify people who selected that interest, gated by the k-anonymity floor above.
  2. Reverse-nudge: "12 people near you are into football — want to start something?" → only fires above the same count threshold, and shows the count for confidence.
- **Notifications must die with the activity's TTL** — a stale push for an activity that already expired/filled is the same clutter problem the ephemerality design exists to prevent, just relocated to the OS notification tray.
- **Interest taxonomy kept small for MVP** — ~8-12 broad buckets (sports, food/cafe, gaming, study/coworking, outdoors, nightlife) rather than granular tags, so density isn't fragmented into slivers too small to ever hit the notification threshold.
- **Idle-state browse screen retained** even though this is "a matching engine, not an events platform" — a live glance at "what's happening near you right now" helps perceived-liveness and doesn't require RSVP/planning tooling.

---

## 6. Launch & Distribution

- Launch scoped to **one dense neighborhood / corporate-density area, ~4-5km radius** — not expecting large-scale liquidity at MVP.
- **Acquisition radius should match the activity join-radius** (see dynamic radius above) — marketing a wider area than the app actually serves dilutes the density you're trying to concentrate.
- **Channels:** digital ads, physical posters (turfs, cafes), Reddit.
- **Open question (not yet decided):** whether to seed with a closed/invite-only group first (own building, coworkers, alumni network) before public launch in the 4-5km zone, or launch public from day one and treat any closed group only as personal dogfooding.
- **No monetization plan for MVP** — this phase is explicitly framed as an experiment, not a revenue-generating launch.

---

## 7. MVP Build Sequence

1. Phone auth + activity creation/browse/join with dynamic radius, no face-scan yet (fake trust, get the core loop working).
2. Add face-scan-gated "verified" badge, on both hosting and joining.
3. Add rating/trust-decay/review system last, once there are real interactions to rate.

**Success criterion for this 2-month sprint:** sustain real, repeat, in-person matches in a single seeded zone for a few weeks without the trust/safety system breaking down. Not "scale to a city," not "find product-market fit" — this is a bounded experiment, sized against a 2-month solo window with no funding and no cofounder.

---

## 8. Screens

### Group 1 — Onboarding (one-time)

- **Splash** — checks auth state, routes accordingly.
- **Phone + OTP** — Supabase phone auth; the only identity step at signup.
- **Basic details** — name, birthdate (18+ gate), gender (used later for filters + feedback).
- **Interest selection** — the 8-12 broad buckets; drives feed, map pins, and notification matching.
- **Notification permission prompt** — explicit ask, since liquidity depends on push.

### Group 2 — Home & Discovery

- **Home (Map view)** — centered on the user's current location, pannable/zoomable. Pins show the activity icon + short name, placed at the activity's fuzzed or host-chosen location (never the poster's personal location). Tapping a pin expands a bottom-sheet card in place: description, time window, host's verified badge, TTL countdown, and engage buttons (Request to Join / View Room if already joined). Dense pockets cluster into a count badge that splits open on zoom.
- **Home (List view toggle)** — same data, list form. Required for virtual activities (no location, no distance cap — can't live on a map) and as an accessibility fallback.
- **Filters bar** (both views) — physical/virtual tier, interest bucket, age range, gender, date range.

### Group 3 — Create & Verify

- **Create Activity** — interest, tier toggle, location (drop a pin or leave randomized), time window, age/gender filters, short description. Submitting routes into verification before it posts.
- **Face Verification** — camera + liveness prompt. Fires here (creating) and again at join-request time.

### Group 4 — Join & Room Lifecycle

- **Join Requests (host view)** — incoming requests, each showing the requester's verified badge and trust score, accept/decline.
- **Pending/Waiting (joiner view)** — shown after requesting, before host response; no real location yet.
- **Active Activity Room** — unlocked on acceptance: real location reveal, ephemeral chat, live TTL countdown to self-destruct.

### Group 5 — Trust, Safety & Feedback

- **Post-Activity Feedback** — fires at room expiry: rate the other party, feeds the rolling trust score.
- **Report/Flag** — reachable from an active room or completed activity; routes to human review, never an automatic action.
- **"Keep in Touch" prompt** — shown right after feedback, opt-in, scoped to that one activity tag.

### Group 6 — Notifications & Liquidity

- **Notifications inbox** — both push types (interest-match alerts, reverse "N people near you" nudges), both gated by the k-anonymity threshold.

### Group 7 — Account

- **My Activities** — created/joined, active with countdowns, thin history.
- **Kept Connections** — the persistent 1:1 list from Group 5's exception, tagged by activity type.
- **Profile/Settings** — verified badge status, interests, notification prefs, logout. No photo gallery, no follower count, no public profile.

### Separate surface, not part of the consumer app

- **Admin review console** (web, internal-only) — where the human-review ban queue from Group 5's Report/Flag gets worked. A small standalone tool, not moderation UI jammed into the mobile app.

---

## 9. Tech Stack

### Mobile client

- **React Native + Expo** (managed workflow to start; move to an EAS dev build only when a library needs native code — the face-scan flow likely will).
- `expo-router` for navigation.
- `expo-location` for foreground/background geofencing.
- `react-native-vision-camera` for the face-scan capture flow (maintained successor to the now-deprecated `expo-face-detector`).
- **`react-native-maps` (Google Maps provider) + `react-native-map-clustering`** for the Home map screen. Chosen over the Mapbox RN SDK because it works inside Expo Go for fast iteration (no dev build needed just to test the map — the dev build is only forced once the camera/face-scan work starts), it's free, and a custom dark/purple map style is achievable via a JSON style array (Google's Maps Styling Wizard) without Mapbox's usage-based pricing. `react-native-map-clustering` handles pin clustering in dense pockets — wraps `react-native-maps` directly, Expo-compatible. Revisit Mapbox only if the custom-style/clustering ceiling of this combo is hit later.

### Backend logic

- A self-written **Node/Express (or Fastify) service** for actual business logic — matching algorithm, radius search, notification-trigger thresholds, trust-decay scoring. Deliberately not left to BaaS auto-rules, since this is where a backend engineer's own judgment matters most.
- Hosted on **Railway or Render** (free/hobby tier sufficient for MVP traffic).

### BaaS: Supabase (not Firebase)

Chosen over Firebase because the data model is relational (users, activities, ratings, interests) and needs real geospatial queries.

- **Postgres + PostGIS** — `ST_DWithin` for "activities within Nkm" radius queries.
- **Auth** — phone OTP out of the box.
- **Realtime** — Postgres change subscriptions, used for the live activity feed and ephemeral chat.
- **Storage** — for any images.
- **Edge Functions** — can host the scheduled TTL/self-destruct sweep job.
- Free tier (current, subject to change): 500MB DB, 50K monthly active users, 200 concurrent realtime connections, 1GB storage — sufficient for a single-neighborhood MVP test.

### Push notifications

- **Expo's own push notification service** — free, handles device/token registration without raw FCM/APNs setup pain.

### Chat

- A Postgres table + Supabase Realtime subscriptions — no third-party chat SDK needed. Makes the TTL self-destruct trivial: a scheduled job deletes expired rows, which naturally kills the realtime channel too.

### Face verification

- **MVP approach:** self-built basic liveness challenge (selfie + blink/head-turn prompt) via `react-native-vision-camera` — no formal anti-spoofing certification, but proportionate to actual risk at MVP scale (small seeded group, human-reviewed bans).
- **If stronger anti-spoofing is needed later:** AWS Rekognition's Face Liveness API — pay-per-check (fractions of a cent at low volume), no flat licensing fee, unlike most dedicated RN face-liveness SDKs (Faceplugin, KBY-AI, etc.) which charge per-app-ID licenses.

### Estimated cost to start: **$0** (Expo, Supabase free tier, Expo Push, free-tier Railway/Render). Only cost trigger is upgrading face verification to AWS Rekognition later, which is cents per check.

---

## 10. AI Tooling for the Build

- **Claude Code (Pro, already held)** — reserved for architecture decisions, debugging the geospatial/matching logic, and code review. Anthropic positions Pro explicitly for "short coding sprints," not sustained agent loops — use short, scoped sessions, avoid Plan Mode for routine tasks (≈7x usage cost), and don't leave long-running conversations open.
- **GitHub Copilot Pro ($10/mo)** — daily driver for the high-volume, low-complexity 80% of the build (boilerplate screens, forms, routine API wiring). Unlimited completions, credit-based agent mode ($0.01/credit as of June 2026).
- **Cursor Pro ($20/mo)** — optional upgrade over Copilot specifically for heavy cross-file work (e.g. wiring RN frontend to the Node backend simultaneously) if that becomes the bottleneck.
- **Escalation path if capped mid-sprint:** temporarily bump to Claude Code Max 5x ($100/mo) for the sprint window, or set `ANTHROPIC_API_KEY` to overflow to pay-per-token API billing for a hard-deadline day (not as a default mode).

---

## 11. Design / Mockup Tooling (no Figma)

- **Google Stitch** (successor to Galileo AI) — primary tool. Free, generous tier, prompt-to-UI via Gemini, and ships SDK integrations with Claude Code/Cursor/Gemini CLI — enables a tight prompt-to-screen-to-implementation loop. Limitation: struggles past 2-3 connected screens per generation, some visual repetitiveness across variations.
- **Uizard** — complementary, for flow-level sketching (multi-screen user flows) before committing to visual fidelity in Stitch. Free tier is thin (3 generations).
- **Visily** — fallback if Stitch's output needs more manual, drag-and-adjust editing rather than re-prompting.
- **Note:** Stitch/Uizard/v0-style tools output HTML/CSS or web-React, not React Native components — treat all outputs as visual/flow specs to hand to the coding agent for RN implementation, not copy-paste code.
- **v0 / Magic Patterns / Lovable** — explicitly not used for the app itself (web-React output mismatch with RN); kept in reserve only if a marketing/landing web page is built later for the ad/poster campaign.

---

## 12. Design System & Stitch Prompts

Kept as separate files so the design system can be handed to Stitch (or any designer/tool) independently:

- `design-system.md` — palette, typography, spacing, component and motion rules for the purple/black theme.
- `stitch-prompts.md` — the app-level context prompt plus one prompt per screen group, written to be pasted into Google Stitch.

---

## 13. Open Decisions (not yet resolved)

- Invite-only/closed-group seed launch vs. fully public launch in the 4-5km zone from day one.
- Monetization model (deliberately deferred — MVP is an experiment, not a revenue launch).
- Exact minimum-count threshold for the k-anonymity/notification-nudge gate (needs real usage data to tune).
