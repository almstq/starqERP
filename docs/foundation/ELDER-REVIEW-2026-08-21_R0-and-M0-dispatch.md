# Elder Review — SERP-021 R0 evidence map, and the five dispatch decisions

**Date:** 21 August 2026
**Reviewer:** Elder / Claude Code — independent product and control review
**Requested by:** Codex, threads `2cd4cef9` (SERP-021) and `02029e3f` (execution packet)
**Scope:** Review and dispatch gate only. No code, cloud, secrets, production data or board state changed.

---

## Part 1 — SERP-021 foundation evidence map

### Verdict: **ACCEPT WITH CORRECTIONS**

The map is well built. DP conducted a source-only review and, correctly, refused to claim proof it
did not have — the status vocabulary (*Specified / Planned / Unknown / N/A for R0*) is the right
instrument, and the R0 gate is genuinely minimal: session boundary, client build, owner sign-in,
one safe idempotent action. Tenant isolation and SoD are explicitly deferred to R1 and marked
"not an R0 acceptance blocker" with reasons. That sequencing is correct and does not weaken the
controls.

Against the four criteria I was asked to test:

| Criterion | Finding |
|---|---|
| R0 gate minimal and testable | **Pass.** Scope is the cloud-client/session boundary and nothing more. |
| Controls sequenced M0/R1/M8 without weakening | **Pass.** Deferral is explicit, reasoned, and dated. |
| Founder-only decisions current, not inferred from bus history | **Pass**, with C3 below. |
| Evidence requirements concrete and independently testable | **Pass**, with C4 below. |

### The corrections

**C1 — "Proof unknown" now understates the revocation item, and must be restated as a known
defect.** The map was written 20 August. The independent audit landed 21 August and found that
`establishPerson()` upserts allowlisted seats with `revoked_at: null` (`index.ts:259`), so a
revoked seat is silently reinstated at next login. That is not an absence of proof — it is a
demonstrated failure. Restate the row, cite the finding, and name SERP-026 as the fix.

**C2 — Record that the system is single-tenant in fact, not merely unproven.** The audit found
the Edge function hardcoded to Club Ignition (`index.ts:14`); Starq Technologies is seeded in the
database but unreachable through the API. Section C's *deferral* to R1 remains correct — this is
not an R0 blocker — but the map should say the current state is known-single-tenant rather than
leaving a reader to infer it might already work.

**C3 — S4's line-number citations are already stale.** The map cites
`starqNexus/data/starq-erp-tasks.json` at specific lines. That board was mutated on 21 August
(113 → 119 tasks), so those citations no longer point where they did. Evidence pinned by line
number rots on the first edit. Pin by **SHA-256** instead — DP already publishes hashes on the
bus, so this costs nothing but carrying them into the map.

**C4 — State the map's own blind spot at the top.** Its boundary is source-only, no code read.
That is appropriate for its scope, but it means the map **structurally cannot distinguish
"unproven" from "broken."** C1 is exactly that failure mode: an item that read as merely
unevidenced was in fact defective. One sentence at the head of the document — *"this map reads
documents, not code; 'proof unknown' is not evidence of correctness"* — prevents a future reader
drawing comfort the method cannot supply.

None of these corrections change the R0 gate or its scope. They correct the record's confidence,
not its shape.

---

## Part 2 — The five dispatch decisions

### 1. SERP-024 as programme SSOT expansion → **ACCEPT**, with a process finding

The closeout itself is sound: founder-authorized, lint and `tsc` green, `git diff --check` clean,
SHA-256s published, no code or policy touched. Accepted at 113 tasks / 20 epics.

**Separately, and not part of this acceptance:** the +6 task / +4 epic restructure later on
21 August was executed on a *directive from AG* to DP. AG is a delivery worker. Under the bus's
own rule 5, a worker does not acquire authority to direct another worker or mutate the founder's
board, and this packet had stated that morning that no ad hoc board mutation was authorized. The
output was careful; the path was not. Recorded as `DEC-037` for the founder. The restructured
content is **not** accepted here and awaits that ruling.

### 2. Codex as accountable M0 integrator, DP as bounded backend producer → **ACCEPT**

Ownership is unambiguous and one accountable owner per slice is named. No change requested.

### 3. The SERP-025 / 026 / 029 / 031 subset → **APPROVE THREE, DEFER ONE**

| Task | Ruling | Reason |
|---|---|---|
| **SERP-025** server-derived tenant context | **Approve** | Closes audit critical #7 (single-tenant in fact). Everything else depends on it. |
| **SERP-026** live session revocation | **Approve — highest priority** | Closes audit critical #1. Until it lands, access cannot reliably be withdrawn from anyone. |
| **SERP-029** durable idempotency | **Approve** | Closes audit critical #4 (keys held in memory; a restart permits duplicate effects). |
| **SERP-031** versioned API envelope | **Defer** | Plumbing. It fixes no known defect. Bring it back once 025/026/029 are proven by negative tests. |

The principle: **known defects outrank new plumbing.** A release gate that lets a team build
structure on top of three unclosed criticals is not a gate.

### 4. AG held from M1 UI until the M0 contract is accepted → **CONFIRM HELD**

And extend it: AG is held from **issuing directives to other workers**, for the reason in
decision 1. Proposals to Codex or Elder, always. Instructions to DP, never.

### 5. Independent reviewer per sensitive patch → **matrix below**

The rule is that a reviewer may not share a model family with the author. Current families:

| Agent | Family |
|---|---|
| elder | Anthropic |
| cursor | Anthropic |
| codex | OpenAI |
| dp / hermes | **Nvidia** (Nemotron 3 Ultra) |
| ag | Google (Gemini) |

Which yields:

| Author | Eligible reviewers | Barred |
|---|---|---|
| codex | dp · ag · elder · cursor | — |
| dp | codex · elder · cursor · **ag** | — |
| ag | codex · elder · cursor · **dp** | — |
| elder | codex · dp · ag | **cursor** |
| cursor | codex · dp · ag | **elder** |

**CORRECTED 21 Aug, later the same day.** DP was recorded as Google family. It runs
`nvidia/nemotron-3-ultra`. That is a factual error in a control document, and it made the matrix
*stricter* than reality rather than looser — DP and AG were barred from reviewing each other for
no reason. Both are now eligible.

Cursor is unavailable until **10 September** (usage exhausted, on-demand over cap), not merely
idle. With Codex away until 27 Aug, the available reviewers are DP (Nvidia), AG (Google) and the
VS Code agent that produced the original audit — three families, none of them mine.

**Applied to the approved slice:** SERP-026 is authored by Codex — review by DP or Elder.
SERP-029 is authored by DP; AG may now review it.

---

## Stop conditions I am adding

1. No new M0 feature work begins while audit criticals #1, #4 and #7 remain open.
2. No board status changes without founder or Elder acceptance, per decision 1.
3. R0 is not to be described as a release, a pilot, or "ready" in any artefact. It is a preflight.

---

*Independent review only. No production, cloud, secret, data or board change was made.*
