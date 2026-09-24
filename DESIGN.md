# Knockout — Mobile Style Reference
> Neutral operations system with functional Aka/Ao competitor color

**Theme:** light

A utility-first system built for people working a live tournament floor — Organizers reviewing rosters, Tournament Directors running rings, Scorekeepers scoring matches under time pressure. The palette is deliberately dichromatic like a clinical instrument: everything is ink black, gray, or white, and color appears only where it carries a specific operational meaning — Aka (red) and Ao (blue) identify competitor corners and nowhere else, while a separate semantic set (green/amber/maroon) covers system states like approved, pending, and rejected. Typography favors legibility over personality: a clean geometric sans for everything read, and tabular monospace numerals for anything that updates live — the match clock and score totals — so digits never jitter or reflow mid-match. Touch targets are generous throughout, since much of this app is used one-handed, ring-side, under pressure.

## Tokens — Colors

### Neutrals

| Name | Value | Token | Role |
|------|-------|-------|------|
| Ink Black | `#0F1115` | `--color-ink-black` | Primary text, headings, icon strokes, primary button fill |
| Charcoal | `#525356` | `--color-charcoal` | Secondary text, secondary icons |
| Slate Gray | `#646668` | `--color-slate-gray` | Tertiary text, muted labels, inactive tab icons |
| Steel Gray | `#BFC0C1` | `--color-steel-gray` | Placeholder text, disabled states, dividers on dark |
| Mist | `#E9EAEA` | `--color-mist` | Hairline borders, card outlines, tab bar top border |
| Cloud | `#F7F8F8` | `--color-cloud` | Subtle surface elevation, muted backgrounds, table stripe |
| Paper White | `#FFFFFF` | `--color-paper-white` | Page background, card surfaces, text on dark/color fills |

### Competitor Colors — Aka & Ao

**Reserved exclusively for competitor/corner identity** (score panels, bracket corner tags, athlete indicator dots). Never repurposed for any other UI meaning.

| Name | Value | Token | Role |
|------|-------|-------|------|
| Aka (Red) | `#E11D2E` | `--color-aka` | Aka corner fill: score panel half, bracket red-corner tag, athlete-A indicator dot |
| Aka Tint | `#FDE7E9` | `--color-aka-tint` | Light background wash for Aka-corner rows/highlights outside the score panel |
| Ao (Blue) | `#0B57D0` | `--color-ao` | Ao corner fill: score panel half, bracket blue-corner tag, athlete-B indicator dot |
| Ao Tint | `#E8F0FE` | `--color-ao-tint` | Light background wash for Ao-corner rows/highlights outside the score panel |

### Semantic (System States)

Deliberately different hues from Aka/Ao, so a system alert is never mistaken for a competitor color mid-match.

| Name | Value | Token | Role |
|------|-------|-------|------|
| Success Green | `#22794A` | `--color-success` | Approved submissions, completed status, win confirmation |
| Success Tint | `#F5F8F6` | `--color-success-tint` | Success status pill background |
| Warning Amber | `#8E571E` | `--color-warning` | Pending/flagged status, kumite penalty warnings, low-time clock state |
| Warning Tint | `#FFF5EE` | `--color-warning-tint` | Warning status pill background |
| Danger Maroon | `#A2121C` | `--color-danger` | Destructive actions (delete event, reject submission) — deliberately a deep wine, not Aka red |
| Danger Tint | `#FDF6F4` | `--color-danger-tint` | Danger status pill background |

## Tokens — Typography

### Switzer — Everything — display, headings, body, UI, nav. A clean neo-grotesque with a light, contemporary voice that stays legible at small sizes · `--font-switzer`
- **Substitute:** SF Pro (iOS), Roboto (Android), Inter
- **Weights:** 300 (Light), 400 (Regular), 500 (Medium)
- **Sizes:** 12, 12, 14, 16, 18, 22, 28, 32, 40
- **Line height:** 1.33, 1.33, 1.43, 1.5, 1.33, 1.27, 1.21, 1.25, 1.05
- **Letter spacing:** -0.020em, -0.020em, -0.015em, -0.010em, -0.010em, -0.010em, 0em, 0.02em, 0em
- **Role:** Everything read — body copy, headings, buttons, navigation, form labels

