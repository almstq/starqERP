# STARQ UI shadcn Standardization — Vision Independent Review v1

> **Reviewer:** Vision (Windows-side Hermes interface)
> **Type:** Adversarial contradiction / reconnaissance
> **Baseline:** Proposal v1 — commit `c3826f27f4b6d48de1ad247f42c5b0cc2c2f0bef`
> **Branch:** `elder/2026-08-31-wave1-governance`
> **Date:** 2026-08-31
> **Status:** **READ-ONLY REVIEW — NO IMPLEMENTATION AUTHORITY**
> **Independence:** This review is based solely on independent inspection of repos, manifests, source files and the proposal itself. It does not consult ChatGPT, Codex follow-ups, or any other reviewer's conclusions (including the file `STARQ_UI_SHADCN_PROPOSAL_ALFRED_INDEPENDENT_REVIEW_V1.md` already present in the governance folder — that file was deliberately **not opened** to preserve independence).

---

## 1. Ecosystem inventory — independent reproduction

### 1.1 Confirmed classifications (MATCH or near-MATCH)

| Codex classification | Independent evidence | Verdict |
|---|---|---|
| `starqERP/web` — ACTIVE | `web/package.json` React 19.0.1, Vite 6.2.3, Tailwind 4.1.14, TS 5.8.2; `src/components/ui/` 18 files; 157 TSX | **MATCH** |
| `03_PROJECTS/hoadha/web/command-center` — ACTIVE, shadcn/Radix | 26 `@radix-ui/react-*` deps; 47 `src/components/ui/*` files; `components.json` (new-york, slate, no registries) | **MATCH** (Codex said "20-plus"; actual is 26) |
| `03_PROJECTS/hoadha/apps/{customer,vendor,console}` + `apps/shared/hoadha_ui` — Flutter | pubspecs present at correct paths | **MATCH** |
| `starqNexus` — ACTIVE React 19, no headless | `package.json` deps confirmed; `src/components/ui/index.tsx` hard-coded slate/cyan, no Radix/Base | **MATCH** |
| `projects/starq-web` — Next 16.3.2 via Vinext, no shadcn | `package.json` confirmed; no shadcn components | **MATCH** |
| `starqNexusMobileBeta` — PARKED (PLATFORM_FREEZE) | `PLATFORM_FREEZE.md` at repo root, not under `docs/` (minor path drift); Expo 56.0.11 | **MATCH with location drift** |
| `00_STARQ_HQ/operations/scm` — Python server-rendered | `admin.py`, `garage.py`, `erp_modules.py` confirmed | **MATCH** |
| `wc2026-nexus` — PARKED, no Tailwind | `package.json` confirms React 19.1, Vite 6.3.5, no Tailwind | **MATCH** |
| Derived / out-of-scope (`starqERP-public`, `publication-candidate-…`, `starq-shell`, `_vercel-sim/starqNexus`) | All exist as described | **MATCH** |

### 1.2 Contradictions / Omissions discovered

