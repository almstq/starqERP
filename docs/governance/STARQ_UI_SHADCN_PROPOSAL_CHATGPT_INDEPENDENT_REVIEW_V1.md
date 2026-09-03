# STARQ UI shadcn Standardization Proposal — ChatGPT Independent Review V1

> **Status:** INDEPENDENT STRATEGIC / ARCHITECTURE REVIEW — NOT APPROVED  
> **Authority:** Advisory only; Founder retains final decision authority  
> **Review baseline:** Proposal v1 — 2026-08-31, commit `c3826f27f4b6d48de1ad247f42c5b0cc2c2f0bef`  
> **Reviewer:** ChatGPT  
> **Scope:** Strategic coherence, hidden assumptions, proportionality, Founder decision framing, review/governance design  
> **Implementation authority:** NONE — review only

---

## 1. Executive verdict

**Overall verdict: SUPPORT WITH CONDITIONS**

The proposal is fundamentally sound as a direction for the **active Starq React web ecosystem**, provided it is interpreted as a progressive, reversible standardization programme rather than a universal visual redesign or a mandatory shared runtime UI platform.

The strongest architectural idea is:

```text
headless mechanics
→ shared semantics/rules
→ product-owned adapter
→ product-specific composition and identity
```

That model preserves local product identity while allowing common accessibility and interaction mechanics to improve over time.

However, several recommendations should be narrowed before Founder approval:

1. Do **not** turn Radix into an ecosystem-wide policy yet.
2. Do **not** create a registry or shared runtime `@starq/ui` package now.
3. Do **not** force the Founder to choose the ERP visual/token authority from prose alone.
4. Do **not** interpret the full regression programme as mandatory for every small UI migration.
5. Keep the first ERP pilot ruthlessly small and reversible.
6. Preserve §10 private→stripped-public publication controls as a permanent gate.
7. Do not create programme-wide board work until the independent review cycle is complete.

---

## 2. What the proposal gets right

### 2.1 Correct scope boundary

The proposal correctly distinguishes the **Starq React web ecosystem** from the entire Starq software ecosystem.

The following should not be forced through the same shadcn source-component programme:

- Flutter products;
- React Native;
- Python/server-rendered applications;
- legacy/copies;
- stripped public derivatives.

This is a critical restraint. Standardization should target relevant React web surfaces only.

### 2.2 shadcn should not become Starq’s visual identity

The proposal is strongest when it treats shadcn as:

- component mechanics;
- accessible headless behavior;
- source-distribution conventions;
- optional registry semantics later;

while preserving each product’s own visual language.

ERP should remain Material 3 governed.  
Nexus should remain a control-plane UI.  
Hoadha should preserve its own product identity and bilingual behavior.  
The public website should preserve its independent visual presentation.

### 2.3 Hybrid architecture is the safest likely direction

The hybrid model is preferable to:

- no standardization at all;
- independent shadcn implementations everywhere;
- a tightly coupled runtime `@starq/ui` package;
- a premature central registry.

The important boundary is that product adapters and compositions remain local until repeated cross-product evidence proves a shared abstraction.

### 2.4 Registry deferral is correct

No registry should be created now.

A registry should only become live after at least **two real consumers** demonstrate the same semantic and behavioral contract.

Until then:

- keep adapters local;
- record candidate shared semantics;
- avoid new repository/platform ownership;
- avoid versioning and distribution infrastructure.

Registry location is therefore **not a Founder decision today**.

### 2.5 The proposed ERP Settings → About pilot is appropriately bounded in concept

A first experiment should avoid:

- ledger posting;
- settlement;
- tenant provisioning;
- shell/navigation;
- forms;
- data-heavy tables;
- financial output.

A small Settings → About slice is directionally correct because it is:

- screenshotable;
- reversible;
- non-financial;
- contained enough to test whether shadcn mechanics can sit below an ERP-owned visual adapter.

The pilot should answer:

> Can shadcn/headless mechanics be introduced without changing the approved ERP visual and behavioral contract?

It should **not** be treated as proof that the entire ERP should migrate.

---

