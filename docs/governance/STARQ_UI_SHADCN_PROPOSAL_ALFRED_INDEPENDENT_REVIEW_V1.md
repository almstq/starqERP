# STARQ UI shadcn Standardization Proposal — Alfred Independent Review V1

> **Status:** INDEPENDENT OPERATING-MODEL REVIEW — NOT APPROVED  
> **Authority:** Advisory only; Founder retains final decision authority  
> **Review baseline:** Proposal v1 — 2026-08-31, commit `c3826f27f4b6d48de1ad247f42c5b0cc2c2f0bef`  
> **Reviewer:** Alfred (independent)  
> **Independence rule honored:** No reliance on ChatGPT, Vision, AG, or later Codex explanations. Judgment is my own, grounded in the proposal text and the operating reality of Starq as described.  
> **Scope:** Read-only review. No code modified, no dependencies changed, no components created, no board state altered, no Nexus edited.

---

## 1. Executive Operability Review

**OPERATING MODEL FIT: ACCEPTABLE WITH CONDITIONS**

The proposal is broadly proportionate. It resists the tempting "standardize everything, including Flutter and the public site" impulse, and that restraint is the single most important thing about it. The conditional part is process weight: for a two-person-founders studio with rotating agents and no dedicated frontend platform team, the *governance surface* (exception records, CI census, staged gates, review cadence, registry metadata) threatens to outlive the *engineering surface* it's meant to serve.

Why not STRONG: the proposal admits 14 migration stages, 5 governance artifacts to maintain, and a reviewer chain that assumes four named agents are simultaneously available. That is not proportionate to the problem size (one ERP pilot, one dialog pilot).
Why not OVER-ENGINEERED: it stops short of building the runtime package, the registry, and the full cross-product backlog. It defers the hardest problems.
Why not UNDER-GOVERNED: it does name owners, stop conditions, rollback rules, and a Founder-ruling gate for token authority. That is more governance than most proposals here give.

Understandable by future agents? Partially. The prose is clear, but the *operational* clarity (where does a new agent put a Button?) lives in the rule in §13, which is one sentence. See §10 and §11.

---

## 2. Challenge the Architecture

Codex's stack is:

```
shadcn / headless mechanics
  → shared Starq semantic foundation and rules
    → product adapters
      → product-specific composition and identity
```

**What works.** The boundaries are genuinely useful. Separating "semantics" (status means, confirmation rules, FormField contracts) from "adapters" (Material 3 ripple, Nexus density, Hoadha bilingual) is the right abstraction. It lets each product own its visual identity without arguing over whether a "danger" status is red or amber — it's *danger*, always.

**Where it over-engineers.**

1. **The "shared Starq semantic foundation" layer is underspecified.** The proposal calls it "roles, states, accessibility, confirmation, FormField" but never says who writes it, who maintains it, where it lives, or how it version-locks without becoming a registry. If it's documentation, it drifts. If it's code, it's the registry under another name. This is the architecture's hidden platform-team obligation — someone must own that layer, and the proposal does not name that owner.
2. **"Product adapters" assumes every product can produce an adapter.** ERP's Material 3 layer is real and deep (ripple, state layers, adaptive window rules). Nexus's control-plane density is a different beast. Hoadha's bilingual/Dhivehi flows are not a thin skin. Three adapters from one shared foundation is optimistic for a studio with no dedicated frontend team.
3. **Duplicate maintenance.** Hoadha already ships 47 shadcn/Radix component files. ERP ships 18. The proposal's hybrid asks both to converge on a shared semantic layer *and* keep separate adapters. That's two codebases per component, not one. Unless the shared layer is genuinely tiny, the maintenance multiplier is real.

**Could a competent new agent add a Button without asking Founder?**  
Not today, and the proposal doesn't close the gap. The rule in §13 says "check the local Starq UI layer and internal registry" — but the registry doesn't exist yet (§8 defers it), and "local Starq UI layer" is ambiguous across products. The agent would have to infer. That's the gap. See §10.

---

## 3. Small-Studio Proportionality

Classifying each element by what Starq actually needs *now*:

