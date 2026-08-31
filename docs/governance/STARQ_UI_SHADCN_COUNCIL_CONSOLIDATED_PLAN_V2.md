# STARQ UI shadcn Standardization Programme — Council-Consolidated Plan V2

> **COUNCIL-CONSOLIDATED PLAN V2 — PROPOSED / NOT APPROVED**
> **Scope:** Consolidation of five independent reviews of Proposal v1. PLAN ONLY. No implementation, dependency, token, board, or SSOT mutation performed or authorized by this document.
> **Baseline reviewed:** Proposal v1, commit `c3826f27f4b6d48de1ad247f42c5b0cc2c2f0bef`
> **Inputs consolidated:**
> 1. [STARQ_UI_SHADCN_STANDARDIZATION_PROPOSAL.md](STARQ_UI_SHADCN_STANDARDIZATION_PROPOSAL.md) (Codex, original)
> 2. [STARQ_UI_SHADCN_PROPOSAL_CHATGPT_INDEPENDENT_REVIEW_V1.md](STARQ_UI_SHADCN_PROPOSAL_CHATGPT_INDEPENDENT_REVIEW_V1.md)
> 3. [STARQ_UI_SHADCN_PROPOSAL_VISION_INDEPENDENT_REVIEW_V1.md](STARQ_UI_SHADCN_PROPOSAL_VISION_INDEPENDENT_REVIEW_V1.md)
> 4. [STARQ_UI_SHADCN_PROPOSAL_FEASIBILITY_REVIEW_V1.md](STARQ_UI_SHADCN_PROPOSAL_FEASIBILITY_REVIEW_V1.md)
> 5. [STARQ_UI_SHADCN_PROPOSAL_ALFRED_INDEPENDENT_REVIEW_V1.md](STARQ_UI_SHADCN_PROPOSAL_ALFRED_INDEPENDENT_REVIEW_V1.md)
> **Evidence order used throughout:** repository fact > reproducible technical evidence > reviewer reasoning > preference.
> **Founder retains final authority.** Nothing in this document authorizes implementation.

---

## 0. Scope discipline note

Vision's independent reconnaissance surfaced `projects/antrac-erp` (and a parked `Antrac Nexus/app` Flutter shell) as active React frontends not enumerated in Proposal v1's inventory. Per this mission's scope instruction, that discovery is treated **only** as evidence that Proposal v1's "active Starq React web ecosystem" inventory wording was incomplete — **not** as a reason to design work for Antrac ERP. Antrac ERP is a separate SBU product under a different corporate parent (Antrac Holding Group, not Starq Technologies) and stays out of this programme's scope entirely. It is recorded once, in the corrections list below, and nowhere else in this plan.

---

## 1. Council matrix

Legend for reviewer columns: SUPPORT / SUPPORT WITH CONDITIONS / OPPOSE / MODIFY / DEFER / N/A (topic not directly addressed by that reviewer).

