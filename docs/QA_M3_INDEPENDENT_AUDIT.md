# starqERP — Independent QA Audit: Material 3 UI-System Adoption

> **Auditor**: Independent QA Review (read-only)
> **Date**: 27 August 2026
> **Branch**: `feat/settings-branding-logos-theme-about` (HEAD at `d67260a`)
> **Commit**: `feat(ui): implement full Google Material 3 UI/UX with ink ripple, state layers, motion curves, and M3 form controls (#7)`
> **Working Tree**: 14 staged files (Settings, Branding, Logos, Theme, About — not yet committed)
> **Scope**: Full M3 adoption verification across all UI surfaces

---

## Executive Verdict

# **FAIL**

**Material 3 has landed as a design-token foundation and a shared primitive library. It has NOT landed as a coherent application-wide UI system.** The main business surfaces (Dashboard, Customers, Jobs, Invoices, Payments, Expenses, Inventory) are correctly built on M3 primitives. However, a significant cluster of high-traffic views — Reports, Audit Trail, Settings (profile, roles, users, workflows, support), and all Detail Views — remain on raw Tailwind colors, hardcoded hex values, undefined legacy CSS classes, and `dark:` modifier prefixes. The result is a split-brain UI: half the application is on Material 3, half is on a pre-M3 Tailwind system that does not share the token architecture.

---

## Scorecard

| Dimension | Score /10 | Notes |
|---|---|---|
| M3 Architecture | 7 | Token system is correct; 18 primitives exist; but adoption is inconsistent |
| Light Theme | 5 | Main views clean; Reports/Audit/Settings use raw Tailwind slate/white/blue |
| Dark Theme | 3 | Only ~15% of components have `dark:` variants; entire Detail Views, Reports, Audit lack dark support |
| Typography | 5 | M3 role mapping in main views; `font-mono` overused (128 instances); no `tabular-nums` in Detail Views |
| DataTable Consistency | 4 | Canonical DataTable used in 7 list views; 8 files bypass it with raw `<table erp-table>` |
| Responsive/Adaptive | 7 | M3 Window Classes correct; detail views have responsive grid but legacy tables lack containment |
| Branding | 9 | Starq logomark canonical; starqAI naming correct; no temporary q logo |
| Theme Switching | 8 | System/Light/Dark correctly implemented with persistence, media query, DOM classes |
| Accessibility | 5 | Skip link, focus ring, reduced motion all present; but raw tables lack ARIA roles |
| Print | 1 | Zero `@media print` rules; `window.print()` captures entire AppShell including sidebar |

---

## 1. Material 3 Architecture

### What landed correctly

- **`theme.css`** (274 lines): Complete M3 token system — 30+ `--md-sys-color-*` roles, 7 shape tokens, 6 motion curves, 12 motion durations, 4 state layer opacities, 5 elevation models, 3 keyframe animations. All values match the UI_CONSTITUTION.md specification exactly.
- **`index.css`** (124 lines): Clean base layer — `overflow-x: clip` defensive boundary, `overflow-wrap: anywhere` on all text elements, `overflow-x: auto` scroll regions, focus-visible ring, `prefers-reduced-motion` respect, skip-link.
- **Shared primitives** (18 components in `web/src/components/ui/`): Button, Input, Select, Surface, Table, DataTable, Badge, Modal, Drawer, Tabs, ResponsiveGrid, ActionGroup, Ripple, StateLayer, Switch, SegmentedButton, FilterChip, ThemeSelector — all consume M3 tokens via inline `style` props.
- **AppShell** (442 lines): Implements all 5 M3 Adaptive Window Classes via `useMaterialWindowClass()` hook. NavigationRail (medium), Persistent Drawer (expanded+), Slide-over Modal Drawer (compact). All nav items use M3 surface-container, secondary-container, state layers.
- **ThemeContext** (79 lines): Correct System/Light/Dark with `localStorage` persistence, live OS `prefers-color-scheme` listener, DOM class toggling on `<html>`.

### What did NOT land

- **Six views completely bypass the M3 system**: ReportsView, AuditLogView, SettingsView (profile tab), RolesPermissionsTab, UsersManagementTab, WorkflowsConfigTab, SupportTab — these use raw Tailwind color classes (`text-slate-900`, `bg-white`, `border-slate-200`, `bg-blue-600`, etc.) and `dark:` modifiers instead of `var(--md-sys-color-*)` tokens.
- **All Detail Views** (CustomerDetailView, InvoiceDetailView, SupplierDetailView, PODetailView, PaymentDetailView) use undefined legacy CSS classes (`erp-card`, `erp-btn-primary`, `erp-muted`, `erp-pill`, `erp-table`) that have **no CSS definition** in any file in the codebase. These classes are dead references.