## 3. Main strategic concerns

### 3.1 Do not make Radix an ecosystem-wide Founder ruling yet

Codex recommends Radix continuity because Hoadha already has a substantial shadcn/Radix implementation.

That supports **Radix as a plausible ERP pilot choice**.

It does **not yet prove**:

> all active Starq React web applications should adopt Radix.

Current evidence shows:

- Hoadha uses Radix;
- ERP uses neither Radix nor Base UI;
- Nexus uses neither;
- the public site uses neither.

Therefore the immediate decision should be narrower:

> Which headless base, if any, should be used for the ERP pilot?

The global policy can wait until a second meaningful consumer proves common mechanics.

### 3.2 The visual/token authority conflict is real, but Founder should not rule blind

The proposal identifies three materially conflicting ERP sources:

- UI Constitution;
- active runtime `theme.css`;
- packaged brand-kit token source.

They differ on:

- primary colour;
- typography;
- surfaces;
- accents;
- charts;
- elevation and visual expression.

This must be resolved before shared theme/token authority is established.

However, the Founder should not be forced to choose A/B/C from text descriptions alone.

Before a permanent ruling, the review council should ideally see:

- exact semantic token deltas;
- representative current runtime screenshots;
- what Constitution-authoritative output would change;
- what runtime-authoritative output would preserve;
- implications of reconciliation;
- light/dark consequences;
- print consequences;
- contrast consequences.

### 3.3 Preserve product identity through behavior, not only colors

For ERP, preserving Material 3 means more than mapping semantic variables.

Any future adapter must account for:

- ripple;
- state layers;
- motion;
- shape;
- elevation;
- focus behavior;
- disabled behavior;
- adaptive window rules;
- financial-table and print behavior where relevant.

A generic shadcn visual preset must never silently replace these contracts.

### 3.4 Avoid premature infrastructure

Do not create:

- a shared runtime `@starq/ui` package;
- a central registry;
- cross-product release/version infrastructure;
- mandatory ecosystem-wide base policies;
- large migration backlogs.

The studio should prove local value first.

---

## 4. Regression and review proportionality

The full regression baseline is useful at programme start, but should not become the repeated ceremony for every tiny migration.

### Programme-level baseline

Capture once before implementation:

- TypeScript/build/test baseline;
- key route inventory;
- representative screenshots;
- light/dark;
- accessibility baseline;
- bundle/dependency baseline;
- print-critical evidence where relevant.

### Per-migration checks

Run:

- the relevant targeted checks;
- global smoke gates;
- additional risk-specific checks only where needed.

A Badge migration should not receive the same review ceremony as a financial DataTable migration.

---

## 5. Risk-tier review model

The external reviewer’s human-effort model is useful as a **separation-of-duties model**, not as a literal calendar schedule.

### LOW-risk UI

Examples:

- Badge;
- Separator;
- tooltip;
- non-behavioral presentation primitive.

Recommended:

- implementer self-verification;
- automated checks;
- independent acceptance only where a task/gate explicitly requires it.

### MEDIUM behavioral UI

Examples:

- Dialog;
- Dropdown;
- FormField;
- focus-sensitive control.

Recommended:

- implementer;
- adversarial reviewer;
- executable/feasibility verifier;
- independent acceptance as required.

### HIGH-risk / financial / architectural

Examples:

- financial tables;
- posting forms;
- shell/navigation;
- token authority;
- publication architecture.

Recommended:

- implementer;
- Vision-style adversarial review;
- AG/feasibility execution review;
- Elder architectural review;
- Founder approval.

This preserves review independence without making every Button a council meeting.

---

## 6. §10 publication boundary

The proposal correctly identifies new risks from shadcn-style source generation and configuration.

Future UI work must continue to respect:

```text
private starqERP
→ verified stripped derivative
→ publication-integrity gate
→ public
```

Potential shadcn-related publication risks include:

- generated component source;
- `components.json`;
- internal registry URLs;
- registry auth metadata;
- private package names;
- comments/examples containing internal paths;
- lockfile dependency changes;
- source maps/debug output;
- product-specific adapter implementation;
- license/provenance of added dependencies.

