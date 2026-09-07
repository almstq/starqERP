# starqERP — FINAL-STRETCH EXECUTION BIBLE

**Status:** CANONICAL. This is the master execution authority for the final stretch.
**Version:** 1.0 · **Effective:** 30 August 2026 · **Authority:** Founder direction, 30 Aug 2026
**Supersedes:** all prior roadmaps, proposals, restart plans and register queues *as sequencing
authority*. It does not delete them; they remain history.

> **Cold-start rule.** If you are an authorised agent waking with no context, read this document
> first and in full. It tells you what is decided, what is open, what you may touch, and what you
> may not. Where this Bible and any other prose disagree, **verify against the repository and the
> task SSOT** — durable evidence outranks every document including this one, and if you find this
> Bible stale, say so out loud rather than acting on it.

---

## 0 · Source precedence

1. Repository / filesystem state (branches, commits, files)
2. Canonical task SSOT — `starqNexus/data/starq-erp-tasks.json`
3. Canonical decision SSOT — `00_STARQ_HQ/decisions.json`
4. This Bible
5. The Founder resolution documents (`..._RevC_FOUNDER_RESOLVED.docx`, `..._MASTER_HANDOVER_FINAL_STRETCH_...docx`)
6. Elder's dated handoffs
7. Derived dashboards and Nexus views — **never authoritative**

---

## 1 · Verified current state (re-derived 30 August 2026)

