# STARQ UI Standardization — Founder Decision Pack V1

**Date:** 31 August 2026  
**Status:** READY FOR FOUNDER REVIEW — NOT APPROVED / PLAN ONLY  
**Baseline:** Proposal v1 @ `c3826f27f4b6d48de1ad247f42c5b0cc2c2f0bef`

## Executive recommendation

Approve a tightly bounded Gate A → Gate B programme.

- Pilot 1 uses **no new headless dependency**.
- No shadcn `init` / `add`.
- No `components.json`.
- No changes under `web/src/components/ui/*`.
- No registry.
- No public-repository work.
- Use shipped `web/src/theme.css` as **interim** authority for Pilot 1/2 only.
- Defer permanent visual authority and Radix/Base until evidence makes them live.

## Required Founder decisions now

1. **Interim visual authority:** runtime `theme.css` governs Pilot 1/2 only; permanent authority remains open.
2. **Gate A → Gate B:** authorize alias/config preflight + pilot-local Settings → About control experiment.

## Central technical finding

Pilot 1 should not be a shadcn migration. The current ERP M3 layer already provides the static primitives needed. A headless dependency becomes relevant only when a real behavioral primitive needs it.

## Pilot 1

Settings → About, pilot-local only.

- existing shared Button/Surface/Badge may be consumed unchanged;
- zero diff under `web/src/components/ui/*`;
- lint/test/build green;
- route/sub-tab smoke;
- before/after information-hierarchy screenshot check;
- no dependency/config/platform expansion except the separate alias preflight.

## Pilot 2

Use AboutTab’s inline Privacy/Terms/Licenses dialog.

**Pack correction:** pattern it on the accessible parts of `common/Modal`, but implement focus trap + focus restoration locally. Do not modify shared `common/Modal` during the pilot. If that becomes disproportionately complex, stop and evaluate a headless Dialog; only then does Radix vs Base become live.

## Strong council consensus

- React-web-only scope.
- Preserve the existing ERP Material 3 layer.
- No registry now.
- No shared runtime `@starq/ui`.
- No global headless-base policy now.
- Five operating gates, not 12–14 stages.
- Risk-tiered review, not every agent on every component.
- Minimal governance only.
- §10 remains one-way private → stripped-public.

## Deferred

- permanent visual authority;
- Radix vs Base;
- registry existence/location/owner;
- rollout beyond Pilot 1/2;
- forms, shell/navigation, financial tables.

## Proposed board shape

1. ERP UI preflight.
2. Settings → About control pilot.
3. About inline dialog accessibility pilot.

## Evidence set

- Codex Proposal v1
- ChatGPT Independent Review v1
- Vision Independent Review v1
- Starq Feasibility Review v1
- Alfred Independent Review v1
- Council-Consolidated Plan v2

Implementation authorization: **NOT AUTHORIZED — FOUNDER RULING REQUIRED.**