---

## 2. Color System

### Light Theme Contamination

**Peach/beige/amber contamination**: Eliminated. Zero matches for "peach" or "beige" anywhere in `web/src/`. Amber is used only as a semantic warning color (`bg-amber-50`, `text-amber-600`), which is correct M3 semantics.

**Primary usage**: Google Material 3 Blue `#0B57D0` correctly seeds all color roles. The blue is used as interactive emphasis, not washed across surfaces.

**Neutral surface hierarchy**: Light surfaces correctly progress from `#ffffff` (container-lowest) through `#eeeeee` (container) to `#e2e2e2` (container-highest). Dark surfaces correctly progress from `#0e0e0e` through `#353535`.

### Color Drift Violations

| # | Severity | File | Lines | Violation |
|---|----------|------|-------|-----------|
| C-1 | **Critical** | `ReportsView.tsx` | 96-510 (entire file) | 0% M3 token usage. Uses `text-slate-900`, `bg-white`, `border-slate-200`, `bg-emerald-50`, `bg-amber-50`, `text-blue-700`, `bg-rose-50`, `bg-blue-50`, `text-slate-500`, `bg-slate-50`, `border-slate-100` throughout. Hardcoded hex in ReCharts: `#e2e8f0`, `#64748b`, `#ffffff`, `#0f172a`, `#2563eb`, `#f87171`, `#10b981`. |
| C-2 | **Critical** | `AuditLogView.tsx` | 1-370 (entire file) | 0% M3 token usage. Uses `dark:bg-slate-900`, `dark:border-slate-800`, `dark:text-slate-100`, `bg-blue-600/10`, `bg-slate-50`, `border-slate-200` throughout. |
| C-3 | **Critical** | `SettingsView.tsx` | 86-340 (profile tab) | Raw Tailwind: `text-slate-900`, `bg-white`, `border-slate-200`, `bg-slate-50`, `bg-blue-600`, `bg-emerald-50`, `bg-slate-100`. `dark:` modifiers throughout. |
| C-4 | **High** | `common/GlobalSearchModal.tsx` | all | `bg-slate-900/80`, `bg-slate-800`, `text-slate-300`, `text-amber-400`, `bg-amber-500/15`. |
| C-5 | **High** | `common/Modal.tsx` | 76 | `focus-visible:ring-amber-500` on close button. |
| C-6 | **High** | `auth/MfaSetupModal.tsx` | all | `bg-blue-100/50`, `bg-blue-600`, `bg-red-50`, `border-red-200`, `bg-amber-50`, `text-amber-600` + 31 lines of `dark:` modifiers. |
| C-7 | **High** | `auth/MfaChallengeModal.tsx` | all | `bg-amber-100`, `bg-blue-600`, `bg-red-50`, `bg-amber-600` + 16 lines of `dark:` modifiers. |
| C-8 | **High** | `onboarding/OrganisationSetupModal.tsx` | all | `bg-red-50`, `bg-blue-50/60/950`, `border-blue-600`, hardcoded hex `#059669`, `#0284c7`, `#2563eb` + 41 lines of `dark:` modifiers. |
| C-9 | **High** | `jobs/CreateJobModal.tsx` | all | `bg-blue-600`, `bg-amber-50`, `text-emerald-600` — 22 raw Tailwind color class instances. |
| C-10 | **High** | `jobs/WorkflowStepRail.tsx` | all | `bg-blue-50/60`, `text-blue-700/900`, `bg-amber-50`, `border-blue-200/500` — 6 instances. |
| C-11 | **High** | `settings/RolesPermissionsTab.tsx` | all | `bg-blue-600`, `bg-blue-50/950`, `text-blue-700` + ~20 `dark:` modifier lines. |
| C-12 | **High** | `settings/UsersManagementTab.tsx` | all | `bg-blue-600/100`, `bg-amber-50/100/200`, `text-emerald-600`, `bg-rose-50` + 65+ `dark:` modifier lines. |
| C-13 | **High** | `settings/WorkflowsConfigTab.tsx` | all | `bg-blue-50/60/700`, `bg-emerald-50`, `bg-purple-50`, `bg-cyan-50`, `bg-rose-50`, `bg-amber-50` + 50+ `dark:` modifier lines. |
| C-14 | **High** | `settings/SupportTab.tsx` | all | `bg-blue-50/950/600`, `bg-amber-500`, `bg-rose-100` + 50+ `dark:` modifier lines. |
| C-15 | **High** | `inventory/NewItemModal.tsx` | all | `bg-blue-600`, `text-emerald-600`, `text-rose-600`, `focus:border-blue-500` — 10 instances. |
| C-16 | **High** | `inventory/StockAdjustmentModal.tsx` | all | `bg-blue-600`, `text-blue-600`, `focus:border-blue-500`, `text-emerald-600` — 3 instances. |
| C-17 | **High** | `customers/NewCustomerModal.tsx` | all | `bg-blue-600/700`, `focus:border-blue-500` — 14 instances. |
| C-18 | **High** | `invoices/CreateInvoiceModal.tsx` | all | `bg-blue-600`, `text-blue-600/700`, `focus:border-blue-500` — 9 instances. |
| C-19 | **High** | `payments/RecordPaymentModal.tsx` | all | `text-emerald-600`, `focus:border-blue-500` — 6 instances. |
| C-20 | **High** | `purchasing/CreatePOModal.tsx` | all | `bg-blue-600`, `text-blue-600`, `focus:border-blue-500` — 8 instances. |

