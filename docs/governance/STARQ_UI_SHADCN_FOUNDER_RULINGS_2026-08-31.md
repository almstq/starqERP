# STARQ UI shadcn Programme — Founder Rulings

**Date:** 31 August 2026  
**Status:** FOUNDER DECISION RECORD  
**Basis:** Council Founder Pack, Codex Proposal v1, ChatGPT review, Vision review, Starq Feasibility review, Alfred review, Council-Consolidated Plan v2.  
**Implementation authority:** Limited only to the rulings below. No broader shadcn migration is approved.

---

## 1. Founder decision summary

The Founder accepted the recommended path:

1. **D1 — APPROVED:** use the currently shipped `web/src/theme.css` as the **interim visual/token authority for Pilot 1 and Pilot 2 only**.
2. **D2 — APPROVED:** authorize **Gate A → Gate B**: isolated alias/config preflight plus a bounded, pilot-local `Settings → About` Pilot 1.
3. **D3 — DIRECTIONAL APPROVAL:** the preferred Pilot 2 target is the `AboutTab` Privacy / Terms / Licenses inline dialog. **No Radix/Base/headless dependency is authorized now.**

These rulings intentionally do **not** approve the whole shadcn programme.

---

# 2. Decision D1 — Interim visual/token authority

## Problem

Three ERP sources materially disagree:

- `docs/UI_CONSTITUTION.md`
- `web/src/theme.css`
- packaged ERP brand-kit tokens

They differ on primary colors, typography, surface expression and related design roles.

The Founder therefore needed a temporary rule so Pilot 1 and Pilot 2 can be judged against one visual baseline without turning the experiment into a redesign.

## Options considered

| Option | Meaning | Consequence | Founder disposition |
|---|---|---|---|
| **A — Constitution interim authority** | Force pilot work toward the declared Material 3 Constitution. | Pilot becomes partly a redesign because shipped runtime already differs. | **NOT CHOSEN NOW** |
| **B — Current runtime `theme.css` interim authority** | Preserve what users see today as the pilot baseline. | Cleanest experiment; visual drift caused by pilot becomes observable. | **CHOSEN** |
| **C — Brand-kit interim authority** | Move pilot toward packaged brand colors/type. | Mixes architecture experiment with brand migration. | **NOT CHOSEN NOW** |
| **D — Reconcile all three first** | Stop and design a new permanent coherent specification first. | Clean in theory, but creates a separate design programme and blocks the experiment. | **DEFERRED** |

## Why B was chosen

The pilot is intended to test architecture and behavior, not redesign the ERP.

If tokens, typography and architecture change simultaneously, the council cannot isolate the cause of any regression. Using the shipped runtime as an interim authority gives a stable before/after reference.

## Founder ruling D1

> **For Pilot 1 and Pilot 2 only, the currently shipped `web/src/theme.css` is the interim visual/token authority. This temporary ruling does not amend or settle the permanent authority of the UI Constitution or packaged brand kit. Permanent ERP visual authority will be decided after Pilot 1 evidence is reviewed.**

---

# 3. Decision D2 — Authorize Gate A → Gate B

## Options considered

### Option A — Approve the revised bounded pilot
**Chosen.**

Authorize:

**Gate A — Preflight**
- correct the `@/*` alias/config mismatch as a separate config-only change;
- capture current lint/test/build baseline;
- apply D1 interim runtime authority.

**Gate B — Pilot 1**
- `Settings → About` only;
- pilot-local work only;
- no shared primitive mutation;
- no Radix;
- no Base UI;
- no shadcn `init`;
- no shadcn `add`;
- no `components.json`;
- no new UI dependency;
- no registry;
- no public-repository work.

### Option B — Modify the pilot to touch shared primitives or install shadcn now
**Rejected for now.**

This would destroy the clean control experiment, broaden blast radius and create rollback/dependency churn before shadcn has proven value.

### Option C — Hold the programme
**Not chosen.**

The revised pilot is sufficiently bounded and reversible to justify learning now.

## Why Option A was chosen

The existing ERP Material 3 component layer already provides the static primitives needed for the About surface. The technical review found that shadcn wrappers around shared Button/Surface/Badge could duplicate existing behavior and create app-wide blast radius.

The safer experiment is therefore:

> **prove value without introducing the thing being evaluated.**