### Faculty Glyphic — Login headline only — the "Log in to Knockout" title, a humanist display face that gives the entry screen its own voice · `--font-faculty-glyphic`
- **Weights:** 400 (Regular)
- **Role:** One line on the login screen. Never used elsewhere

### Geist Mono — Live numerals only — the match clock and score totals, so digits never jitter or reflow as they update in real time · `--font-geist-mono`
- **Substitute:** IBM Plex Mono, JetBrains Mono, Roboto Mono
- **Weights:** 700
- **Sizes:** 56, 96
- **Line height:** 1.0
- **Letter spacing:** 0em
- **Role:** Tabular, fixed-width numerals for the match countdown clock and the live score display — the only place a secondary typeface appears

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|-----------------|-------|
| caption | 12px | 1.33 | 0 | `--text-caption` |
| label | 12px | 1.33 | 0.02em (uppercase) | `--text-label` |
| body | 14px | 1.43 | 0 | `--text-body` |
| body-lg | 16px | 1.5 | -0.01em | `--text-body-lg` |
| subheading | 18px | 1.33 | -0.01em | `--text-subheading` |
| heading-sm | 22px | 1.27 | -0.01em | `--text-heading-sm` |
| heading | 28px | 1.21 | -0.015em | `--text-heading` |
| heading-lg | 32px | 1.25 | -0.02em | `--text-heading-lg` |
| display | 40px | 1.05 | -0.02em | `--text-display` |
| timer-display | 56px | 1.0 | 0 (Geist Mono) | `--text-timer` |
| score-display | 96px | 1.0 | 0 (Geist Mono) | `--text-score` |

Keep body text no smaller than 14px anywhere read at arm's length (ring-side, not just close-up) — the reference web system's 11–13px captions don't survive the distance test on a tournament floor.

## Tokens — Spacing & Shapes

**Base unit:** 4px, rounded up to 8px multiples for anything tappable.

**Density:** comfortable — this is a touch interface used under time pressure, not a data-dense desktop screen.

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 24 | 24px | `--spacing-24` |
| 32 | 32px | `--spacing-32` |
| 48 | 48px | `--spacing-48` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 16px |
| chips / status pills | 8px |
| buttons | 9999px |
| score panel | 20px |
| bottom sheet (top corners) | 24px |

### Touch Targets & Safe Areas

- **Minimum tappable size:** 48×48pt everywhere, except the Button component's own `medium` (36pt) and `normal` (40pt, its default) sizes — most buttons in the app are below this floor as a deliberate choice; the true minimum still governs every other tappable control (chips, list rows, text fields), and score-entry buttons keep their own dedicated 56pt+ size regardless of Button's `size` prop.
- **Score-entry buttons:** 56pt+ tall — these are used mid-match, one-handed, without looking away from the match.
- **Safe areas:** every screen respects device safe-area insets; the match clock in the score panel header must never sit under a notch or dynamic island.

### Shadows

| Name | Value | Token |
|------|-------|-------|
| subtle | `rgba(15, 17, 21, 0.06) 0px 1px 2px 0px` | `--shadow-subtle` |
| score-panel | `rgba(15, 17, 21, 0.12) 0px 4px 12px 0px` | `--shadow-score-panel` |

## Components

### Score Panel (Aka/Ao Split)
**Role:** Primary live-scoring surface for a kumite match

Full-width panel split vertically in half: left side Aka fill (`#E11D2E`), right side Ao fill (`#0B57D0`), each with the athlete's name in white body-lg and their running total in white `score-display` (96px, Geist Mono, weight 700). The match clock overlaps both halves at the top center as a black pill in `timer-display` (56px, Geist Mono), turning Warning Amber in the final 10 seconds. Score-entry buttons sit below each half.

### Score Button
**Role:** Point and penalty entry, mid-match

White fill on the athlete's colored half, Ink Black label at 17-19px weight 500, 16px radius, minimum 56pt height, generous horizontal padding for thumb reach without looking down. No color coding beyond which half it sits on — the label alone (Ippon/Waza-ari/Yuko) differentiates action.

### Tatami Queue Card
**Role:** Current/on-deck/up-next display for one ring