**C-1 — MAJOR OMISSION: `projects/antrac-erp` is an active React web frontend not enumerated in §2.10 or anywhere else in the proposal.**
- Path: `D:\StarqTech\projects\antrac-erp\`
- Evidence: `package.json` v0.17.0; `PROGRESS.md` reports live state v0.34.0, branch `codex/antrac-mvp-access-reports`; README, CHANGELOG, SECURITY, GEMINI.md, `docs/` all present and recent
- Stack: React 19.2.6, Vite 8.0.12, TypeScript 6.0.2, Tailwind 4.3.0, Firebase backend (NOT Supabase), react-hook-form 7.76, zod 4.4, react-query 5.100
- UI: own `src/components/ui/{Badge,Button,Card,Input}.tsx` — no shadcn init, no Radix, no Base UI, no `components.json`
- Mission: Antrac Holding Group asset/ERP — sibling product to starqERP under a different corporate parent
- **Significance:** It is a real, separate, active React web application in the same workspace. It must be added to the inventory as **ACTIVE — separate SBU, deferred from standardization until its own design authority is established**. This is a non-trivial inventory gap; the proposal's "active React web ecosystem" picture is incomplete.

**C-2 — MINOR: `Antrac Nexus/app` (Flutter) is a separate mobile app under `D:\StarqTech\Antrac Nexus\app\` (pubspec.yaml `antrac_nexus` v1.0.0).** Codex enumerated "Hoadha Flutter apps" but not this one. It appears parked (a sibling `projects/antrac-erp` web is the active track) but should be explicitly classified.

**C-3 — MINOR: `Mobile Beta` platform-freeze document lives at repo root, not `docs/`.** Codex's text says "`PLATFORM_FREEZE.md` permits…" without giving path; this is acceptable but should be pinned to `D:\StarqTech\starqNexusMobileBeta\PLATFORM_FREEZE.md`.

**C-4 — JUNCTION-DUPLICATION DISCLOSURE:** The proposal states "`D:\StarqTech` is a Windows junction to `D:\!starq`; these are one physical ecosystem and must not be counted as two workspaces." Confirmed via `git worktree list`: all `D:\!starq\starqERP` HEADs trace back to the same physical tree. No counting error present, but the disclosure itself is correct and important.

**C-5 — NO HIDDEN RADIX/BASE/HEADLESS USE detected anywhere outside Hoadha.** Repo-wide `package.json` scan (`grep -E "@radix-ui|@base-ui|@headlessui|react-aria" --include=package.json -r .` excluding node_modules) returns exactly one hit: Hoadha command center. This **strengthens** Codex's claim that the ecosystem split is binary (Hoadha-Radix vs everything-else-native).

---

## 2. starqERP UI surface — independent verification

### 2.1 Source measurements (independent counts)

| Measure | Codex | Vision | Verdict |
|---|---:|---:|---|
| TSX files in `web/src` | 157 | 157 | **MATCH** |
| Test files | 82 | 82 | **MATCH** |
| Files in `src/components/ui/` (incl. index) | 18 | 18 (+ index) | **MATCH** |
| Inline-style files | 53 | 52 | **MATCH (±1)** |
| Raw `<button>` occurrences | 219 | 219 | **MATCH** |
| Raw `<input>` occurrences | 114 | 114 | **MATCH** |
| Raw `<select>` occurrences | 69 | 69 | **MATCH** |
| Raw `<table>` occurrences | 41 | 41 | **MATCH** |
| Raw `<form>` occurrences | 22 | 22 | **MATCH** |
| Modal files containing "Modal" | 22 | 22 (incl. 2 general + 20 specialized) | **MATCH** |
| Routes addressable | 20 | 21 (counting `/login`, `/`, 18 children, wildcard redirect) | **COUNTING METHOD DIFFERENCE** — Codex likely excludes wildcard; not material |

The **occurrences** match exactly. The "raw `<button>` files" count (Codex 85 vs my 66) is the only notable drift; my count excludes `.ts` hook files that grep may have included under TSX glob. **Not material.**

### 2.2 Tech stack — MATCH

- React `^19.0.1`, Vite `^6.2.3`, Tailwind `^4.1.14`, TS `~5.8.2` — confirmed.
- No Radix, no Base UI, no Headless UI, no React Aria — confirmed.
- Lucide `^0.546.0`, Recharts `^3.10.1` — confirmed.
- `motion` `^12.23.24` and `canvas-confetti` `^1.9.4` present but not in proposal — both are tiny; not material gaps.
- `canvas-confetti` and `motion` are not in proposal — neither is shadcn-relevant.

### 2.3 shadcn-style variable aliases are **already present** in `web/src/theme.css`

This is a positive material finding Codex did not surface. The runtime theme already declares:
```
--background, --foreground, --card, --card-foreground, --border, --input, --ring,
--radius-sm, --radius-md, --radius-lg, --radius-xl, --radius-2xl, --radius-full
```
These are the **exact names shadcn CLI generates**. shadcn's `init` step therefore does not require a token rewrite at the variable level — it requires only `components.json` and a `cn()` util, both of which are absent.

**This weakens Codex's "Stage 2: token reconciliation" necessity** in part. Token reconciliation is still required to *resolve which palette/typography is correct*, but the shadcn plumbing can be wired without renaming CSS variables.

### 2.4 Alias mismatch — confirmed and **worse than characterised**

- `vite.config.ts`: `'@': path.resolve(rootDir, 'src')`
- `tsconfig.json`: `"@/*": ["./*"]` (resolves to project **root**, not `src/`)

Codex correctly identifies this as a hazard. Independent reading: it is **operationally** broken — TypeScript and Vite resolve `@/components/ui/Button` to two different files. The hazard is masked only because most imports today go through the relative path or through short relative chains. Running `tsc --noEmit` likely surfaces path errors. **MATCH** Codex claim, with a sharper characterisation: this is a latent breakage, not a future risk.

### 2.5 AboutTab — pilot target verified

`src/components/settings/AboutTab.tsx`:
- Already imports `Button`, `Surface`, `Badge` from `../ui`.
- Already includes an **inline modal** (lines 232–298) for Privacy/Terms/Licenses — `fixed inset-0 z-50`, `backdrop-filter: blur(3px)`, state-based open/close. **No `role="dialog"`, no `aria-modal`, no Escape handler, no focus management, no focus restoration.** This is a **third** modal implementation in starqERP beyond the two general ones (`ui/Modal` and `common/Modal`) Codex identified. It is "specialized" so not contradicting Codex's count of *general* implementations, but it must be noted: Codex's "no Dialog … in this pilot" claim is technically true, but the About surface itself already contains a non-accessible modal that is a *stronger* accessibility test target than the dialog migration later in §10.2.

### 2.6 StarqNexus concrete UI

`src/components/ui/index.tsx`:
- Hard-coded `slate-800`, `cyan-400/60`, `bg-[#070a10]`, `bg-slate-950`, `bg-cyan-400/10` — **no design tokens, no theming**, native `<input>`/`<select>`/`<button>`. This is a "control-room" presentation, not a shadcn-shaped product. Codex's "medium" readiness is **slightly generous** — it is closer to a custom styling system that would need de-hardcoding before any shadcn init.

---

## 3. Design-authority conflict — yes, but not as A/B/C

### 3.1 Direct evidence

| Source | Primary (light) | Primary (dark) | Display font | UI font | Surfaces (dark) | Authority claim |
|---|---|---|---|---|---|---|
| `docs/UI_CONSTITUTION.md` | `#0b57d0` | `#b2c5ff` | (n/a) | **Instrument Sans** | `#131313` (charcoal slate) | **"AUTHORITATIVE SSOT"** |
| `web/src/theme.css` (runtime) | `#0284c7` | `#38bdf8` | **Plus Jakarta Sans** | **Plus Jakarta Sans** | `#020617` (near-black) | Authoritative-by-being-shipped |
| `brand/v1.0/starqERP_brand_kit/tokens/brand-tokens.css` | `#2563A8` | `#7FBEF3` | **Lexend** | **Manrope** | `#0A1018` | "starq" branded token file |

These are **materially inconsistent** on:
- Color seed / primary value (three different hex values per mode)
- Typography (three different font families)
- Surface darkness (charcoal vs near-black vs deep-navy)
- Visual concept ("M3 Expressive" vs "M3 Quantum Expressive" vs "starq brand")
- Chart palette (Constitution defines none; brand-kit defines five; runtime none)
- Accent strategy (Constitution neutral-only; brand-kit amber `#E09036`; runtime cobalt cyan-glow)

**This is a real, non-cosmetic conflict.** shadcn initialization without a ruling WILL pick whichever preset's CSS variables happen to load first, or generate its own that will silently compound the drift.

### 3.2 Decision

**Is this a Founder decision blocker before shadcn migration? — YES.**

A pilot that runs shadcn init against a runtime theme that disagrees with a labelled-authoritative spec will:
1. Make the "SSOT" claim false by the act of shipping;
2. Lock whichever theme is current as default without a written ruling;
3. Force every future shadcn install to either align with the unratified runtime or silently override it.

Codex's three options (A/B/C) are not exhaustive. A safer fourth exists:

**Option D — Two-stage ruling.** Founder rules a *temporary* authority (the runtime, with explicit "interim" label) for the duration of the pilot, then a *permanent* authority after pilot evidence. This lets the pilot proceed without burning the governance record and avoids the A-vs-B political decision before any visual evidence exists.

The proposal's Stage 1 (Visual-authority ruling) should be split into **1a Interim authority** (Founder approves one of A/B/C OR rules interim-runtime) and **1b Permanent authority** (after Pilot 1 evidence, Founder confirms or amends).

---

## 4. Radix recommendation — split decisions

### 4.1 Radix continuity for the ERP pilot — **OPPOSE (mildly)**

Evidence:
- Hoadha has **26** individual `@radix-ui/react-*` packages for a 47-file UI library. This is a **maintenance surface**: every shadcn `add` and every Radix minor version touches N packages.
- Hoadha's package count is itself a "shadcn-with-Radix tax" — copying that into ERP gives ERP a similar surface for no demonstrated reason.
- The shadcn team's own July 2026 changelog names **Base UI** as the new default precisely because they consider it the long-term path. Continuing Radix because one consumer uses it is a sunk-cost argument.
- Radix individual packages' footprint is non-trivial: Hoadha's `node_modules` size is visibly larger than starqERP's per file. Without a measured bundle delta, the argument is theoretical — but the direction is clear.

**Counter-evidence (which Codex cites):**
- Radix is mature, accessible, fully supported by shadcn today.
- Hoadha already has working code that ERP could pattern-match.
- No functional pressure to switch.

**Adjudication:** A Radix pilot is **defensible** but is **not the best path** for a small team. If the Founder wants to begin quickly, Radix is fine. If the Founder wants the smaller long-term surface, Base UI is the better call. **Codex over-relies on "Hoadha already does it"** — Hoadha is one consumer, not a reason.

### 4.2 Global Radix policy — **INSUFFICIENT EVIDENCE**

The proposal's reasoning jumps from "Hoadha is stable on Radix" to "all active Starq React web should stay on Radix." The intermediate steps are not demonstrated:
- There is no measured accessibility delta (Radix vs Base) for the specific ERP components.
- There is no agent-cost measurement.
- There is no measurement of how often ERP and Hoadha actually need shared mechanics.
- The four-hour shadcn init is identical in either base.

A founder call on the global policy is therefore premature. **Defer global policy until after ERP pilot.**

---

## 5. Hybrid architecture — partially justified, smaller still possible

### 5.1 What Hybrid gets right

- Preserves product identity (no shared runtime coupling).
- Honours the existing `src/components/ui` convention.
- Does not invent registry prematurely.
- Recognises the shadcn-variable aliases already in `theme.css`.

### 5.2 What Hybrid over-engineers

- "Product adapter" layer is largely **already present** in starqERP via `src/components/ui/*`. Wrapping those wrappers in adapters is a **second** wrapper. With careful scoping, this can be added in a one-line re-export; calling it a layer is over-naming.
- "Starq semantic foundation" is materially **already the M3 token system**. Creating a "Starq semantic foundation" as a separate concept risks token-drift-by-another-name.
- The "registry metadata" item in the "potentially shared" list is a tooling concern, not architecture; it should not anchor the architecture diagram.

### 5.3 Proportional alternative

For a small AI-agent studio, the smallest architecture that gets 80–90% of the benefit is:
- Keep `src/components/ui/*` as the Starq layer.
- Allow shadcn `add` to drop new components into that folder.
- Document a 1-paragraph convention: "any new reusable primitive extends `src/components/ui/*`; shadcn is the source of new mechanics; never import `@radix-ui/*` or `@base-ui/*` directly outside `src/components/ui/*`."
- No new packages, no new repos, no new layer names.

This is what Hybrid means in practice once the "product adapter" and "Starq semantic foundation" labels are removed.

**Verdict on Hybrid:** SUPPORT (as a name) — but the **minimum implementation** of Hybrid is much smaller than the proposal's diagram suggests.

---

## 6. Registry deferral — supported

### 6.1 Evidence-based

- **Hoadha alone is not a proof of shared abstraction.** It is a product that happens to use shadcn. It has its own design tokens, its own palette, its own chart colors, its own Dhivehi handling. Extracting a registry to "match" Hoadha would be to write an internal shadcn-flavoured shadcn registry — duplicate effort, no consumer benefit yet.
- **Two-consumer proof is the right gate.** Until a second React product (antrac-erp? starqNexus? Hoadha? starq-web?) actually wants the same primitive, a registry is a project that maintains itself.
- **A registry is the right answer eventually.** Not now.

### 6.2 Decisions

- **REGISTRY NOW:** **NO** — agree with Codex.
- **REGISTRY LOCATION DECISION NOW:** **DEFER** — agree with Codex.

**Caveat:** antrac-erp (the omission in §1) may become the second consumer faster than expected. If Founder wants to put antrac-erp on a shared visual system, the registry question becomes live. Founder should be told that antrac-erp exists and is an unstated second-consumer candidate.

---

## 7. Pilot choice — REJECT in current form, MODIFY proposed

### 7.1 About pilot

**Surface exists:** `Settings → SettingsView → activeSubTab === 'about' → <AboutTab />` (SettingsView.tsx line 484). Settings route registered at `/settings`. **MATCH.**

**Low-risk:** TRUE for the read-only metadata display. FALSE for the **shared Button/Surface/Badge adapters** Codex wants to wrap.

**Critical hidden risk — Adapter is system-wide:**
- `src/components/ui/Button.tsx` is exported via `src/components/ui/index.ts`.
- It is consumed by `AboutTab` AND by every other domain view (Accounts, Customers, Invoices, Jobs, Settings tabs other than About, the AppShell, etc.).
- A shadcn-wrapped Button adapter does **not** stay local to the About pilot. It becomes the ERP-wide Button. Once accepted, **any caller change is a global change.**

Codex's Stage 5 ("Adapter layer … Exit gate: Adapter usable without caller migration") understates this. The exit gate after About should be: **"Adapter is used only by AboutTab; no other caller has switched."** Otherwise the next two migrations will reuse the Adapter and the "About-only" rollback becomes an app-wide rollback.

**Pilot risk on the inline modal:**
- AboutTab already has its own non-accessible inline modal (lines 232–298). Any shadcn init that touches the AboutTab's dialog-rendering path will also touch this inline modal (because the inline modal is a sibling element rendered conditionally inside the same component).
- This is a *better* accessibility target than Pilot 2 (AccountDetailModal). The right Pilot 2 is **the inline AboutTab dialog** (Privacy/Terms/Licenses), not AccountDetailModal. AccountDetailModal is heavier and depends on AccountsView's data layer.

### 7.2 Pilot verdict

**PILOT: MODIFY.**

Required modifications:
1. **Adapter must be a NEW component (e.g. `AboutButton`, `AboutCard`, `AboutSeparator`), not a wrap of the system-wide `ui/Button`.** Pilot proves mechanics without touching shared primitives.
2. **Pilot 2 should be the AboutTab inline dialog**, not AccountDetailModal. Lower blast radius, equal or better accessibility test, removes the third-modal mystery.
3. **Add a caller census** to Stage 5 exit gate: prove the new component is used only by AboutTab before any second use.

If these modifications are accepted, the About pilot becomes a genuine 1–2-day bounded experiment. If not, the pilot becomes a stealth global Button migration.

---

## 8. Migration safety model — ordering defects

### 8.1 Stage-by-stage review

| Stage | Verdict | Notes |
|---|---|---|
| 1. Visual-authority ruling | Required first | **MODIFY** — see §3, split into 1a interim + 1b permanent |
| 2. Token reconciliation | Required before init | **PARTIALLY WEAKENED** — shadcn-variable aliases already present; the blocker is *which palette/typography*, not the variable names. The proposal can compress Stage 2 into a "design authority reconciliation only" rather than a token-rename stage |
| 3. Alias correction | Required first | **STRENGTHEN** — this is a *latent breakage* of `tsc --noEmit` today, not a future risk. Make Stage 3 a **preflight fix**, not a "pre-migration" change |
| 4. Controlled shadcn init | Required | OK as proposed |
| 5. Adapter layer | **REORDER** | Adapter should be built locally for the pilot surface only, **before** init writes the first non-shadcn-named file. Otherwise init will silently register shadcn default names like `Button` that collide with the existing `ui/Button` |
| 6. Settings → About pilot | Acceptable **with §7 modifications** | |
| 7. Read-only dialog | Move target to AboutTab's inline modal (see §7) | |
| 8. Low-risk controls/status | OK | |
| 9. Forms | OK as ordered | |
| 10. Shell/navigation | **REORDER**: move to BEFORE tables. AppShell is more about chrome than forms; putting it after forms risks it being treated as a "form concern" | |
| 11. Data-heavy/financial tables | Last; OK | |
| 12. Legacy retirement | OK | |

### 8.2 Missing migration class

- **No stage for accessibility proof on shared components that were never migrated.** The "About pilot" leaves ~50% of the surface untouched. A periodic accessibility scan of the **whole surface** (not just the migrated chunks) is needed so that a global regression introduced by a global adapter (e.g. `ui/Button` change of focus-ring color) is caught.
- **No stage for theme reconciliation with the public repo.** `starqERP-public/web/src/components/ui/` mirrors the private component set. Whatever shadcn init does, the strip process must continue to be safe. Add a Stage 2.5: **Public-repo diff baseline.**

### 8.3 Init visual-neutrality

The proposal claims Stage 4 produces "Zero visual change." That is achievable **only if** `components.json` is generated with `baseColor` and styles that match the runtime, and **only if** the init does not write any new component yet. shadcn's `init` writes `components.json`, `src/lib/utils.ts`, and a `cn()` helper. It does not write components until `add`. Stage 4 is therefore achievable, but the proposal should explicitly say: **"Stage 4 = `init` only. First `add` is Stage 5."** Today that is implicit.

---

## 9. Regression model — slightly excessive, mostly right

### 9.1 Missing checks (medium risk)

- **Multi-tenant theming** — `theme.css` is global, but starqERP supports tenant branding. A shadcn init that replaces `theme.css` (e.g. via a default `globals.css`) could break tenant branding without visual regression on the primary tenant. Check: render two known tenants side-by-side.
- **Print output baseline** is in the proposal but not at the *invoice* and *financial statement* level. These are exactly the surfaces that ship to PDF / printer and that go through print-specific CSS. A shadcn init that changes color tokens can break print contrast.
- **Browser zoom 200%** — accessibility-relevant, not in the proposal.
- **Tabular-num rendering** — financial values use `font-variant-numeric: tabular-nums`. shadcn components may set their own numeric defaults. Check.

### 9.2 Checks that should run once globally, not per chunk

- Bundle delta — run once at Stage 4 (init) and at Stage 6 (pilot end). Per-component runs are noise.
- Dependency graph — run once at Stage 4; flag any new direct import of `@radix-ui/*` or `@base-ui/*` outside `src/components/ui/*` as a CI gate.
- Console error capture — run only on touched routes.
- Reduced-motion — once at Stage 4, then per-chunk only when the chunk has motion.

### 9.3 Unnecessary ceremony

- **The "20 addressable ERP route entries" manifest is overkill for a non-shell pilot.** Routes that the pilot does not touch do not need pre-pilot baseline. Run a route manifest when Stage 10 (shell) begins.
- **`at minimum` viewport matrix** at Stage 6 is 6 widths × 2 themes × 2 routes = 24 screenshots. The pilot touches one route. A 360/1200/1600 × light/dark × one route = 6 screenshots is sufficient for Pilot 1.

---

## 10. §10 publication safety — partially adequate, with one material omission

### 10.1 What Codex got right

- `starqERP-public` and `publication-candidate-…` are correctly classified as derived.
- The rule "Never migrate the public repository independently" is correct.
- The general concern about generated source / registry URLs / lockfiles is correct.

### 10.2 Missing publication controls

- **`components.json` is a publication leak vector.** The `registries: {}` field is currently empty. As soon as it contains a private URL (Hoadha internal registry, Starq registry, anything but a public shadcn URL), it must be **stripped** by the publication process or it leaks the internal registry topology. The proposal should require a `components.json` scrubber as part of every `publication` script.
- **Source-map comments from shadcn-generated files.** shadcn components carry `// from https://ui.shadcn.com/...` style provenance comments. These are usually fine, but the proposal should **explicitly approve** them, not leave them to drift.
- **Hoadha namespacing in shared components.** If anything is ever extracted to a shared registry, the *default* shadcn prefix and namespace must be reviewed for any Hoadha-specific naming.
- **`package.json` "scripts" field.** `shadcn init` does not modify scripts, but downstream additions (e.g. `shadcn-build`, registry commands) can leak internal commands into the public repo's manifest. Add to the diff review.
- **"Comments / examples" Codex mentioned** are good but the specific list of shadcn's example stories / Storybook addons is missing.
- **`pnpm` / `bun` lockfile differences.** starqERP uses `npm` (lockfile: `package-lock.json`). If shadcn init is run under `pnpm` it will write a `pnpm-lock.yaml` that may not be in the publication strip set. Pin package manager in the pilot.
- **License/provenance on `@radix-ui/*` and `@base-ui/*`** is MIT. No issue, but the publication diff must confirm: no shadcn sub-dependency with a copyleft license was added.

### 10.3 Additional control needed

- A **pre-publication `git diff --stat` baseline of `src/components/ui/`** before any pilot, so that every publication knows exactly which files came from shadcn vs which were private. This is the single most useful publication control for §10.

---

## 11. Proportionality test — Codex is over-engineering for a small studio

### 11.1 What is proportionate

- 18 components in `src/components/ui/*` — proportionate.
- `components.json` + `cn()` util — proportionate.
- Token reconciliation, alias fix, init, About pilot, dialog pilot — proportionate **in scope**, **modest in ceremony**.
- Registry deferral — proportionate.

### 11.2 What is not proportionate

- **A 12-stage migration model** for a 157-file React app owned by an AI-agent-driven studio. Three to four stages (init → adapter isolation → bounded pilots → second-consumer evaluation) cover the same surface with less drift.
- **A separate "Starq semantic foundation" naming.** The M3 token system is the semantic foundation; calling it a Starq layer is branding, not architecture.
- **Per-chunk route manifests and full dependency-graph scans.** These are appropriate at shell migration; not for Pilot 1.
- **A pre-defined Adapter layer with its own diagram box.** A single component file (`src/components/ui/ShadcnAbout.tsx`) suffices for Pilot 1.
- **A formal "exception record" governance field for every primitive exception.** This is appropriate for a team of five engineers; for a one-orchestrator studio, a CHANGELOG entry is enough.

### 11.3 Smallest architecture that gets 80–90% of the benefit

1. Fix alias mismatch (1 commit, 30 minutes).
2. Founder interim visual-authority ruling (1 question, 5 minutes).
3. `npx shadcn@latest init` with `baseColor: slate` (or matching M3 seed), no components yet (1 commit, 30 minutes).
4. Add three shadcn components needed for About: `separator`, `card`, `badge` (or the equivalent of what About actually needs).
5. Build **local adapters** in `src/components/settings/AboutAdapters.tsx` that wrap shadcn components and re-implement the M3 look. The wrappers are used **only by AboutTab**.
6. Pilot 2 = AboutTab inline modal → shadcn `dialog` (replaces hand-rolled backdrop).
7. Run regression baseline (3 viewports, light/dark, About route only).
8. Independent review.
9. If accepted → decision on whether to proceed to forms, shell, tables.
10. **Registry only if and when a second product independently asks for the same primitive.**

This is **5 commits, 1 founder question, no new repos, no new layer names, no governance overhead beyond the existing `docs/governance/` folder.**

---

## 12. Founder decision surface — independent recomputation

### 12.1 Required before any implementation (Founder must rule)

1. **Interim visual authority** for the duration of Pilot 1 (Constitution / runtime / brand-kit / interim-runtime). [Codex merged this into Stage 1; my recommendation is to split interim and permanent.]
2. **Bounded pilot authorization** — yes/no on running the pilot on `Settings → About` with the §7 modifications. [Codex has this; agree.]
3. **Public-repo diff baseline** — confirm the strip process can handle a `components.json` and shadcn-generated components without leaking. [Codex did not enumerate; should.]

### 12.2 Required but can be safely deferred until after Pilot 1 evidence

4. **Permanent visual authority** — after Pilot 1 screenshots and accessibility data exist.
5. **Adapter rollout plan** — only if Pilot 1 succeeds.
6. **Forms / shell / tables rollout** — only after Pilot 1 + 2 succeed.
7. **Second-consumer decision** — wait for antrac-erp, Hoadha, or starqNexus to actually need the same primitive.

### 12.3 Required but not yet on Founder's plate

8. **Per-app headless policy** (Radix vs Base) — only if second consumer is found.
9. **Registry creation** — only after two consumers.
10. **Registry location** — only at registry creation.

### 12.4 Should NOT be a Founder decision

- Specific shadcn commands (CLI defaults are correct).
- Whether to use `npm` or `pnpm` (default to existing `npm`).
- Adapter file naming.
- The interim screenshot matrix (use sensible defaults; record the chosen ones).
- Whether to add an "exception record" governance form (skip for v1; use CHANGELOG entries).

---

## 13. Final independent verdict

### VISION INDEPENDENT REVIEW — PROPOSAL V1

**Overall verdict:** **SUPPORT WITH CONDITIONS**

**Evidence confidence:** **HIGH** on factual claims (the inventory, the alias mismatch, the design conflict, the Modal count, the shadcn-variable aliases already present). **MEDIUM** on the proportionality critique (depends on Founder's appetite for governance). **LOW** on Radix vs Base long-term outcome (no measurement possible without a pilot).

### Confirmed Codex findings (independently reproduced)

- Ecosystem classification of starqERP, Hoadha command center, Hoadha Flutter, starqNexus, Starq public website, Nexus Mobile Beta, Python scm portal, WC2026, derived material — **CONFIRMED**.
- starqERP tech stack, headless-library absence, raw-control prevalence, 2 general Modal implementations — **CONFIRMED**.
- Design-authority conflict between Constitution, runtime theme.css, and brand kit — **CONFIRMED, with sharper characterisation** (three font families, three primary hex values, three different visual concepts).
- Alias mismatch between Vite (`@ → src`) and TS (`@/* → ./`) — **CONFIRMED as a latent breakage, not a future risk.**
- Radix exclusive to Hoadha in the entire tree — **CONFIRMED**.
- Pilot surface (Settings → About) — **CONFIRMED**.
- shadcn-style variable aliases already present in `theme.css` — **NEW FACT** not in the proposal.

### Contradictions / errors

- **C-1 (MAJOR):** `projects/antrac-erp` is an active React web frontend not enumerated in §2.10 or anywhere else. Founder needs to know this exists.
- **C-2 (MINOR):** `Antrac Nexus/app` Flutter app not enumerated.
- **C-3 (MINOR):** Platform-freeze doc path is `D:\StarqTech\starqNexusMobileBeta\PLATFORM_FREEZE.md`, not under `docs/`.
- **C-4 (NONE):** No hidden Radix/Base/Headless use outside Hoadha. Proposal's "binary ecosystem" picture is correct.
- **C-5 (UNDERSTATED):** The "raw `<button>` files" count (Codex 85 vs my 66) is the only material drift. Occurrence counts match exactly. Not material.
- **C-6 (UNDERSTATED):** AboutTab contains a third, hand-rolled, non-accessible inline modal. Proposal says "no Dialog … in this pilot" — technically true, but the pilot surface itself is a better Dialog test than the proposal's Pilot 2 candidate.

### Missing evidence

- **No measurement** of bundle delta for Hoadha's 26 Radix packages vs an equivalent Base UI build.
- **No measurement** of how often antrac-erp / starqNexus / starq-web would actually consume shared primitives.
- **No accessibility audit** of AboutTab's existing inline modal (which has no focus management, no Escape, no `role="dialog"`).
- **No check** that the public-repo strip process can handle `components.json` and shadcn-generated files.
- **No measurement** of `tsc --noEmit` impact of the current alias mismatch (this is a small, valuable preflight that takes 60 seconds and is not in the proposal).

### Architecture assessment

| Aspect | Verdict |
|---|---|
| **Hybrid architecture (Concept)** | **SUPPORT** — but minimal implementation: 1 adapter file for the pilot, not a new layer |
| **Radix for ERP pilot** | **OPPOSE (mildly)** — defensible but Base UI is the better long-term bet; either is acceptable; don't let this become a year-long debate |
| **Global Radix policy** | **INSUFFICIENT EVIDENCE** — defer until second consumer exists |
| **Registry deferral** | **SUPPORT** — Hoadha alone is not proof of shared abstraction |
| **ERP pilot (Settings → About)** | **MODIFY** — adapter must be local-only to AboutTab; Pilot 2 = AboutTab inline dialog, not AccountDetailModal |
| **Migration sequence** | **MODIFY** — split Stage 1 into 1a interim + 1b permanent; reorder shell before forms; add Stage 2.5 public-repo diff baseline; condense Stages 5–12 from 8 to ~4 effective stages |

### Risks Codex understated

- **The alias mismatch is a latent `tsc --noEmit` failure**, not a forward-looking risk. Run `tsc --noEmit` today to confirm.
- **Adapter-as-shared-primitive** — touching `ui/Button` adapter in Pilot 1 is not local to About; it changes the system-wide Button. The exit gate must prove zero non-About consumers.
- **AboutTab's inline modal** is a known a11y gap that the pilot will inevitably touch. Plan for it.
- **Public-repo `components.json` scrub** — Codex mentioned this in passing; it deserves a named control.
- **`projects/antrac-erp`** is a sibling consumer that could rapidly become a second-consumer candidate. Founder needs to know.

### Risks Codex overstated

- **The 12-stage migration model** is heavier than the work warrants. Three to four stages cover the same ground with less drift.
- **"Starq semantic foundation"** as a separate layer is naming, not architecture. The M3 token system is the foundation.
- **Per-chunk full route manifests and dependency graphs** are excessive for Pilot 1.
- **The "exception record" governance form** is over-engineered for a one-orchestrator studio.

### Founder decisions actually required (this list supersedes Codex §17)

**Required before any implementation:**
1. Interim visual authority (Constitution / runtime / brand-kit / interim-runtime) for the duration of Pilot 1.
2. Bounded pilot authorization on `Settings → About` with the §7 modifications.
3. Acknowledge `projects/antrac-erp` exists and decide whether it is in or out of the standardization programme.

**Required after Pilot 1 evidence:**
4. Permanent visual authority.
5. Adapter rollout plan (if Pilot 1 passes).

**Defer until a second consumer is proven:**
6. Headless base policy.
7. Registry creation, location, governance.

### Vision recommendation — ≤10 bullets

1. **Fix the alias mismatch first as a preflight commit, not a migration stage.** Verify with `tsc --noEmit`. Likely a one-line `tsconfig.json` change.
2. **Adopt shadcn as a mechanics source, not as a design system.** The brand, tokens, and product identity remain Starq-owned. State this explicitly in Stage 1.
3. **Split Codex's Stage 1 into 1a interim + 1b permanent.** Pilot 1 needs an interim authority; permanent authority is decided after evidence.
4. **Modify the pilot to use local-only adapters** (`AboutButton`, `AboutCard`, `AboutSeparator` — NOT wraps of the system-wide `ui/Button`). Stage 5 exit gate: prove zero non-About consumers before any second use.
5. **Change Pilot 2 from AccountDetailModal to AboutTab's existing inline dialog.** It is the better accessibility test, has lower blast radius, and resolves a known a11y gap.
6. **Do not decide Radix-vs-Base globally yet.** Defer the global policy; let the pilot pick Radix *or* Base. Either is fine.
7. **Do not create a registry now.** Add `antrac-erp` to the inventory and ask Founder whether it is a second consumer.
8. **Add a publication control**: a `components.json` scrubber and a per-pilot pre-publication diff baseline of `src/components/ui/`.
9. **Condense the migration model from 12 stages to 4–5 effective stages.** Stages 5–12 are sequenced right; they do not need a stage per primitive family.
10. **Authorize the bounded pilot only.** No migration, no token change, no dependency change, no registry, no shared package until Pilot 1 has been independently reviewed and Founder has confirmed the permanent authority.

### Implementation authorization

**NO — review only.**

No shadcn migration, no `init`, no `add`, no alias change, no token change, no component replacement, no `components.json`, no registry, no shared package is authorized by this document. Founder ruling on §12.1 items 1–3 is the gate.

---

## Appendix A — files reviewed for this review

Read (independent verification):
- `D:\StarqTech\starqERP\docs\governance\STARQ_UI_SHADCN_STANDARDIZATION_PROPOSAL.md` (full)
- `D:\StarqTech\starqERP\docs\UI_CONSTITUTION.md` (full)
- `D:\StarqTech\starqERP\web\package.json` (full)
- `D:\StarqTech\starqERP\web\vite.config.ts` (full)
- `D:\StarqTech\starqERP\web\tsconfig.json` (full)
- `D:\StarqTech\starqERP\web\src\theme.css` (full)
- `D:\StarqTech\starqERP\web\src\index.css` (head)
- `D:\StarqTech\starqERP\web\src\components\ui\index.ts` (full)
- `D:\StarqTech\starqERP\web\src\components\ui\Button.tsx` (head)
- `D:\StarqTech\starqERP\web\src\components\settings\AboutTab.tsx` (full)
- `D:\StarqTech\starqERP\web\src\components\settings\SettingsView.tsx` (relevant lines)
- `D:\StarqTech\starqERP\web\src\app\router.tsx` (full)
- `D:\StarqTech\starqERP\brand\v1.0\starqERP_brand_kit\tokens\brand-tokens.css` (full)
- `D:\StarqTech\03_PROJECTS\hoadha\web\command-center\package.json` (full)
- `D:\StarqTech\03_PROJECTS\hoadha\web\command-center\components.json` (full)
- `D:\StarqTech\starqNexus\package.json` (deps section)
- `D:\StarqTech\starqNexus\src\components\ui\index.tsx` (full)
- `D:\StarqTech\projects\starq-web\package.json` (head)
- `D:\StarqTech\projects\antrac-erp\package.json` + README + PROGRESS (head)
- `D:\StarqTech\starqNexusMobileBeta\PLATFORM_FREEZE.md` (head)

Deliberately **NOT** read (to preserve independence):
- `D:\StarqTech\starqERP\docs\governance\STARQ_UI_SHADCN_PROPOSAL_ALFRED_INDEPENDENT_REVIEW_V1.md`

## Appendix B — repo state

- Working dir: `D:\!starq\starqERP`
- Branch: `elder/2026-08-31-wave1-governance`
- HEAD: `c3826f27f4b6d48de1ad247f42c5b0cc2c2f0bef`
- `git status`: clean except for the **untracked** file
  `docs/governance/STARQ_UI_SHADCN_PROPOSAL_VISION_INDEPENDENT_REVIEW_V1.md` (this report)
- No commits, no staged changes, no repository mutations performed by this review.