| TOPIC | CODEX | CHATGPT | VISION | FEASIBILITY | ALFRED | HARD EVIDENCE | V2 POSITION |
|---|---|---|---|---|---|---|---|
| Programme scope (React web only, not Flutter/RN/Python/public) | SUPPORT — proposes it | SUPPORT — calls it "critical restraint" | SUPPORT, but flags inventory gap (antrac-erp omitted) | N/A (not separately reviewed) | SUPPORT — "the single most important thing about it" | `package.json`/pubspec scans confirm Flutter/RN/Python surfaces exist and are structurally distinct | **CONFIRMED.** Scope stays React-web, ERP-first. Inventory wording corrected (§0), scope not widened. |
| Existing ERP Material 3 layer | Notes 18 files, "medium" shadcn readiness | Requires any adapter to preserve ripple/state/motion/shape | Confirms 18 files, notes shadcn-style CSS variable **names** already present in `theme.css` | Confirms via direct read: `Button.tsx`, `Surface.tsx`, `Badge.tsx`, `Input.tsx` already implement full M3 contracts (ripple, state layers, floating label) | Requires "M3 behavior checklist" before any caller migration | Read of [Button.tsx](../../web/src/components/ui/Button.tsx), [Surface.tsx](../../web/src/components/ui/Surface.tsx), [Badge.tsx](../../web/src/components/ui/Badge.tsx), [theme.css](../../web/src/theme.css) confirms all claims | **CONFIRMED FACT.** ERP already owns a real, working M3 layer. Any shadcn work is additive/experimental, not a rescue of a missing capability. |
| shadcn value proposition for ERP | Frames as accessible headless mechanics under an ERP adapter | Same framing, narrows to "prove mechanics help, don't assume" | Notes ERP already has the CSS variable names shadcn expects — plumbing cost is lower than Codex implied, but the mechanics benefit is unproven | Concludes adapter "would mostly duplicate existing implementation" for Card/Badge/Button/Separator | Agrees shared foundation is useful in concept but under-specified in ownership | Read of ERP primitives shows Button/Badge/Surface already solved; no Dialog primitive exists with focus-trap/Escape/aria-modal in `AboutTab`'s inline modal | **GENUINE DISAGREEMENT, narrowed.** Value is not in re-implementing Button/Badge/Surface. Value, if any, is narrowly in **behavioral primitives** (Dialog/focus management) where the current app has a real, verified gap. |
| Hybrid architecture (headless → semantics → adapter → product) | Proposes as the destination architecture | SUPPORT as "safest likely direction" | SUPPORT the name, but argues the *minimum implementation* is much smaller than the diagram — adapters are largely already `src/components/ui/*` | N/A (not separately modeled) | SUPPORT the boundary concept; flags "shared semantic foundation" has no named owner, no location — "hidden platform-team obligation" | `src/components/ui/index.ts` already re-exports a de facto Starq adapter layer | **CONFIRMED WITH CORRECTION.** Keep the layering concept; reject a new named layer/diagram. Implement as: shadcn (if used) → thin local wrapper inside existing `components/ui` or a pilot-local file → done. No new "Starq semantic foundation" artifact until 2nd consumer. |
| Token/design authority (Constitution vs runtime vs brand-kit) | Flags conflict, proposes Founder choose A/B/C now | Flags conflict but says Founder should not rule "blind" from prose; wants deltas/screenshots first | Independently re-confirms 3-way conflict with exact hex/font deltas; proposes **Option D: interim-then-permanent two-stage ruling** | Independently re-confirms conflict is real; recommends resolving "which authority" before init but does not mandate full reconciliation for a pilot | Requires A/B/C resolved "before any token work begins" | Direct read of [UI_CONSTITUTION.md](../UI_CONSTITUTION.md) vs [theme.css](../../web/src/theme.css) vs brand-kit tokens confirms 3 different primary hex values, 3 different type families, 3 different surface-darkness values | **CONFIRMED FACT + GENUINE DISAGREEMENT on process.** Conflict is real (all 5 agree). Disagreement: permanent ruling now (Alfred) vs interim-then-permanent (Vision, adopted — see §5). |
| Alias mismatch (`@/*`) | Flags as blocker to shadcn init | Not separately re-verified | Independently re-confirms: Vite resolves to `src`, tsconfig resolves to project root — calls it "operationally broken," "latent breakage" | Independently ran `tsc --noEmit`; **passes today** because no `@/` imports exist in current source; classifies as latent config debt, not an active blocker | Requires fixed "first," pre-migration | Read of [vite.config.ts](../../web/vite.config.ts), [tsconfig.json](../../web/tsconfig.json); grep for `@/` imports in `web/src` returns no matches; `npm run lint` passes clean | **CONFIRMED FACT, reconciled.** Real config drift; not currently load-bearing (zero `@/` imports exist today, and `tsc --noEmit`/tests pass). Trivial one-line preflight fix, done once, before any shadcn work — not a hard blocker to the current app. |
| Settings → About pilot (as originally scoped) | Proposes wrapping shared `Button`/`Surface`/`Badge` | Supports concept, bounded, reversible, non-financial | **MODIFY required** — wrapping the shared `ui/Button` etc. is a stealth app-wide migration because that Button is imported by ~40+ files | Independently confirms: `AboutTab` imports `Button, Surface, Badge` from the shared `../ui` barrel used across the entire app | ACCEPT pilot, but add "information hierarchy" test #0 | Grep confirms `Button`/`Surface`/`Badge` from `components/ui` barrel are used across accounts, customers, invoices, jobs, settings, etc. (60+ import sites) | **CONFIRMED FACT + CORRECTION.** Pilot concept accepted; original wrap-the-shared-primitive design rejected. Redesigned in §6 to use pilot-local components only. |
| Shared Button blast radius | Not addressed as a distinct risk | Not addressed as a distinct risk | **Raised as the critical hidden risk** — "any caller change is a global change" | Independently confirms via grep: `Button`/`Surface`/`Badge` exported through `ui/index.ts` and imported in dozens of unrelated views | Requires adapter contract before "any caller migration" | Grep evidence: 60+ import sites of `../ui` barrel across `accounts/`, `customers/`, `invoices/`, `jobs/`, `payments/`, `purchasing/`, `reports/`, `settings/`, `suppliers/`, `tax/` | **CONFIRMED FACT.** This is the single most important correction to Proposal v1's pilot design. Pilot must not touch the shared barrel at all. |
| AboutTab inline modal | Not identified in Proposal v1 as a distinct artifact | N/A | **Discovered independently**: a third, non-accessible modal (no `role="dialog"`, no `aria-modal`, no Escape handler, no focus trap) at lines ~232–298 of `AboutTab.tsx`, separate from the two general `Modal` implementations | Independently re-read and confirmed: `activeDialog` state renders a raw `div` with `onClick`-to-close only, zero ARIA attributes, zero keyboard handling | N/A (not separately reviewed) | Direct read of [AboutTab.tsx](../../web/src/components/settings/AboutTab.tsx) lines 220–298 confirms zero `role`, `aria-modal`, `aria-labelledby`, or `keydown` handling. By contrast [common/Modal.tsx](../../web/src/components/common/Modal.tsx) (used by `AccountDetailModal`) **already has** `role="dialog"`, `aria-modal`, `aria-labelledby`, and an Escape-key handler. | **CONFIRMED FACT, material.** This is a real, present, isolated, non-financial accessibility gap directly inside the pilot surface. It is the strongest behavioral-primitive candidate in the entire ERP app — better than `AccountDetailModal`, which already has a reasonably accessible dialog. |
| Radix vs Base UI (for ERP pilot specifically) | Recommends Radix for continuity with Hoadha | Narrows: Radix defensible for ERP pilot, but explicitly rejects extending this to global policy from one data point | Mildly opposes Radix-for-ERP: Hoadha's 26-package Radix footprint is a "shadcn-with-Radix tax," "Hoadha is one consumer, not a reason"; prefers Base UI if starting fresh, but calls Radix "defensible" | Independently frames as advisory only; both feasible with conditions; Base UI marginally lower cross-product-conflict risk | Recommends Radix continuity "given Hoadha's existing investment" | No ERP dependency on either exists today (`package.json` scan: zero `@radix-ui`/`@base-ui` in ERP); Hoadha has 26 `@radix-ui/react-*` packages | **GENUINE DISAGREEMENT, preserved.** Alfred/Codex favor Radix continuity; Vision/Feasibility lean Base-UI-or-neither. Resolved procedurally in §4: the question is moot for Pilot 1 because Pilot 1 needs no headless package at all (see §4). Defer the Radix-vs-Base choice to whenever a real behavioral primitive actually requires one. |
| Whether Pilot 1 needs a headless dependency at all | Implicitly assumes yes (proposes `init` as Stage 4) | Implicitly assumes a headless base is chosen for the pilot, but stresses "no headless package for the first pilot if evidence shows existing M3 primitives already provide enough value" as a live option | Confirms shadcn-style CSS variable names already exist in `theme.css`; does not fully resolve whether `init` is needed for a non-visual pilot | Independent conclusion: current M3 `ui/` layer already covers Button/Surface/Badge value; adapters there would "merely duplicate existing implementation" | Not raised as a distinct question | No `components.json` exists; ERP ships zero headless dependencies; existing `Button`/`Surface`/`Badge` are functionally complete M3 components today | **RESOLVED — this is the central technical finding of this consolidation.** See §4. Pilot 1 (metadata/status surface) needs **no** headless dependency. A headless dependency only becomes relevant for a **behavioral** primitive (Dialog), which is Pilot 2, not Pilot 1. |
| Global headless-base policy (ecosystem-wide) | Proposes Radix as ecosystem default | **Explicitly rejects ruling this now** — "not yet on Founder's plate" | Calls it "INSUFFICIENT EVIDENCE" — no measured a11y delta, no agent-cost data | Not separately modeled at ecosystem scope | Recommends deciding now "to avoid dual-base drift," but scoped to Radix-vs-Base only, not full ecosystem mandate | Repo-wide scan: exactly one existing consumer (Hoadha) uses any headless library | **CONFIRMED CORRECTION.** No ecosystem-wide headless policy should be set now. Defer to second real consumer (§11, DEFERRED UNTIL SECOND CONSUMER). |
| Registry (shared source-distribution) | Proposes as "possible" future mechanism, defers creation | SUPPORT deferral; registry location "not a Founder decision today" | SUPPORT deferral; flags antrac-erp as a possible unstated second-consumer candidate (noted, not designed for — see §0) | Not separately modeled | SUPPORT deferral, but requires a **named owner before the second pilot**, or "the registry never ships" | No registry exists; Hoadha's own `components.json` has `registries: {}` empty | **STRONG CONSENSUS.** No registry now. Defer until 2 consumers exist AND an owner is named (Alfred's condition adopted). |
| Runtime `@starq/ui` shared package | Rejects a full runtime package | SUPPORT rejection | N/A (not separately modeled) | Not separately modeled | Rejects runtime package; **but** proposes a much smaller framework-neutral "shared contracts/semantics" package (status types, a11y contracts) may be worth it after 2 consumers | No shared package of any kind exists in any repo today | **STRONG CONSENSUS.** No runtime UI package, ever, without proof. A tiny framework-neutral contracts package is a DEFERRED, not REQUIRED, idea — noted in §11 as agent-resolvable/deferred. |
| Migration-stage complexity (Codex's ~12–14 stage pipeline) | Proposes full staged pipeline with named gates and reviewer chain | Calls full regression programme "useful at programme start" but "should not become repeated ceremony for every tiny migration" | Reorders/compresses several stages; flags Stage 4 ("zero visual change") needs explicit "init-only vs first-add" split | Independently designed a 5-step minimal plan in the Feasibility review, not a 12-stage one | Explicitly calls the 14-stage pipeline "overhead," recommends collapsing to reference table, not gating process | The programme has produced 2 prior review documents and this is the 3rd; process cost is already visible | **STRONG CONSENSUS: compress.** Replace the staged pipeline with 5 gates (§7), not 12–14. |
| Regression/testing burden | Proposes full matrix (viewports × themes × routes, axe, bundle, print, reduced motion) for every stage | Proposes a one-time programme baseline + light per-migration checks scaled to risk tier | Flags per-pilot screenshot matrix (24 screenshots) as excessive for a 1-route pilot; proposes 6 screenshots for Pilot 1; flags **missing** checks: multi-tenant theming, print-at-invoice-level, 200% zoom, tabular-nums | Independently marked most later-stage checks (Playwright, axe, keyboard, print, bundle) as "NEEDS SETUP," not "AVAILABLE NOW"; TypeScript/tests/build already pass today | Supports risk-tiered review (LOW/MEDIUM/HIGH), not uniform ceremony | `npm run lint` and `npm test` (82 files, 295 passed/1 skipped) already pass and are free; Playwright/axe/visual regression tooling does not exist in `package.json` today | **CONFIRMED FACT + CORRECTION.** Minimum baseline before Pilot 1 = lint + test + build + 1 route smoke + keyboard/focus check + console check. Full matrix deferred until a route/shell-level migration is actually proposed. |
| Review cadence / reviewer chain | Proposes 4+ named agents in sequence for every stage | Proposes 3-tier risk model (LOW/MEDIUM/HIGH) with escalating reviewer count | N/A (not separately modeled as a table) | N/A (feasibility review is itself one tier of that model) | Independently proposes near-identical 3-tier model; explicitly warns "otherwise every Button becomes a meeting" | This very consolidation required 5 independent documents for one UI proposal — direct evidence of review-cost sensitivity | **STRONG CONSENSUS.** Adopt the 3-tier risk model (LOW/MEDIUM/HIGH) from ChatGPT/Alfred, converged independently by two reviewers. |
| Small-studio governance (docs, exceptions, CI census) | Proposes exception records, CI census, cross-product policy docs, architecture doc, staged-gate docs | Not separately itemized beyond regression proportionality | N/A (not separately modeled) | Not separately modeled | Extremely detailed: one-page semantics doc, 3-line `README.md`, one-line exception template, report-only CI, no formal exception-review process | No `web/src/components/ui/README.md` exists today | **CONFIRMED CORRECTION.** Adopt Alfred's minimal governance set nearly as-is (§8). Cap total governance documentation at roughly one page. |
| §10 / publication safety | Flags general risk of shadcn artifacts leaking into `starqERP-public` | Lists specific artifact classes at risk (components.json, registry URLs, lockfiles, comments) | N/A (not separately modeled) | Independently concludes any shadcn-generated private code must be excluded from public packaging unless Founder explicitly approves a publication-safe variant | N/A (not separately modeled) | `starqERP-public` and `publication-candidate-*` exist and are classified DERIVED in Proposal v1 §2.10 | **STRONG CONSENSUS with additions.** See §9 for the consolidated, expanded control list (adds `components.json` scrubbing and a pre-pilot diff baseline of `src/components/ui/`, from ChatGPT). |
| Founder decision surface | Proposes 3 immediate rulings, doesn't distinguish "now" from "later" cleanly | Explicitly narrows to 3 "rule now" items, defers the rest | Proposes Option D two-stage ruling; flags antrac-erp existence as founder-notice item (not a design task) | Independently proposes narrow founder-ruling-for-pilot-only model | Proposes 3 "required before any implementation," explicit "agent-resolvable, do not escalate" list | Five separate review documents converge more than they diverge on this list | **STRONG CONSENSUS** on reducing Founder burden; final register in §11. |

---

## 2. CONFIRMED FACTS

1. Proposal v1's programme-scope restraint (React web only; excludes Flutter, React Native, Python/server-rendered, legacy, public) is correct and should be preserved unchanged.
2. `starqERP/web` already has a fully working, custom Material 3 UI primitive layer (`Button`, `Input`, `Surface`, `Badge`, `Modal`, `Drawer`, `Tabs`, `Switch`, `SegmentedButton`, `DataTable`, `FilterChip`) — 18 files, exported through one barrel (`components/ui/index.ts`).
3. That barrel is imported by 60+ files across nearly every ERP domain (accounts, customers, invoices, jobs, payments, purchasing, reports, settings, suppliers, tax). Any change to the shared primitives is an app-wide change, not a local one.
4. `starqERP/web/src/theme.css` already declares shadcn-conventional CSS variable names (`--background`, `--foreground`, `--card`, `--border`, `--input`, `--ring`, `--radius-*`). shadcn plumbing does not require renaming these variables; it would only require `components.json` and a `cn()` utility, neither of which currently exists.
5. There is a genuine 3-way design-authority conflict between [UI_CONSTITUTION.md](../UI_CONSTITUTION.md) (declared AUTHORITATIVE SSOT), the shipped runtime [theme.css](../../web/src/theme.css), and the packaged brand-kit tokens — different primary hex values, different type families, different dark-surface darkness, in all three sources.
6. The `@/*` alias mismatch between [vite.config.ts](../../web/vite.config.ts) (resolves to `src`) and [tsconfig.json](../../web/tsconfig.json) (resolves to project root) is real, but it is currently **latent**: zero `@/`-prefixed imports exist in ERP source today, and `npm run lint` (`tsc --noEmit`) and `npm test` both pass cleanly as of this review.
7. `AboutTab.tsx` already imports the shared `Button`, `Surface`, and `Badge` primitives from the app-wide `ui` barrel — the original pilot design (wrap those primitives) is not isolated to Settings/About.
8. `AboutTab.tsx` contains its own hand-rolled inline modal (Privacy/Terms/Licenses, ~lines 232–298) with **zero** accessibility scaffolding: no `role="dialog"`, no `aria-modal`, no `aria-labelledby`, no Escape-key handling, no focus trap, close-on-backdrop-click only.
9. By contrast, [common/Modal.tsx](../../web/src/components/common/Modal.tsx) (used by `AccountDetailModal` and others) already implements `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and Escape-key handling.
10. No headless dependency (`@radix-ui/*`, `@base-ui/*`, `@headlessui/*`, `react-aria`) exists anywhere in the ERP app today. Exactly one product in the whole `D:\StarqTech` tree (Hoadha's web command center) currently uses a headless library, with 26 individual `@radix-ui/react-*` packages.
11. No `components.json`, no shadcn CLI artifact, and no shared registry exist anywhere in starqERP today.
12. The ERP app's current validation baseline is green without any change: `npm run lint` passes; `npm test` passes (82 test files, 295 tests passed, 1 skipped).
13. `starqERP-public` and `publication-candidate-starqERP-public-20260831` are correctly classified DERIVED and must never be migrated independently of the private canonical source.

---

## 3. PROPOSAL V1 CORRECTIONS

1. **The Settings → About pilot design must not wrap the shared `Button`/`Surface`/`Badge` primitives.** Doing so is not a bounded pilot; it is a stealth app-wide migration, because that barrel is imported by 60+ files across the whole app (Fact 2, 3, 7). Redesigned in §6.
2. **The better Pilot 2 (behavioral/a11y) target is the AboutTab's own inline Privacy/Terms/Licenses modal, not `AccountDetailModal`.** `AccountDetailModal` already uses an accessible dialog (`common/Modal`, Fact 9); the AboutTab inline modal has a real, present, isolated accessibility gap (Fact 8) and lives inside the exact pilot surface already chosen. See §7.
3. **The alias mismatch is real config debt but not an active blocker.** It should be fixed as a one-line, isolated preflight patch (add `baseUrl` alignment) before any shadcn-adjacent work, but it must not be framed as evidence that the current app is broken (Fact 6).
4. **The 12–14 stage migration pipeline with a 4+ agent reviewer chain is disproportionate** for a two-founder studio with rotating agents. Compress to 5 gates (§7) with a 3-tier risk-based review model, not a fixed multi-agent sequence for every change.
5. **The design-authority ruling should not be forced as one permanent A/B/C choice before any evidence exists.** Adopt Vision's two-stage model: an interim, pilot-scoped authority ruling now, and a permanent ruling after Pilot 1 produces real screenshots/deltas (§5).
6. **Do not assume shadcn `init` (or any headless package install) is required to start.** The central technical finding of this consolidation (§4) is that Pilot 1 can and should be built entirely from the existing M3 `ui/` layer, introducing a headless dependency only if and when a genuinely behavioral primitive (Dialog) is attempted, which is Pilot 2 — not Pilot 1.
7. **Radix-vs-Base UI is not a decision Pilot 1 needs to make at all**, and should not be escalated to Founder until a real behavioral primitive is actually being built with a headless library (§4, §11).
8. **The proposed governance surface (exception records, CI census, cross-product policy docs, architecture doc, staged-gate docs) should be capped at roughly one page total**, per Alfred's minimum-sustainable-architecture model, not built as a parallel documentation ecosystem (§8).
9. **§10 publication controls need two additions beyond Proposal v1**: a `components.json`/registry-URL scrubber requirement, and a pre-pilot `git diff --stat` baseline of `src/components/ui/` so any future publication strip can distinguish shadcn-origin files from private-origin files (§9).
10. Proposal v1's inventory of "active Starq React web ecosystem" is incomplete (it omits `projects/antrac-erp`); this is corrected as a factual note only (§0) and does not change scope, ownership, or work.

---

## 4. GENUINE DISAGREEMENTS

These are preserved, not resolved by fiat, per instruction.

1. **Radix vs Base UI for whenever a headless primitive is eventually justified.** Codex and Alfred favor Radix (continuity with Hoadha's existing 26-package investment). Vision and the Feasibility review lean toward Base UI or "neither yet" (smaller footprint, avoids importing Hoadha's dependency-family cost with no proven shared benefit, notes Radix's own upstream project has been de-emphasizing itself in favor of Base UI). This consolidation does **not** rule on this. It is resolved procedurally, not substantively: the question does not need to be answered for Pilot 1 (§4 below shows no headless dependency is needed at all), and should only be answered when a concrete behavioral primitive (Pilot 2, or a later stage) actually requires a headless package.
2. **Permanent design-token authority (Constitution vs runtime vs brand-kit vs deliberate reconciliation).** All five reviewers agree the conflict is real. They disagree on *when* it must be permanently resolved: Alfred requires it "before any token work begins"; Vision and ChatGPT argue the Founder should not rule on this from prose alone and should see the pilot's evidence first. This consolidation adopts Vision's two-stage model as the *procedural* resolution (§5), but the underlying substantive disagreement about which source should ultimately win remains open and is explicitly a Founder decision, not a council decision.
3. **Whether a global ecosystem-wide headless-base policy should exist at all.** Codex proposes Radix as a default across the active React ecosystem. ChatGPT, Vision, and the Feasibility review all argue this is premature with only one existing consumer. Alfred is silent on the ecosystem-wide scope (only addresses ERP-specific choice). This is not resolved here; it is explicitly deferred (§11, DEFERRED UNTIL SECOND CONSUMER).
4. **Whether a tiny framework-neutral "shared contracts" package (status types, a11y contracts — not a UI runtime) has future value.** Alfred raises this as a distinct, smaller idea worth keeping alive; no other reviewer addresses it. Not resolved; logged as an open question in §5 below, not designed for now.

---

## 5. OPEN QUESTIONS

1. Which source ultimately wins as permanent ERP design-token authority (Constitution / runtime / brand-kit / deliberate reconciliation of all three) — deferred until after Pilot 1 evidence exists (§11).
2. Whether Base UI or Radix (or neither) should be used if/when a behavioral primitive genuinely needs a headless library — deferred until that moment arrives (§11).
3. Whether a tiny framework-neutral shared-contracts package (not a UI runtime) is ever worth building — open, not urgent, no reviewer has proposed a trigger condition for it yet.
4. Whether `AboutTab`'s inline modal should be replaced with the existing app-wide `common/Modal` (zero new dependency, immediate accessibility fix) instead of a new headless-based Dialog — this is a legitimate simpler alternative that emerged from this consolidation's own evidence (Fact 9) and is explicitly evaluated as Path A in §6.

## 6. DEFERRED QUESTIONS

1. Registry existence and location — deferred until at least two real consumers demonstrably need the same semantic/behavioral contract, and an owner is named before that second pilot begins (Alfred's condition, adopted).
2. Global/ecosystem-wide headless-base policy — deferred until a second consumer exists.
3. Rollout order beyond Pilot 1/Pilot 2 (forms, shell/navigation, financial tables, legacy retirement) — deferred until Pilot 1 and Pilot 2 both pass Gate C/D review.
4. Whether Hoadha's existing Radix investment should ever influence ERP's choice — deferred to whenever a headless library decision is actually live for ERP.
5. Antrac ERP's UI direction — explicitly out of this programme's scope (§0); not a Starq Technologies decision to make here.

---

## 4. Central technical question: does Pilot 1 need a headless dependency?

> Does Pilot 1 need Radix/Base/shadcn headless dependencies at all, or can the first useful proof be performed using the ERP's existing Material 3 UI layer, introducing headless mechanics only when a behavioral primitive such as Dialog actually benefits from them?

### Path A — Pilot 1 with no new headless dependency

- **What is actually proven:** That the existing M3 `ui/` layer is sufficient to compose a metadata/status surface cleanly, and (if Pilot 1 also includes fixing the inline modal using the existing `common/Modal`) that the app's own accessible dialog pattern can be reused instead of invented twice. Proves the "hybrid" architecture is achievable with zero new packages for non-behavioral work.
- **Dependency/config impact:** None. No new packages, no lockfile change, no `components.json`.
- **Rollback:** Trivial — revert the pilot-local files only; no shared file is touched.
- **Accessibility value:** Real and immediate if paired with adopting `common/Modal`'s existing `role="dialog"`/`aria-modal`/Escape pattern for the AboutTab inline modal — this alone closes Fact 8's gap using code that already exists and is already tested elsewhere in the app.
- **Blast radius:** Zero outside the pilot files.
- **Verdict:** The pilot is meaningful. It proves the architecture and closes a real, present accessibility gap without adding anything.

### Path B — Pilot 1 with Base UI

- **What is actually proven:** That Base UI's headless primitives can be wired under an ERP-owned adapter without visual drift. Proves comparatively little beyond what Path A proves for a metadata/status screen, since Base UI's main value is for *behavioral* primitives (Dialog, Popover, Menu), not static Card/Badge/Surface composition.
- **Dependency/config impact:** New direct dependency (Base UI package(s)), possible `components.json`, possible `cn()`/class-merge utility addition, Tailwind config touch.
- **Rollback:** Requires removing the dependency and any generated config/utility files; not zero-cost, but manageable if isolated to pilot-local files.
- **Accessibility value:** Only realized if the pilot actually implements a behavioral primitive (Dialog) with it — otherwise the accessibility value is theoretical (Card/Badge/Surface do not need a headless base).
- **Blast radius:** Contained if strictly limited to new pilot-local files; risk is procedural (agents reaching for the new package elsewhere before it's proven).
- **Verdict:** Adds a wrapper without adding proven value **if** Pilot 1 stays scoped to the non-behavioral metadata surface. Only becomes meaningful if Pilot 1 is redefined to include the Dialog work — which this plan instead assigns to Pilot 2 (§7).

### Path C — Pilot 1 with Radix

- Same analysis as Path B, with a larger dependency footprint (Hoadha's own experience shows Radix's per-primitive package count adds up — 26 packages for 47 components) and the additional consideration that adopting Radix here before any second consumer exists pre-empts the still-open Radix-vs-Base disagreement (§4, GENUINE DISAGREEMENTS #1) without evidence.
- **Verdict:** Same conclusion as Path B — not justified for a non-behavioral Pilot 1, and additionally forecloses an open disagreement prematurely.

### Resolution

**Path A.** Pilot 1 should introduce **no headless dependency**. The metadata/status surface is fully achievable with the existing M3 `ui/` layer. If Pilot 1's scope includes fixing the inline modal's accessibility gap, it should do so first by reusing the app's own existing `common/Modal` pattern (zero new dependency) — this alone proves whether headless mechanics would add anything beyond what the app already has. A headless library only becomes relevant if/when a future primitive genuinely cannot be built from `common/Modal`'s pattern, which has not been demonstrated. This directly answers the mission's central question:

**Does Pilot 1 require a headless dependency? NO.**

---

## 6. Recommended Pilot 1 — Settings → About, pilot-local only

**Design principle (correcting Proposal v1, per §3.1):** touch nothing in the shared `components/ui` barrel. Everything is new, pilot-local, and additive.

### Exact files/surface to touch

- **New file:** `web/src/components/settings/about/AboutPilotPrimitives.tsx` (or similar pilot-local name) — contains any new presentational wrapper(s) needed for the About surface only. If nothing new is actually needed beyond composing existing `Button`/`Surface`/`Badge` as-is (unchanged, just used, not wrapped), this file may not be needed at all.
- **Modified file:** `web/src/components/settings/AboutTab.tsx` — only to the extent of using pilot-local composition where useful; existing imports of `Button`, `Surface`, `Badge` from `../ui` remain untouched (read-only usage, not modification of those primitives).
- **Not touched:** `web/src/components/ui/*` (no changes to `Button.tsx`, `Surface.tsx`, `Badge.tsx`, or `index.ts`).
- **Not touched:** any other domain view, `SettingsView.tsx`'s other tabs, or the shared `common/Badge.tsx` compatibility wrapper.

### Accounting for council evidence

- AboutTab already uses shared `Button`/`Surface`/`Badge` — Pilot 1 leaves this exactly as-is; it does not attempt to replace or wrap them.
- Because modifying shared primitives creates app-wide blast radius (Fact 3), Pilot 1 by design contains zero changes to `components/ui/*`.
- Pilot-local wrappers, if any are needed at all, live next to `AboutTab.tsx`, not in the shared barrel.
- shadcn-style semantic aliases already exist in `theme.css` (Fact 4) — Pilot 1 needs no token renaming and no `components.json` to prove the architecture works.
- Information hierarchy must remain unchanged — adopted as an explicit acceptance test (Alfred's "test #0": a human confirms the About surface still reads as "About this ERP installation," not as a generic settings page, before/after comparison).

### Acceptance tests for Pilot 1

1. `npm run lint` and `npm test` pass unchanged.
2. `npm run build` succeeds.
3. Route-level smoke of `/settings?tab=about`.
4. Visual/information-hierarchy check (test #0): before/after screenshot pair, human-confirmed.
5. Zero diff in any file under `web/src/components/ui/`.

---

## 7. Recommended Pilot 2 — behavioral/a11y experiment

### Comparison

| | AccountDetailModal | AboutTab inline Privacy/Terms/Licenses modal |
|---|---|---|
| Current dialog implementation | Uses `common/Modal`, which **already has** `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape-key handling | Hand-rolled `div`, **zero** ARIA attributes, no Escape handling, no focus trap |
| Data dependency | Depends on `AccountsView`'s ledger/account data layer — financial-adjacent | None — static legal/informational text only |
| Blast radius if changed | Touches a financial-domain view and its data wiring | Fully contained inside the already-selected Pilot 1 surface (`AboutTab`) |
| Accessibility upside of touching it | Marginal — the existing pattern is already reasonably accessible | Real and immediate — closes an actual, present, verified gap (Fact 8) |
| Risk tier | Higher (financial-adjacent, per the risk-tier model in §8) | Lower (non-financial, purely presentational) |

### Recommendation

**AboutTab's inline Privacy/Terms/Licenses modal is the better Pilot 2 target.** It is lower blast radius, non-financial, already inside the Pilot 1 surface, and has a real, present, verified accessibility defect to fix — unlike `AccountDetailModal`, which already uses an accessible pattern and would add process cost for no measurable a11y gain. Per §4's resolution (Path A), the first attempt at fixing it should reuse the existing `common/Modal` pattern (zero new dependency); only if that proves insufficient should a headless-library-based Dialog be evaluated, and only then does the Radix-vs-Base question (§4, disagreement #1) become live.

---

## 8. Token authority — smallest Founder ruling required

Per §5 (GENUINE DISAGREEMENTS #2), this consolidation does not force a permanent A/B/C ruling. It adopts Vision's interim-authority model.

**Smallest Founder ruling required to conduct a non-redesign pilot safely:**

> For the duration of Pilot 1 and Pilot 2 only, the currently shipped runtime (`web/src/theme.css`) is treated as the **interim** visual/token authority. This is explicitly temporary and does not amend [UI_CONSTITUTION.md](../UI_CONSTITUTION.md)'s "AUTHORITATIVE SSOT" status. A permanent ruling (Constitution / runtime / brand-kit / deliberate reconciliation of all three) is deferred until after Pilot 1 evidence (screenshots, deltas) exists, at which point the Founder rules permanently.

This is a one-sentence ruling, not a design reconciliation project, and it unblocks the pilot without pretending the underlying 3-way conflict (Fact 5) is resolved.

---

## 9. Simplified operating model — five gates

| Gate | ENTRY | SCOPE | VALIDATION | REVIEW | ROLLBACK | EXIT | FOUNDER ACTION |
|---|---|---|---|---|---|---|---|
| **A — Preflight / authority / baseline** | This consolidated plan is read | Fix `@/*` alias config only (§3.3); capture current `npm run lint`/`npm test`/`npm run build` baseline; obtain interim token-authority ruling (§5) | `npm run lint`, `npm test`, `npm run build` all green, unchanged | Implementer self-check; no council review needed (LOW risk, config-only) | Revert the config-only patch | Alias aligned, baseline recorded, interim authority ruled | Approve interim token-authority ruling (one sentence, §5) |
| **B — Pilot 1** | Gate A exit | Settings → About pilot-local composition only (§6); zero changes to `components/ui/*` | Gate A checks + route smoke + information-hierarchy test #0 | Implementer + one spot-check reviewer (LOW-MEDIUM risk) | Revert pilot-local files only | Pilot 1 acceptance tests pass; zero diff in shared barrel confirmed | Authorize Pilot 1 (yes/no) |
| **C — Behavioral Pilot 2** | Gate B exit + approval | AboutTab inline modal → reuse `common/Modal` pattern first (Path A); escalate to a headless-library Dialog only if that proves insufficient (§4, §7) | Gate B checks + keyboard/focus check + axe/DOM scan on the pilot route only | Implementer + accessibility-focused reviewer (MEDIUM risk) | Revert to Gate B state | Modal is keyboard-accessible, Escape-dismissible, focus-trapped; no shared file touched unless a headless library was justified and isolated | Authorize Pilot 2 approach (reuse-existing vs headless-library, only if reuse proves insufficient) |
| **D — Expand or stop** | Gate C exit | Decide whether to propose further ERP surfaces (forms, shell, tables) — **no work authorized by this gate itself** | Council/independent review of Pilot 1+2 evidence | Founder + whichever reviewers Founder wants (HIGH-risk decision) | N/A — decision gate, not a code gate | Decision recorded: expand / hold / stop | Decide expand/hold/stop; this is the only gate where scope beyond the two pilots can be authorized |
| **E — Second-consumer / registry decision** | A second real consumer (not Antrac ERP — out of scope, §0) independently needs the same primitive | Evaluate whether a registry and/or shared contracts package is now justified | Evidence of duplicated need across 2+ Starq React web products | Founder + Elder | N/A — decision gate | Registry owner named, or explicitly deferred again | Name registry owner if proceeding, or defer again |

This replaces Proposal v1's 12–14 stage pipeline and 4+ agent reviewer chain with 5 gates and a 3-tier risk-based review model (LOW: implementer self-check; MEDIUM: implementer + one focused reviewer; HIGH: Founder + full council), per the converged ChatGPT/Alfred recommendation.

---

## 10. Small-studio governance — minimum durable controls

Adopting Alfred's minimum-sustainable-architecture model, capped at roughly one page total:

| Artifact | Decision | Rationale |
|---|---|---|
| Repo-level UI README (`web/src/components/ui/README.md`) | **CREATE — 3–5 lines** | Closes the bus-factor gap: states the canonical primitive location, the rule for extend-vs-create, and where exceptions are recorded. Not a design doc. |
| Tiny semantics/interaction guide | **DEFER** | Not needed until a second product needs the same behavioral contract. Alfred's "one-pager" is a good future shape but has no trigger yet. |
| ERP M3 behavior checklist | **CREATE — short checklist, part of README or adjacent** | Ripple / state layer / shape / motion / adaptive-window presence — a testable list, not prose, so any future adapter (if one is ever built) can self-verify against it. |
| Report-only CI census | **DEFER** | Not needed until there is more than one pilot's worth of components to census. Revisit at Gate D if expansion is approved. |
| Exception handling | **One-line template only** (primitive, reason, owner, date, temporary/permanent) | No formal exception-review process; agents write one line when they deviate. |
| Shared-candidate tracking | **DEFER, informal** | Track "possible shared candidates" as a single bullet list appended to this document's Gate E section when/if a second consumer appears — do not stand up a separate tracking artifact now. |

Total new governance surface from this programme: one short README file. Everything else is either already covered by this consolidated plan or explicitly deferred with a named trigger.

---

## 11. §10 / publication controls — additions only

Preserving the one-way private → stripped-public model unchanged. Additional UI/shadcn-specific controls required, beyond Proposal v1's general statement:

1. **`components.json` scrubbing:** if a `components.json` is ever created (not required by Pilot 1 or 2 per §4), the publication/strip process must scrub or exclude any `registries` field before any public derivative is generated. No private registry URL, auth metadata, or internal namespace may reach `starqERP-public`.
2. **Registry URLs:** any registry reference (internal or third-party beyond the default public shadcn registry) must be treated as a publication-blocking artifact until explicitly reviewed.
3. **Generated source provenance:** any shadcn-generated component file must carry its origin clearly (e.g., a top-of-file comment) so the publication strip script can identify shadcn-origin vs private-origin files without guessing.
4. **Package/lockfiles:** confirm the package manager stays `npm` (existing `package-lock.json`) for any pilot work; do not introduce a second lockfile format (`pnpm-lock.yaml`, `bun.lock`) that the existing strip tooling does not expect.
5. **Private adapters:** any pilot-local wrapper file must not itself be assumed public-safe by default; it is subject to the same manifest review as any other private source file.
6. **Comments/provenance:** shadcn's own upstream attribution comments (if any component is ever added) are acceptable to keep, but must be explicitly approved once, not left to silent drift.
7. **License/provenance:** confirm no dependency added under this programme carries a copyleft license before it is added — MIT/Apache 2.0 only, consistent with current ERP dependencies.
8. **Pre-pilot diff baseline (new, from ChatGPT's review):** capture a `git diff --stat` baseline of `web/src/components/ui/` before Gate B begins, so that any future publication process can distinguish exactly which files originated from this programme versus pre-existing private source.

Since Pilot 1 and Pilot 2 (per §4/§6/§7) require **no new dependency and no `components.json`**, none of these controls are actually triggered by the recommended pilots themselves. They are recorded here as standing controls for **if and when** a headless dependency or shadcn CLI artifact is ever introduced in a later gate.

---

## 12. Founder Decision Register V2

### REQUIRED BEFORE ANY CODE

1. Approve the interim, pilot-scoped token-authority ruling (§8) — one sentence: runtime `theme.css` governs for the duration of Pilot 1/2 only; permanent ruling deferred to after Pilot 1 evidence.

### REQUIRED BEFORE PILOT 1

2. Authorize Gate A → Gate B progression (the alias preflight fix and the pilot-local, no-shared-primitive-touch design in §6).

### REQUIRED AFTER PILOT 1

3. Permanent ERP visual/token authority ruling (Constitution / runtime / brand-kit / deliberate reconciliation), informed by Pilot 1's actual screenshots and deltas.
4. Approve or modify the Pilot 2 approach (reuse `common/Modal` pattern vs. introduce a headless-library Dialog), per §4/§7's Path-A-first recommendation.
5. Gate D decision: expand to further ERP surfaces, hold, or stop.

### DEFERRED UNTIL SECOND CONSUMER

6. Registry creation and location, with a named owner (Alfred's condition).
7. Global/ecosystem-wide headless-base policy (Radix vs Base UI as a Starq-wide default).
8. Whether a tiny framework-neutral shared-contracts package is worth building.
9. Whether Hoadha's existing Radix investment should influence any other product's choice.

### AGENT-RESOLVABLE — DO NOT ESCALATE

10. Exact pilot-local file names and locations within `web/src/components/settings/`.
11. Whether Pilot 1 needs any new pilot-local wrapper file at all, or can compose existing primitives as-is.
12. The specific screenshot/viewport combination used for the information-hierarchy test (sensible default: one route, light/dark, one representative width — record what was chosen).
13. Whether to log a one-line exception record for any minor deviation (per §10's template) — agents decide and log, they do not ask.
14. `README.md` wording inside `web/src/components/ui/` (§10) — agents draft it, Founder does not need to approve prose.

---

## 13. Board proposal — smallest justified tasks only

No board mutation performed. The following are the smallest justified task proposals, for the Founder/Elder to create manually if Gate A/B are authorized. No registry task is proposed, because none is currently justified (§4, §11).

1. **Task: ERP UI preflight** — fix the `@/*` alias config mismatch (`tsconfig.json` `baseUrl` alignment), capture the current lint/test/build baseline, obtain the interim token-authority ruling. Maps to Gate A.
2. **Task: Settings → About pilot (no shared-primitive changes)** — implement Pilot 1 exactly as scoped in §6. Maps to Gate B.
3. **Task: AboutTab inline modal accessibility fix** — attempt Path A first (reuse `common/Modal`'s existing accessible pattern); only escalate to a headless-library evaluation if that proves insufficient, with Founder sign-off before adding any new dependency. Maps to Gate C.

No task is proposed for: registry, shared runtime package, global headless-base policy, forms/shell/table migration, or any work involving Antrac ERP.

---

## Summary answers

### CONSOLIDATION STATUS
**READY FOR FOUNDER REVIEW**

### Biggest corrections to Proposal v1

1. The Settings → About pilot must not wrap the shared `Button`/`Surface`/`Badge` primitives — that barrel is used by 60+ files across the whole app, so wrapping it is an app-wide migration, not a bounded pilot.
2. The better behavioral/a11y Pilot 2 target is `AboutTab`'s own inline Privacy/Terms/Licenses modal (zero ARIA, zero keyboard handling today), not `AccountDetailModal` (which already uses an accessible `common/Modal` pattern).
3. Pilot 1 needs **no new headless dependency** at all — the existing M3 `ui/` layer and the existing `common/Modal` pattern are sufficient to prove the architecture and even to fix the real accessibility gap, before any Radix/Base UI decision is needed.
4. The 12–14 stage migration pipeline and 4+ agent reviewer chain should be compressed to 5 gates with a 3-tier risk-based review model.
5. The permanent design-token authority ruling should not be forced now from prose alone; an interim, pilot-scoped ruling is sufficient to proceed safely, with the permanent ruling deferred until Pilot 1 produces real evidence.

### Strong council consensus

1. Programme scope stays React-web-only, ERP-first; no Flutter/RN/Python/public work.
2. No registry now; defer until 2 real consumers exist and an owner is named.
3. No shared runtime `@starq/ui` package, ever, without proof.
4. No ecosystem-wide headless-base policy now.
5. Governance documentation should be capped at roughly one page (a short README + a testable M3 checklist), not a documentation ecosystem.
6. §10 publication controls need explicit `components.json`/registry-URL scrubbing and a pre-pilot diff baseline, if and when any shadcn artifact is ever introduced.

### Genuine unresolved disagreements

1. Radix vs Base UI, whenever a headless primitive is eventually justified (Codex/Alfred favor Radix continuity; Vision/Feasibility lean Base UI or neither) — not resolved, deliberately deferred past Pilot 1 and Pilot 2.
2. Permanent ERP design-token authority source — real 3-way conflict confirmed by all reviewers, substantively unresolved, procedurally deferred via an interim ruling.
3. Whether an ecosystem-wide headless-base policy should ever exist — deferred, not resolved.

### Founder decisions required now

1. Approve the one-sentence interim token-authority ruling (runtime `theme.css` governs for Pilot 1/2 only).
2. Authorize Gate A → Gate B (alias preflight + pilot-local, no-shared-primitive Pilot 1 design).

### Decisions deferred

1. Permanent token authority ruling (after Pilot 1 evidence).
2. Pilot 2 approach approval (reuse-existing vs headless-library Dialog) — after Path A is attempted.
3. Gate D expand/hold/stop decision.
4. Registry existence/location/owner — after 2nd consumer.
5. Global headless-base policy — after 2nd consumer.

### Recommended Pilot 1

Settings → About, pilot-local composition only. Zero changes to `web/src/components/ui/*`. Existing `Button`/`Surface`/`Badge` usage in `AboutTab.tsx` remains untouched; any new presentation need is met with a pilot-local file next to `AboutTab.tsx`. No new dependency. Acceptance includes an explicit information-hierarchy test (test #0) alongside lint/test/build/route-smoke.

### Recommended Pilot 2

Fix `AboutTab`'s inline Privacy/Terms/Licenses modal's accessibility gap. Attempt first by reusing the app's own existing `common/Modal` pattern (which already has `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape handling) — zero new dependency. Only evaluate a headless-library-based Dialog if that proves insufficient, and only with explicit Founder sign-off before adding any new package.

### Does Pilot 1 require a headless dependency?
**NO**

### Implementation authorization
**NOT AUTHORIZED — PLAN ONLY**