**Summary**: Of ~58 `.tsx` component files, **9 use `dark:` modifiers** (337 lines total), and **25+ files** use raw Tailwind color classes bypassing the M3 token system. The M3 token adoption rate is approximately **55% by file count** but significantly lower by line count in the affected files.

---

## 3. Typography Audit

### Font Family

| Surface | Family | Correct? |
|---------|--------|----------|
| Global body | `var(--font-sans)` = Instrument Sans | Yes |
| M3 tokens in `@theme` | `--font-display`, `--font-sans` = Instrument Sans | Yes |
| Monospace declarations | `var(--font-mono)` = Geist Mono | Yes |
| `mono-num` class | `font-family: var(--font-mono); font-feature-settings: "tnum" 1, "zero" 1` | Yes |
| Instrument Serif usage | 0 instances | Clean |

### M3 Typography Role Mapping

| Role | Expected | Actual | File |
|------|----------|--------|------|
| Page titles | label-large / title-large, bold | `text-xl sm:text-2xl font-bold tracking-tight` | Main views: correct |
| Section headers | label-medium, uppercase | `text-xs font-bold uppercase tracking-wider` | Dashboard, Invoices, etc.: correct |
| KPI values | headline-medium, mono | `text-base sm:text-lg font-bold mono-num` | Dashboard KPIs: correct |
| Table headers | label-medium | `text-xs font-semibold` (DataTable), `text-[10px] font-bold uppercase` (Table.tsx) | Slight inconsistency |
| Table rows | body-medium | `text-xs` or `text-[11px]` | Consistent |
| Buttons | label-large | `text-xs font-semibold` on Button component | Consistent |
| Chips/Badges | label-small | `text-[10px]` or `text-[11px]` | Consistent |
| Metadata | body-small | `text-[11px]` or `text-[10px]` | Consistent |

### Typography Violations

| # | Severity | File | Issue |
|---|----------|------|-------|
| T-1 | **Critical** | `ReportsView.tsx` | Entire file uses `text-slate-900`, `text-slate-500`, `text-slate-600`, `text-slate-700` — no M3 typography roles |
| T-2 | **Critical** | `AuditLogView.tsx` | Uses `text-slate-900`, `text-slate-500`, `text-slate-400` — no M3 typography roles |
| T-3 | **Critical** | `SettingsView.tsx` (profile tab) | Uses `text-slate-900`, `text-slate-500`, `text-slate-600`, `text-slate-700` |
| T-4 | **High** | `font-mono` overuse | 128 instances across 20+ files. Some are appropriate (account codes, TIN, plate numbers, timestamps). But monetary values in Detail Views use `font-mono` instead of `tabular-nums` on the UI font, which is the M3-correct approach for financial values |
| T-5 | **High** | Detail Views (InvoiceDetail, CustomerDetail, etc.) | Financial values use `font-mono` without `tabular-nums`. M3 convention is UI font with tabular figures, not monospace |
| T-6 | **Medium** | `Table.tsx:46` | Header uses `text-[10px] font-semibold uppercase tracking-wider` while `DataTable.tsx:83` uses `text-xs font-semibold` — inconsistent header typography between the two table primitives |
| T-7 | **Medium** | `font-weight: extrabold` in ReportsView | Several headings use `font-extrabold` which is not an M3 role |

