# STARQ UI shadcn Standardization Proposal

> **Status:** PROPOSAL FOR COLLECTIVE TECHNICAL REVIEW — NOT AN APPROVED ADR  
> **Authority:** Advisory only; Founder retains final decision authority  
> **Intended reviewers:** Founder, Elder, Antigravity / AG, Vision, Alfred, ChatGPT, Codex  
> **Prepared by:** Codex  
> **Date:** 2026-08-31  
> **Review Baseline:** Proposal v1 — 2026-08-31  
> **Immediate focus:** `starqERP`  
> **Scope boundary:** Documentation only. This proposal authorizes no implementation, dependency, token, component, repository-configuration, publication, or board change.

---

## 1. Executive summary

The active **Starq React web ecosystem** can realistically standardize progressively on shadcn conventions. The entire Starq software ecosystem cannot and should not be described as shadcn-standardizable: Hoadha's Flutter applications, STARQ Nexus Mobile's React Native application, the Python/server-rendered operating portal, legacy copies, and stripped public derivatives require different treatment.

The proposed programme is not a global rewrite and does not propose shadcn as Starq's visual design authority. It proposes:

- shadcn-compatible headless primitives for accessible component mechanics;
- Starq semantic contracts and product adapters for visual and behavioral identity;
- registry semantics as a possible source-distribution mechanism after abstractions have been proven;
- progressive replacement only, while every application remains functional and rollbackable.

For `starqERP`, the authoritative product design contract is currently Material 3. Any shadcn primitive would therefore sit underneath a Starq ERP adapter and preserve Material 3 geometry, state layers, motion, responsive rules, typography, colors, and financial-interface conventions.

The current evidence supports a **hybrid architecture** as the safest likely destination:

```text
shadcn / headless mechanics
        ↓
shared Starq semantic foundation and rules
        ↓
product-owned adapter
        ↓
product-specific composition and identity
```

This recommendation is advisory. Two matters require Founder ruling before an ERP pilot: which ERP design-token specification is authoritative, and whether the active React web policy should continue on Radix or deliberately introduce Base UI. Registry location can safely be deferred.

---

## 2. Evidence inventory

### 2.1 Inspection boundary and reproducibility

The inventory inspected active or plausibly active user-facing frontends under `D:\StarqTech`. `D:\StarqTech` is a Windows junction to `D:\!starq`; these are one physical ecosystem and must not be counted as two workspaces.

The inspection used repository manifests, source imports, CSS/token files, UI component directories, governance documents, Git state, and Nexus board notes. It did not run builds, tests, initializers, package managers, or generators because the expedition was read-only and those operations can write build products, caches, lockfiles, or generated sources.

Classification meanings:

- **ACTIVE:** a current product or operational frontend.
- **PARKED:** preserved but frozen, break-fix-only, or not an active engineering target.
- **LEGACY:** superseded copy or historical implementation that must not become canonical.
- **DERIVED:** generated, mirrored, stripped, or published from a private canonical source.
- **OUT-OF-SCOPE:** personal, experimental, contributor payload, or non-product material.

### 2.2 `starqERP` private canonical web application

| Field | Evidence |
|---|---|
| Path | `D:\StarqTech\starqERP\web` |
| Classification | **ACTIVE — immediate focus** |
| Framework/runtime | React `^19.0.1`, React DOM `^19.0.1`, React Router `^7.18.2` |
| Build system | Vite `^6.2.3`, `@vitejs/plugin-react`, TypeScript `~5.8.2` |
| Tailwind | Tailwind `^4.1.14` with `@tailwindcss/vite` |
| Current headless system | No Radix, Base UI, React Aria, or Headless UI dependency found |
| Reusable UI layer | 18 files in `web/src/components/ui`, exported through `index.ts` |
| Theme/token source | Runtime `web/src/theme.css`; authoritative contract `docs/UI_CONSTITUTION.md`; separate packaged brand kit under `brand/v1.0/.../tokens` |
| Forms | Native React inputs/selects/forms with local/domain state; no React Hook Form or Formik dependency |
| Tables | Custom `Table.tsx`, `DataTable.tsx`, plus extensive direct HTML tables; no TanStack Table dependency |
| Dialog/modal | Custom `components/ui/Modal.tsx`, a second `components/common/Modal.tsx`, custom Drawer, specialized modal components |
| Icons | Lucide React `^0.546.0` |
| Charts | Recharts `^3.10.1` |
| Calendar/date | No shared calendar/date library found |
| Toast | No application-wide toast dependency found |
| Existing `components.json` | None |
| shadcn readiness | **Medium**: compatible React/Vite/Tailwind baseline and semantic variables, but broad custom UI and contract drift |

Primary evidence:

- `web/package.json`
- `web/vite.config.ts`
- `web/tsconfig.json`
- `web/src/theme.css`
- `web/src/index.css`
- `web/src/components/ui/index.ts`
- `web/src/components/ui/*.tsx`
- `web/src/components/common/Modal.tsx`
- `docs/UI_CONSTITUTION.md`
- `brand/v1.0/starqERP_brand_kit/tokens/brand-tokens.css`

Major blockers:

1. The UI Constitution, runtime theme, and brand kit disagree materially.
2. `@/*` resolves to `src` in Vite but `./*` in the `web` TypeScript configuration; shadcn initialization should not proceed while aliases disagree.
3. A large proportion of screens bypass the existing UI layer with raw controls and inline styles.
4. The Material 3 behavioral contract includes ripple, state layers, shape, elevation, motion, adaptive layout and specialized data-table behavior that generic shadcn output does not preserve automatically.
5. Existing accessibility coverage does not yet demonstrate rendered-DOM axe conformance or complete dialog focus behavior.

### 2.3 Hoadha unified web command center

| Field | Evidence |
|---|---|
| Path | `D:\StarqTech\03_PROJECTS\hoadha\web\command-center` |
| Classification | **ACTIVE** |
| Framework/runtime | React `^19.2.0`, TanStack Start/Router/Query |
| Build system | Vite `^8.0.16`, TypeScript `^5.8.3` |
| Tailwind | Tailwind `^4.2.1`, `@tailwindcss/vite`, `tw-animate-css` |
| Current headless system | shadcn-style components on individual `@radix-ui/*` packages |
| Reusable UI layer | 47 files in `src/components/ui` |
| Theme/token source | `src/styles.css`, semantic CSS variables, Hoadhaa Design System v1.2 comments and product aliases |
| Forms | React Hook Form `^7.71.2`, Zod `^3.24.2`, Hook Form resolvers |
| Tables | shadcn-style Table; product compositions remain local |
| Dialog/modal | Radix Dialog, Alert Dialog, Sheet; Vaul Drawer |
| Icons | Lucide React `^0.575.0` |
| Charts | Recharts `^2.15.4` through a local chart adapter |
| Calendar/date | React Day Picker `^9.14.0`, date-fns `^4.1.0` |
| Toast | Sonner `^2.0.7` |
| Existing `components.json` | Yes: `new-york`, CSS variables, Lucide, aliases configured; no custom registries |
| shadcn readiness | **Already adopted on Radix** |