| Element | Classification | Rationale |
|---|---|---|
| Shared semantic foundation (roles, states, a11y rules) | NECESSARY NOW — but minimal | A one-page "Starq UI semantics" doc with status meanings, confirmation rules, and FormField contract is enough. Code it only when two products need the same behavior. |
| Adapters (ERP M3, Nexus, Hoadha) | NECESSARY NOW — per-product, local | Keep them local. Do not share adapter code until proven common. |
| Registry | OVERHEAD / DEFER | No registry until two consumers prove the abstraction. The proposal agrees. |
| Governance rules (§13 rule, exception records) | NECESSARY NOW — minimal | One rule, one lightweight exception record template. No formal process. |
| CI census | OVERHEAD / DEFER | Report-only is correct. Do not make it blocking until the canonical replacement exists (proposal agrees). |
| Cross-product policies | USEFUL LATER | Defer until a second product adopts the shared layer. |
| Runtime `@starq/ui` package | DO NOT BUILD | See §5. |
| 14-stage migration pipeline | OVERHEAD / DEFER | The stages are sensible; the *pipeline-as-process* is not. Collapse to "pilot → expand → retire" and keep the stage table as a reference, not a gating checklist. |

**Minimum sustainable architecture:**

1. One-page Starq UI semantics (status meanings, a11y rules, confirmation contract).
2. Product-owned adapters, local to each repo.
3. Registry deferred until two consumers.
4. One agent rule, one exception record template, CI report-only.
5. Pilot → expand → retire. No staged-gate process overhead.

This gives Starq 90% of the benefit at 30% of the governance cost.

---

## 4. Registry Governance Review

**REGISTRY CREATION NOW: NO**  
**REGISTRY AFTER TWO CONSUMERS: CONDITIONAL (SUPPORT with conditions)**

I agree with deferral. The proposal's "registry after two consumers" is the right call, but I'd tighten the conditions:

**Who would own the registry?** Nobody today. The proposal defers ownership. That's honest, but it means the registry cannot be created until someone is explicitly named owner — and that naming must happen *before* the second pilot, not after. Registry without an owner is technical debt with extra steps.