---

## 4. Canonical DataTable Audit

### DataTable Adoption

| View | Uses Canonical DataTable? | Notes |
|------|--------------------------|-------|
| DashboardView | **YES** | Jobs table via `<DataTable>` |
| CustomersView | **YES** | Full column definitions with `ColumnDef<Customer>[]` |
| JobsView | **YES** (list mode) | Kanban mode uses custom cards; list mode uses `<DataTable>` |
| InvoicesView | **YES** | Full `<DataTable>` |
| PaymentsView | **YES** | Full `<DataTable>` |
| ExpensesView | **YES** | Full `<DataTable>` |
| InventoryView | **YES** | Full `<DataTable>` |
| ReportsView | **NO** | Raw `<table>` × 3 (trial balance, technician stats, plus no DataTable import) |
| AuditLogView | **NO** | Raw `<table>` × 1 |
| PurchasingView | **NO** | Raw `<table class="erp-table">` |
| SuppliersView | **NO** | Raw `<table class="erp-table">` |
| CustomerDetailView | **NO** | Raw `<table class="erp-table">` × 2 |
| InvoiceDetailView | **NO** | Raw `<table class="erp-table">` × 2 |
| SupplierDetailView | **NO** | Raw `<table class="erp-table">` × 2 |
| PODetailView | **NO** | Raw `<table class="erp-table">` × 1 |
| Settings/RolesPermissionsTab | **NO** | Raw `<table>` × 1 |
| Settings/UsersManagementTab | **NO** | Raw `<table>` × 1 |
| Settings/SupportTab | **NO** | Raw `<table>` × 1 |

### The `erp-table` Ghost

The class `erp-table` is referenced 9 times across 7 files but **has no CSS definition anywhere in the codebase**. No `@layer`, no `@apply`, no `.erp-table {}` rule exists in any CSS file (`theme.css` or `index.css`). It is also not defined in any Tailwind config (no `tailwind.config.ts` exists — this is Tailwind v4).

**Impact**: These 9 `<table>` elements render with browser-default table styling only. They lack:
- M3 surface container backgrounds
- M3 outline-variant row dividers
- M3 shape tokens for border radius
- Sticky header
- Responsive column hiding
- Consistent row height (44-48px density contract)
- M3 hover state layers
- Tabular-nums for financials
- Monospace for IDs

### The `erp-card`, `erp-btn-*`, `erp-pill`, `erp-muted` Ghosts

These classes are used extensively (100+ references across 20+ files) but **none have CSS definitions**. They are dead class attributes producing no styling. The Detail Views that use them rely entirely on:
1. Adjacent Tailwind utility classes (which partially work)
2. Browser defaults (which look unstyled)

### Canonical DataTable Properties (verified in `DataTable.tsx`)

| Property | Value | M3 Compliant? |
|----------|-------|--------------|
| Header height | `h-10` (40px) | Borderline — M3 spec is 48px |
| Header typography | `text-xs font-semibold` | Correct |
| Row min-height | `min-h-[44px] sm:min-h-[48px]` | Correct |
| Row dividers | `divide-y divide-[var(--md-sys-color-outline-variant)]` | Correct |
| Hover state | `hover:bg-[var(--md-sys-color-surface-container-high)]` | Correct |
| Sticky header | `sticky top-0 z-10` | Correct |
| Numeric alignment | `text-right justify-end` via `getAlignmentClass` | Correct |
| Financial formatting | `tabular-nums font-medium` via `isNumeric` | Correct |
| ID monospace | `mono-num text-xs font-semibold` via `isMonospace` | Correct |
| Empty state | Centered message with `emptyAction` slot | Correct |
| Responsive hiding | `hideOn: 'compact' \| 'medium'` → `hidden sm:table-cell` | Correct |
| Surface background | `--md-sys-color-surface-container-lowest` | Correct |
| Border | `--md-sys-color-outline-variant` | Correct |
| Border radius | `--md-sys-shape-corner-medium` | Correct |
| Scroll containment | `erp-scroll-region` class (`overflow-x: auto; overscroll-behavior-x: contain`) | Correct |

---

## 5. Responsive / Adaptive Architecture

### M3 Adaptive Window Classes (verified in `AppShell.tsx`)

