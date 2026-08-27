# starqERP — Canonical UI Constitution & Full Material 3 Design System Specification

> **Status**: AUTHORITATIVE SSOT  
> **Authority**: Founder Directives & Full Google Material 3 (M3 Expressive) Adoption  
> **Design Framework**: Google Material 3 (M3 Expressive)  
> **Generator**: `@material/material-color-utilities@0.4.0`  
> **Color Seed**: `#0B57D0` (Official Google Material 3 Blue, HCT 270 65 40)  
> **Adaptive Engine**: Material 3 Adaptive Window-Size Classes & Container Queries  
> **Brand Identity**: Starq Technologies (`starqERP`, `starqAI`)

---

## 1. Product Identity & Brand Foundation

starqERP is built on **Google Material 3** as its design system while preserving the **Starq** brand identity:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CANONICAL NAMING RULES                            │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ Core Product Name             │ starqERP                                    │
│ (Forbidden Variants)          │ STARQ ERP, StarqERP, Starq ERP, starq ERP   │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Embedded AI Capability        │ starqAI                                     │
│ (Forbidden Variants)          │ STARQ AI, Starq AI, StarqAI, starq AI       │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Canonical Design System Seed  │ #0B57D0 (Official Google Material 3 Blue)   │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ First Production Tenant       │ Club Ignition (Automotive Garage)           │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

### Logomark & Wordmark Specification
- **Logomark (`L4`)**: The `q` of `starq` reduced to a minimal geometric bowl and descender rendered via SVG.
- **Wordmark (`W4`)**: `starq` in **Instrument Sans** followed immediately by `ERP` in **Geist Mono** (uppercase tag).
- **Tenant Neutrality in Chrome**: The application chrome is strictly `starqERP` branded. The active workspace name appears solely in the top workspace selector.

---

## 2. Official Material Color Utilities Generation & Palette Architecture

### Generator SSOT
All semantic color roles are generated using **`@material/material-color-utilities@0.4.0`**:
- **Seed Color**: `#0B57D0` (Google Material Blue, HCT: Hue 270, Chroma 65, Tone 40)
- **Contrast Level**: `0.0` (Standard)
- **Scheme Architecture**: Official Material 3 `DynamicScheme` with crisp neutral canvas (`neutralPalette`: 0 chroma; `neutralVariantPalette`: 0 chroma).
- **Neutral Policy**: Material Blue is used exclusively for primary interactive emphasis, active indicators, and focus rings. Surfaces remain crisp, clean neutral Material grays in light mode, and crisp charcoal slates in dark mode without peach/amber contamination.

### Canonical Token Roles (`md.sys.color.*`)

```
┌───────────────────────────────────────┬───────────┬───────────┐
│ Semantic Role                         │ Light     │ Dark      │
├───────────────────────────────────────┼───────────┼───────────┤
│ --md-sys-color-primary                │ #0b57d0   │ #b2c5ff   │
│ --md-sys-color-on-primary             │ #ffffff   │ #002b72   │
│ --md-sys-color-primary-container      │ #dae2ff   │ #0040a1   │
│ --md-sys-color-on-primary-container   │ #0040a1   │ #dae2ff   │
│ --md-sys-color-secondary              │ #595e6f   │ #c2c6d9   │
│ --md-sys-color-on-secondary           │ #ffffff   │ #2b3040   │
│ --md-sys-color-secondary-container    │ #dee2f6   │ #414656   │
│ --md-sys-color-on-secondary-container │ #191c28   │ #dee2f6   │
│ --md-sys-color-tertiary               │ #006399   │ #94ccff   │
│ --md-sys-color-on-tertiary            │ #ffffff   │ #003353   │
│ --md-sys-color-tertiary-container     │ #cde5ff   │ #004b75   │
│ --md-sys-color-on-tertiary-container  │ #001d32   │ #cde5ff   │
│ --md-sys-color-error                  │ #ba1a1a   │ #ffb4ab   │
│ --md-sys-color-on-error               │ #ffffff   │ #690005   │
│ --md-sys-color-error-container        │ #ffdad6   │ #93000a   │
│ --md-sys-color-on-error-container     │ #93000a   │ #ffdad6   │
│ --md-sys-color-surface                │ #f9f9f9   │ #131313   │
│ --md-sys-color-surface-dim            │ #dadada   │ #131313   │
│ --md-sys-color-surface-bright         │ #f9f9f9   │ #393939   │
│ --md-sys-color-surface-container-lowest│ #ffffff  │ #0e0e0e   │
│ --md-sys-color-surface-container-low  │ #f3f3f3   │ #1b1b1b   │
│ --md-sys-color-surface-container      │ #eeeeee   │ #1f1f1f   │
│ --md-sys-color-surface-container-high │ #e8e8e8   │ #2a2a2a   │
│ --md-sys-color-surface-container-highest│ #e2e2e2 │ #353535   │
│ --md-sys-color-on-surface             │ #1b1b1b   │ #e2e2e2   │
│ --md-sys-color-on-surface-variant     │ #474747   │ #c6c6c6   │
│ --md-sys-color-outline                │ #777777   │ #919191   │
│ --md-sys-color-outline-variant        │ #c6c6c6   │ #474747   │
│ --md-sys-color-inverse-surface        │ #303030   │ #e2e2e2   │
│ --md-sys-color-inverse-on-surface     │ #f1f1f1   │ #303030   │
│ --md-sys-color-inverse-primary        │ #b2c5ff   │ #0b57d0   │
└───────────────────────────────────────┴───────────┴───────────┘
```