Primary evidence:

- `web/command-center/package.json`
- `web/command-center/components.json`
- `web/command-center/src/styles.css`
- `web/command-center/src/components/ui/*.tsx`

Contradictory evidence that must be retained: Hoadha is not uniformly a React/shadcn product. Its customer, vendor and console applications are Flutter and use a separate shared Dart UI package. The web command center cannot be used to claim the entire Hoadha product is shadcn-based.

### 2.4 Hoadha Flutter applications

| Field | Evidence |
|---|---|
| Paths | `D:\StarqTech\03_PROJECTS\hoadha\apps\customer`, `apps\vendor`, `apps\console` |
| Classification | **ACTIVE** |
| Runtime | Flutter/Dart, not React DOM |
| Build system | Flutter toolchain |
| Type system | Dart |
| Tailwind/headless | Not applicable |
| Reusable UI layer | `apps/shared/hoadha_ui`, including button, input, card, chip, confidence badge, loading/error, map, routing and theme components |
| Theme/token source | `apps/shared/hoadha_ui/lib/src/theme/hoadha_theme.dart` and brand files |
| shadcn readiness | **Not applicable** |

These applications should retain their Flutter-native design system. Shared semantics may be documented across web and Flutter, but source components and runtime packages must not be shared across the framework boundary.

### 2.5 STARQ Nexus web control plane

| Field | Evidence |
|---|---|
| Path | `D:\StarqTech\starqNexus` |
| Classification | **ACTIVE — internal control plane** |
| Framework/runtime | React `^19.0.1`, React DOM `^19.0.1` |
| Build system | Vite `^6.2.3`, TypeScript `~5.8.2` |
| Tailwind | Tailwind `^4.1.14`, `@tailwindcss/vite` |
| Current headless system | None found |
| Reusable UI layer | One `src/components/ui/index.tsx` containing Input, Textarea, Select, FilterSelect, SubmitButton and presentation panels |
| Theme/token source | `src/index.css` and `src/styles/nexus.css`; many component-level hard-coded slate/cyan classes and hex values |
| Forms | Native controls and local state |
| Tables | Direct HTML tables |
| Dialog/modal | Bespoke application implementations; no headless dependency found |
| Icons | Lucide React `^0.546.0` |
| Charts/calendar/toast | No common libraries found in manifest |
| Existing `components.json` | None |
| shadcn readiness | **Medium**, but token normalization is less mature than ERP/Hoadha |

Measured surface: 20 TSX files; 17 files contain raw buttons, 7 raw inputs, 5 raw selects, 3 raw tables, and 9 files contain inline style objects.

### 2.6 Starq public website

| Field | Evidence |
|---|---|
| Path | `D:\StarqTech\projects\starq-web` |
| Classification | **ACTIVE — release-gated/frozen baseline** |
| Framework/runtime | Next `^16.3.2` through Vinext, React `19.2.6` |
| Build system | Vinext/Vite `8.0.13`, TypeScript `5.9.3`, OpenAI Sites/Cloudflare tooling |
| Tailwind | Tailwind `4.2.1` |
| Current headless system | None found |
| Reusable UI layer | Small set of site components: chrome, contact form, network field, product brand, theme toggle |
| Theme/token source | Large bespoke `app/globals.css` house palette and ERP marketing aliases |
| Forms | Hand-written contact form and native controls |
| Tables/dialog/calendar/toast/charts | No common component libraries found |
| Icons | No icon package found in manifest |
| Existing `components.json` | None |
| shadcn readiness | **Medium**, but visual migration would threaten the founder-approved public identity |

Only functional controls should be considered. Public composition, cinematic layout, network graphics, and brand presentation should remain product-owned.

### 2.7 STARQ Nexus Mobile Beta

| Field | Evidence |
|---|---|
| Path | `D:\StarqTech\starqNexusMobileBeta` |
| Classification | **PARKED/FROZEN** |
| Runtime | Expo `~56.0.11`, React Native `0.85.3`, React `19.2.3` |
| Build system | Expo/Metro, TypeScript `~6.0.3` |
| Reusable layer | React Native application components |
| shadcn readiness | **Not applicable to native UI** |

`PLATFORM_FREEZE.md` permits bug, security, and critical UI corrections only and prohibits dependency upgrades, navigation refactors and visual redesigns. It must not enter this programme.

### 2.8 Python operating portal

| Field | Evidence |
|---|---|
| Path | `D:\StarqTech\00_STARQ_HQ\operations\scm` |
| Classification | **PARKED FEATURE-WISE; ACTIVE BREAK-FIX/OPERATIONS** |
| Runtime | Python and server-rendered HTML |
| Build system | Python scripts/application server |
| UI approach | Server-rendered application routes and hand-written HTML/CSS |
| shadcn readiness | **Not applicable without a prohibited rewrite** |

Nexus states that the portal and books engine keep running under break-fix-only status. Server rendering is not itself a defect. This proposal does not recommend rebuilding it in React.

### 2.9 WC2026 Nexus

| Field | Evidence |
|---|---|
| Path | `D:\StarqTech\wc2026-nexus` |
| Classification | **PARKED/STANDALONE** |
| Runtime | React `^19.1.0` |
| Build system | Vite `^6.3.5`, TypeScript `^5.8.3` |
| Tailwind | Not present |
| UI system | Small bespoke React/CSS application, Lucide icons |
| Existing `components.json` | None |
| shadcn readiness | **Low-to-medium**; adding Tailwind would itself be material churn |

No migration should be scheduled while it remains parked.

### 2.10 Derived, legacy and excluded material

