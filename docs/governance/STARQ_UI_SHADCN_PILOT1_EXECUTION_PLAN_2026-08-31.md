# STARQ UI shadcn Programme — Pilot 1 Execution Plan

**Date:** 31 August 2026  
**Status:** FOUNDER-AUTHORIZED BOUNDED PILOT  
**Scope:** Gate A → Gate B only  
**Canonical governance folder:** `D:\StarqTech\starqERP\docs\governance`

## Required authorities to read before action

1. `STARQ_UI_SHADCN_FOUNDER_DECISION_PACK_V1_2026-08-31.md`
2. `STARQ_UI_SHADCN_FOUNDER_RULINGS_2026-08-31.md`
3. `STARQ_UI_SHADCN_COUNCIL_CONSOLIDATED_PLAN_V2.md`
4. `STARQ_UI_SHADCN_STANDARDIZATION_PROPOSAL.md` — historical Proposal v1 only; superseded where later Founder rulings/council evidence conflict.

Authority order for this pilot:

**Founder rulings > Founder decision pack > Council V2 > Proposal v1 > reviewer recommendations**

---

# 1. Pilot objective

Pilot 1 is a **control experiment**, not a shadcn migration.

The purpose is to prove that the `Settings → About` surface can be improved/recomposed safely while:

- preserving the currently shipped ERP visual identity;
- preserving the existing Material 3 UI layer;
- touching no shared UI primitive implementation;
- adding no headless dependency;
- performing no shadcn initialization;
- creating no registry;
- producing a clean rollback boundary.

The pilot must answer:

> Can Starq execute a bounded UI-standardization experiment without creating platform coupling, shared-primitives blast radius or visual drift?

---

# 2. Founder authority in force

## D1 — interim visual authority

For Pilot 1 and Pilot 2 only:

`web/src/theme.css`

is the interim visual/token authority.

This is temporary. It does not settle the permanent conflict with the UI Constitution or brand kit.

## D2 — Gate A → Gate B

Founder authorized:

- one isolated alias/config preflight;
- one bounded `Settings → About` Pilot 1;
- pilot-local work only.

Not authorized:

- Radix;
- Base UI;
- shadcn `init`;
- shadcn `add`;
- `components.json`;
- any new UI/headless dependency;
- registry work;
- shared runtime package;
- mutation of `web/src/components/ui/*`;
- independent public-repository work;
- migration beyond Settings → About.

---

# 3. Gate A — preflight

## 3.1 Re-read current repo state

Before mutation:

- verify current branch and HEAD;
- verify working tree status;
- identify all untracked governance review artifacts;
- do not absorb unrelated untracked files into the implementation commit.

## 3.2 Capture baseline

From `web/` run:

- `npm run lint`
- `npm test`
- `npm run build`

Record the exact result.

Also capture:

- `git status --short`
- a baseline list/stat of `web/src/components/ui/*`
- a baseline diff/stat sufficient to prove Gate B did not mutate shared primitives.

## 3.3 Alias/config preflight

Current evidence says:

- Vite alias `@` resolves to `src`;
- TypeScript path mapping is inconsistent;
- the mismatch is currently latent because current source does not rely on `@/` imports.

Implement the **smallest config-only correction** necessary to align TypeScript/Vite resolution.

Do not mix this correction with UI code.

After the correction run:

- `npm run lint`
- `npm test`
- `npm run build`

### Gate A stop conditions

STOP and report before Gate B if:

- config correction requires source rewrites;
- existing imports break;
- lint/tests/build regress;
- the change is broader than the isolated alias/config debt;
- unrelated working-tree drift appears.

### Gate A exit

Gate A passes only when:

- config is aligned;
- baseline remains green;
- change is independently reversible;
- no UI code was changed.

---

# 4. Gate B — Settings → About Pilot 1

## 4.1 Exact surface

Primary surface:

`web/src/components/settings/AboutTab.tsx`

The pilot may create **pilot-local** helper/presentation files adjacent to the About surface if genuinely needed.

Example acceptable location:

`web/src/components/settings/about/`

No new file is required merely for architecture ceremony. Prefer the smallest implementation.

## 4.2 Shared primitives are read-only

Pilot 1 may continue to **consume** existing:

- `Button`
- `Surface`
- `Badge`

as they exist today.

Pilot 1 must not modify:

`web/src/components/ui/*`

including:

- `Button.tsx`
- `Surface.tsx`
- `Badge.tsx`
- `index.ts`
- any other shared primitive.