If the pilot shows no benefit from adding a headless source later, Starq learns that with almost no architectural cost.

## Pilot 1 acceptance

Pilot 1 must satisfy all of the following:

1. `npm run lint` passes.
2. existing tests pass.
3. production build passes.
4. Settings → About route/sub-tab smoke passes.
5. before/after screenshot evidence exists.
6. information hierarchy remains recognizable as “About this ERP installation.”
7. **zero diff under `web/src/components/ui/*`.**
8. rollback is limited to the preflight/pilot-local changes only.

## Founder ruling D2

> **Authorize Gate A and Gate B: isolated alias/config preflight and a bounded Settings → About Pilot 1. Pilot 1 must introduce no headless dependency, perform no shadcn initialization, create no registry, modify no shared `web/src/components/ui/*` primitive, and make no public-repository change. Any need to cross these boundaries returns to Founder before execution.**

---

# 4. Decision D3 — Pilot 2 target, technology deferred

## Options considered

### Original Pilot 2 — `AccountDetailModal`
Not preferred.

It is financial-adjacent and already uses a better common modal pattern with dialog semantics and Escape behavior.

### Review-proposed Pilot 2 — AboutTab inline Privacy / Terms / Licenses dialog
**Chosen as the preferred target.**

It is:
- already inside the Pilot 1 surface;
- non-financial;
- low blast radius;
- a verified accessibility gap;
- better suited to proving focus and overlay behavior.

## Technology choice

The Founder did **not** choose Radix or Base UI.

The first attempt should remain pilot-local and use the good behavioral pattern already present in `common/Modal`, while adding/validating the full accessibility contract locally:

- `role="dialog"`
- `aria-modal`
- labelled title
- Escape close
- keyboard path
- **focus trap**
- **focus restoration**

Shared `common/Modal` should **not** be modified during the pilot.

If delivering that full contract locally becomes disproportionately complex, the implementer must stop and return with a focused Radix-vs-Base/headless decision.

## Founder ruling D3

> **AboutTab’s inline Privacy / Terms / Licenses dialog is accepted in principle as the preferred Pilot 2 target. No Radix, Base UI or other headless dependency is authorized at this time. Pilot 2 should first use a pilot-local accessible dialog approach. If a new headless dependency is later justified, stop and return to Founder with exact evidence before installation.**

---

# 5. Decisions explicitly deferred

The Founder does **not** need to decide these now:

- permanent ERP visual/token authority;
- Radix vs Base UI;
- any global Starq headless-base policy;
- registry creation;
- registry repository/location;
- registry owner;
- shared runtime `@starq/ui`;
- forms migration;
- shell/navigation migration;
- financial table migration;
- wider product rollout.

These become live only when the evidence trigger described by the council is met.

---

# 6. Standing constraints

Until a later Founder ruling:

- shadcn is not approved as a wholesale ERP design system;
- no big-bang UI migration;
- no shared runtime UI package;
- no registry;
- no public-repo independent migration;
- no shared primitive mutation inside Pilot 1;
- no Radix/Base ecosystem policy;
- no extension into higher-risk ERP surfaces.

---

# 7. Execution sequence now authorized

```text
Founder D1 + D2
      ↓
Gate A — alias/config preflight + baseline
      ↓
Gate B — Settings → About control pilot
      ↓
independent evidence review
      ↓
Founder reviews Pilot 1 evidence
      ↓
permanent visual authority decision
      ↓
Gate C / Pilot 2 if approved
      ↓
expand / hold / stop
```

---

# 8. Agent instruction summary

Any agent resuming this programme should read this ruling before acting.

The agent may proceed only inside D1/D2 authority.

If the agent encounters any of the following, it must stop and escalate:

- need for a new UI/headless dependency;
- need for shadcn `init` / `add`;
- need to create `components.json`;
- need to change shared `web/src/components/ui/*`;
- need to alter permanent tokens/Constitution/brand kit;
- need to change `starqERP-public`;
- need to expand beyond Settings → About;
- need to create a registry or shared package.

---

# 9. Final status

**D1:** APPROVED  
**D2:** APPROVED  
**D3:** DIRECTIONALLY APPROVED — target accepted, technology deferred  

**Programme status:** BOUNDED PILOT AUTHORIZED  
**Broad shadcn migration:** NOT AUTHORIZED  
**Founder retains final authority.**