| Path | Classification | Treatment |
|---|---|---|
| `D:\StarqTech\starqERP-public` | **DERIVED** | Stripped public derivative; never migrate independently |
| `D:\StarqTech\publication-candidate-starqERP-public-20260831` | **DERIVED/STAGING** | Publication candidate, not canonical UI source |
| `D:\StarqTech\starq-shell` | **LEGACY/COPY** | Older partial Nexus-shaped Vite application; do not standardize |
| `D:\StarqTech\_vercel-sim\starqNexus` | **OUT-OF-SCOPE SIMULATION** | Build/simulation copy, not source authority |
| Hoadha contributor package payloads | **OUT-OF-SCOPE DATA** | Submitted data/package content, not product frontends |
| Antrac/personal projects | **OUT-OF-SCOPE** | Not part of the owned Starq UI programme |

---

## 3. Current UI duplication

### 3.1 Measured `starqERP` surface

Read-only source measurements:

| Measure | Result |
|---|---:|
| TSX files | 157 |
| Test specification files present | 82 |
| Local reusable UI component files | 18 |
| Files with inline style objects | 53 |
| Files containing raw `<button>` | 85 |
| Raw `<button>` occurrences | 219 |
| Files containing raw `<input>` | 45 |
| Raw `<input>` occurrences | 114 |
| Files containing raw `<select>` | 35 |
| Raw `<select>` occurrences | 69 |
| Files containing raw `<table>` | 33 |
| Raw `<table>` occurrences | 41 |
| Raw `<form>` occurrences | 22 |
| Independent general Modal implementations | 2 |

These counts describe source prevalence, not automatically 219 or 114 distinct visual designs. Some raw elements are legitimate implementation details inside canonical wrappers. The risk comes from raw elements distributed throughout domain screens, because behavior and styling can diverge without an enforced adapter boundary.

### 3.2 Cross-product duplication map

| Concept | Current independent forms |
|---|---|
| Button | ERP M3 Button plus raw buttons; Nexus SubmitButton/raw buttons; Hoadha shadcn Button; public-site CSS buttons; Flutter button |
| Input | ERP M3 Input plus raw inputs; Nexus Input; Hoadha shadcn/RHF Input; public-site fields; Flutter input |
| Select | ERP native-wrapper Select plus raw selects; Nexus Select/FilterSelect; Hoadha Radix Select; public-site native select |
| Dialog/Modal | Two general ERP Modals plus specialized overlays; Hoadha Radix Dialog/AlertDialog; Flutter dialogs/sheets |
| Sheet/Drawer | ERP custom Drawer; Hoadha Radix Sheet and Vaul Drawer; Flutter sheets |
| Badge/Status | ERP canonical Badge and compatibility wrapper; Nexus tiles/status labels; Hoadha Badge; public status pills; Flutter confidence badge |
| Table/DataTable | ERP Table, DataTable and direct tables; Hoadha Table; Nexus direct tables |
| Tabs | ERP custom Tabs plus domain-specific button tabs; Hoadha Radix Tabs; bespoke Nexus navigation state |
| Navigation/shell | ERP AppShell; Hoadha site/cockpit shells; Nexus ResponsiveShell; public-site chrome; native Flutter navigation |
| Forms | ERP native/local state; Hoadha React Hook Form/Zod; Nexus native forms; public-site custom contact form; Flutter forms |
| Calendar/date | Hoadha DayPicker/date-fns; no common ERP calendar; Flutter-native date controls |
| Toast | Hoadha Sonner; no common ERP/Nexus/public-site mechanism identified |
| Theme/tokens | ERP M3 runtime, ERP packaged brand kit, Hoadha semantic variables, Nexus hard-coded palette, public-site house palette, Flutter theme |

### 3.3 Duplication versus dangerous fragmentation

Some duplication is correct:

- Flutter and React DOM require different source implementations.
- The public website, ERP and Hoadha should retain different visual compositions.
- Product shells and data-heavy workflows encode product-specific needs.

Fragmentation becomes dangerous when it changes semantics or interaction contracts:

- dialogs with inconsistent focus trapping, Escape behavior or focus restoration;
- destructive confirmation flows with different safeguards;
- status colors whose meaning changes between products;
- form errors that differ in accessible naming or announcement;
- financial tables that lose tabular alignment, containment or print behavior;
- multiple headless libraries shipping equivalent primitives in one application;
- agent-created primitives that bypass established accessibility and token rules.

The programme should target dangerous behavioral fragmentation first and tolerate deliberate product-level visual differences.

---

## 4. Authoritative design-contract conflict

### 4.1 Exact conflict

Three inspected sources disagree:

1. **`docs/UI_CONSTITUTION.md`** declares itself `AUTHORITATIVE SSOT`, specifies Material 3 Expressive, seed `#0B57D0`, generated M3 role values, neutral surfaces, Instrument Sans/Geist identity, M3 state layers, ripple, motion, window classes and component contracts.
2. **`web/src/theme.css`**, the active runtime stylesheet, describes `M3 Quantum Expressive` but uses materially different cyan/cobalt values, including light primary `#0284c7`, dark primary `#38bdf8`, dark cyan glow effects, Plus Jakarta Sans and dark surface values such as `#020617`.
3. **`brand/v1.0/starqERP_brand_kit/tokens/brand-tokens.css`** defines another product palette and typography: dark background `#0A1018`, blue primary `#7FBEF3`, amber accent `#E09036`, Lexend/Manrope/Fira Code, plus a separate light set and chart colors.

This is not merely naming drift. It changes the product's primary color, accent strategy, typography, surfaces, elevation expression, chart palette and potentially contrast behavior.

Shadcn must not accidentally resolve this authority dispute by whichever preset or generated CSS happens to be applied first.

### 4.2 Option A — UI Constitution remains authoritative

| Dimension | Consequence |
|---|---|
| Visual impact | Runtime moves toward `#0B57D0`, the Constitution's neutral surfaces, defined generated roles and documented type treatment |
| Migration impact | Token reconciliation precedes component work; shadcn adapters target Constitution roles |
| Regression risk | High initially because the current runtime visibly differs; broad screenshot change is expected even before component migration |
| Work required | Produce exact token delta; correct runtime; reconcile brand-kit export; re-baseline light/dark/print/screenshots; confirm tenant branding rules |
| Registry effect | Clear authority if resolved; registry theme can encode the Constitution without ambiguity |

This option best respects the existing document's explicit authority label, but it is not visually conservative relative to today's runtime.

### 4.3 Option B — Current runtime cyan/cobalt becomes authoritative

