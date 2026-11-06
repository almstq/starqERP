# Cloudroom ↔ Herdr Engineering Handoff Contract

**Status:** RATIFIED — Repeatable operating procedure
**Owner:** @claude (Elder), StarqERP Engineering Lead / Floor Orchestrator
**Authority:** Founder / Managing Director — Room operating notice #18325–#18326 (2026-11-06)
**Companion to:** [`DURABLE_ENGINEERING_ACTIVITY_STANDARD_2026-11-06.md`](./DURABLE_ENGINEERING_ACTIVITY_STANDARD_2026-11-06.md)

This documents the Founder's deliberate handoff model so Cloudroom and Herdr take turns on the same work instead of competing to orchestrate it. It is an operating procedure, **not** a change to governance or to independent-review / Founder-merge authority.

## 1. The cycle

```
Cloudroom → Prepare → Herdr → Execute → Cloudroom → Verify/Close → Repeat
```

| Phase | Environment | Responsibility |
|---|---|---|
| **1. Select & Prepare** | Cloudroom | Inspect the board; pick the next eligible task; check dependencies, prerequisites, existing implementations, GitHub history, blockers, acceptance criteria; produce a **durable execution handover** (schema §2). Then pause. |
| **2. Execute** | Herdr (Elder) | Receive the work package; organize stations; assign implementation + independent verification; supervise; produce engineering, tests, reviews, GitHub activity and Room reporting under existing authority. Return a **delivery receipt** (schema §3). |
| **3. Verify & Close** | Cloudroom (Vision) | **Vision** (Cloudroom PM) examines the delivery receipt, commits, PRs, tests, independent reviews, Room evidence vs acceptance criteria; obtains Founder authorization where required; closes only verified+accepted work; returns failed verification as a correction task. |
| **4. Repeat** | Cloudroom (fresh session) | Read durable project state; select the next eligible task; prepare the next package. |

**Verification roles (Founder decision #18372).** Routine delivery verification is performed in Cloudroom by **Vision** — the Windows Hermes Project Manager operating within Cloudroom, who serves StarqERP and Hoadhaa through their respective lanes and **has no Herdr pane and does not need one**. **Copilot** provides *risk-based* specialist engineering assurance: deeper independent technical review (via Herdr or GitHub) for security-sensitive, architectural, migration or other high-risk changes. Copilot is **not** a mandatory reviewer for routine packages; the project verification cycle remains in Cloudroom. The Founder retains final merge, release and acceptance authority.

## 2. Durable work-package handover (Cloudroom → Herdr)

A package Herdr can execute from must carry:
1. **Task identity** — Cloudroom task ID + title; lifecycle family / critical-path position.
2. **Objective & bounded scope** — what "done" means; explicit out-of-scope.
3. **Reconciliation** — existing implementations and relevant GitHub history already checked (so Herdr reconciles before rebuilding).
4. **Dependencies / prerequisites** — verified, with blockers named.
5. **Acceptance criteria** — the independently-verifiable outcome, and what evidence closes it.
6. **Authorization reference** — the Room sequence authorizing the work; any Founder pre-authorization or reserved decision flagged.

## 3. Delivery receipt (Herdr → Cloudroom)

A delivery Cloudroom can verify+close must carry:
1. **Task identity** — same ID, for traceability.
2. **GitHub output** — commit SHAs, branch(es), PR number(s); contributor attribution correct.
3. **Test results** — suites run and outcomes.
4. **Independent review** — reviewer identity (≠ builder) and verdict (PASS / corrections), with Room evidence refs.
5. **Acceptance mapping** — each acceptance criterion → the evidence that satisfies it.
6. **Open items** — anything needing Founder merge/acceptance authority, stated explicitly (publishing a branch/PR never authorizes merge).

## 4. Invariants (unchanged by this procedure)

- Independent verification and Founder-controlled merge/release/acceptance authority remain in force. Only verified+accepted work closes on the board.
- Room maintains the operational history across both environments; GitHub maintains real output + review history; the Cloudroom board maintains progress/closure.
- **Continuity must never depend on keeping an old conversation alive** — durable handovers (work package + delivery receipt + Room + checkpoint docs) connect sessions. Cloudroom and Herdr @claude may operate concurrently with independent instance attribution (Room #18310); the handover artifacts are the coordination mechanism, not a shared live conversation.
- Each work package stays **traceable from selection through final acceptance** via its task ID and linked Room/GitHub references.

## 5. Prerequisites established

- This contract is version-controlled and GitHub-visible (per the companion standard) and referenced from the AGENTS.md onboarding entrypoint so new sessions inherit it.
- Herdr-side readiness: canonical Room identity + lease, a durable Room watcher, builder/reviewer separation, and per-worktree git identity for correct attribution are already in place.

---
*Ratified per Founder operating notice #18325–#18326. An explanation of the Founder's orchestration workflow, not a replacement for governance or authorization rules.*