No separate migration of `starqERP-public` should ever occur.

The public derivative must remain generated from approved private product state under §10.

---

## 7. Board / programme impact

Do not create the full proposed three-task programme yet.

If independent review converges, the initial implementation programme should likely begin with only:

### Task A — ERP UI foundation / authority / preflight

Purpose:

- resolve or temporarily govern visual/token authority;
- establish migration baseline;
- fix config/alias prerequisites;
- define minimal pilot acceptance.

### Task B — Bounded ERP pilot

Purpose:

- prove one isolated shadcn/headless mechanic under ERP-owned behavior;
- verify rollback;
- independently review before any expansion.

### Registry proof

**Deferred.**

Do not create a registry-proof task until:

- Pilot 1 succeeds;
- a second real consumer appears;
- the shared contract is proven rather than assumed.

---

## 8. Founder decision framing

Codex proposes three immediate Founder decisions.

My review narrows the Founder burden.

### Do not rule yet

Before independent review is complete, Founder should not yet decide:

- permanent ERP visual authority;
- global Radix policy;
- registry location;
- broader rollout order.

### Likely decisions after evidence reconciliation

The genuine Founder decision surface should be approximately:

1. **ERP visual/token authority**
   - Constitution;
   - runtime;
   - deliberate reconciliation;
   - or an explicitly temporary/interim authority if supported by evidence.

2. **ERP pilot headless choice**
   - Radix;
   - Base UI;
   - or no headless package for the first pilot if evidence shows existing M3 primitives already provide enough value.

3. **Authorize / defer / reject the bounded pilot**

Everything else should remain deferred until evidence exists.

---

## 9. Review council sequence

Recommended sequence:

1. **Codex** — Proposal v1 author.
2. **ChatGPT** — strategic / architecture challenge.
3. **Vision** — independent contradiction and evidence reproduction.
4. **Implementation-feasibility reviewer / AG** — repository reality, rollback, dependency/test impact.
5. **Alfred** — maintainability and operating-model review.
6. **Elder** — architecture/governance gate when available.
7. **Founder** — final ruling.

No reviewer majority constitutes approval.

---

## 10. Provisional position

Subject to independent review evidence:

| Question | Provisional position |
|---|---|
| Progressive standardization | **SUPPORT** |
| Hybrid architecture | **SUPPORT** |
| ERP-local adapters first | **SUPPORT** |
| Settings → About bounded pilot | **SUPPORT, subject to isolation evidence** |
| Shared runtime `@starq/ui` | **NO** |
| Registry now | **NO** |
| Registry location now | **DEFER** |
| Global Radix policy | **TOO EARLY** |
| Radix for ERP pilot | **Plausible, not yet proven** |
| Permanent token authority | **UNRESOLVED** |
| Big-bang migration | **NO** |
| starqERP-public independent migration | **NEVER** |

---

## 11. Stop conditions

Do not begin implementation if any of the following remain unresolved for the approved pilot:

- no usable visual/token authority for the pilot;
- unclear blast radius;
- inability to revert cleanly;
- unexpected global styling changes;
- hidden publication-boundary leakage;
- unresolved dependency/config conflict;
- no targeted acceptance baseline;
- pilot requires touching financial/high-risk surfaces;
- proposal scope silently expands into ecosystem infrastructure.

---

## 12. Final recommendation

### CHATGPT RECOMMENDATION — NOT APPROVED

1. Keep the programme React-web-only.
2. Treat shadcn as mechanics/source conventions, not Starq visual authority.
3. Preserve product identity locally.
4. Keep the hybrid concept, but implement it minimally.
5. Do not create a shared runtime UI package.
6. Do not create a registry until two consumers prove the abstraction.
7. Do not make Radix an ecosystem-wide policy yet.
8. Resolve or temporarily govern ERP visual authority before the pilot.
9. Run one tightly isolated ERP pilot and independently review it.
10. Expand only if the pilot produces measurable value without increasing operating burden.

> **Implementation authorization: NO — review only. Founder retains final authority.**