White card, 16px radius, an uppercase `label`-style chip reading "TATAMI 3" in Ink Black, athlete names each with a small Aka or Ao dot beside them, estimated call time in Slate Gray caption below.

### Status Pill
**Role:** Small state indicator for categories, submissions, and events

Pill shape (8px radius), tinted background with matching colored text: Success green (Approved/Completed), Warning amber (Pending/Flagged), Slate gray (Draft), Danger maroon (Rejected). Aka/Ao never appear on a status pill.

### Approval Queue Row
**Role:** Organizer's registration review list item

Club name in body-lg weight 500, participant count and submitted-at timestamp in caption/Slate Gray, two actions right-aligned: Approve (filled Success green pill) and Flag (outlined Warning amber pill).

### Bracket Tree View
**Role:** Visual bracket display

Match nodes as small cards in a horizontally-scrolling tree; each side shows an Aka or Ao dot beside the athlete's name once assigned to that corner. The winner's name stays Ink Black and bold; the loser dims to Slate Gray on advance.

### Bottom Tab Bar
**Role:** Primary app navigation

White fill, 1px Mist top border, active tab icon + label in Ink Black, inactive in Steel Gray. No color accent on tabs — native iOS/Android bottom-tab convention, not the floating pill pattern of the reference web system.

### Primary Button
**Role:** Main calls to action (Generate Bracket, Approve All, Start Match)

Fill is the primary gradient (`linear-gradient(360deg, #111111, #444444)`, dark at the bottom), white text at 17px weight 400, 9999px radius, 48pt minimum height.

### Match Clock
**Role:** Countdown timer in the score panel header

Black pill, white `timer-display` numerals (Geist Mono, tabular), turns Warning Amber background in the final 10 seconds as an urgency cue distinct from any competitor color.

## Do's and Don'ts

### Do
- Reserve Aka Red and Ao Blue exclusively for competitor/corner identity — score panels, bracket corner tags, athlete indicator dots — and nowhere else in the UI.
- Keep every tappable control at least 48×48pt; make score-entry buttons 56pt+ since they're used mid-match under time pressure.
- Use tabular (Geist Mono) numerals for anything that updates live — score totals, match clock — so digits never jitter or reflow.
- Respect device safe-area insets on every screen, especially the score panel header.
- Use a native bottom tab bar for primary navigation.
- Pick Danger Maroon (not Aka Red) for every destructive action, so "delete" never visually reads as a competitor color.

### Don't
- Don't use Aka Red for system errors or Ao Blue for links/info states — use the semantic Success/Warning/Danger set instead.
- Don't drop below 15px for anything read at arm's length, even where the type scale technically allows a 12-13px caption.
- Don't introduce a third accent color outside the score panel — the system depends on color scarcity to keep Aka/Ao meaningful.
- Don't use a weight below 700 for `score-display` or `timer-display` — legibility across a gym floor requires it.
- Don't stack Aka and Ao anywhere they don't represent an actual pair of competitors (e.g., never use them as generic "option A / option B" colors elsewhere in the app).

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Page Canvas | `#FFFFFF` | Main background for all screens |
| 1 | Card Surface | `#FFFFFF` | Cards sit on canvas with hairline Mist borders |
| 2 | Muted Surface | `#F7F8F8` | Table stripes, alt-row backgrounds |
| 3 | Score Panel — Aka | `#E11D2E` | Left half of the live score panel |
| 3 | Score Panel — Ao | `#0B57D0` | Right half of the live score panel |
| 4 | Tab Bar | `#FFFFFF` | Bottom navigation, 1px Mist top border |

## Elevation

- **Card:** `rgba(15, 17, 21, 0.06) 0px 1px 2px 0px`
- **Score Panel:** `rgba(15, 17, 21, 0.12) 0px 4px 12px 0px` — the one screen in the app allowed to feel "raised," since it's the focal surface during a match

## Quick Start

### React Native — Theme Tokens (TypeScript)

