---
name: Nocturnal Pulse
colors:
  surface: '#14121b'
  surface-dim: '#14121b'
  surface-bright: '#3b3842'
  surface-container-lowest: '#0f0d16'
  surface-container-low: '#1c1a24'
  surface-container: '#211e28'
  surface-container-high: '#2b2933'
  surface-container-highest: '#36333e'
  on-surface: '#e6e0ee'
  on-surface-variant: '#ccc3d9'
  inverse-surface: '#e6e0ee'
  inverse-on-surface: '#322f39'
  outline: '#958da2'
  outline-variant: '#4a4456'
  surface-tint: '#d2bbff'
  primary: '#d2bbff'
  on-primary: '#3e008e'
  primary-container: '#7b2ff7'
  on-primary-container: '#ebddff'
  inverse-primary: '#7423f0'
  secondary: '#e1b6ff'
  on-secondary: '#4c007b'
  secondary-container: '#691a9f'
  on-secondary-container: '#d69eff'
  tertiary: '#ffb4ab'
  on-tertiary: '#690005'
  tertiary-container: '#b7372f'
  on-tertiary-container: '#ffdbd7'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#eaddff'
  primary-fixed-dim: '#d2bbff'
  on-primary-fixed: '#25005a'
  on-primary-fixed-variant: '#5900c6'
  secondary-fixed: '#f2daff'
  secondary-fixed-dim: '#e1b6ff'
  on-secondary-fixed: '#2e004d'
  on-secondary-fixed-variant: '#691a9f'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#ffb4ab'
  on-tertiary-fixed: '#410002'
  on-tertiary-fixed-variant: '#8c1715'
  background: '#14121b'
  on-background: '#e6e0ee'
  surface-variant: '#36333e'
  bg-void: '#0D0B14'
  bg-ink: '#17131F'
  bg-ink-raised: '#211C2E'
  text-moonlight: '#F5F0FF'
  text-dusk: '#A99BC2'
  border-hairline: '#2C2739'
typography:
  display-xl:
    fontFamily: Clash Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  display-xl-mobile:
    fontFamily: Clash Display
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
  display-l:
    fontFamily: Clash Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  display-m:
    fontFamily: Clash Display
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: General Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: General Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  caption:
    fontFamily: General Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1'
    letterSpacing: 0em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
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

This design system is built for a "Hyperlocal Activity App" that captures the ephemeral, high-energy pulse of a city at night. The brand personality is nocturnal, urgent, and map-centric, avoiding generic social media aesthetics in favor of a sophisticated, "inky" urban atmosphere. 

The design style is a blend of **Minimalism** and **Tactile Dark Mode**, where depth is communicated through tonal layers rather than traditional shadows. It utilizes high-contrast accents to signify life and expiry. The core aesthetic principle is "Quiet Interface, Vibrant Pulse": the UI remains restrained and dark to allow the "Pulse Pin" signature elements—the live activities—to command the user's attention.

**Key Principles:**
- **Nocturnal Urbanism:** Use deep violets and near-blacks to mimic a city at night.
- **Ephemeral Urgency:** Visual cues must communicate that content is temporary and happening "right now."
- **Chromatic Restraint:** Saturated color is a functional tool, not a decorative one. Signal Violet is the primary driver, while Pulse Lilac and Ember are reserved for temporal status.

## Colors

The palette is anchored by "Moonlight" text on "Void" backgrounds, creating a high-legibility environment that is easy on the eyes in low-light settings.

- **Primary (Signal Violet):** The main action color. Used for buttons, active states, and verified signals.
- **Secondary (Pulse Lilac):** Exclusively signifies "Live" or "Fresh" activity. It represents the start of a lifecycle.
- **Tertiary (Ember):** Reserved for urgency and expiry (TTL < 30 min) or destructive actions.
- **Neutral Layers:** 
    - **Void (#0D0B14):** The base atmospheric layer.
    - **Ink (#17131F):** The primary surface for cards and sheets.
    - **Raised Ink (#211C2E):** For modals and pressed states.

## Typography

The typography strategy uses three distinct voices to organize information:

1.  **Clash Display (Headlines):** Used for screen titles and activity names. Its geometric, slightly condensed nature gives a "poster-like" energy.
2.  **General Sans (Body):** The workhorse for descriptions, labels, and buttons. It provides high legibility against dark backgrounds.
3.  **JetBrains Mono (Data):** Used for all dynamic or live data (TTL countdowns, distances, trust scores). This reinforces the "live feed" nature of the application. Always enable tabular figures for countdowns to prevent character jumping.

## Layout & Spacing

The system follows a strict spacing scale based on a 4px/8px rhythm to ensure visual tension and alignment.

- **Grid:** A fluid grid is used for map overlays and list views. 
- **Margins:** 16px (Mobile), 24px (Tablet/Desktop).
- **Gutters:** 12px or 16px depending on the density of the activity feed.
- **Bottom Sheets:** These are the primary navigation container for activity details. They should span the full width on mobile and appear as floating centered "Ink" cards on larger screens, maintaining the view of the map behind them.

## Elevation & Depth

Elevation is strictly defined by **Tonal Layering** and **Hairline Borders**. Because traditional shadows appear muddy on near-black backgrounds, we use surface shifts:

1.  **Void (Base):** The bottom-most layer (Map or App background).
2.  **Ink (Level 1):** Primary surface for cards, navigation bars, and bottom sheets.
3.  **Raised Ink (Level 2):** Highest level for modals, pop-overs, or active/pressed button states.

**Separation:** Use a 1px `border-hairline` (#2C2739) to define the edges of raised surfaces. This provides a crisp, architectural feel without the blurriness of shadows. For bottom sheets, apply a background blur (Backdrop Filter) to the "Ink" surface to maintain spatial awareness of the map beneath.

## Shapes

The shape language is defined by two distinct rules:

- **Structural Containers:** Activity cards, bottom sheets, and modals use a **20px** (rounded-lg) corner radius to feel substantial yet modern.
- **Interactive Elements:** Buttons, chips, and input fields are **fully pill-shaped**. This contrasts against the structural containers and signifies touch-target areas clearly.
- **Map Pins:** These are the only perfectly circular elements, reinforcing their role as the "Signature Pulse."

## Components

### Buttons
- **Primary:** Pill-shaped, filled with Signal Violet, text in Moonlight.
- **Secondary:** Pill-shaped, transparent fill with a Hairline border, text in Moonlight.
- **Destructive:** Ember border only, transparent fill. Keep this style rare to maintain its alarming impact.

### Pulse Pins (Signature Element)
The "Pulse Pin" is a circular Ink-filled container with a glow ring.
- **Live/New:** Pulse Lilac ring, bright and thick, slow ambient pulse (2s).
- **Expiring:** Transitions to Ember, dims in brightness, and increases pulse speed as TTL approaches zero.

### Activity Cards
Use an Ink surface with Moonlight text. Place the Mono-data countdown in the top-right corner. The verified badge (a Signal Violet checkmark chip) should be placed adjacent to the host's name.

### Filter Chips
Pill-shaped. Inactive states use a Hairline border; active states use a solid Signal Violet fill.

### Input Fields
Pill-shaped with a Hairline border. Focus states should transition the border color to Signal Violet. Use Mono-data for any numeric input.