| Class | Range | Navigation | Verified |
|-------|-------|-----------|----------|
| Compact | < 600px | Slide-over modal drawer | YES |
| Medium | 600–839px | NavigationRail (72px) | YES |
| Expanded | 840–1199px | Persistent drawer (w-60) | YES |
| Large | 1200–1599px | Persistent drawer (w-64) | YES |
| Extra-large | ≥ 1600px | Persistent drawer (w-64) | YES |

### Container Responsiveness

| Component | `container-type: inline-size` | Verified |
|-----------|------------------------------|----------|
| `.cq-card` | YES | Defined in `index.css:34-39` |
| `.cq-panel` | YES | Defined in `index.css:41-46` |
| `Surface` with `container` prop | YES | Sets `containerType: 'inline-size'` |
| DataTable | `w-full min-w-0 erp-scroll-region` | Scroll containment correct |

### Responsive Violations

| # | Severity | File | Issue |
|---|----------|------|-------|
| R-1 | **Medium** | Detail Views | `erp-card` class is undefined, so card containers have no background/border/radius — content may bleed at narrow widths |
| R-2 | **Medium** | ReportsView, AuditLogView | Raw `<table>` elements inside `overflow-x-auto` work, but lack the `erp-scroll-region` `overscroll-behavior-x: contain` property — tables may scroll the page horizontally on mobile |
| R-3 | **Low** | All views | `overflow-x: clip` on `<html>` (index.css:19) provides a global safety net |

---

## 6. Theme Control

### System/Light/Dark Implementation

| Feature | Status | Evidence |
|---------|--------|----------|
| Three modes | System, Light, Dark | `ThemeContext.tsx:3` — `ThemeMode = 'system' \| 'light' \| 'dark'` |
| Persistence | `localStorage` key `starq_theme_mode` | `ThemeContext.tsx:13,59` |
| Default mode | `system` | `ThemeContext.tsx:21` |
| OS media query | `prefers-color-scheme: dark` listener with live updates | `ThemeContext.tsx:34-40` |
| DOM mutation | Adds `dark`/`light` class on `<html>` | `ThemeContext.tsx:46-54` |
| CSS selectors | `:root, html.light, .light` and `html.dark, .dark` | `theme.css:70-72, 154-155` |
| ThemeSelector component | 3-option menu (System/Light/Dark) with icons, checkmark, keyboard dismiss | `ThemeSelector.tsx` (198 lines) |
| Icons per mode | Laptop (System), Sun (Light), Moon (Dark) | `ThemeSelector.tsx:47-50` |
| Accessible label | `aria-haspopup`, `aria-expanded`, `role="menu"` | `ThemeSelector.tsx:76-97` |
| Footer status | "Currently active: {resolvedTheme} mode" | `ThemeSelector.tsx:185` |

**Assessment**: Theme switching is correctly implemented as a first-class feature. The System mode correctly tracks live OS changes. Persistence is correct.

### Dark Mode Coverage Gap

While the theme infrastructure is correct, **dark mode only visually works in the 55% of components that use `var(--md-sys-color-*)` tokens**. The other 45% (Reports, Audit, Settings profile, all Detail Views, all modals) use hardcoded light-only Tailwind classes (`bg-white`, `text-slate-900`, `border-slate-200`) which will render as bright white/light-gray even in dark mode. The `dark:` modifier lines (337 total) only cover a subset of these, and are themselves Tailwind utilities rather than M3 tokens.

---

## 7. Branding

### Canonical Naming

| Rule | Status | Evidence |
|------|--------|----------|
| Product name: `starqERP` | Correct | Used consistently in `index.html:5`, AppShell, AboutTab |
| AI name: `starqAI` | Correct | Used consistently; explicit drift test in `serp_032_product_metadata.test.tsx:22` rejects `StarqAI` |
| No `STARQ ERP` / `Starq ERP` / `StarqERP` | Correct | Zero matches in production code |
| No `STARQ AI` / `Starq AI` / `StarqAI` | Correct | Explicit test enforces lowercase |

### Logo / Mark

| Item | Status | Evidence |
|------|--------|----------|
| Temporary q logo | **Gone** | Zero matches for "q logo", "temporary", or "placeholder" in branding context |
| Canonical Starq Logomark SVG | Present | `brand/StarqLogo.tsx` — proper SVG with bowl + descender geometry |
| Brand Lockup | Present | `StarqBrandLockup` — logomark + "starq" text + "ERP" badge |
| Used in AppShell | YES | Navigation drawer header, rail icon |
| Used in About page | YES | `StarqBrandLockup size="lg"` |
| Canonical logo PNG files | Present (staged) | `web/public/starq-logo.png`, `web/public/club-ignition-logo.png` |

