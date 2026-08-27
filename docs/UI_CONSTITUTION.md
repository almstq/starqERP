# starqERP — Canonical UI Constitution & Material 3 Design System Specification

> **Status**: AUTHORITATIVE SSOT  
> **Authority**: Founder Directives & Google Material 3 (M3) Adoption  
> **Design Framework**: Google Material 3 (M3 Expressive)  
> **Generator**: `@material/material-color-utilities@0.4.0`  
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
│ Brand Primary Seed Color      │ #E59500 (Starq Warm Amber, HCT 72 57 68)    │
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
- **Seed Color**: `#E59500` (Starq Amber, HCT: Hue 72, Chroma 57, Tone 68)
- **Contrast Level**: `0.0` (Standard)
- **Scheme Architecture**: Official Material 3 `DynamicScheme` with crisp neutral canvas (`neutralPalette`: 0 chroma; `neutralVariantPalette`: 0 chroma).
- **Neutral Policy**: Starq amber is used exclusively for primary interactive emphasis and focused indicators, **never** as an all-over wash across neutral surfaces. Surfaces remain crisp, clean neutral Material grays in light mode, and crisp charcoal slates in dark mode.

### Canonical Token Roles (`md.sys.color.*`)

```
┌───────────────────────────────────────┬───────────┬───────────┐
│ Semantic Role                         │ Light     │ Dark      │
├───────────────────────────────────────┼───────────┼───────────┤
│ --md-sys-color-primary                │ #845400   │ #ffb95a   │
│ --md-sys-color-on-primary             │ #ffffff   │ #462a00   │
│ --md-sys-color-primary-container      │ #ffddb6   │ #643f00   │
│ --md-sys-color-on-primary-container   │ #643f00   │ #ffddb6   │
│ --md-sys-color-secondary              │ #576062   │ #bfc8ca   │
│ --md-sys-color-on-secondary           │ #ffffff   │ #293234   │
│ --md-sys-color-secondary-container    │ #dbe4e6   │ #3f484a   │
│ --md-sys-color-on-secondary-container │ #3f484a   │ #dbe4e6   │
│ --md-sys-color-tertiary               │ #4a6364   │ #b0cccc   │
│ --md-sys-color-on-tertiary            │ #ffffff   │ #1b3435   │
│ --md-sys-color-tertiary-container     │ #cce8e8   │ #324b4c   │
│ --md-sys-color-on-tertiary-container  │ #324b4c   │ #cce8e8   │
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
│ --md-sys-color-inverse-primary        │ #ffb95a   │ #845400   │
└───────────────────────────────────────┴───────────┴───────────┘
```

---

## 3. Material 3 Adaptive Window Classes & Container Responsiveness

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

---

## 4. Starq ERP DataTable Primitive Contract

The `DataTable` is a Starq ERP primitive governed by Material 3 system tokens:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STARQ ERP DATATABLE CONTRACT                          │
├───────────────────────┬─────────────────────────────────────────────────────┤
│ Density & Heights     │ Desktop dense visual row: min 44px – 48px           │
│                       │ Interactive controls: min 48×48px effective touch   │
│                       │ Compact / mobile rows: >= 48px touch-friendly       │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ Header Typography     │ Material 3 label role (label-medium / label-large)  │
│                       │ text-xs font-semibold; no mandatory uppercase       │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ Cell Padding          │ px-4 py-3 (consistent across all tables)            │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ Divider Treatment     │ 1px solid var(--md-sys-color-outline-variant)       │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ Hover State           │ hover:bg-[var(--md-sys-color-surface-container-high)]│
├───────────────────────┼─────────────────────────────────────────────────────┤
│ Financial Numbers     │ UI font (Instrument Sans) + tabular figures         │
│                       │ Right-aligned; zero digit truncation                │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ Technical IDs         │ Geist Mono (font-mono text-xs); min-w-0; tooltip    │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ Scroll Containment    │ erp-scroll-region owns horizontal scroll            │
│                       │ Whole-page scrollWidth <= clientWidth strictly kept │
└───────────────────────┴─────────────────────────────────────────────────────┘
```

---

## 5. One Typography Contract

| Role | Typography Specification | Usage |
|------|--------------------------|-------|
| **Page Title** | `text-xl sm:text-2xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)]` | Top view headings |
| **Section Title** | `text-xs font-semibold uppercase tracking-wider text-[var(--md-sys-color-on-surface)]` | Widget / section boundaries |
| **Card / KPI Title** | `text-xs font-medium text-[var(--md-sys-color-on-surface-variant)]` | Metric card labels |
| **Body Primary** | `text-xs sm:text-sm font-medium text-[var(--md-sys-color-on-surface)]` | Primary descriptions, cell text |
| **Table Header** | `text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]` | Column labels |
| **Secondary Metadata** | `text-[11px] text-[var(--md-sys-color-on-surface-variant)]` | Sub-labels, helper memos |
| **Button Label** | `text-xs sm:text-sm font-medium` | Button text |
| **Chip / Badge Label** | `text-[11px] font-semibold uppercase tracking-wider` | Status pills, category chips |
| **Financial / Numeric** | UI Font + `tabular-nums font-semibold` | Amounts, quantities, balances |
| **Technical ID / Code** | `font-mono text-xs font-semibold text-[var(--md-sys-color-primary)]` | Work order IDs, UUIDs, SKUs |

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
