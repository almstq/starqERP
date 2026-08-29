# STARQ ERP — Elder Return Core Execution Packet

**Prepared:** 2026-08-20  
**Review horizon:** Elder returns in approximately 19 hours  
**Product:** STARQ ERP only. Historical legacy/engine/POS and the Club Ignition garage client are implementation evidence/modules, not separate product streams.

## Founder direction

- Move the main STARQ ERP control spine, not the garage portal.
- Do not rebuild APK/web artifacts for every task. Keep one immutable candidate for a proper smoke gate.
- Profile & Organisation is required, but only as a server-authoritative M1 surface after M0 controls exist.
- No ad hoc board mutation. This packet proposes dispatch; Elder/founder acceptance determines live ownership and status changes.

## State Elder should verify first

1. **SERP-001 R0 remains a preflight, not a pilot/release.** The signed candidate is frozen for the later smoke test. Cloud owner allowlist is synchronized. Remaining human evidence is owner sign-in plus one safe, synthetic, nonfinancial idempotent action and audit/replay proof.
2. **SERP-024 programme board expansion is delivered but awaits Codex/Elder acceptance.** Board state remains 113 tasks / 20 epics; no mutation is authorized by this packet.
3. **M0 formal dependency:** SERP-025 depends on SERP-001 and SERP-024. SERP-026 and SERP-031 follow SERP-025; SERP-029 may prepare in parallel but formal completion still respects its gates.
4. **M1 is not tomorrow's implementation target.** SERP-040 depends on the complete SERP-039 M0 gate. Vision may prepare the Profile & Organisation gap map; AG must not build M1 UI against an unsettled server contract.

## Focused core team

| Role | Accountable lane | Tomorrow's bounded output |
|---|---|---|
| Elder / Claude | Independent product/control review and dispatch gate | Accept/reject R0/SERP-024 evidence; approve exact M0 slice boundaries; challenge tenant, session, idempotency and audit claims |
| Codex | Day-to-day technical coordination; integration and acceptance evidence | Freeze candidate/evidence manifest; reconcile DP patch; own API/data/control boundary decisions within approved scope |
| DP / Hermes | Backend/data producer | Current-state-to-patch work for SERP-026, SERP-029 and SERP-031; tests first; no deploy or business policy |
| AG | Main product client producer, held until contract gate | After Elder/Codex GO only: consume the accepted main ERP identity/tenant/profile contract; no garage iteration or per-task builds |
| Vision | Windows evidence and founder-facing QA support | Main ERP Profile & Organisation gap map and later smoke evidence; no implementation authority or release acceptance |

Exactly one accountable owner is named per dispatched slice. Sensitive work requires a non-author reviewer outside the author's model family.

## Nineteen-hour preparation window

### Lane A — R0 closure readiness (Codex; founder supplies human sign-in)

- Preserve the accepted signed candidate without rebuilding.
- Confirm owner and personal director/admin identities are server-allowlisted with distinct tenant/seat authority.
- Receive DP's safe-action/idempotent-replay runbook.
- Do not execute real business, financial, destructive or live garage actions.

### Lane B — M0 server-core preparation (DP; Codex reviews)

- Map existing Edge/migration behavior to SERP-026, SERP-029 and SERP-031 acceptance clauses.
- Produce the smallest independent tests-first patch or stop with a concrete contract blocker.
- No cloud deployment, secrets, live data, board mutation or invented roles/policy.

### Lane C — Main product surface preparation (Vision; AG held)

- Reconcile person, legal tenant, activity/brand/outlet, membership, seat/role/modules, audited tenant switch and sign-out.
- Mark existing garage-only UI as evidence, not product authority.
- Produce no UI code before M0 contract approval.

### Lane D — Elder review pack (Codex)

- Current artifact/evidence manifest.
- R0 open/closed evidence table.
- SERP-024 acceptance evidence.
- DP patch/gap report and Vision surface map.
- Named decisions requiring Elder or founder; no hidden agent blockers.

## Tomorrow's execution blocks after Elder review

### Gate 0 — 30 minutes

Elder accepts or rejects: product scope, R0 evidence boundary, SERP-024, candidate freeze and proposed ownership. No coding starts from an unresolved gate.

### Block 1 — M0 vertical control slice (up to 3 hours)

Dispatch only the accepted subset of SERP-025 → SERP-026/SERP-029 → SERP-031. Target one end-to-end server-derived principal/tenant/session/API contract with positive and negative tests. No UI build.

### Block 2 — Abuse and audit evidence (up to 3 hours)

Extend the accepted slice toward SERP-033/SERP-034: cross-tenant denial, forged-seat denial, CSRF/payload failure, same-key replay and append-only actor/tenant/seat/outcome evidence. No production deployment.

### Block 3 — Main ERP contract handoff (up to 2 hours)

Only after Blocks 1–2 are accepted, issue AG a bounded contract-consumption task for the main STARQ ERP shell. Profile & Organisation remains contract-first; no M1 completion claim before SERP-039.

### Close — 30 minutes

Codex assembles evidence; Elder performs independent review. Update board status/workers only with explicit authorization and only to reflect verified work.

## Stop conditions

- R0 or SERP-024 evidence is rejected.
- A required business/legal/role policy is not founder-defined.
- A patch needs live-data migration, production deployment, secret rotation or destructive change.
- Tenant/session/idempotency behavior cannot be proven by negative tests.
- Concurrent work touches the same files or changes the accepted server contract without coordination.

## Elder decisions requested on return

1. Accept or reject SERP-024 as the programme SSOT expansion.
2. Confirm Codex as accountable integrator for the first M0 vertical slice and DP as bounded backend producer.
3. Approve the exact SERP-025/026/029/031 subset for tomorrow; keep remaining M0/M1 tasks planned.
4. Confirm AG remains held from M1 UI implementation until the M0 server contract gate is accepted.
5. Name the independent reviewer for each sensitive patch where the author/reviewer model-family rule requires separation.