| Fact | Value |
|---|---|
| `origin/main` tip | `e04f7e3` — *fix(SERP-340): one account-code universe* (#24) |
| Elder working branch | `elder/2026-08-31-wave1-governance` @ `defcb45`, tree clean, **1 ahead of main, unpushed** |
| Branches ahead of main | **~30**, several by 40–56 commits — *not seven* |
| Canonical board | **146 done / 363 = 40.22%** · planned 182 · in_progress 28 · blocked 6 · next 1 |
| Review-pending | **26** |
| Decision store | **113 records**, ends `DEC-113` |
| Board freshness | PASS on all 15 boards |
| Elder window | to **4 September 2026** |

### 1.1 Open pull requests — merge posture is Founder-set and binding

| PR | Subject | Posture |
|---|---|---|
| #25 | SERP-341 taxonomy + statutory accounts | **CHANGES REQUESTED** — owning-process authority on the posting-control boundary |
| #26 | SERP-343 CoA structural validation | **APPROVED**, dependency/order constrained; avoid DB/UI parity overstatement |
| #27 | SERP-356 payment failure modes | **CHANGES REQUESTED** — traceability/overclaim. **Also carries the fabricated-TIN code fix (`511226a`)** |
| #28 | SERP-234 reachability gate | **APPROVED** |
| #29 | ADR-010 Starq Account | **ACCEPTED subject to Rule 2 wording fix** |
| #30 | EXECUTION_STATE cold-start | **CHANGES REQUESTED** — stale/unsafe content |
| #32 | SERP-351 per-tenant payment config | **CHANGES REQUESTED** — RLS privilege semantics, activation-authority evidence, `config_id` follow-on |

**No PR carrying changes-requested findings may merge until those exact findings are corrected and independently rechecked.**

---

## 2 · Founder decisions — CLOSED. Do not re-ask.

Recorded durably as `DEC-095` … `DEC-113`. **"Founder-closed" means the policy is settled; implementation, review, deployment proof or remediation may still be open.**

| Gate | Ruling | Execution consequence |
|---|---|---|
| F1 | Founder is independent review/merge authority for Elder-authored work | Elder cannot self-accept |
| F2 | No fabricated TIN reached any issued/filed record | **CODE OPEN** — land the truthful-code fix safely |
| F3 | Archive superseded UI under `legacy/retired-ui/`; preserve, never delete | Archive with traceability; repair imports/tests |
| F4 | Route only real backed capability; hold/retire fixture-backed screens | Classify from **backend evidence**, not reachability optics |
| F5 | Telegram/Deadpool primary; `security@starq.mv` secondary; paid paging deferred | **PROOF OPEN** — observe a real deployed denial |
| F6 | Preserve `legacy/accounts.csv` pending provenance | No deletion |
| F7 | `config_id` becomes a real tenant-safe relationship on payment intents/attempts | **EXECUTION OPEN** |
| F8 | Activation authority = auditable human evidence, not a bare boolean | **EXECUTION OPEN** |
| F9 | DoD v0.2 adopted | **EXECUTION OPEN** — build enforceable gates, never a fake checklist gate |
| F10 | ADR-010 accepted; Rule 2 wording fix accepted | Land the wording correction |
| F11 | Durable human identity is a standing downstream gate | Accounting/ledger work is **not** blocked by it |
| F12 | Medical admin/operational ERP allowed; no clinical decision support | Keep scope non-clinical |
| F13 | Consequential claims need evidence + independent review | No self-certification via SSOT |
| N1 | Aikido authoritative scope = **starqERP only** | ERP claims use the ERP-only report |
| N2 | Pull SERP-226 forward now | **EXECUTION OPEN** — bounded process |
| N3 | Aikido is advisory evidence, **not** a release gate | Triage input only |
| N4 | High SAST needs independent human triage | **TRIAGE OPEN** — no blind AutoFix or dismissal |
| N5 | Aikido → ERP workflow stays manual | Founder exports evidence |
| N6 | Non-starqERP Aikido findings are **out of scope** for the ERP final stretch | **Do not block ERP on other repos** |
| — | Aikido secrets: 1 Med + 2 Low | Correct along the way; spawn tracked tasks |
| — | GitHub IP allow list | Deferred; not an ERP blocker |
| — | GitHub org 2FA | Approved in principle **after** member-readiness check |
| — | Supabase Auth console pass | **COMPLETE** — record durably |
| — | hCaptcha | Backend stays OFF until frontend `captchaToken` wiring works |
| — | Publication doctrine | Private main canonical; public is a lossy derivative |

---

## 3 · Final phase structure — P0 … P9

**This replaces the three competing vocabularies** currently on the board (`Phase N — …` blueprint,
`Phase N - …` main-base, and `Stage N - …`). Historical `phase` values are preserved on every task;
`final_phase` is the execution topology from here.

| Phase | Purpose | Parallel? |
|---|---|---|
| **P0 — Canonical convergence** | Make the board trustworthy: reconcile SSOT against branch reality, correct vocabulary/ownership, preserve the deletion set | Must complete first |
| **P1 — Land reviewed foundations** | Correct the changes-requested PRs and land them in dependency order | Serial by PR |
| **P2 — Identity, tenant and command boundaries** | Starq Account, tenant-safe relationships, RLS/seat-matrix verification, server-side mutation boundaries | Parallel with P3 |
| **P3 — Money, accounting and statutory truth** | CoA/taxonomy/posting/statutory controls, fabricated-identity code remediation, payment config, activation authority | Parallel with P2 |
| **P4 — Product reachability and truthful UX** | Route real capability; hold/retire the rest; archive superseded UI; remove demo authority from live paths | Parallel after P1 |
| **P5 — Security remediation embedded in build** | SERP-226 process, Aikido triage, secrets remediation, hCaptcha, GitHub 2FA, F5 proof | **Travels alongside all of P2–P7** |
| **P6 — Independent acceptance and review debt** | SERP-241, SERP-300 third run, SERP-351 review + live probe, the 26 review-pending | Continuous, non-Elder |
| **P7 — Completion drive** | Remaining domain slices under DoD v0.2, against a real denominator | Parallel |
| **P8 — 88–90% deep audit** | One comprehensive cross-system audit when real production paths exist | Trigger-gated |
| **P9 — Remediation + release acceptance** | Close audit findings, smaller acceptance gate, verify private main, derive stripped public, publish | Final |

**P5 is not a stage you reach — it is a lane that runs continuously.** Security does not wait its turn.

---

## 4 · Priority model

- **P0** — truthful canonical state, tenant isolation, financial/statutory correctness, authentication, security-denial proof
- **P1** — unlocks multiple downstream domains or removes a review/merge bottleneck
- **P2** — customer-visible *backed* capability needed for a usable commercial path
- **P3** — hardening/cleanup/non-blocking debt that travels alongside development
- **P4** — future/parked work that does not advance current commercial completion

Prioritise by **consequence × dependency leverage × release criticality** — never by task age, agent ownership, or a scanner's severity label alone.

---

## 5 · Dependency order — the critical path

```
P0 board convergence
      │
      ▼
P1 correct + land #26, #28  →  #29 wording  →  #25, #27, #30, #32 (after their findings close)
      │                                              │
      │                                              └─► #27 carries the fabricated-TIN fix (F2 code half)
      ▼
P2 identity/tenant boundaries ─┐
P3 money/statutory truth ──────┼──► P7 completion drive ──► P8 deep audit (88–90%) ──► P9 release
P4 reachability/truthful UX ───┘
      ▲
P5 security lane ─── runs continuously alongside P2–P7
P6 independent acceptance ─── runs continuously, never by Elder
```

**Hard sequencing rules**
1. Nothing merges while its Founder findings are open.
2. **Seat vocabulary migration precedes the seat matrix** — reversing it turns a silent authorization hole into a hard outage.
3. Issue-side COGS waits for the shared posting gate; no local duplicate of accounting rules.
4. `--strict` reachability stays out of CI until the F4 dispositions are actually applied.
5. Identity gate (F11) does **not** block accounting/ledger work.

---

## 6 · Release-blocking gates

A release is blocked until **all** of these are true. Aikido is *not* among them (N3).

1. Private `main` builds, tests and migrations clean from a fresh clone — **independently reproduced** (SERP-241).
2. Tenant isolation independently proven, including the SERP-300 third run. **Inconclusive is failing.**
3. No fabricated statutory identifier on any landed surface (F2 code half).
4. No unreachable feature view ships without an explicit DEC-103 classification.
5. Chart of accounts and database seed do not diverge — **with a ratchet that prevents recurrence**.
6. F5: a real deployed denial observed reaching Telegram/Deadpool and `security@starq.mv`.
7. All changes-requested PR findings corrected and independently rechecked.
8. P8 deep audit findings remediated and the release-acceptance gate passed.
9. Publication-integrity/deployment-safety gate passed on the public derivative.

---

## 7 · Worker allocation model

**Availability is not asserted in this document.** The agent-comms bus archives stop at 29 August and
there is no live duty roster on disk, so *any* availability claim here would be invented.
**Elder checks live availability at dispatch time** (bus inboxes, runtime, Founder confirmation) and
allocates then. WIP = 0 on wake: no worker silently pulls work.

| Role | Function | Binding rule |
|---|---|---|
| **Elder** | Governance and integration lead | Final plan, board reconciliation, task spawning, dispatch, integration. **Cannot accept Elder-authored gates.** |
| **Founder** | Human merge/release authority | Independent acceptance of the Elder-authored stack; console-only actions; genuinely new policy |
| **Independent reviewers** | Acceptance lane | SERP-241, SERP-300, SERP-351, review-pending, consequential gates. **Reviewer ≠ author, always.** |
| **Coding agents** | Parallel implementation | Bounded tasks with acceptance criteria; commit/push/handoff evidence; no self-certification |
| **Recon-capable agent** | Targeted evidence only | Focused inspection that unblocks execution. **No new broad audit programme** |
| **Nexus/board tooling** | SSOT projection | Regenerate after every canonical mutation. Never outranks repo/SSOT evidence |

**Known constraints as at 30 Aug:** Vision and Alfred stopped · @vscode out of credits · Elder disqualified from accepting his own work (DEC-072, DEC-111) · Founder is the merge authority. **Re-verify before dispatching.**

**Every worker handoff must carry:** task IDs · branch/commit · tests run and their real outcomes · blockers · files touched · **what remains unproven**.

---

## 8 · Security work that travels alongside development (P5)

Continuous, never deferred to a phase:

- **SERP-226 bounded process** — owner, manual triage cadence, fix window per severity, closure evidence, and the named authority permitted to ship with a known finding open.
- **Aikido triage** — 6 High SAST by independent human review (**no blind AutoFix, no mass-dismissal**); 11 Medium + 5 Low dispositioned; 1 Medium dependency; 1 Medium + 2 Low history secrets corrected along the way.
- **Preserve the completed Supabase Auth posture**: audit logs ON · password ≥12 with lower/upper/number/symbol · secure password change with current-password requirement · TOTP MFA and enhanced posture · existing rate limits · refresh-token compromise detection at a 10-second reuse interval.
- **hCaptcha** — frontend Sitekey, render challenge, capture and pass `captchaToken`; then *the Founder* enables backend protection with the offline secret. Backend stays OFF until wiring works.
- **GitHub org 2FA** — member-readiness check, then rollout. IP allow list deferred; GitHub Free retained.
- **F5 proof** — the alert path is not done when wired; it is done when a real denial is observed arriving.

**Three things that are never security proof:** a green test · a static scanner · an Aikido notification.

---

## 9 · The 88–90% deep-audit trigger and release acceptance

Broad discovery auditing is **parked**. It resumes exactly once.

1. **Trigger:** approximately **88–90% completion against a real denominator** — not a percentage of a board whose denominator has been reshaped to flatter it.
2. **Deep audit:** one comprehensive cross-system audit, run when real production paths exist so it can exercise them rather than read them.
3. **Remediation:** audit findings convert directly into tracked tasks. No finding is closed by the auditor.
4. **Release-acceptance gate:** deliberately *smaller* than the deep audit — verify §6's nine gates, no re-audit.
5. **Publication:** verify private `main` → derive the stripped public repository → publication-integrity/deployment-safety check → deploy.

---

## 10 · Private-main → stripped-public publication doctrine

**Private `starqERP` main is the only canonical product truth.** `starqERP-public` is a deliberately
lossy presentation derivative.

**The test:** *a competent developer must not be able to substantially reconstruct proprietary
starqERP functionality from the public repository.*

**Stripped from public:** detailed business logic · ledger mechanics · tenant-isolation
implementation · payment and provider internals · security architecture · database policies and
migrations · operational scripts · internal governance documents · reconstructive API and workflow
detail.

**Order of operations, always:** audit and clean private → verify and push canonical private main →
derive stripped public → publication-integrity/deployment-safety gate → deploy.

Public receives a **publication-integrity and deployment-safety check, not a duplicate deep product
audit.**

---

## 11 · What stays parked

- **Non-starqERP Aikido findings** (`erp-public`, `Nexus`) — out of scope for the ERP final stretch (N6). Do not infer, do not block on them.
- **Broad discovery auditing** — until the P8 trigger.
- **GitHub IP allow list / Enterprise hardening** — deferred.
- **Paid paging** — deferred.
- **starqPay as a licensed product** — unauthorised, unchanged.
- **Clinical decision support** — requires separate governance (F12).
- **`legacy/accounts.csv`** — preserved, provenance unestablished (F6).

---

## 12 · Standing prohibitions

- No self-certification of any consequential claim.
- No batch closure to raise a completion percentage.
- No independent gate discharged by Elder.
- No merge of a PR with open Founder findings.
- No branch-only work represented as landed.
- No destructive cleanup; **archive means `legacy/retired-ui/`, never deletion** (DEC-113).
- No mass-deletion of history; supersede and mark, never erase.
- **An inconclusive result is a failing result.**
- A Founder policy ruling closes the decision, **not** the implementation.

---

## 13 · Known contradictions carried into the final stretch

These are live and must not be lost in the reorganisation:

1. **Register row 10 open** — fabricated TIN defaults still render on `main` at `MiraTgstView.tsx:96`, `MiraGst201View.tsx:52`, `BilingualInvoicePrintView.tsx:164`. Fix is `511226a`, trapped on PR #27.
2. **SERP-340 is closed claiming a "coherence ratchet added" that does not exist on `main`.** The correction merged; the ratchet did not. New task raised; **status deliberately not changed** — reopening a closed row is not Elder's call.
3. **SERP-268 "Admin MFA" is `done`** above an accept-all MFA stub (SERP-381). No call site, so a landmine not a breach — but the row overstates it.
4. **D5 unresolved** — SERP-300 `done` on a merged PASS vs SERP-379's recorded inconclusive re-run.
5. **D11 and D13 are referenced in the register but never defined** (only D1–D9 exist). Documentation gap; not reconstructed.
6. **Reachability ratchet unenforceable** — `scripts/reachability-sweep.mjs` is absent from `main`.
7. **`OrganisationSetupModal` lives at `web/src/components/onboarding/`**, not `organisations/` as the register implies, and is imported by `serp_275` and `serp_276` tests. Moving it breaks both unless repaired in the same commit.

---

## 14 · Completion condition for this Bible

Consumed successfully when: the Founder register is no longer a question list; the board has been
reconciled into this topology; workers are allocated against **real** availability; and development
is moving on the highest-priority unblocked strands under DoD v0.2.

**Not** consumed by producing another plan.