| Dimension | Consequence |
|---|---|
| Visual impact | Current application appearance remains closest to today's observed runtime |
| Migration impact | Lower immediate visual churn; the Constitution and brand kit must be amended rather than runtime replaced |
| Regression risk | Lower for runtime screenshots, but governance risk is significant if a supposedly authoritative contract is silently superseded |
| Work required | Founder approval; rewrite Constitution values and examples; regenerate or deprecate brand-kit tokens; verify contrast and print behavior |
| Registry effect | Registry theme derives from the runtime expression after it is formally ratified |

This is the most visually conservative option but requires an explicit governance correction.

### 4.4 Option C — Deliberately reconciled third specification

| Dimension | Consequence |
|---|---|
| Visual impact | Could preserve current recognizable runtime while restoring selected blue/amber, type or chart rules from the brand kit/Constitution |
| Migration impact | Largest design-decision surface and longest precondition before component migration |
| Regression risk | Highest scope-creep risk because reconciliation can become a redesign programme |
| Work required | Bounded design adjudication, semantic-role matrix, contrast proof, sample screens, formal replacement of all three conflicting sources |
| Registry effect | Potentially strongest long-term foundation, but registry extraction must wait until the new specification is approved and stable |

This option is valid only if deliberately commissioned. It must not emerge opportunistically during shadcn work.

### 4.5 Required gate

No shared Starq theme, registry theme item, preset, or cross-product token package should be created until the Founder rules on A, B or C. A technical pilot may not use shadcn initialization as a substitute for that ruling.

---

## 5. Architectural options

### Option 1 — No ecosystem standardization

| Dimension | Assessment |
|---|---|
| Benefits | Maximum product autonomy; no shared infrastructure or cross-repo governance |
| Risks | Continued primitive proliferation; duplicated accessibility fixes; inconsistent confirmation/form/status semantics |
| Coupling | Lowest cross-product coupling |
| Upgrade burden | Repeated independently in every app |
| Identity flexibility | Maximum |
| Agent maintainability | Weak: agents must rediscover conventions per repository |
| Accessibility | Depends on each team's discipline; ERP custom overlays remain a concern |
| Blast radius | Small per change |
| Rollback | Simple and local |

This is defensible if the ecosystem remains small and product teams value total independence more than shared behavior.

### Option 2 — shadcn primitives independently per React app

| Dimension | Assessment |
|---|---|
| Benefits | Accessible baseline mechanics; local ownership; low central governance cost |
| Risks | Similar components still drift; repeated initialization/configuration; Base/Radix divergence likely |
| Coupling | Low |
| Upgrade burden | Per app |
| Identity flexibility | High |
| Agent maintainability | Better within each repo, mediocre across repos |
| Accessibility | Better starting point, but fixes are repeated |
| Blast radius | Local |
| Rollback | Local source reversion |

This is a safe interim state but does not solve ecosystem-level duplication.

### Option 3 — Shared runtime `@starq/ui` package

| Dimension | Assessment |
|---|---|
| Benefits | One implementation; centralized fixes; conventional versioning |
| Risks | Tight runtime coupling; coordinated releases; product adapters accumulate conditionals; package failure affects many apps |
| Coupling | High |
| Upgrade burden | Central upgrade plus consumer compatibility management |
| Identity flexibility | Medium-to-low unless adapter design is excellent |
| Agent maintainability | Simple discovery, harder cross-repo compatibility |
| Accessibility | Central fixes propagate quickly |
| Blast radius | High |
| Rollback | Requires version rollback and possibly lockfile changes in every consumer |

This is premature for Starq's currently divergent visual and framework landscape.

### Option 4 — Internal Starq shadcn registry

| Dimension | Assessment |
|---|---|
| Benefits | Distributes reviewed source; local adaptation; transparent dependencies; can include hooks, utilities, themes, config and rules |
| Risks | Copied code can diverge; registry ownership/versioning may fail; updates are not automatic |
| Coupling | Medium at installation/update time, low at runtime |
| Upgrade burden | Registry publishes changes; apps choose when to apply/reconcile them |
| Identity flexibility | High |
| Agent maintainability | Strong if namespace, ownership and update policy are clear |
| Accessibility | Reviewed baseline can be propagated; local divergence must be audited |
| Blast radius | Bounded to an explicit consumer update |
| Rollback | Source revert within the consuming repository |

This fits shadcn's source-ownership model but should not be created before a real cross-product abstraction exists.

### Option 5 — Hybrid

Shared semantic definitions, interaction rules and accessibility conventions; registry-distributed source for proven components; optional runtime packages only for stable framework-neutral utilities/contracts; product-owned adapters and compositions.

| Dimension | Assessment |
|---|---|
| Benefits | Balances consistency and product identity; avoids runtime UI coupling; supports React apps without pretending Flutter is React |
| Risks | Requires clear boundaries; can become over-engineered if extraction begins too early |
| Coupling | Low runtime, medium governance |
| Upgrade burden | Central definitions plus explicit per-product adoption |
| Identity flexibility | High |
| Agent maintainability | Strong if examples and ownership are concise |
| Accessibility | Shared rules and reviewed mechanics, product-level verification retained |
| Blast radius | Bounded per adoption |
| Rollback | Local revert plus registry version/reference rollback |

### Codex recommendation — advisory only

Recommend **Option 5, Hybrid**, but begin as local ERP adapters rather than by creating infrastructure. Extract nothing to a registry until at least two real consumers demonstrate the same semantic and behavioral contract.

---

## 6. Radix versus Base UI

### 6.1 Observed state

- Hoadha command center already uses 20-plus individual Radix primitive packages across 47 local shadcn-style component files.
- `starqERP` currently uses neither Radix nor Base UI; its components are native/custom React implementations.
- STARQ Nexus and Starq Web likewise have no observed headless primitive dependency.
- Current shadcn (July 2026 onward) defaults new projects to Base UI. Official guidance keeps Radix fully supported and explicitly says functioning Radix applications do not need to migrate merely because the default changed.
- Current CLI initialization can select `base`, `radix`, or `aria`; this choice must be explicit in automation.

### 6.2 Radix continuity

Benefits:

- aligns new React adoption with Hoadha's established implementation;
- prevents two registry variants at programme start;
- mature, tested accessibility behavior and broad shadcn coverage;
- no Hoadha migration required.

Risks:

- chooses the older shadcn default for a new ERP integration;
- may defer access to Base-only innovations;
- individual Radix packages can expand dependency count unless managed deliberately.

### 6.3 Base UI adoption

Benefits:

- current shadcn default and current primary documentation path;
- active component development and modern APIs;
- sensible choice for a genuinely isolated greenfield application.

Risks:

