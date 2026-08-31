# STARQ UI — Canonical Frontend Stack & Quality Doctrine V1

**Date:** 31 August 2026  
**Status:** POST-PILOT STACK DECLARATION — FOUNDER REVIEW / EXECUTION BASELINE  
**Product:** `starqERP` private canonical web application  
**Scope:** Frontend/UI architecture only. Backend, ledger, tenancy, auth and financial-domain architecture remain unchanged.

---

## 1. Stack identity

The starqERP frontend is **not becoming a shadcn application**.

The adopted direction is:

> **Starq UI / Material 3 Expressive visual system + product-local React primitives + accessibility-first interaction contracts + shadcn-quality composition discipline, without a mandatory shadcn/headless runtime dependency.**

shadcn is a **quality benchmark and source-pattern reference**, not the product's visual authority or required runtime.

The purpose of the UI programme is to achieve the qualities associated with a polished shadcn application — consistency, crisp interaction states, accessible overlays, predictable focus, clean spacing, restrained motion and compositional discipline — while preserving starqERP's Starq-owned Material 3 identity.

---

# 2. Canonical frontend technology stack

| Layer | Canonical choice | Current detail |
|---|---|---|
| Runtime | React | `^19.0.1` |
| DOM | React DOM | `^19.0.1` |
| Routing | React Router | `^7.18.2` |
| Build | Vite | `^6.2.3` |
| React build plugin | `@vitejs/plugin-react` | Existing Vite React integration |
| Language | TypeScript | `~5.8.2` |
| Styling | Tailwind CSS | `^4.1.14` |
| Tailwind integration | `@tailwindcss/vite` | Existing |
| Theme authority | `web/src/theme.css` | Current execution/visual baseline |
| Shared UI layer | `web/src/components/ui/*` | Starq-owned Material 3 primitives |
| Feature-local UI | Feature-local component directories | Preferred for bounded feature-specific behavior/composition |
| Icons | Lucide React | `^0.546.0` |
| Charts | Recharts | `^3.10.1` |
| Forms | Native React controls/local/domain state | No React Hook Form/Formik dependency |
| Tables | Starq custom `Table.tsx`, `DataTable.tsx` + direct HTML tables | No TanStack Table dependency |
| Package manager | npm | Existing `package-lock.json`; no second lockfile family |
| Import alias | `@/*` → `src/*` | Vite and TypeScript aligned by Gate A |
| Headless UI runtime | **None required** | No Radix / Base UI / React Aria / Headless UI |
| shadcn CLI | **Not part of canonical runtime** | No `components.json`; no init/add |
| Component registry | **None** | Deferred until 2 real consumers prove reuse |
| Shared runtime UI package | **None** | No `@starq/ui` |
| Public derivative | `starqERP-public` | Derived only; never independently migrated |

---

# 3. Design and component architecture

## 3.1 Visual language

**Starq UI / Google Material 3 Expressive**

The existing Starq Material 3 layer remains the product-owned visual and behavioral base.

Current shared primitives include the existing `web/src/components/ui/*` family such as:

- Button
- Input
- Surface
- Badge
- Modal
- Drawer
- Tabs
- Switch
- SegmentedButton
- Table / DataTable
- FilterChip
- related local primitives

Generic shadcn styling must not replace Starq's M3 shape, motion, state-layer, typography, elevation or product identity.

## 3.2 Composition rule

Use the smallest appropriate ownership level:

```text
shared Starq M3 primitive
        ↓
feature-local composition / behavior
        ↓
screen
```

Do not create another abstraction layer merely for architecture naming.

A component belongs in the shared `components/ui` layer only when multiple real callers need the same primitive contract.

Feature-specific components stay feature-local.

## 3.3 Headless behavior rule

A headless library is **not required by default**.

First preference:

1. use the existing Starq UI primitive;
2. compose locally;
3. implement a small local behavioral contract when it remains maintainable;
4. only evaluate a headless primitive if native/local implementation becomes materially complex or brittle.

If a headless primitive becomes justified, Radix vs Base UI is decided against that concrete requirement — not as an ecosystem ideology.

---

# 4. Accessibility interaction contract

Pilot 2 establishes the minimum dialog-quality contract for new/updated behavioral overlays:

- semantic `role="dialog"`;
- `aria-modal="true"`;
- labelled dialog title;
- deterministic initial focus;
- Tab/Shift+Tab focus containment;
- Escape-to-close;
- keyboard-operable close control;
- focus restoration to the exact invoking control;
- safe backdrop interaction;
- no new browser-console errors.

This interaction standard should be treated as a **quality contract**, regardless of whether an implementation is native, local, Radix-backed or Base-UI-backed in the future.

---

# 5. Current post-pilot proof

## Gate A

Commit:

`da6ff3cf7fca4fc6fd1d6aa74f4d2b40b90cc330`

Result:

- TypeScript/Vite import alias aligned;
- lint PASS;
- tests PASS;
- build PASS;
- no UI source touched.

## Pilot 1 / Gate B

Commit:

`e424da8180752596f491a1c9162733c1a58923cb`

Result:

- Settings → About local composition cleaned up;
- local `AboutPrimitives.tsx`;
- zero diff under shared `components/ui/*`;
- no dependency change;
- no visual drift.

## Pilot 2