**Upgrade/version burden.** Copied-source registries (shadcn's model) do not auto-update. Consumers must reconcile. For a studio where agents rotate, "reconcile" becomes "who noticed the drift?" The version burden is low until a failure happens; then it's high.

**Risk of copied components diverging.** This is the real problem the registry solves, and it's a real problem. Two agents independently extending the same primitive will diverge silently. The registry is one mitigation; a clear "canonical primitive" rule is the better one (see §10).

**What happens when an agent updates one consumer but not another?** Drift. The proposal's exception record helps, but only if agents actually write them. In practice, agents skip the record. The rule must be simpler than the record.

**Does a registry solve more problems than it creates?** For Starq today: no. The registry solves a *growth* problem (many teams, many consumers) that Starq does not yet have. It creates a *maintenance* problem (owner, versioning, docs, governance) that Starq does have. Defer.

---

## 5. Shared Runtime Package Review

Codex correctly rejects the full `@starq/ui` runtime package. Tight coupling, coordinated releases, product adapters accumulating conditionals — all valid.

**Where a tiny shared package *might* still be useful:**

- **Status semantics** (status meanings, not visual variants) — framework-neutral, stable, small.
- **Accessibility contracts** (focus-trap rules, announcement contracts) — framework-neutral, stable, small.
- **Common TypeScript types** (status union, confirmation severity, permission roles) — framework-neutral, stable, small.
- **Non-visual utilities** (e.g., a shared `aria-describedby` builder, or a `announce()` helper) — framework-neutral, stable, small.

**Separate these from "shared UI runtime package."** The value is in the *contracts and semantics*, not in a shared component runtime. I'd frame this as:

- **Shared contracts/semantics package (framework-neutral):** SUPPORT, but only after two consumers prove the same contract. Tiny, stable, low-maintenance.
- **Shared UI runtime package:** DO NOT BUILD. The proposal is right to reject this.

The distinction matters: contracts can live in a README + a tiny TS package; a runtime package requires versioning, testing, and a release cadence Starq cannot support.

---

## 6. Product Identity Review

Codex's model *mostly* protects product identity, but I'd strengthen three guardrails:

1. **ERP Material 3 identity.** The adapter must preserve ripple, state layers, motion, shape, elevation, and adaptive window rules — not just color tokens. The proposal states this, but "preserves M3 behavior" is not a testable adapter contract. **Stronger guardrail:** the ERP adapter must pass a "M3 behavior checklist" (ripple on, state layer visible, shape follows M3 spec) before any caller migration.
2. **Hoadha product identity.** Hoadha's bilingual/Dhivehi presentation and map/confidence workflows are not "product-specific composition" — they're product DNA. The guardrail "shared confirmation rules do not require identical layout" is correct but thin. **Stronger guardrail:** explicitly mark Hoadha's bilingual rendering and confidence-badge patterns as *untouchable* in the shared semantic contract.
3. **Public website identity.** The public site's "cinematic layout, network graphics, and house identity" must be explicitly excluded from *any* shared primitive — including the semantic foundation. A shared "status" primitive that leaks into the public site's marketing copy would quietly homogenize it. **Stronger guardrail:** the public site is out of scope for the shared semantic foundation entirely. Not "product-owned" — "excluded."

**Nexus control-plane density** and **Flutter-native behavior** are already explicitly excluded. Good.

One gap I'd flag: the proposal does not address **StarqShell / Nexus ResponsiveShell**. If the shared semantic foundation includes "navigation" or "shell" semantics, Nexus's control-plane density could be diluted. Explicitly exclude shell/navigation primitives from the shared foundation; they stay product-owned.

---

## 7. ERP Pilot Operability

**PILOT: ACCEPT**

The Settings → About pilot is well-scoped:

- No financial mutation.
- Small, screenshotable surface.
- Existing tests cover canonical product metadata.
- Rollback is a single commit revert.
- Acceptance tests are concrete (screenshots, keyboard, a11y DOM scan, build, bundle delta).

**Smallest useful alternative?** The pilot is already minimal. If I were tightening it further, I'd drop "Badge/status adapter" and "Separator" from the pilot and keep it to Card/Surface + Button + the About metadata surface only — but that's nitpicking. The pilot as stated is acceptable.

One addition I'd require: **before/after screenshot comparison must include the "information hierarchy" check** — not just pixel diff, but a human confirming that the About surface still reads as "About this ERP installation" and not "shadcn settings page." The proposal mentions this under "must remain visually identical" but does not make it an explicit acceptance test. Add it as test #0.

---

## 8. Review Process Burden

Codex proposes staged migration gates and multiple reviewers (§18). The process is heavy relative to the problem.

Recommended risk-based review model:

| Risk tier | Examples | Reviewers required | Cadence |
|---|---|---|---|
| LOW-risk UI | Badge, tooltip, simple status surface, Separator | Codex / implementer only; Alfred spot-check | As-needed; no formal review meeting |
| MEDIUM-risk behavioral UI | Dialog, DropdownMenu, Tooltip, FormField | Implementer + Vision (a11y) + Alfred (operability) | Weekly triage |
| HIGH-risk / financial / architectural UI | Tables, financial reports, shell/navigation, token changes | Implementer + Vision + AG + Elder + Founder | Formal gate review |

Do not assume every agent reviews every Button. The proposal's §18 chain (Codex → ChatGPT → Vision → AG → Alfred → Elder → Founder) is a *review queue*, not a per-component process. Make that explicit: the chain is for *proposals and gates*, not for individual component additions. Otherwise every Button becomes a meeting.

---

## 9. Documentation Burden

The proposal asks for:

- Architecture doc
- Repository instructions
- Registry metadata
- CI reporting
- Exception records
- Cross-product policies
- Staged-gate documentation

That's a documentation ecosystem. For a small studio, it becomes harder to maintain than the UI itself.

Classification:

| Artifact | Treatment |
|---|---|
| Architecture doc | CANONICAL — one living doc, kept thin |
| Repository instructions | MINIMAL — a 3-line README in `web/src/components/ui/` (see §11) |
| Registry metadata | GENERATED — only when registry exists |
| CI reporting | GENERATED — report-only census, no docs |
| Exception records | MINIMAL — one-line template (product, primitive, reason, owner, date, temporary/permanent) |
| Cross-product policies | OPTIONAL — defer until second consumer |
| Staged-gate docs | AVOID as process docs; keep the stage table as a reference in the architecture doc only |

**The one-page rule.** If the combined governance documentation exceeds one page of actual reading, it's too heavy. Starq's documentation budget is small. Spend it on the semantics doc and the adapter contract; everything else should be generated, minimal, or deferred.

---

## 10. Agent Operating Rule

Codex proposes:

> Before creating a reusable UI primitive, check the local Starq UI layer and internal registry. Extend the canonical primitive unless a documented product-specific exception applies.

**Sufficient for rotating agents? No.** The rule has three ambiguities that a rotating agent cannot resolve alone:

1. "Local Starq UI layer" — which product's layer? ERP's? Nexus's? Hoadha's? The agent must know which repo they're in and which layer applies.
2. "Internal registry" — the registry doesn't exist yet (§8 defers it). The rule points to a moving target.
3. "Documented product-specific exception" — the agent must know where exceptions are documented and whether their use case is covered.

**Clearer rule (short):**

> When adding a UI primitive: first check `web/src/components/ui/README.md` for the canonical primitive in this repo. If one exists and your use-case is not in the exception list, extend it. If no canonical primitive exists and your use-case is product-specific, create it locally and add a one-line exception record. If you are unsure, ask the implementer of the last shared primitive in this repo.

This rule is:
- repo-specific (no cross-product ambiguity),
- registry-agnostic (works before the registry exists),
- exception-driven (not record-heavy),
- escalation-based (the fallback is a person, not a process).

---

## 11. Failure / Bus-Factor Test

Scenario: Codex unavailable, Elder away, six months pass, a new AI coding agent opens `starqERP`.

**Can the agent safely understand:**

| Question | Answer today | Gap |
|---|---|---|
| Which UI primitive is canonical? | ❌ No canonical primitive exists yet; the shared semantic foundation is not code | A canonical primitive must exist and be documented in `web/src/components/ui/README.md` |
| Which visual system controls? | Material 3 (via ERP adapter) — but the adapter contract is not formalized | Write the M3 behavior checklist as part of the adapter contract |
| Whether Radix/Base is allowed? | Radix continuity per proposal | State this explicitly in README.md |
| Where to put a new component? | `web/src/components/ui/` — but no rule about when to extend vs. create | The §10 clearer rule, posted in README.md |
| Whether it should be shared? | Defer until two consumers — but the agent has no way to know | Maintain a "shared candidates" list (one page) in README.md |
| What must remain product-specific? | ERP M3 behavior, Nexus density, Hoadha bilingual — but not formalized | Add a "product-owned" section to README.md |
| How to roll back? | Revert the commit — but no recorded baseline | Capture the regression baseline (§11) and store it; the rollback instruction is "revert to last green baseline" |

**Missing operational controls:**

1. `web/src/components/ui/README.md` — 3 lines: canonical primitive, rules, where to find exceptions.
2. A "shared candidates" one-pager (status meanings, confirmation rules, FormField contract).
3. The M3 behavior checklist (ripple, state layer, shape, motion, adaptive window).
4. Recorded regression baseline (§11) — stored, not just committed.

Without these four, the bus-factor test fails. With them, a competent new agent can operate safely for 80% of cases.

---

## 12. Cost / Benefit Test

**Benefits likely to materialize quickly:**
- Accessible dialogs (Pilot 2).
- Consistent status semantics across ERP (shared contracts).
- Reduced duplicate primitive creation in ERP.
- A documented adapter contract that future agents can follow.

**Benefits that are speculative:**
- Registry efficiency (registry deferred).
- Cross-product consistency (only one product in pilot).
- Reduced agent coordination burden (governance overhead may increase it).
- "Ecosystem standardization" benefit (Starq is not yet an ecosystem).

**Costs likely to appear immediately:**
- Token reconciliation (requires Founder ruling + design work).
- Alias correction (Vite/TS mismatch).
- Shadcn/Radix initialization and dependency audit.
- Regression baseline capture (screenshots, DOM scans, bundle metrics).
- Pilot implementation + review + rollback testing.

**Hidden long-term costs:**
- Exception record maintenance (agents skip it; drift accumulates).
- Registry ownership (if created) — a person-hour per month.
- Documentation ecosystem (§9) — scales faster than the UI.
- Adapter maintenance (three adapters for one shared foundation).
- Process overhead (staged gates, review cadence, review meetings).

**Does this programme reduce future agent work, or merely move complexity into a new UI platform layer?**  
It does both — but the *net* effect depends entirely on execution discipline. If Starq maintains the one-page rule (§9), keeps the registry deferred, and uses the §10 simpler agent rule, the programme reduces future agent work. If Starq builds the registry, the runtime package, and the full staged-gate process, it merely moves complexity into a new platform layer. The proposal's *recommendations* lean toward the former; the proposal's *process* leans toward the latter. The risk is in the gap between them.

---

## 13. Founder Decisions

**Required before any implementation:**

1. **ERP visual/token authority** (A: Constitution; B: current runtime; C: reconciliation). The proposal is honest that this is unresolved. This is the single prerequisite for every downstream decision. *No token work begins without it.*
2. **React headless-base policy** (Radix continuity vs. Base UI). The proposal recommends Radix continuity; I agree, given Hoadha's existing Radix investment. *Choose now to avoid dual-base drift.*
3. **Authorize bounded pilot work.** The pilot is scoped and rollbackable. *Approve only after decisions 1 and 2 are made.*

**Decisions that should be deferred:**

1. Registry creation and location.
2. Runtime utility package scope.
3. Product rollout order after ERP.
4. Base UI exception policy for future greenfield apps.

**Decisions agents should resolve without Founder:**

1. Which canonical primitive to extend (per the §10 rule).
2. Whether to open a one-line exception record.
3. Whether a new primitive is product-specific or shared (default: product-specific until two consumers prove otherwise).
4. Pilot implementation details (component selection within the pilot scope).

Do not merely copy Codex's decision table — the table is correct, but the *agent-resolvable* decisions must be explicit, or agents will escalate every Button to Founder.

---

## 14. Final Alfred Verdict

**ALFRED INDEPENDENT REVIEW — SHADCN PROPOSAL V1**

**Overall verdict: SUPPORT WITH CONDITIONS**

**Operating-model fit: ACCEPTABLE**

**What Codex got right:**
- Explicitly excludes Flutter, React Native, Python/server-rendered, legacy, and derived surfaces. That restraint is rare and correct.
- Honest exposure of the token-authority conflict (§4) rather than papering over it.
- Bounded, rollbackable pilot (§10).
- Registry deferred until two consumers (§8).
- Staged migration with rollback at every gate (§9).
- Correct rejection of the runtime `@starq/ui` package (§5).

**Where Codex over-engineered:**
- 14-stage migration pipeline presented as process rather than reference.
- Review chain (§18) assuming four named agents simultaneously available.
- "Shared Starq semantic foundation" left as a documentation abstraction without an owner, a location, or a maintenance model.
- Documentation ecosystem (§9) that would become harder to maintain than the UI itself.

**Where Codex under-governed:**
- Agent operating rule (§13) is one sentence with three ambiguities.
- No `README.md` in `web/src/components/ui/` for new-agent onboarding.
- No "shared candidates" one-pager for the shared semantic foundation.
- No explicit exclusion of shell/navigation primitives from the shared foundation (Nexus control-plane density risk).
- No formal M3 behavior checklist for the ERP adapter contract.
- No bus-factor documentation (§11).

**Minimum sustainable architecture:**

1. One-page Starq UI semantics doc (status meanings, a11y rules, confirmation contract).
2. `web/src/components/ui/README.md` — 3 lines: canonical primitive, rules, exceptions.
3. ERP adapter with M3 behavior checklist; local to ERP repo.
4. Registry deferred; no runtime package.
5. Pilot → expand → retire; staged gates as a reference table, not a process.
6. CI report-only census; no blocking enforcement.
7. One-line exception record template; no formal exception-review process.
8. Founder rules on token authority and base policy before any code.

**Registry:** now: NO; later: CONDITIONAL (only after two consumers prove the abstraction, with an explicit owner named before the second pilot).

**Pilot:** accept (Settings → About; add "information hierarchy" as test #0).

**Review cadence:**
- Low-risk UI: implementer self-approves; Alfred spot-checks monthly.
- Medium-risk behavioral UI: weekly triage (implementer + Vision + Alfred).
- High-risk / financial / architectural: formal gate review (implementer + Vision + AG + Elder + Founder).

**Founder decisions genuinely required:**
1. ERP visual/token authority (A/B/C).
2. Radix vs. Base UI policy.
3. Pilot authorization (after 1 and 2).

**Alfred recommendation (10 bullets):**

1. **Accept the pilot** but add "information hierarchy" as explicit acceptance test #0.
2. **Defer the registry** — name an owner *before* the second pilot, or the registry never ships.
3. **Do not build the runtime `@starq/ui` package.** Shared contracts yes; runtime package no.
4. **Write the §10 agent rule shorter** — repo-specific, registry-agnostic, escalation-based. Post it in `web/src/components/ui/README.md`.
5. **Create a 3-line `README.md`** in `web/src/components/ui/` (canonical primitive, rules, exceptions) to close the bus-factor gap.
6. **Write a one-page Starq UI semantics doc** (status meanings, a11y rules, confirmation contract) — code it only when two products need the same behavior.
7. **Add an M3 behavior checklist** to the ERP adapter contract (ripple, state layer, shape, motion, adaptive window).
8. **Collapse the staged-gate pipeline** from a process to a reference table; keep only three gates: baseline, pilot, expand.
9. **Reduce the review chain** to risk-tiered tiers (§8); do not require all named agents for every component.
10. **Cap governance documentation at one page** (§9); generate or defer everything else.

**Implementation authorization: NO — independent review only.**

---

*Reviewer: Alfred | Date: 2026-08-31 | Baseline: Proposal v1, commit `c3826f27f4b6d48de1ad247f42c5b0cc2c2f0bef`*
*This review is advisory. Founder retains final decision authority.*