- introduces a second headless family immediately beside Hoadha Radix;
- forces a dual-base internal registry or prevents shared source;
- creates agent confusion about which implementation to generate;
- newer-default status is not evidence that ERP's custom M3 layer should migrate to it.

### 6.4 Transitional coexistence

ERP's custom/native primitives will necessarily coexist temporarily with whichever headless base is selected. Coexistence is safe when bounded by component and call-site inventories, explicit ownership, dependency checks, and zero removal while callers remain.

Unbounded coexistence is dangerous: agents may freely choose native, custom, Radix or Base for the same concept.

### 6.5 Per-product exceptions

Per-product exceptions are appropriate for:

- existing Radix applications that remain stable;
- future isolated greenfield applications with a documented reason to use Base UI;
- framework boundaries such as Flutter and React Native;
- product-specific primitives unavailable or inappropriate in the chosen base.

### CODEX RECOMMENDATION — NOT YET FOUNDER RULING

Use **Radix continuity for active Starq React web products**, with controlled transitional coexistence during migration and documented exceptions for isolated future products. Do not migrate Hoadha to Base. Do not introduce Base into ERP merely because it is the new default.

---

## 7. Proposed Starq UI layer

```text
┌─────────────────────────────────────────────────────────────┐
│ Product-specific composition                               │
│ ERP financial surfaces | Nexus shell | Hoadha cockpit/site │
└───────────────────────────────▲─────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────┐
│ Product adapter                                             │
│ ERP M3 adapter | Nexus adapter | Hoadha adapter             │
└───────────────────────────────▲─────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────┐
│ Starq semantic foundation                                  │
│ roles | states | accessibility | confirmation | FormField  │
└───────────────────────────────▲─────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────┐
│ shadcn-distributed source and Radix mechanics               │
│ Dialog | Select | Tabs | Tooltip | Popover | AlertDialog    │
└─────────────────────────────────────────────────────────────┘
```

### Potentially shared after proof

- definitions for semantic roles and status meanings;
- accessibility and keyboard rules;
- FormField composition and error-announcement convention;
- destructive/non-destructive confirmation conventions;
- status variants with stable meaning rather than shared colors;
- hooks/utilities shown to behave identically in multiple React applications;
- responsive and reduced-motion rules that are genuinely universal;
- registry metadata, documentation and agent instructions.

### Product-owned

- ERP Material 3 adapter, ripple behavior, adaptive window rules, financial tables and print contracts;
- STARQ Nexus shell, operational-room layouts and control-plane density;
- Hoadha compositions, bilingual/Dhivehi presentation, map and confidence workflows;
- Starq public website compositions, cinematic graphics and house identity;
- Flutter source components and native interaction behavior.

The proposed layer is intentionally not a giant component library. Shared status semantics do not require identical badges. Shared confirmation rules do not require identical layout. Product identity remains local.

---

## 8. Registry location options

### Dedicated private Starq UI/registry repository

Advantages: neutral ownership, clear version history, independent access control, direct private GitHub registry support. Disadvantages: infrastructure and governance must exist before value is proven; creates another repository and release responsibility.

### Incubate inside `starqERP`

Advantages: immediate focus and easiest place to evolve adapters beside real callers. Disadvantages: risks encoding ERP-specific M3 decisions as ecosystem-neutral; another product may become a secondary consumer of an ERP-owned contract.

### Incubate inside Hoadha command center

Advantages: already shadcn/Radix, large component inventory, existing `components.json`. Disadvantages: Hoadha's product needs, palette, routing and bilingual behavior are not neutral; extraction could incorrectly make an existing product implementation the ecosystem authority.

### Defer registry creation until two consumers prove an abstraction

Advantages: cheapest, lowest-risk evidence path; avoids premature naming, hosting, versioning and ownership. Disadvantages: the first two pilots duplicate some work and must carefully record what is common.

### Safest evolutionary path

1. Build ERP adapters locally after Founder rulings.
2. Record candidate shared semantics, without moving them.
3. Compare each candidate against Hoadha's working Radix implementation and, where relevant, Nexus needs.
4. Extract only when two consumers require the same semantics and behavior.
5. Decide repository location based on the proven consumer/owner set.

**Recommendation: do not create a registry until two consumers prove an abstraction.** Repository location is not required before the ERP pilot.

---

## 9. Migration safety model

| Stage | Entry condition | Exact allowed scope | Validation | Rollback | Exit gate |
|---|---|---|---|---|---|
| 1. Visual-authority ruling | Proposal reviewed | Documentation ruling only | Founder decision recorded; supersession targets named | Withdraw ruling before code begins | One authoritative ERP visual/token source identified |
| 2. Token reconciliation | Stage 1 complete; baseline captured | Semantic aliases and explicitly approved token corrections only | Token diff, contrast checks, light/dark/print screenshots | Revert token-only commit | No unresolved role or source-authority conflict |
| 3. Import alias correction | Green baseline | Align Vite and TS `@/*` resolution only | TypeScript, build, existing tests, import-resolution probe | Revert isolated config commit | Both tools resolve identical paths |
| 4. Controlled shadcn initialization | Stages 1–3 complete; Radix/Base ruling recorded | `components.json`, required utility and minimum dependencies; no components or preset restyle beyond approved plan | Exact diff review, lockfile diff, build/test, dependency audit | Revert initialization commit and lockfile | Zero visual change; explicit base and paths confirmed |
| 5. Adapter layer | Initialization accepted | Product-owned wrappers preserving current public props and M3 contract | Contract tests, screenshots, keyboard tests | Revert adapter-only commit | Adapter usable without caller migration |
| 6. Settings → About pilot | Regression baseline complete | About surface and named low-risk components only | Section 10 acceptance tests | Revert pilot commit; old surface remains recoverable | Independent review finds no visual/behavioral regression |
| 7. Read-only Dialog pilot | About pilot accepted | One read-only dialog and its tests | Focus entry/trap/restore, Escape, backdrop policy, screenshots | Restore old dialog caller/implementation | Accessibility improves without product regression |
| 8. Low-risk controls/status | Dialog accepted; caller inventory current | Badge, tooltip, simple controls, status surfaces | Per-component tests/screenshots and caller census | Revert one component/caller batch | Each migrated batch green; no parallel accidental primitive |
| 9. Forms | Stable FormField/error convention | One bounded non-financial form at a time, then progressively riskier forms | Validation, error announcement, dirty state, submit/disable, keyboard | Restore previous form component/callers | Functional parity independently reviewed |
| 10. Shell/navigation | Route baseline proven | AppShell/navigation only | Route manifest, deep links, responsive widths, keyboard, auth/permission gates | Revert shell commit | No route, focus, permission or viewport regression |
| 11. Data-heavy/financial tables | Earlier stages stable; financial fixtures approved | One table/report surface at a time | Values/totals, sorting/filtering if applicable, overflow, print, RTL, screenshots | Restore old table with fixture comparison | Exact data and interaction parity |
| 12. Legacy retirement | Zero callers proven | Delete one obsolete primitive at a time | Repository-wide reference scan, tests/build, bundle/dependency check | Restore deleted file/exports | Zero callers and no generated/public boundary break |