```ts
export const theme = {
  colors: {
    // Neutrals
    inkBlack: '#0F1115',
    charcoal: '#525356',
    slateGray: '#646668',
    steelGray: '#BFC0C1',
    mist: '#E9EAEA',
    cloud: '#F7F8F8',
    paperWhite: '#FFFFFF',

    // Competitor colors — reserved for corner identity only
    aka: '#E11D2E',
    akaTint: '#FDE7E9',
    ao: '#0B57D0',
    aoTint: '#E8F0FE',

    // Semantic
    success: '#22794A',
    successTint: '#F5F8F6',
    warning: '#8E571E',
    warningTint: '#FFF5EE',
    danger: '#A2121C',
    dangerTint: '#FDF6F4',
  },

  // One family per weight: React Native selects custom-font weights by family name.
  fonts: {
    sans: {
      light: 'Switzer-Light',
      regular: 'Switzer-Regular',
      medium: 'Switzer-Medium',
    },
    display: 'FacultyGlyphic-Regular', // login headline only
    mono: 'GeistMono_700Bold', // score-display and timer-display only
  },

  type: {
    caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0 },
    label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.26 },
    body: { fontSize: 14, lineHeight: 20 },
    bodyLg: { fontSize: 16, lineHeight: 24, letterSpacing: -0.17 },
    subheading: { fontSize: 18, lineHeight: 24, letterSpacing: -0.19 },
    headingSm: { fontSize: 22, lineHeight: 28, letterSpacing: -0.22 },
    heading: { fontSize: 28, lineHeight: 34, letterSpacing: -0.42 },
    headingLg: { fontSize: 32, lineHeight: 40, letterSpacing: -0.68 },
    display: { fontSize: 40, lineHeight: 42, letterSpacing: -0.8 },
    timerDisplay: { fontSize: 56, lineHeight: 56, fontFamily: 'GeistMono_700Bold' },
    scoreDisplay: { fontSize: 96, lineHeight: 96, fontFamily: 'GeistMono_700Bold' },
  },

  spacing: {
    4: 4, 8: 8, 12: 12, 16: 16, 24: 24, 32: 32, 48: 48,
  },

  radii: {
    card: 16,
    chip: 8,
    button: 9999,
    scorePanel: 20,
    sheetTop: 24,
  },

  touchTarget: {
    minimum: 48, // the true accessibility floor; kept untouched by Button's own sizes below
    medium: 36,
    normal: 40,
    scoreButton: 56,
  },

  // Primary button fill: CSS linear-gradient(360deg, #111111, #444444), i.e. dark at the bottom, lighter at the top.
  gradients: {
    primary: ['#111111', '#444444'],
  },

  shadows: {
    subtle: {
      shadowColor: '#0F1115',
      shadowOpacity: 0.06,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1, // Android
    },
    scorePanel: {
      shadowColor: '#0F1115',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6, // Android
    },
  },
} as const;
```

### NativeWind / Tailwind (if using utility classes in RN)

```css
@theme {
  --color-ink-black: #0F1115;
  --color-charcoal: #525356;
  --color-slate-gray: #646668;
  --color-steel-gray: #BFC0C1;
  --color-mist: #E9EAEA;
  --color-cloud: #F7F8F8;
  --color-paper-white: #FFFFFF;

  --color-aka: #E11D2E;
  --color-aka-tint: #FDE7E9;
  --color-ao: #0B57D0;
  --color-ao-tint: #E8F0FE;

  --color-success: #22794A;
  --color-success-tint: #F5F8F6;
  --color-warning: #8E571E;
  --color-warning-tint: #FFF5EE;
  --color-danger: #A2121C;
  --color-danger-tint: #FDF6F4;

  --radius-card: 16px;
  --radius-chip: 8px;
  --radius-button: 9999px;
  --radius-score-panel: 20px;
}
```

## Open Items

- **App name/logo:** the app is named Knockout; the logo lives in `components/Logo.tsx`. The neutral+Aka/Ao system holds regardless of branding.
- **Dark mode:** out of scope per the light-only decision for v1; if added later, Aka/Ao should likely brighten slightly (e.g., Aka → `#FF4D5E`, Ao → `#3B82F6`) to hold contrast on a dark score panel — worth a dedicated pass rather than a blind invert.
- **Iconography set:** not yet specified — recommend a single consistent icon family (e.g., Phosphor or Lucide) at 1.5-2px stroke weight to match Switzer's clean grotesque character.
