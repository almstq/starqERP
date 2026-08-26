# starqERP — Canonical UI Constitution & Material 3 Design System Specification

> **Status**: AUTHORITATIVE SSOT  
> **Authority**: Founder Directive & Google Material 3 (M3) Adoption (2026-08-27)  
> **Design Framework**: Google Material 3 (M3 Expressive)  
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
│ Brand Primary Seed Color      │ #E59500 (Starq Warm Amber)                  │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ First Production Tenant       │ Club Ignition (Automotive Garage)           │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

### Logomark & Wordmark Specification
- **Logomark (`L4`)**: The `q` of `starq` reduced to a minimal geometric bowl and descender rendered via SVG.
- **Wordmark (`W4`)**: `starq` in **Instrument Sans** followed immediately by `ERP` in **Geist Mono** (uppercase tag).
- **Tenant Neutrality in Chrome**: The application chrome is strictly `starqERP` branded. The active workspace name appears solely in the top workspace selector.

---

## 2. Material 3 Adaptive Window Classes & Container Responsiveness

The responsive engine uses **Google Material 3 Adaptive Window Classes** and **Container Queries**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 MATERIAL 3 ADAPTIVE WINDOW-SIZE CLASSES                     │
├───────────────────────┬─────────────────────────────────────────────────────┤
│ Compact               │ < 600px                                             │
│                       │ Single pane, modal drawer, 1-col reflow             │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ Medium                │ 600 – 839px                                         │
│                       │ NavigationRail, multi-col card grids                │
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
Reusable ERP components must adapt to the space actually allocated to them, not merely the viewport:
- `@container (max-width: 420px)`: Single column stacking for KPI tiles, entity cards, and forms.
- `@container (min-width: 421px)`: Side-by-side multi-column arrangement.
- Applied to: KPI cards, Work Order cards, Customer cards, Form fieldsets, Drawer side panels, Modal dialog bodies.

---

## 3. Canonical Content-Overflow Policy

Zero page-level horizontal overflow: `scrollWidth <= clientWidth`.
`overflow-x: hidden` is **forbidden** as an overflow mask. Responsiveness must be solved at the component level:

```
┌───────────────────────────┬─────────────────────────────────────────────────┐
│ Content Category          │ Policy & Behavior                               │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ Names / Descriptions      │ Wrap naturally; line-clamp-2 or line-clamp-3    │
│                           │ where density dictates. Never cut off abruptly. │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ IDs / UUIDs / Hashes      │ min-w-0; truncate with title/copy affordance    │
│                           │ to preserve complete cryptographic identity.    │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ Currencies & Quantities   │ Intact always; tabular figures (`mono-num`);    │
│                           │ layout reflows around them; zero chopped digits.│
├───────────────────────────┼─────────────────────────────────────────────────┤
│ Badges / Status Chips     │ Atomic (`whitespace-nowrap`); surrounding chip  │
│                           │ group wraps (`flex-wrap`).                      │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ Action Groups / Toolbars  │ Flex-wrap by default; secondary actions stack   │
│                           │ or collapse into overflow menus on Compact.     │
└───────────────────────────┴─────────────────────────────────────────────────┘
```

---

## 4. Material 3 Tonal Surface Hierarchy & Color Roles

### Tonal Surface Roles
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MATERIAL 3 SURFACE PROGRESSION                        │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ surface                       │ Base screen background                      │
│ surface-dim / surface-bright  │ Dynamic contrast anchors                    │
│ surface-container-lowest      │ Deepest container (tables, cards in light)  │
│ surface-container-low         │ Base column containers, panels              │
│ surface-container             │ Primary cards, dialog body, top bar         │
│ surface-container-high        │ Raised cards, search inputs, active toolbars│
│ surface-container-highest     │ Highest elevation, dropdowns, popovers      │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

### Semantic Token Architecture (`md.sys.*`)