Global rules:

- No old primitive is removed while callers remain.
- Each stage is separately reviewable and revertible.
- No stage combines token authority, dependency initialization and caller migration.
- A failed gate stops progression; it does not authorize expanding scope to repair unrelated defects.

---

## 10. Pilot proposal

### 10.1 Pilot 1 — `starqERP` Settings → About

#### Purpose

Prove that shadcn/Radix mechanics can sit beneath Starq-owned adapters without changing the product's approved Material 3 appearance or behavior.

#### Why lower risk

- No ledger posting, settlement, tenant provisioning or money mutation.
- No primary navigation replacement.
- Small, directly screenshotable surface.
- Existing About tests cover canonical product metadata.
- Failure is locally rollbackable.

#### Proposed components

- Starq ERP adapter around Card/Surface behavior;
- Badge/status adapter;
- Separator where structurally appropriate;
- Button adapter only for actions already present on the surface;
- no Dialog, form library, data table or shell change in this pilot.

#### Must remain visually identical

- current Material 3 colors and role meanings after the Founder token ruling;
- typography, spacing, shape, elevation and information hierarchy;
- light/dark behavior;
- product naming and canonical version/build information;
- touch targets, focus treatment and responsive containment.

#### Expected behavioral improvement

- consistent prop/variant contract under one adapter boundary;
- normalized focus and disabled-state mechanics;
- a reproducible component installation/update path;
- evidence that shadcn mechanics do not require adopting a shadcn visual preset.

#### Acceptance tests

1. Existing product-metadata/About tests remain green.
2. Before/after screenshots match at approved viewports in light and dark modes, apart from explicitly accepted pixel differences.
3. Keyboard traversal order and visible focus remain correct.
4. Accessible names, roles and states are present in rendered DOM.
5. Reduced-motion behavior remains valid.
6. TypeScript, production build and complete existing frontend suite pass.
7. Bundle delta and dependency delta are reported.
8. Independent reviewer confirms no unapproved token or global CSS change.

#### Rollback condition

Rollback immediately if the pilot requires global restyling, changes information hierarchy, breaks tests/route behavior, creates unexplained bundle growth, or cannot retain the approved M3 contract through a clean adapter.

#### What it does not prove

- Dialog accessibility or overlay behavior;
- form validation and submission parity;
- shell/navigation compatibility;
- table and financial-report compatibility;
- that an internal registry is justified;
- that Base and Radix are interchangeable;
- that Flutter or React Native can consume the same source.

### 10.2 Pilot 2 — one read-only Dialog

After independent acceptance of Pilot 1, migrate one read-only dialog—proposed candidate: Account Detail—behind a Starq ERP Dialog adapter.

Required proof:

- focus enters at the defined element;
- Tab/Shift+Tab remain trapped while open;
- Escape closes only when policy permits;
- focus returns to the opener;
- backdrop click behavior matches current product policy;
- title and description IDs are instance-safe;
- scroll locking works and is restored;
- nested controls remain usable at all viewport sizes;
- no financial data changes and no action semantics are added.

This pilot should not simultaneously consolidate every Modal caller. It proves the adapter with one caller first.

---

## 11. Regression baseline

The following must be captured and committed or stored as approved evidence **before the first migration commit**.

### Route manifest

- Record all 20 addressable ERP route entries observed in `web/src/app/router.tsx`, plus wildcard redirect behavior.
- Record authenticated versus unauthenticated expectations.
- Record deep-link behavior for entity-detail routes.
- Add an automated manifest/route smoke assertion so shell changes cannot silently remove a route.

### Viewport matrix

Capture at minimum:

| Width | Purpose |
|---:|---|
| 360 | Compact phone |
| 600 | M3 compact/medium boundary |
| 768 | Tablet portrait |
| 840 | M3 medium/expanded boundary |
| 1200 | Large desktop |
| 1600 | Extra-large/high-density desktop |

Use stable heights and fixtures, and include at least one constrained-height dialog/table case.

### Required baseline evidence

- light and dark screenshots for pilot and shared shell;
- representative print baselines for invoice and financial statement output;
- keyboard traversal records for shell, pilot and overlays;
- dialog focus entry, focus trap, Escape and restoration tests;
- form required/error/invalid/submission behavior, including accessible error announcement;
- table overflow, tabular number alignment, headers and print containment;
- all existing frontend tests with exact pass/fail counts and raw logs;
- rendered-DOM accessibility scan using axe-core or equivalent, not only abstract metadata validation;
- production bundle files/sizes and a defined acceptable delta;
- direct and transitive dependency graph;
- automated detection/reporting of simultaneous equivalent headless families, especially Radix and Base UI;
- browser console error capture;
- reduced-motion and light/dark persistence checks.

The existing SERP-035 test demonstrates an accessibility policy model. It is useful, but it is not evidence that every rendered component or dialog passes a DOM accessibility engine.

---

## 12. Publication boundary

`starqERP-public` is a stripped derivative under the private/public §10 boundary.

Rules:

1. Never migrate the public repository independently.
2. Never treat the public repository as canonical UI source.
3. Only approved private UI changes may flow through the existing stripped-public publication process.
4. Publication must continue to prove that private code, operator surfaces, internal conventions, secrets and reconstructive implementation detail are not exposed.

Shadcn introduces new publication considerations:

- generated/local component files may be more self-contained and therefore more reconstructive than previous call sites;
- registry URLs, namespaces, authentication configuration and internal package names can reveal private architecture;
- `components.json`, registry metadata, lockfile dependencies and generated source require explicit §10 classification;
- copied source may carry comments, examples or imports that reference private paths;
- registry credentials must never enter repository configuration, logs, generated files or public builds;
- publication tooling must distinguish redistributable upstream/open-source component code from proprietary Starq adapters and operator-only compositions;
- public dependency additions must be license and provenance reviewed.