Commit:

`ffef3c578a8d8ec7bf06ba79b9be10f6dad363ad`

Result:

- pilot-local About legal dialog;
- real Settings → About application route exercised under controlled authenticated-state interception;
- focus trap PASS;
- focus restoration PASS;
- Escape PASS;
- keyboard close PASS;
- backdrop close PASS;
- lint PASS;
- 82 test files PASS / 295 tests PASS / 1 skipped;
- build PASS;
- CSS output hash unchanged;
- zero diff under shared `components/ui/*`;
- zero diff to `common/Modal.tsx`;
- no new dependencies;
- no package/lockfile churn;
- public repository untouched.

---

# 6. What “shadcn-quality” means for starqERP

For this product, shadcn-quality does **not** mean installing shadcn everywhere.

It means the application should consistently demonstrate:

## Interaction

- fast, predictable feedback;
- polished hover/pressed/focus/disabled states;
- keyboard-complete controls;
- reliable focus management;
- accessible overlays;
- restrained, purposeful motion;
- reduced-motion respect.

## Visual rhythm

- consistent spacing;
- consistent radius/elevation;
- coherent information density;
- strong hierarchy;
- no raw-control visual drift;
- clean empty/loading/error states;
- no accidental one-off styling.

## Navigation

- unmistakable current location;
- smooth but restrained state transitions;
- reliable narrow-window behavior;
- no layout jump or focus loss.

## Data-heavy UI

- readable density;
- clear selection/hover/focus;
- tabular numeric alignment where relevant;
- predictable overflow and responsive containment;
- preserved financial semantics.

## Feedback

- consistent success/error/warning/info treatment;
- actionable errors;
- visible loading/progress states;
- no silent failure.

---

# 7. Current non-goals

The following are **not** part of the canonical stack today:

- mandatory shadcn CLI usage;
- Radix as a global Starq policy;
- Base UI as a global Starq policy;
- `components.json`;
- internal component registry;
- runtime `@starq/ui`;
- redesigning starqERP into the default shadcn visual style;
- replacing all custom Material 3 primitives;
- independently migrating `starqERP-public`;
- introducing a new form/table framework without evidence.

---

# 8. About-page stack declaration

The current About screen should no longer imply that “Google Material 3” alone describes the frontend architecture.

Recommended product-facing wording:

### Design System
**Starq UI — Material 3 Expressive**

### Frontend Stack
**React 19 · TypeScript 5.8 · Vite 6 · Tailwind CSS 4**

### UI Architecture
**Starq-owned M3 primitives · product-local composition · accessibility-first interaction contracts**

### Headless / Component Runtime
**Native / local by default — no mandatory Radix, Base UI or shadcn runtime dependency**

### Interaction Quality Standard
**Keyboard-complete · focus-managed · reduced-motion aware · shadcn-quality polish**

A compact About display may show the short values above, while “Copy System Information” can expose the full detail.

---

# 9. Permanent visual-authority recommendation

The pilots proved that the currently shipped runtime can be preserved while architecture and accessibility improve.

Recommended Founder ruling for the next expansion wave:

> **Ratify the currently shipped starqERP runtime appearance as the canonical execution baseline. Reconcile the UI Constitution and packaged brand-kit documentation to the approved runtime through a separate governance/documentation task. Do not redesign the product as part of that reconciliation.**

This is a **runtime-first reconciliation** approach:

- current product appearance is frozen as the visual reference;
- documentation catches up to reality;
- future polish improves consistency and behavior without reopening the brand;
- deliberate visual redesign remains a separate Founder decision.

---

# 10. Next engineering wave — “Polish, not conversion”

The next wave should not ask:

> “What else can we convert to shadcn?”

It should ask:

> **“What still prevents starqERP from feeling as smooth, coherent and interaction-polished as a top-tier shadcn application?”**

The next recon should rank gaps by:

**user-visible value × recurrence × accessibility impact × blast radius × rollback confidence**

Highest-value candidate families:

1. dialogs / overlays / drawers / dropdowns;
2. focus and keyboard inconsistencies;
3. loading / empty / error / success states;
4. raw button/input/select drift;
5. navigation state and transition polish;
6. form validation and field-feedback consistency;
7. table hover/selection/focus/overflow behavior;
8. motion and reduced-motion;
9. 200% zoom / narrow-window behavior;
10. duplicated local UI patterns that have proven reuse.

Financial semantics, posting behavior, tenant logic and business rules remain out of scope for a UI polish wave.

---

# 11. Freeze criteria

The UI polish programme may be frozen when:

- lint/tests/build are green;
- no unresolved console errors exist on target routes;
- light/dark behavior is coherent;
- keyboard/focus contracts pass on behavioral primitives;
- reduced-motion is respected where motion exists;
- 200% zoom and narrow-window checks pass on major shells;
- shared component changes have caller-census evidence;
- dependency graph remains intentional;
- public-derivative boundary remains intact;
- final screenshot evidence is captured;
- an independent reviewer accepts the wave;
- Founder approves the freeze.

---

**Canonical short name:** **Starq UI Stack V1**  
**Design identity:** **Starq UI / Material 3 Expressive**  
**Quality target:** **shadcn-quality interaction and compositional polish**  
**Mandatory shadcn dependency:** **No**