---

## 8. Organisation / Client Logo Support

| Feature | Status | Evidence |
|---------|--------|----------|
| Upload | YES | `LogoUpload.tsx` — file input, drag-and-drop, SVG security validation |
| Preview | YES | 128×128px preview frame with `object-contain` |
| Replace | YES | "Replace Logo" button triggers same file picker |
| Remove | YES | "Remove Logo" button calls `onSaveLogo(null)` |
| Persistence | **FAKE** | Stored as data URL in React state via `ERPContext.updateTenantLogo()` — resets on page refresh |
| Tenant scoping | **NO** | Only one tenant active; logo not persisted to any backend/localStorage |
| Fallback | YES | Initials-based monogram avatar in `primary-container` color |
| Safe rendering | YES | `onError` handler hides broken images; SVG script injection detection |

**Critical finding**: Logo persistence is browser-session-only. The success message "saved to tenant storage" is misleading — the data URL lives in React state. On page reload, the logo reverts. There is no `localStorage` or backend persistence for the uploaded logo.

---

## 9. About Page

| Check | Status | Evidence |
|-------|--------|----------|
| Starq logomark + brand lockup | YES | `StarqBrandLockup size="lg"` at `AboutTab.tsx:64` |
| starqERP name | YES | `meta.productName` from `STARQ_ERP_CANONICAL_METADATA` |
| Version/release metadata | YES | `meta.version`, `meta.releaseTrack` |
| Starq Technologies Pvt Ltd | YES | `meta.companyName` — `Starq Technologies Pvt Ltd` |
| starqAI naming | YES | `meta.embeddedAiName` — `starqAI` |
| Support contact | YES | `meta.contactEmail` |
| Privacy / Terms / Licenses | YES | Modal dialogs with content |
| No secrets exposed | YES | Only user-agent, theme mode, environment — no keys, no tokens |
| Canonical metadata source | YES | Imports from `../../../../contracts/commands` — single source of truth |

---

## 10. Print System

| Check | Status | Evidence |
|-------|--------|----------|
| Print buttons exist | YES | 5 detail views have `window.print()` calls |
| `@media print` CSS rules | **ZERO** | No print-specific CSS anywhere in the codebase |
| Sidebar hidden on print | **NO** | AppShell always renders sidebar |
| TopBar hidden on print | **NO** | AppShell always renders TopAppBar |
| Dedicated invoice layout | **NO** | InvoiceDetailView renders inside the AppShell layout |
| A4 page sizing | **NO** | No `@page` rules |
| Short invoice single page | **NO** | No page-break controls |
| Multi-page support | **NO** | No page-break-inside/after rules |
| Light/Dark → identical print | **NO** | Dark mode will print dark backgrounds with light text |

**Assessment**: Print is completely unimplemented. The 5 `window.print()` buttons will print the entire application shell including navigation, search bar, and theme controls.

---

## 11. Accessibility

### What exists

| Feature | Status | Evidence |
|---------|--------|----------|
| Skip link | YES | `index.css:108-123` — `.skip-link` positioned off-screen, visible on focus |
| Focus-visible ring | YES | `index.css:83-86` — `2px solid var(--md-sys-color-primary)` with 2px offset |
| Reduced motion | YES | `index.css:97-106` — kills animations/transitions |
| Touch targets | Partial | Buttons have `touch-action: manipulation` (index.css:88-95) |
| Semantic ARIA on navigation | YES | `aria-label="Main Navigation"`, `aria-label="Modules"` on all nav |
| ThemeSelector ARIA | YES | `aria-haspopup`, `aria-expanded`, `role="menu"`, `role="menuitem"` |
| Modal keyboard dismiss | YES | Escape key closes drawers, menus, modals |
| Search input ARIA | YES | `aria-label="Search across customers, jobs, invoices"` |

### Accessibility Violations