Every pilot requires a publication-boundary diff review before any private-to-public synchronization. This proposal does not amend §10 or authorize publication.

---

## 13. Governance for agents

Proposed minimum rule:

> Before creating a reusable UI primitive, check the local Starq UI layer and internal registry. Extend the canonical primitive unless a documented product-specific exception applies.

After implementation is approved and usable replacements exist, place the rule in:

1. repository-level agent instructions for immediate discoverability;
2. the approved UI architecture/ADR document for durable rationale and exceptions;
3. CI initially as a reporting-only census of new raw controls, duplicate primitive names, direct headless imports outside adapters, and Radix/Base duplication.

Do not make CI enforcement blocking until the relevant canonical replacement exists, has migration guidance, and is usable without breaking product contracts. Governance must not force agents into an incomplete abstraction.

Suggested exception record fields: product, primitive, reason, owner, date, review trigger, and whether the exception is temporary or permanent.

---

## 14. Risk register

| Risk | Likelihood | Impact | Mitigation | Stop condition |
|---|---|---|---|---|
| Design-token drift | High | High | Founder authority ruling; one canonical token matrix; token-only review stage | More than one source still claims authority |
| Visual regression | High | High | Pre-migration screenshots; adapter contract; pixel review at defined viewports | Unexplained product-wide visual change |
| Accessibility regression | Medium | High | DOM axe scan; keyboard/focus tests; independent review | New serious/critical violation or lost keyboard behavior |
| Radix/Base duplication | Medium | Medium-high | Explicit base ruling; dependency detector; direct-import boundary | Both bases provide the same primitive without approved exception |
| Tailwind/shadcn version drift | Medium | Medium | Pin reviewed versions; record CLI output; controlled update cadence | Generated output changes outside reviewed scope |
| Agent primitive proliferation | High | Medium-high | Minimal rule, discoverable adapters, reporting census | New parallel shared primitive lacks exception record |
| Runtime-package coupling | Medium | High | Prefer copied source/registry and local adapters; package only stable utilities | UI package update requires coordinated multi-product release |
| Registry governance failure | Medium | High | Defer registry; name owner/version/support policy before launch | No accountable owner or update/rollback policy |
| Public derivative leakage | Medium | Critical | §10 diff/provenance scan; private registry metadata classification | Private/reconstructive content appears in publication candidate |
| Bundle growth | Medium | Medium | Pre/post bundle and dependency graph; tree-shaking verification | Delta exceeds approved threshold without demonstrated value |
| Form behavioral regression | Medium-high | High | One-form slices; validation/dirty/submit/error fixtures | Any accepted input, error, or submission behavior changes unexpectedly |
| Data-table regression | High | Critical | Tables last; deterministic fixtures; totals/overflow/print comparison | Financial value, total, column meaning or print output changes |
| Dark/light inconsistency | High | Medium-high | Paired screenshots and contrast scans; semantic variables only | Component works in only one theme or role meaning changes |
| Premature abstraction | High | High | Two-consumer proof before extraction; local incubation | Proposed shared component has only one real consumer or product-specific conditionals |
| Alias/configuration mismatch | High now | Medium | Separate alias correction stage; resolution test | Vite and TypeScript resolve `@` differently |
| M3 behavior loss | Medium-high | High | ERP adapter contract for ripple/state/motion/shape/adaptive behavior | Generic generated component visibly replaces required M3 behavior |
| Rollback complexity | Medium | High | One concern per commit; preserve old primitive until zero callers | Migration requires deleting old primitive before acceptance |

---

## 15. Alternatives and dissent

### Strongest reason not to standardize

The active products are fewer and more visually different than the phrase “ecosystem standardization” suggests. Hoadha web already works on shadcn/Radix, ERP has a detailed Material 3 system, Nexus is an internal control plane, and the public site is bespoke. Central governance could cost more than duplicated primitives while creating false uniformity.

### Strongest reason not to start with ERP

ERP is the widest and highest-risk React surface: 157 TSX files, many raw controls, financial tables, print output, security-sensitive administrative flows, and unresolved token authority. Hoadha already has a functioning shadcn implementation and could provide cheaper registry evidence.

Counterpoint: the proposed About pilot is deliberately non-financial, bounded and aligned with the current product focus. It should still stop if the baseline or token ruling is not ready.

### Strongest reason to choose Base UI instead of Radix

Base UI is the current shadcn default, current primary documentation path and actively evolving base. ERP has no incumbent headless library, so selecting Base now could avoid beginning a new migration on the older default and give ERP the cleanest long-term shadcn path.

Counterpoint: doing so creates two headless families immediately because Hoadha is already extensively Radix-based.

### Strongest reason to avoid a shared registry

Copied source can create the appearance of standardization while each consumer quietly diverges. Maintaining, documenting and versioning a registry adds another control plane; a small team may be better served by concise conventions and deliberate local components.

### Evidence that could change the recommendation

- A full caller/behavior audit showing ERP's existing primitives are already consistent and accessible would weaken the case for shadcn migration.
- Evidence that Base UI materially outperforms Radix for required ERP interaction/accessibility cases could justify a dual-base or Base policy.
- Evidence that Hoadha and ERP share no component contract beyond generic names would argue against a registry.
- Two successful consumers of an identical adapter contract would strengthen the registry case.
- Measured bundle or performance harm from Radix would change the base recommendation.
- Founder selection of a third visual specification could delay all UI standardization until design authority stabilizes.
- A product roadmap that parks ERP UI work would make Hoadha or Nexus a more appropriate pilot—or justify no pilot.

---

## 16. Board impact — proposal only

No SERP rows are created or authorized by this proposal.

### Proposed programme task 1 — ERP UI foundation/token reconciliation

| Field | Proposal |
|---|---|
| Purpose | Establish one visual/token authority, capture regression baseline and correct import alias disagreement |
| Dependencies | Founder design-contract ruling; current ERP baseline available |
| Acceptance criteria | One authoritative token source; semantic mapping; light/dark/print/route/a11y/bundle baseline; Vite/TS alias agreement; no component migration |
| Rollback | Revert isolated documentation/token/config commits independently; baseline evidence remains |
| Suggested phase/priority | Foundation/pre-migration; P0 only if UI standardization is approved as current work, otherwise P1/next cycle |
| Founder ruling first? | **Yes** for token authority; implementation priority also requires Founder approval |

### Proposed programme task 2 — bounded shadcn/Radix pilot

