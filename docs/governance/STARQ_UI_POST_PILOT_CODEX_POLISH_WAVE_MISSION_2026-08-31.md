# Codex Mission — Post-Pilot UI Polish Recon + Execution Wave

**Repository:** `D:\StarqTech\starqERP`  
**Canonical governance folder:** `D:\StarqTech\starqERP\docs\governance`

Founder direction: **polish, not conversion**.

The target is not “make starqERP a shadcn app.” The target is:

> **Make starqERP feel as smooth, coherent, accessible and interaction-polished as a top-tier shadcn application while preserving Starq UI / Material 3 Expressive identity and the existing product architecture.**

## 0. Read current authority first

Read these in order:

1. `STARQ_UI_CANONICAL_FRONTEND_STACK_V1_2026-08-31.md`
2. `STARQ_UI_SHADCN_FOUNDER_RULINGS_2026-08-31.md`
3. `STARQ_UI_POST_PILOT_FOUNDER_VISUAL_INTERACTION_AMENDMENT_2026-08-31.md`
4. `STARQ_UI_SHADCN_PILOT1_EXECUTION_REPORT_2026-08-31.md`
5. `STARQ_UI_SHADCN_PILOT2_EXECUTION_REPORT_2026-08-31.md`
6. `STARQ_UI_SHADCN_COUNCIL_CONSOLIDATED_PLAN_V2.md`
7. `STARQ_UI_SHADCN_FOUNDER_DECISION_PACK_V1_2026-08-31.md`

Historical Proposal v1 is background only where later authority does not supersede it.

## 1. Current canonical UI stack

Treat this as the working stack:

- React `^19.0.1`
- React DOM `^19.0.1`
- React Router `^7.18.2`
- Vite `^6.2.3`
- TypeScript `~5.8.2`
- Tailwind CSS `^4.1.14` + `@tailwindcss/vite`
- Starq-owned Material 3 primitives in `web/src/components/ui/*`
- feature-local components for feature-specific composition/behavior
- Lucide React `^0.546.0`
- Recharts `^3.10.1`
- native React/local-domain forms
- custom Starq Table/DataTable + direct HTML tables
- npm + existing `package-lock.json`
- `@/*` aligned to `src/*`
- no mandatory Radix/Base/React Aria/Headless UI
- no `components.json`
- no shadcn CLI requirement
- no registry
- no `@starq/ui`
- private ERP canonical; public repo derived only

Design identity:

**Starq UI — Material 3 Expressive**

Quality target:

**shadcn-quality interaction and compositional polish**

## 2. First duty — independently verify Pilot 1 and Pilot 2

Before expanding scope, inspect the actual three local implementation commits:

- Gate A: `da6ff3cf7fca4fc6fd1d6aa74f4d2b40b90cc330`
- Pilot 1: `e424da8180752596f491a1c9162733c1a58923cb`
- Pilot 2: `ffef3c578a8d8ec7bf06ba79b9be10f6dad363ad`

Confirm or challenge:

- no unintended shared-UI mutation;
- no dependency/lockfile churn;
- alias correction is valid;
- About primitives remain local;
- About legal dialog accessibility implementation is sound;
- focus trap/restoration logic is not brittle;
- no scope leak;
- rollback remains clean.

If a material Pilot 1/2 defect exists, STOP expansion and report it.

If both are sound, continue.

## 3. Update the About stack declaration

The current About screen still presents the old architecture too narrowly.

Do not overload the screen, but update the product metadata so it accurately reflects the new canonical stack.

Preferred concise display:

- **Design System:** `Starq UI — Material 3 Expressive`
- **Frontend Stack:** `React 19 · TypeScript 5.8 · Vite 6 · Tailwind CSS 4`
- **UI Architecture:** `Starq-owned M3 primitives · product-local composition`
- **Interaction Standard:** `Accessibility-first · keyboard/focus managed · shadcn-quality polish`

The full “Copy System Information” payload should include:

- React / React DOM / Router versions
- Vite / TypeScript / Tailwind
- UI system and theme authority
- component ownership model
- icons / charts
- forms / tables approach
- headless runtime: none required
- shadcn runtime: not mandatory
- registry: none
- package manager
- private/public publication model
- current build/environment metadata already present

Keep this product-facing and factual. Do not turn the About page into a governance essay.

## 4. Post-pilot recon — find the remaining polish gap

Perform a fresh evidence-based UI reconnaissance against the **post-Pilot-2 code**, not Proposal v1 assumptions.

The Founder amendment named above is mandatory for this reconnaissance. In particular, classify all second-level and third-level navigation by semantic type before consolidating it, and return its required surface/caller matrix before mutation. Treat Settings nested navigation as application/sidebar navigation, not generic content tabs. Include the dashboard Welcome Card four-region composition in the reconnaissance and responsive plan.

Question:

> **What still prevents starqERP from feeling as smooth, coherent and interaction-polished as a top-tier shadcn application?**

Inspect the active ERP web UI for recurring issues in:

- dialogs / overlays / drawers / dropdowns;
- focus and keyboard behavior;
- hover / pressed / focus / disabled states;
- loading / empty / error / success feedback;
- raw button / input / select visual and behavioral drift;
- navigation active state and transition polish;
- form validation and field-feedback consistency;
- table hover / selection / focus / overflow behavior;
- motion / reduced-motion;
- 200% zoom and narrow-window resilience;
- one-off spacing/radius/elevation inconsistencies;
- duplicated local patterns that have now proven genuine reuse.

Do not judge by raw occurrence count alone. Rank each finding by:

**user-visible value × recurrence × accessibility impact × blast radius × rollback confidence**

## 5. Produce a short execution matrix before mutation

For every proposed change, record:

`ITEM | EVIDENCE | USER VALUE | FILES/CALLERS | RISK | ROLLBACK | EXECUTE NOW / DEFER`

Do not build a new 50-item migration backlog.

Select only the highest-confidence fixes that materially improve polish today.

## 6. Founder-authorized execution envelope

If Pilot 1/2 verification passes, you may execute a **bounded polish wave** without returning for each low/medium-risk fix, subject to all rules below.

### Authorized

- local accessibility fixes;
- keyboard/focus fixes;
- consistent interaction states;
- local loading/empty/error/success treatment;
- local navigation polish;
- low/medium-risk visual consistency fixes using existing tokens/classes;
- reduced-motion handling;
- responsive/zoom fixes;
- local deduplication where reuse is proven;
- About stack declaration update;
- tests supporting those changes.

### Not authorized without stopping

- new UI/headless dependency;
- Radix/Base adoption;
- shadcn `init` / `add`;
- `components.json`;
- registry;
- `@starq/ui`;
- permanent global token/color/font redesign;
- changing ledger/business/financial semantics;
- changing tenant/auth/security behavior;
- replacing a shared primitive without caller census + regression evidence;
- introducing a new form/table framework;
- independent `starqERP-public` changes;
- broad rewrite.

If one of those is genuinely needed, STOP and return the exact evidence/decision required.

## 7. Shared-primitives rule

`web/src/components/ui/*` is no longer categorically untouchable after the pilots, but it is **high-blast-radius**.

You may modify a shared primitive only when all are true:

1. the recon proves a recurring defect/value across multiple real callers;
2. caller census is recorded;
3. the change preserves existing prop contracts unless explicitly justified;
4. targeted tests exist or are added;
5. before/after visual/behavior evidence is captured;
6. lint/tests/build remain green;
7. rollback is one focused commit.

Otherwise keep the fix local.

## 8. Financial-surface rule

You may improve purely presentational/accessibility behavior on financial screens if the underlying accounting/data/business behavior is untouched.

Do not alter:

- calculations;
- posting behavior;
- validation semantics tied to accounting rules;
- money precision;
- tax logic;
- settlement;
- tenancy;
- permissions;
- financial workflow state transitions.

Any such need is a STOP condition.

## 9. Validation proportionality

For every executed fix:

- lint;
- relevant tests;
- production build;
- target-route smoke;
- browser console;
- keyboard/focus where relevant.

For shell/navigation/shared primitives additionally check:

- light/dark;
- representative desktop + narrow viewport;
- 200% zoom where practical;
- reduced-motion if motion exists.

Do not build a new testing platform today.

## 10. Commit discipline

Keep commits coherent by behavior/family.

Do not squash the existing three pilot commits.

Do not mix unrelated governance files into product commits.

Do not push yet.

## 11. Durable output

Create:

`D:\StarqTech\starqERP\docs\governance\STARQ_UI_POST_PILOT_POLISH_WAVE_EXECUTION_REPORT_2026-08-31.md`

Include:

1. Pilot 1/2 independent verification;
2. post-pilot recon findings;
3. ranked execution matrix;
4. changes executed;
5. changes deliberately deferred;
6. shared-primitive caller census where applicable;
7. lint/test/build results;
8. route / interaction / visual evidence;
9. dependency proof;
10. rollback plan;
11. remaining blockers;
12. recommendation:
   - READY FOR FINAL FREEZE REVIEW
   - READY WITH CONDITIONS
   - MORE POLISH WAVE REQUIRED
   - REVERT RECOMMENDED

## 12. Final response

Return:

### PILOT VERIFICATION
Pilot 1: PASS / FAIL  
Pilot 2: PASS / FAIL

### CANONICAL STACK
Confirmed / challenged

### TOP REMAINING POLISH GAPS
1.
2.
3.
...

### EXECUTED NOW
1.
2.
3.
...

### DEFERRED
1.
2.
...

### VALIDATION
- lint
- tests
- build
- key routes
- keyboard/focus
- light/dark
- zoom/responsive
- console

### GIT
- starting SHA
- new commits
- branch
- pushed: NO

### REPORT
- path

### RECOMMENDATION
READY FOR FINAL FREEZE REVIEW / other

STOP after this wave.

Do not start a second autonomous wave. The next executor will be Starq Feasibility / VS Code for final freeze verification.
