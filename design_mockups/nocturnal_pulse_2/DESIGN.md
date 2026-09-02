---
name: Nocturnal Pulse
colors:
  surface: '#14121b'
  surface-dim: '#14121b'
  surface-bright: '#3a3842'
  surface-container-lowest: '#0f0d16'
  surface-container-low: '#1c1a24'
  surface-container: '#211e28'
  surface-container-high: '#2b2932'
  surface-container-highest: '#36333d'
  on-surface: '#e6e0ed'
  on-surface-variant: '#cbc4d0'
  inverse-surface: '#e6e0ed'
  inverse-on-surface: '#322f39'
  outline: '#948e9a'
  outline-variant: '#49454f'
  surface-tint: '#d2bbff'
  primary: '#eadcff'
  on-primary: '#38255e'
  primary-container: '#d2bbff'
  on-primary-container: '#5b4883'
  inverse-primary: '#685490'
  secondary: '#e1b6ff'
  on-secondary: '#43205e'
  secondary-container: '#5b3776'
  on-secondary-container: '#cfa5ed'
  tertiary: '#ffd9d4'
  on-tertiary: '#51221d'
  tertiary-container: '#feb3aa'
  on-tertiary-container: '#7a433c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#eaddff'
  primary-fixed-dim: '#d2bbff'
  on-primary-fixed: '#230e48'
  on-primary-fixed-variant: '#4f3c76'
  secondary-fixed: '#f2daff'
  secondary-fixed-dim: '#e1b6ff'
  on-secondary-fixed: '#2c0647'
  on-secondary-fixed-variant: '#5b3776'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4ab'
  on-tertiary-fixed: '#360e0a'
  on-tertiary-fixed-variant: '#6c3832'
  background: '#14121b'
  on-background: '#e6e0ed'
  surface-variant: '#36333d'
  bg-void: '#0D0B14'
  bg-ink: '#17131F'
  bg-ink-raised: '#211C2E'
  text-moonlight: '#F5F0FF'
  text-dusk: '#A99BC2'
  border-hairline: '#2C2739'
  signal-violet: '#d2bbff'
  pulse-lilac: '#e1b6ff'
  ember: '#ffb4ab'
typography:
  display-xl:
    fontFamily: Bricolage Grotesque
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.03em
  display-xl-mobile:
    fontFamily: Bricolage Grotesque
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Bricolage Grotesque
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Bricolage Grotesque
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Bricolage Grotesque
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.02em
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
---

## Brand & Style

This design system is engineered for a "Hyperlocal Activity App" that captures the ephemeral, high-energy pulse of a city at night. The brand personality is nocturnal, urgent, and map-centric, favoring a sophisticated, "inky" urban atmosphere over generic social media aesthetics.

The design style is a blend of **Minimalism** and **Tactile Dark Mode**. Depth is communicated through tonal layers and crisp hairline borders rather than traditional shadows. The core aesthetic principle is "Quiet Interface, Vibrant Pulse": the UI remains restrained and dark to allow the "Pulse Pin" signature elements—the live activities—to command the user's attention.

**Key Principles:**
- **Nocturnal Urbanism:** Deep violets and near-blacks mimic a city after dark.
- **Ephemeral Urgency:** Visual cues communicate that content is temporary and happening "right now."
- **Chromatic Restraint:** Saturated color is a functional tool. Signal Violet drives action, while Pulse Lilac and Ember are reserved for temporal status and urgency.

## Colors

The palette is anchored by "Moonlight" text on "Void" backgrounds, creating high-legibility in low-light settings.

- **Primary (Signal Violet):** The main action color for buttons, active states, and verified signals.
- **Secondary (Pulse Lilac):** Exclusively signifies "Live" or "Fresh" activity.
- **Tertiary (Ember):** Reserved for urgency, expiry (TTL < 30 min), or destructive actions.
- **Neutral Layers:** 
    - **Void (#0D0B14):** The base atmospheric layer and map background.
    - **Ink (#17131F):** The primary surface for cards and sheets.
    - **Raised Ink (#211C2E):** For modals and high-level interaction states.

## Typography

The typography strategy focuses on a singular, expressive voice for brand recognition, supported by a technical mono font for functional data.

1.  **Bricolage Grotesque (Headlines & Body):** Used for all primary communication. Its quirky, variable-width personality provides a modern, energetic feel that suits the "Pulse" concept. Use heavier weights for headlines to emphasize the "poster" aesthetic.
2.  **JetBrains Mono (Data):** Reserved for dynamic or live data (TTL countdowns, distances, trust scores). Always enable tabular figures for countdowns to prevent character jumping during live updates.

## Layout & Spacing

The system follows a strict spacing scale based on a 4px/8px rhythm to ensure visual tension and alignment.

- **Grid:** A fluid grid is used for map overlays and list views to maximize content visibility. 
- **Margins:** 16px on Mobile to maximize screen real estate; 24px on Tablet/Desktop for a more relaxed feel.
- **Gutters:** 12px for high-density feeds; 16px for standard activity cards.
- **Bottom Sheets:** These are the primary navigation containers. They should span the full width on mobile. On larger screens, they transform into floating centered "Ink" cards, maintaining the background map's context.

## Elevation & Depth

Elevation is defined by **Tonal Layering** and **Hairline Borders**. To avoid "muddy" UI common in dark modes, we use surface shifts:

1.  **Void (Base):** The bottom-most atmospheric layer (Map background).
2.  **Ink (Level 1):** Primary surface for cards, navigation bars, and bottom sheets.
3.  **Raised Ink (Level 2):** Highest level for modals, pop-overs, or active/pressed button states.

**Separation:** Use a 1px `border-hairline` (#2C2739) to define edges. This architectural approach provides clarity without the blurriness of shadows. For bottom sheets, apply a background blur to the "Ink" surface to maintain spatial awareness of the map beneath.

## Shapes

The shape language utilizes high-contrast corner treatments to differentiate structure from interaction:

- **Structural Containers:** Activity cards, bottom sheets, and modals use a **1rem** (rounded-lg) corner radius for a substantial, architectural feel.
- **Interactive Elements:** Buttons, chips, and input fields are **fully pill-shaped**. This identifies them as touch targets.
- **Map Pins:** These remain perfectly circular, acting as the "Signature Pulse" of the application.

## Components

### Buttons
- **Primary:** Pill-shaped, Signal Violet fill, Bricolage Grotesque (Bold) text in Moonlight.
- **Secondary:** Pill-shaped, transparent fill, Hairline border, text in Moonlight.
- **Destructive:** Ember border, transparent fill. Reserved for irreversible actions.

### Pulse Pins
A circular Ink-filled container with a glow ring.
- **Live:** Pulse Lilac ring with a 2s ambient pulse animation.
- **Expiring:** Transitions to Ember; pulse speed increases as TTL approaches zero.

### Activity Cards
Constructed on an Ink surface with Moonlight text. Place the Mono-data countdown in the top-right. Verified badges use a Signal Violet checkmark chip adjacent to the title.

### Filter Chips
Pill-shaped. Inactive: Hairline border. Active: Solid Signal Violet fill with Dark-text contrast.

### Input Fields
Pill-shaped with a Hairline border. Focus states transition the border to Signal Violet. Use JetBrains Mono for all numeric or time-based inputs.