| Field | Proposal |
|---|---|
| Purpose | Prove shadcn mechanics beneath ERP M3 adapters on Settings → About, then separately one read-only Dialog |
| Dependencies | Task 1 complete; Radix/Base ruling; regression gates established |
| Acceptance criteria | Visual parity, DOM accessibility, keyboard behavior, existing tests/build, bundle/dependency report, independent acceptance, clean rollback |
| Rollback | Revert pilot callers/adapters and initialization as isolated changes; old surface remains available until acceptance |
| Suggested phase/priority | First implementation experiment; bounded P1 unless Founder elevates it |
| Founder ruling first? | **Yes** for base policy and permission to implement |

### Proposed programme task 3 — Starq registry proof

| Field | Proposal |
|---|---|
| Purpose | Determine whether at least two consumers share a real semantic/behavioral abstraction and, only then, prove registry distribution |
| Dependencies | Accepted ERP pilot plus comparison or adoption by a second React consumer |
| Acceptance criteria | Two consumers; named owner; version/update/rollback policy; private/public boundary review; no product-identity leakage |
| Rollback | Keep components local; delete/retire experimental registry without consumer runtime impact |
| Suggested phase/priority | Later evidence stage; P2/deferred |
| Founder ruling first? | Not now. Founder ruling required only before registry creation/publication or new repository creation |

Do not create product-wide migration backlogs until the pilot and second-consumer evidence exist.

---

## 17. Founder decision register

### Required before any implementation

| Decision | Options | Codex recommendation | Consequence | Required now? |
|---|---|---|---|---|
| ERP visual/token authority | A: Constitution; B: current runtime; C: approved reconciliation | Prefer explicit A or B over open-ended C; governance evidence currently favors A, visual conservatism favors B | Determines all token mapping and screenshot expectations | **Yes** |
| React headless-base policy for ERP pilot | Radix continuity; Base adoption; approved exception | Radix continuity with transitional coexistence | Determines dependencies, generated source and future registry compatibility | **Yes** |
| Authorize bounded pilot work | Approve, defer, reject | Approve only after baseline/task 1 | Determines whether any initialization or migration may begin | **Yes, before implementation** |

### Safely deferred until evidence exists

| Decision | Options | Codex recommendation | Consequence | Required now? |
|---|---|---|---|---|
| Registry creation | Create now; create after pilot; wait for two consumers | Wait for two consumers | Avoids premature abstraction and governance infrastructure | **No** |
| Registry location | Dedicated private repo; ERP incubation; Hoadha incubation | Decide after consumers/owner are proven | Determines ownership and distribution operations | **No** |
| Runtime utility package | None; framework-neutral package; shared UI package | Package only stable framework-neutral utilities if evidence supports it | Changes runtime coupling | **No** |
| Product rollout order after ERP | Nexus; Hoadha refinement; public-site controls; none | Reassess after ERP pilot | Avoids speculative backlog | **No** |
| Base UI exception policy for future greenfield apps | Never; approval-only; default | Approval-only | Preserves flexibility without current dual-base churn | **No** |

---

## 18. Proposed review order

Advisory review sequence:

1. **Codex proposal:** validate evidence, measurements, scope and explicit uncertainty.
2. **ChatGPT analysis:** challenge strategic coherence, hidden assumptions and decision framing.
3. **Vision independent contradiction/recon check:** reproduce inventory and look specifically for omitted frontends, token authority conflicts and incorrect classifications.
4. **AG implementation-feasibility review:** test whether the staged gates, alias correction, adapter model, dependency choice and rollback are technically executable.
5. **Alfred review where useful:** examine operational cost, maintainability, documentation usability and rollout discipline.
6. **Elder architectural/governance review when available:** assess system boundaries, public/private publication, authority, long-term coupling and board shape.
7. **Founder ruling:** decide authority and timing; no other review constitutes approval.

Reviewers should record agreement, dissent, missing evidence and requested changes separately. A majority opinion does not replace Founder authority.

---

## 19. Final recommendation

### CODEX RECOMMENDATION — NOT APPROVED

1. Standardize only the active **React web** ecosystem; explicitly exclude Flutter, React Native, Python/server-rendered, legacy and derived surfaces.
2. Use shadcn primarily for component mechanics and potential source distribution, not as Starq's visual design system.
3. Require Founder ruling on the ERP Constitution/runtime/brand-kit conflict before shared theme or token work.
4. Continue Radix for active React web products unless the Founder deliberately approves a Base UI exception.
5. Correct Vite/TypeScript alias disagreement in a separate pre-migration change.
6. Preserve ERP Material 3 behavior through product-owned adapters.
7. Run the bounded Settings → About pilot first; independently review it before expanding.
8. Follow with one read-only Dialog pilot to prove focus and overlay behavior.
9. Defer financial tables, shell/navigation and form-heavy workflows until lower-risk stages pass.
10. Do not create a registry until two consumers prove the same abstraction; never migrate `starqERP-public` independently.

> No shadcn migration, initialization, dependency change, token change, component replacement, registry creation, or board mutation is authorized by this document. Implementation begins only after Founder ruling.

---

## Appendix A — official shadcn capability references reviewed

- Existing Vite project installation: <https://ui.shadcn.com/docs/installation/vite>
- CLI `init`, `apply`, `build`, `docs`, `info` and migrations: <https://ui.shadcn.com/docs/cli>
- Base UI as current default while Radix remains supported: <https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default>
- Base UI and Radix documentation model: <https://ui.shadcn.com/docs/changelog/2026-01-base-ui>
- Monorepo support: <https://ui.shadcn.com/docs/monorepo>
- Registry introduction: <https://ui.shadcn.com/docs/registry>
- Registry namespaces and authenticated private sources: <https://ui.shadcn.com/docs/registry/namespace>
- Registry authentication: <https://ui.shadcn.com/docs/registry/authentication>
- Registry schema and distributed resource types: <https://ui.shadcn.com/docs/registry/registry-json>
- Private GitHub registry support noted in August 2026 changelog: <https://ui.shadcn.com/docs/changelog>

## Appendix B — evidence limitations

- Measurements are point-in-time source inspection from 2026-08-31.
- No build/test result in this proposal is claimed current-green because no build or test was executed during the read-only expedition.
- Repository/board classifications can change; implementation must re-check current Git, Nexus and product authority before action.
- Source counts can include elements inside wrappers and tests were counted as files, not executed assertions.
- The proposal does not resolve the design-contract conflict; it exposes it for Founder ruling.