---

## 3. Material 3 Motion, State Layers & Tactile Ripple Physics

### Motion & Easing Engine
- **Emphasized Decelerate**: `cubic-bezier(0.05, 0.7, 0.1, 1.0)` for entrances (dialogs, drawers, dropdowns).
- **Emphasized Accelerate**: `cubic-bezier(0.3, 0.0, 0.8, 0.15)` for exits.
- **Standard Curve**: `cubic-bezier(0.2, 0.0, 0, 1.0)` for color, border, and elevation shifts.

### State Layers (`md.sys.state.*`)
Interactive elements use semi-transparent overlays matching their text/content color:
- **Hover State**: `8%` opacity (`--md-sys-state-hover-opacity: 0.08`)
- **Focus State**: `12%` opacity (`--md-sys-state-focus-opacity: 0.12`)
- **Pressed State**: `12%` opacity (`--md-sys-state-pressed-opacity: 0.12`)
- **Dragged State**: `16%` opacity (`--md-sys-state-dragged-opacity: 0.16`)

### Signature Ink Ripple
All buttons, table rows, filter chips, and segmented controls feature GPU-accelerated radial ink ripples originating from the user's exact pointer coordinates.

---

## 4. Material 3 Adaptive Window Classes & Container Responsiveness

The responsive engine uses **Google Material 3 Adaptive Window Classes** and **Container Queries**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 MATERIAL 3 ADAPTIVE WINDOW-SIZE CLASSES                     │
├───────────────────────┬─────────────────────────────────────────────────────┤
│ Compact               │ < 600px                                             │
│                       │ Single pane, modal drawer, 1-col reflow             │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ Medium                │ 600 – 839px                                         │
│                       │ NavigationRail (72px), multi-col card grids         │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ Expanded              │ 840 – 1199px                                        │
│                       │ Persistent drawer, 2-pane master-detail workflows   │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ Large                 │ 1200 – 1599px                                       │
│                       │ Multi-pane dashboards, constrained readable reading │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ Extra-large           │ >= 1600px                                           │
│                       │ High-density sidebars, maximum content containment  │
└───────────────────────┴─────────────────────────────────────────────────────┘
```

### Container Responsiveness (`container-type: inline-size`)
Reusable ERP components adapt to the inline space actually allocated to them:
- `@container (max-width: 420px)`: Single column stacking for KPI tiles, entity cards, and forms.
- `@container (min-width: 421px)`: Multi-column arrangement.
- Applied to: KPI cards, Work Order cards, Customer cards, Form fieldsets, Drawer side panels, Modal dialog bodies.

---

## 5. Authentic M3 Form, Selection & Navigation Controls

| Primitive | Specification | Behavior |
| :--- | :--- | :--- |
| **`Button`** | Filled, Tonal, Outlined, Text, Elevated | Integrated state layer, ink ripple, active scale (0.98), M3 elevation |
| **`Input`** | M3 Outlined Text Field | Floating label animation, active notch cutout, focus ring, supporting text |
| **`Switch`** | M3 Animated Toggle | 32×52px track, thumb morphs 16px → 24px upon selection with spring deceleration |
| **`SegmentedButton`**| M3 View Toggle | Connected segments with leading animated checkmark upon selection |
| **`FilterChip`** | M3 Filter Chip | 32px height, 8px radius, leading checkmark, ink ripple |
| **`DataTable`** | Starq ERP Primitive | Governed by M3 tokens, tabular-nums financial alignment, contained scroll |
| **`Modal`** | M3 Dialog | Scrim backdrop blur, `m3-dialog-enter` emphasized deceleration reveal |
| **`Drawer`** | M3 Side Sheet | Pure tonal surface elevation, smooth slide-in |

---

## 6. Material 3 Shape Scale (`md.sys.shape.*`)

```css
--md-sys-shape-none:               0px;
--md-sys-shape-corner-extra-small: 4px;   /* Chips, badges, sub-tags */
--md-sys-shape-corner-small:       8px;   /* Text fields, select inputs */
--md-sys-shape-corner-medium:      12px;  /* Cards, table containers */
--md-sys-shape-corner-large:       16px;  /* Navigation drawers, sheets */
--md-sys-shape-corner-extra-large: 28px;  /* Dialogs, major modals */
--md-sys-shape-corner-full:        9999px;/* Buttons, search pills */
```