A diff under this directory is an automatic Gate B failure unless Founder explicitly re-authorizes scope.

## 4.3 No new dependency

Pilot 1 must not:

- install Radix;
- install Base UI;
- install shadcn-related helper packages;
- run shadcn CLI;
- generate `components.json`;
- add a registry;
- create a shared `@starq/ui` package.

If the implementer believes any dependency is necessary, STOP and return evidence to Founder.

## 4.4 Visual requirement

The current runtime remains the visual baseline.

Do not:

- reconcile Constitution/runtime/brand-kit during Pilot 1;
- change global tokens;
- change fonts;
- change the general ERP visual language;
- redesign About into a generic shadcn page.

The information hierarchy must remain recognizably:

> **About this ERP installation**

not a generic Settings showcase.

## 4.5 What work is allowed

Allowed work is limited to a small, meaningful About-surface improvement or recomposition that demonstrates:

- clean local component composition;
- consistent use of current ERP M3 semantics;
- zero shared-primitive mutation;
- clear rollback;
- maintainable local implementation.

Do not invent work merely to produce a diff.

If the current About surface does not need a meaningful static change, document that finding rather than forcing one.

---

# 5. Pilot 1 acceptance evidence

Pilot 1 is accepted only if all of the following are demonstrated.

## Build / regression

- `npm run lint` — PASS
- `npm test` — PASS
- `npm run build` — PASS

## Scope

- Settings → About only.
- No unrelated domain files changed.
- Zero diff under `web/src/components/ui/*`.
- No new dependency.
- No package/lockfile churn except if unavoidable for an already-authorized non-UI reason — otherwise FAIL.
- No `components.json`.
- No shadcn init/add.
- No registry.

## Visual / UX

- Before screenshot.
- After screenshot.
- Current `theme.css` visual expression preserved.
- Information hierarchy preserved.
- No unexpected light/dark drift on the pilot surface.

## Runtime

- route/sub-tab smoke passes;
- browser console has no new errors attributable to the pilot.

## Rollback

- Gate A can be reverted independently.
- Gate B can be reverted independently.
- Revert does not require restoring unrelated product code.

---

# 6. Review tier

Pilot 1 is **LOW–MEDIUM risk**.

Required:

- implementer self-verification;
- automated lint/test/build;
- one independent spot-check reviewer before Founder acceptance.

Do not require the entire council for this pilot.

The implementer may not claim independent acceptance of their own work.

---

# 7. Evidence deliverable

Create a durable report:

`D:\StarqTech\starqERP\docs\governance\STARQ_UI_SHADCN_PILOT1_EXECUTION_REPORT_2026-08-31.md`

Report structure:

1. authority read;
2. starting branch / HEAD / working tree;
3. Gate A change;
4. baseline before/after;
5. Gate B exact files changed;
6. screenshot evidence locations;
7. lint/test/build results;
8. shared-primitives zero-diff proof;
9. dependency/package proof;
10. rollback proof;
11. deviations / surprises;
12. independent-review status;
13. recommendation:
   - ACCEPT PILOT
   - ACCEPT WITH CONDITIONS
   - REVERT / REJECT
14. implementation boundary:
   - no Pilot 2 / no broader migration without next Founder direction.

---

# 8. Commit discipline

Gate A and Gate B should remain logically separable.

Preferred:

- one focused Gate A config/preflight commit;
- one focused Gate B pilot commit.

Do not bundle unrelated governance artifacts, existing untracked review files or unrelated repo changes into either commit.

Do not push unless the Founder instruction to the executing agent explicitly authorizes push.

---

# 9. Mandatory stop-and-escalate conditions

STOP before proceeding if any of these occurs:

- need for Radix/Base/headless dependency;
- need for shadcn CLI;
- need for `components.json`;
- need to modify shared `web/src/components/ui/*`;
- need to modify permanent visual tokens or design-authority documents;
- need to modify `starqERP-public`;
- need to touch another ERP domain;
- baseline lint/test/build fails;
- rollback ceases to be isolated;
- About requires a broader design rewrite;
- unanticipated repository drift makes the bounded evidence unreliable.

---

# 10. Completion definition

Pilot 1 is complete when:

- Gate A passes;
- Gate B passes;
- evidence report exists;
- changes remain bounded and reversible;
- one independent reviewer has checked the evidence;
- Founder receives the result.

Pilot 1 completion does **not** authorize:

- Pilot 2;
- Radix/Base;
- shadcn adoption;
- registry;
- broader ERP UI migration.

Those remain separate future decisions.
