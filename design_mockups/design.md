Design System — Hyperlocal Activity App
Standalone file — give this to Stitch (or any design tool) as brand/style context before generating screens.
Direction
Dark, map-first, nocturnal-urban. The app's core mechanic is "something is happening near you, right now, and it won't last" — the design should feel like a city's live pulse at night, not a generic social app. Avoid the default AI-purple look (a flat lavender-to-blue gradient card): this palette leans deep and inky with one saturated violet doing the work, not a gradient doing it for you.
Color
Token Hex Name Usage bg-void #0D0B14 Void App background — near-black with a faint violet undertone, not pure black bg-ink #17131F Ink Cards, sheets, nav bars — one step up from Void bg-ink-raised #211C2E Raised Ink Modals, active/pressed surfaces accent-signal #7B2FF7 Signal Violet Primary buttons, active states, verified badge, links accent-pulse #C77DFF Pulse Lilac Live/fresh activity indicator, map pin glow at full TTL, highlights accent-ember #FF6B5E Ember Urgency only — TTL running low (<30 min), destructive actions, unverified warning text-primary #F5F0FF Moonlight Primary text — off-white with a violet whisper, never pure white text-secondary #A99BC2 Dusk Secondary text, timestamps, captions border-hairline #2C2739 Hairline Dividers, card borders, input outlines
Rule: Signal Violet is the only saturated color allowed on most screens. Pulse Lilac and Ember are reserved exclusively for state (live/fresh vs. expiring) — never used decoratively. If a screen has more than one saturated color doing non-functional work, remove one.
Typography


Display (screen titles, activity names on cards, TTL countdown numerals): Clash Display, Semibold/Bold. Geometric, slightly condensed, gives the app a poster-like energy without being a default system sans.

Body (descriptions, labels, buttons): General Sans, Regular/Medium. Clean, humanist, highly legible on dark backgrounds.

Utility/data (distance, TTL countdown seconds, timestamps, trust score): JetBrains Mono, Regular. Monospace gives live/numeric data a "real-time feed" feel — reinforces that this is live data, not static copy.
Type scale (base 16px): Display XL 32 / Display L 24 / Display M 20 / Body 16 / Body S 14 / Caption 12 / Mono data 14 (tabular figures on).
Spacing, Radius, Elevation


Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 (px) — no arbitrary values.

Radius: cards and sheets 20px, buttons and chips fully rounded (pill), map pin container circular.

Elevation is conveyed by surface tone (Void → Ink → Raised Ink), not drop shadows — shadows are barely visible on a near-black canvas and read as muddy. Use a 1px border-hairline outline instead of shadow to separate raised surfaces.

Bottom sheets (activity detail on map tap) use a translucent Ink surface with light blur, sliding up over the map rather than replacing it — keeps spatial context while reading details.
Components


Buttons: primary = filled Signal Violet, pill-shaped, Moonlight text. Secondary = Hairline-bordered, transparent fill, Moonlight text. Destructive (report/leave) = Ember outline only, never filled — keep alarming color rare.

Activity card / bottom sheet: Ink surface, activity icon + name in Display type at top, Mono countdown top-right, description in Body, host's verified badge (small violet checkmark chip) next to host name, primary action button pinned to bottom.

Map pins: circular, Ink fill with a Pulse Lilac ring. The ring's brightness and thickness scale with TTL remaining — near-full and bright at posting, fading toward a dim Ember ring in the last 30 minutes. This is the signature element (see below). Clustered pins show a count in Mono type inside a slightly larger circle.

Filter chips: pill-shaped, Hairline border when inactive, Signal Violet fill when active.

Verified badge: small circular checkmark, Signal Violet fill — never shown in any other color, so it stays a single unambiguous trust signal across the app.

Trust/rating display: shown as a small Mono numeric + short label, never a star-rating graphic (stars read as generic e-commerce, not fitting the tone).
Signature Element: The Pulse Pin
The one thing this app should be visually remembered by: every activity pin on the map is alive. Its glow ring brightness and color shift over the activity's TTL lifespan — Pulse Lilac and bright when just posted, gradually dimming, shifting to Ember and pulsing faster as it nears expiry, then vanishing when it self-destructs. The map itself becomes a literal visualization of the neighborhood's live, ephemeral activity — this is the one place worth spending visual/animation budget; keep everything else in the interface quiet by comparison.
Motion


Pulse Pin glow: slow ambient pulse (≈2s cycle) at full TTL, accelerating gradually as expiry approaches — the only continuous ambient animation in the app.

Bottom sheet expand/collapse: quick slide-up, ~200ms, no bounce.

New activity appearing on map: soft fade-and-scale-in, not a hard pop.

Respect reduced-motion settings: pulse becomes a static ring with a subtly dimmer opacity per TTL stage instead of animating.
Voice
Plain, active-voice, present-tense microcopy — describe what the person can do, not system mechanics. "Request to join," not "Submit join request." Errors state what happened and what to do next, without apologizing. Empty states (empty map, no nearby activities) should read as an invitation to act ("Nothing happening near you yet — be the first to start something") rather than a dead end.