#### Light Theme (`:root` / `.light`)
- `--md-sys-color-primary`: `#855300`
- `--md-sys-color-on-primary`: `#ffffff`
- `--md-sys-color-primary-container`: `#ffddb6`
- `--md-sys-color-on-primary-container`: `#2b1700`
- `--md-sys-color-secondary`: `#705b41`
- `--md-sys-color-on-secondary`: `#ffffff`
- `--md-sys-color-secondary-container`: `#fce0be`
- `--md-sys-color-on-secondary-container`: `#281805`
- `--md-sys-color-tertiary`: `#516440`
- `--md-sys-color-on-tertiary`: `#ffffff`
- `--md-sys-color-tertiary-container`: `#d3eabb`
- `--md-sys-color-on-tertiary-container`: `#101f04`
- `--md-sys-color-surface`: `#fff8f4`
- `--md-sys-color-surface-dim`: `#e5d7d0`
- `--md-sys-color-surface-bright`: `#fff8f4`
- `--md-sys-color-surface-container-lowest`: `#ffffff`
- `--md-sys-color-surface-container-low`: `#fef1eb`
- `--md-sys-color-surface-container`: `#f8ece5`
- `--md-sys-color-surface-container-high`: `#f3e6df`
- `--md-sys-color-surface-container-highest`: `#ede0da`
- `--md-sys-color-on-surface`: `#211a15`
- `--md-sys-color-on-surface-variant`: `#51443b`
- `--md-sys-color-outline`: `#83746a`
- `--md-sys-color-outline-variant`: `#d5c3b8`
- `--md-sys-color-error`: `#ba1a1a`
- `--md-sys-color-error-container`: `#ffdad6`
- `--md-sys-color-on-error`: `#ffffff`

#### Dark Theme (`.dark`)
- `--md-sys-color-primary`: `#ffb865`
- `--md-sys-color-on-primary`: `#472a00`
- `--md-sys-color-primary-container`: `#653e00`
- `--md-sys-color-on-primary-container`: `#ffddb6`
- `--md-sys-color-secondary`: `#dec1a0`
- `--md-sys-color-on-secondary`: `#3e2d17`
- `--md-sys-color-secondary-container`: `#57432b`
- `--md-sys-color-on-secondary-container`: `#fce0be`
- `--md-sys-color-tertiary`: `#b8cea1`
- `--md-sys-color-on-tertiary`: `#243516`
- `--md-sys-color-tertiary-container`: `#3a4c2a`
- `--md-sys-color-on-tertiary-container`: `#d3eabb`
- `--md-sys-color-surface`: `#18120e`
- `--md-sys-color-surface-dim`: `#18120e`
- `--md-sys-color-surface-bright`: `#3f3833`
- `--md-sys-color-surface-container-lowest`: `#130d09`
- `--md-sys-color-surface-container-low`: `#211a16`
- `--md-sys-color-surface-container`: `#251e1a`
- `--md-sys-color-surface-container-high`: `#302924`
- `--md-sys-color-surface-container-highest`: `#3b342f`
- `--md-sys-color-on-surface`: `#ede0da`
- `--md-sys-color-on-surface-variant`: `#d5c3b8`
- `--md-sys-color-outline`: `#9e8e83`
- `--md-sys-color-outline-variant`: `#51443b`
- `--md-sys-color-error`: `#ffb4ab`
- `--md-sys-color-error-container`: `#93000a`
- `--md-sys-color-on-error`: `#690005`

---

## 5. Material 3 Shape Scale (`md.sys.shape.*`)

```css
--md-sys-shape-none:               0px;
--md-sys-shape-corner-extra-small: 4px;   /* Chips, badges, sub-tags */
--md-sys-shape-corner-small:       8px;   /* Text fields, select inputs */
--md-sys-shape-corner-medium:      12px;  /* Cards, table containers */
--md-sys-shape-corner-large:       16px;  /* Navigation drawers, sheets */
--md-sys-shape-corner-extra-large: 28px;  /* Dialogs, major modals */
--md-sys-shape-corner-full:        9999px;/* Buttons, search pills */
```