| # | Severity | Issue |
|---|----------|-------|
| A-1 | **High** | Raw `<table>` elements in 8 files lack `role`, `aria-label`, or `<caption>` elements |
| A-2 | **High** | ReportsView/AuditLogView/SettingsView forms use native `<input>` without `id`/`htmlFor` label associations |
| A-3 | **Medium** | `aria-hidden="true"` is not consistently applied to decorative Lucide icons (some do, some don't) |
| A-4 | **Medium** | Data tables in Detail Views lack `scope="col"` on `<th>` elements |
| A-5 | **Low** | `prefers-reduced-motion` only kills CSS animations — `md-ripple-expand` keyframe uses `animation` property which is correctly killed |

---

## 12. Automated Verification

### Build

```
✓ vite build — built in 7.33s
  dist/index.html         1.61 kB (gzip: 0.87 kB)
  dist/assets/index.css  81.20 kB (gzip: 14.07 kB)
  dist/assets/index.js  1,134.98 kB (gzip: 299.45 kB)
```

Build succeeds cleanly. No TypeScript errors. One chunk size warning (>500KB) indicating code-splitting should be implemented.

### Test Suite

```
✓ 32 test files passed (32)
✓ 121 tests passed (121)
Duration: 12.33s
```

All 121 tests pass. However, test coverage analysis:

| Test | What it actually proves |
|------|------------------------|
| `frontend_smoke_audit.test.tsx` (12 tests) | Every view renders without runtime exceptions and contains expected heading text. **Does NOT verify M3 token usage, color consistency, or responsive behavior.** |
| `serp_032_product_metadata.test.tsx` | Verifies `starqAI` naming is enforced and `StarqAI` is rejected as drift. **Valid.** |
| `serp_035_accessibility_baseline.test.tsx` (3 tests) | Tests contrast ratio math and a validation function. **Does NOT test actual rendered contrast in the UI.** |
| `invoice_arithmetic.test.ts` | Verifies invoice totals. **Business logic only, not UI.** |
| `bookkeeping_spine.test.ts` | Verifies double-entry calculations. **Business logic only.** |
| `serp_025_release_manifest.test.tsx` | Metadata validation. **Not UI.** |
| Other 26 tests | Backend/contract/logic tests — RBAC, security, telemetry, CRM, POS, inventory, etc. **None test UI system consistency.** |

**Gap**: There are **zero tests** that verify:
- M3 token usage in components
- Responsive overflow behavior
- Color system consistency
- Dark mode rendering
- Print layout
- DataTable shared primitive usage
- Typography consistency

---

## Findings Summary

### Critical (4)

| ID | Finding | Evidence | Impact |
|----|---------|----------|--------|
| **C-1** | ReportsView completely bypasses M3 system | 516 lines of raw Tailwind colors, no token usage, 12 hardcoded hex values | Reports page looks like a different application in both light and dark modes |
| **C-2** | AuditLogView completely bypasses M3 system | 370 lines of raw Tailwind `dark:` modifiers | Audit trail is visually disconnected from the rest of the app |
| **C-3** | SettingsView profile tab completely bypasses M3 | 340 lines of raw Tailwind | Settings form uses a pre-M3 visual language |
| **C-4** | 9 raw `<table erp-table>` elements have NO CSS definition | `erp-table` class has zero CSS rules in the codebase | Tables render with browser defaults — no M3 surface, no borders, no row heights, no hover states |

### High (14)

| ID | Finding | Evidence | Impact |
|----|---------|----------|--------|
| **H-1** | All Detail Views use undefined `erp-card`, `erp-btn-*`, `erp-pill`, `erp-muted` classes | 100+ references to classes with no CSS definition | Detail views render without card backgrounds, button styles, pill badges, or muted text colors |
| **H-2** | 25+ component files use raw Tailwind color classes | 100+ instances of `bg-blue-600`, `text-emerald-600`, `bg-amber-50`, etc. | Form modals, job creation, invoice creation all bypass M3 tokens |
| **H-3** | Dark mode only works in ~55% of the UI | Reports, Audit, Settings, all Detail Views lack `var(--md-sys-color-*)` tokens | Switching to dark mode produces a half-light, half-dark application |
| **H-4** | No `@media print` CSS rules | 5 `window.print()` calls with zero print styling | Print captures entire AppShell with sidebar, top bar, navigation |
| **H-5** | Logo persistence is browser-session-only | Stored in React state, no `localStorage` or backend | Logo disappears on page refresh |
| **H-6** | `font-mono` used 128 times for financial values instead of `tabular-nums` on UI font | Detail Views use `font-mono` for all MVR amounts | Financial values switch to a different typeface than the surrounding UI, creating visual inconsistency |
| **H-7** | ReportsView ReCharts hardcoded to light-only hex colors | `#e2e8f0`, `#64748b`, `#ffffff`, `#2563eb`, `#f87171`, `#10b981` | Charts render with wrong colors in dark mode |
| **H-8** | Raw `<table>` elements lack ARIA roles, captions, scope | ReportsView, AuditLogView, Settings tabs | Screen readers cannot properly navigate tabular data |
| **H-9** | Common/Badge shim maps to canonical Badge | `components/common/Badge.tsx` wraps `components/ui/Badge.tsx` with legacy variant names | Acceptable bridge but adds an extra import indirection |
| **H-10** | `SettingsView` header uses `text-slate-900 dark:text-slate-100` | Line 86 | Settings page title does not follow M3 on-surface token |
| **H-11** | ReportsView tab switcher uses hardcoded `bg-slate-100 rounded-xl` | Lines 109-132 | Tab bar ignores M3 segmented button primitive |
| **H-12** | CustomerDetailView header uses `erp-h1 text-2xl` | Line 89 | Undefined class produces no heading style |
| **H-13** | InvoiceDetailView currency uses `font-mono` not `tabular-nums` | Lines 154-155, 166, 174, 228, 232 | Currency values use monospace instead of tabular-nums |
| **H-14** | SettingsView "Save Tenant Profile" button uses `bg-blue-600 hover:bg-blue-700` | Line 334 | Save button bypasses the canonical Button primitive |

### Medium (7)

| ID | Finding | Evidence | Impact |
|----|---------|----------|--------|
| **M-1** | Table.tsx header uses `text-[10px]` while DataTable.tsx uses `text-xs` | `Table.tsx:46` vs `DataTable.tsx:83` | Inconsistent header size between the two table primitives |
| **M-2** | ReportsView trial balance uses `text-blue-700` for totals | Lines 237-241 | Financial totals colored with Tailwind blue instead of M3 primary |
| **M-3** | `Common/Modal.tsx:76` uses `focus-visible:ring-amber-500` | Amber focus ring on close button | Should use `--md-sys-color-primary` focus ring |
| **M-4** | Container query classes (`cq-card`, `cq-panel`) defined but not widely used | Only `Surface` and DataTable leverage them | Container queries are available but underutilized |
| **M-5** | ReportsView print button labeled "Export PDF" | Line 148 | `window.print()` does not export a PDF |
| **M-6** | 33 instances of `font-mono` used for non-technical data | Email addresses, phone numbers, role names | `font-mono` should be reserved for technical IDs/codes |
| **M-7** | Instrument Serif loaded in `index.html` Google Fonts link | Line 14 | Font loaded but never used — wasted bandwidth |

### Low (4)

| ID | Finding | Evidence | Impact |
|----|---------|----------|--------|
| **L-1** | Bundle size 1.13MB (unminified JS) | Build output | Should be code-split |
| **L-2** | Zero UI system consistency tests | Test suite covers business logic only | No automated guard against M3 drift |
| **L-3** | `erp-scroll-region` class used by DataTable and Jobs kanban | Only 2 explicit uses | Should be more widely applied for scroll containment |
| **L-4** | Dashboard chart uses ReCharts which accepts CSS custom properties | `DashboardView.tsx:557-575` — uses `var(--md-sys-color-primary)` | Works but ReCharts has limited CSS var support |

---

## "Did Material 3 Actually Land?"

**Partially. The foundation is real. The adoption is incomplete.**

**What genuinely landed:**
- A correct Material 3 token system generated from the official MCU toolchain
- Both light and dark color schemes with all 30+ semantic roles
- M3 shape, motion, state layer, and elevation tokens
- 18 shared UI primitives that consume M3 tokens
- An M3 Adaptive Window Class responsive engine
- System/Light/Dark theme switching with persistence
- A canonical DataTable with M3 surface styling
- M3 ink ripple and state layer components
- Correct branding (starqERP, starqAI, canonical logo)
- A proper About page with canonical metadata

**What did NOT land:**
- The 6 high-traffic views (Reports, Audit, Settings profile, all Detail Views) are completely outside the M3 system
- 25+ modal/form components bypass M3 tokens with raw Tailwind colors
- The `erp-*` class system referenced 100+ times has no CSS definition — it is a ghost
- Dark mode only visually works in about half the application
- Print is completely unimplemented
- Zero automated tests guard against M3 drift
- Aria/semantic HTML is inconsistent

**The architecture is correct. The migration is ~55% complete by component count and ~70% by user-visible surface time (since Dashboard, Customers, Jobs, Invoices, Payments, Expenses, and Inventory list views are correctly on M3). But the remaining 45% — including all detail-level views and the entire Settings/Reports/Audit area — renders the M3 adoption incomplete rather than consistent.**

---

*End of independent QA audit.*
