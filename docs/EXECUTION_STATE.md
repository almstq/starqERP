# starqERP — execution state

**Written:** 30 Aug 2026, by Elder (Claude Code), on Founder continuity
directive. **Read this first if you are picking starqERP up cold.**

This file is a **pointer and a reconciliation**, not an authority. When it
disagrees with the board, **the board wins** and this file is stale — fix it
here rather than acting on it.

- **SSOT for tasks:** `starqNexus/data/starq-erp-tasks.json` (regenerate with
  `node scripts/regenerate-all-boards.mjs starq-erp`; the freshness gate runs
  on `predev` and `prebuild`).
- **SSOT for decisions:** `00_STARQ_HQ/decisions.json`.
- **Blueprint:** `00_STARQ_HQ/2026-08-24_STARQERP_FINAL_BLUEPRINT.md` (DEC-073).
- **Governance:** DEC-072 — claimed, committed and proven are three different
  things and only the third counts. **No worker closes its own gate.**

---

## 1 · Board totals, as of this writing

| | |
|---|---|
| Tasks | **363** |
| Done | **144** (**39.67%**) |
| In progress | 28 — **26 of them `review_pending`** |
| Blocked | 8 |
| Epics | 23 |

**Read the completion number correctly.** It moved 41.81% → 39.67% today
*because 21 tasks were added, not because anything regressed.* Done did not
change. Board completion is **not** a measure of usable product: see §6.

---

## 2 · The single most important fact

**This project is review-starved, not work-starved.**

26 tasks sit `review_pending`. Four more are blocked on a **Founder ruling**.
Three PRs have been green and unmerged since this morning. Adding
implementation widens the queue; it does not move the product.

If you are a competent agent arriving cold and you are *allowed* to review,
**reviewing is worth more than building today.** DEC-072 means Elder cannot
accept Elder's own work, and most of the queue is Elder's.

---

## 3 · Open PRs — exact reality

All five are **MERGEABLE**, none is merged, none is self-approved.

| PR | Branch | Contains | CI | Blocked on |
|---|---|---|---|---|
| [#25](https://github.com/almstq/starqERP/pull/25) | `elder/2026-08-30-serp341-taxonomy` | CoA taxonomy corrections + missing Maldives statutory accounts | green | Founder review |
| [#26](https://github.com/almstq/starqERP/pull/26) | `elder/2026-08-30-serp343-coa-validation` | CoA structural validation, four gaps enforced. **Carries the Azhad review pack** at `docs/qa/coa-accountant-audit-2026-08-29/AZHAD_SECOND_REVIEW_PACK.md` | green | Founder review |
| [#27](https://github.com/almstq/starqERP/pull/27) | `elder/2026-08-30-serp356-payment-failure-modes` | Payment failure modes, 12 of 12 guarded | green | Founder review |
| [#28](https://github.com/almstq/starqERP/pull/28) | `elder/2026-08-30-serp234-reachability` | SERP-234 reachability sweep + standing CI gate | green | Second-party review |
| [#29](https://github.com/almstq/starqERP/pull/29) | `elder/2026-08-30-starq-account-adr` | ADR 010 Starq Account + task set. **Docs only** | — | Founder acceptance of ADR |

**Merge order for #25 → #26 → #27 is tested, not assumed.** They were merged
in that order in a scratch worktree against `origin/main`: zero conflicts, no
duplicate migration versions, 523 tests across 96 files, tsc clean, build
clean, all 36 migrations applied to an empty Postgres, chart = 57 accounts
with zero UI-only and zero DB-only codes.

> **Merge all three or none.** Stopping half way is the real risk. #28 and #29
> are independent of that chain and of each other.

---

## 4 · Blocked, and who can unblock it

**Only the Founder can move these four:**

| Task | Ruling needed |
|---|---|
| `SERP-196` | Path budget — Windows cannot check the vault out; five paths exceed MAX_PATH |
| `SERP-238` | Re-scope: removing foundation-engine client traces |
| `SERP-338` | Google OAuth clients are in two different projects — needs the Google Cloud console |
| `SERP-351` | Merchant identity / provider registry. **The schema currently expresses the model that needs an MMA licence, so proceeding is choosing it** |

Analysis for each is already delivered under `workspaces/elder/`. **Do not
infer the Founder's answer on any of them.**

**Needs a second party, not engineering:**

| Task | Why |
|---|---|
| `SERP-241` | Exit gate. Elder ran it and is disqualified from accepting it |
| `SERP-125` | Delivered at `64281de`, needs independent review |
| `SERP-379` | **New.** SERP-300 reads `done` while the 30 Aug re-run was inconclusive — see §6 |
| `SERP-380` | **New.** Archive ruling for two superseded duplicate components |

**Other blocked:** `SERP-028` (Flutter freeze, DEC-067).

---

## 5 · Recommended execution path

Ordered. The first two are not Elder's to do.

1. **Merge #25 → #26 → #27**, in that order, or none. Everything downstream of
   the finance kernel is waiting behind them.
2. **Review the queue.** 26 `review_pending`. Closing the ones that genuinely
   pass reaches ~49% *with no new engineering* — but only the ones that pass.
   Do not batch-close: three tasks were found marked `done` on 29 Aug with no
   work in the product.
3. **Rule on the four Founder items** above.
4. **`SERP-379`** — settle the SERP-300 contradiction. Tenant isolation is
   release-blocking and is currently *claimed* rather than *proven*.
5. **`SERP-381`** — make the MFA stub fail closed, see §6b. P0, **no
   dependencies at all**, small, and it gets more dangerous as identity
   work starts. Real TOTP is `SERP-366` and needs the account layer.
6. **Then** Starq Account Phase A (`SERP-361`), which cannot start before
   `SERP-037` is accepted and the three PRs merge. **`SERP-369` is ruled**
   — recovery is settled, see §11.

**Starq Account is mandatory but it is not next.** It is correctly positioned
and still gated on `SERP-037` and the merges. Treating "mandatory" as "immediate" would start a schema
migration while three migration-bearing PRs are unmerged.

---

## 6 · Evidence gaps and contradictions — read before trusting the board

**a · RELEASE-BLOCKING RED GATE — `SERP-300` says done; isolation is
NOT proven.** Recorded as `SERP-379`, and as the **first entry in the
board's `standing_rules`** so it cannot be missed. **Do not read
`SERP-300` = done as proof that tenant isolation passed.** Vision re-ran the adversarial isolation probe on 30 Aug and
reported *"COULD NOT FULLY ASSERT PASS"* — the 16/16 matrix was not fully
executed, and the run hit a leftover `serp300_probe` role. Under the standing
rule **an inconclusive result is a failing result.** Elder did not re-status
it: governance rule 6 forbids overwriting another worker's task.

**b · The MFA validator accepts almost anything.** *(`SERP-381` now, `SERP-366` later.)*
`contracts/commands.ts:1953` `validateMfaChallenge` returns `valid: true` for
**any 6-digit code** except three hard-coded test values. No secret, no
time-step check, no MFA table in any of the 36 migrations. It is called
**only by its own four passing tests**, never by the API, and
`starq-api/index.ts:524` hard-codes `mfa_verified: false`. So
`operator_principals.mfa_required` (default true) is a flag with no mechanism.
**Not a live vulnerability — a landmine.** It looks finished and has green
tests. Recorded as `SERP-381` (fail closed, startable now) and
`SERP-366` (real TOTP, needs the account layer).

**c · Nine components are implemented and unreachable.** See `SERP-234` and
the register in `tests/component_reachability.test.mjs`. Eight of them have
no table, no command and no endpoint; four raise *"posted to General Ledger!"*
for journals that are computed and dropped. **Every one already has a passing
render test.** A passing render test is not reachability evidence.

**d · Authorization is seeded from an environment variable.**
`STARQBOOKS_ALLOWLIST_JSON` supplies seats, upserted into `membership_seats`
on every sign-in (`index.ts:576–592`). `api_session_authority` is still the
runtime authority so this is **not** a tenant-isolation hole, but a redeploy
with an edited env var re-grants seats. `SERP-373`, overlaps `SERP-287`.

**e · Vision's Starq Account reconnaissance produced no findings.** The file
at `workspaces/vision/starq-account-research.md` and its `/tmp` original
contain only an evidence-preservation note asserting their own existence. All
current-state facts in ADR 010 were read from the repository directly. Also:
`/tmp` resolves to `C:\tmp` — **Rule 0**.

---

## 7 · Working-tree and local-only reality

**Repos are pushed. `git rev-list --all --not --remotes` = 0 in all three.**

| Repo | Branch | State |
|---|---|---|
| `starqERP` | `elder/2026-08-30-starq-account-adr` | clean but for one untracked file |
| `starqNexus` | `nexus/orgspace` | board changes committed and pushed |
| vault `D:\!starq` | `master` | pushed to `local/starqos.git`; **560 working-tree deletions left deliberately** |

**Intentionally not committed:**

- **560 vault deletions** (Dhivashi archives, Hoadha docs, scratch dumps).
  Content is safe in vault history *and* mirrored at `E:\STARQ-GIT-ARCHIVE`.
  **Awaiting a Founder ruling** — it is a structural change Elder did not make.
- `starqERP/scripts/serp358-gate2.mjs` — untracked, **Vision's**, a 16-line
  draft gate script. Theirs to commit or remove.
- `03_PROJECTS/hoadha` — main ahead 3, **177 local-only commits, 6 stashes**.
  Antigravity's lane.
- `starqNexusMobileBeta` — `mobile` ahead 3, dirty `src/data`. The
  PUBLIC_BUILD rule applies; do not regenerate and commit casually.

**Local-only, not in Git:** `starqERP/.claude/launch.json` port corrected
3000 → 3001. `.claude/` is gitignored. Port 3000 is **Starq Nexus's** dev
server; vite serves the ERP on 3001. If your preview points at 3000 you are
looking at the wrong app.

---

## 8 · Architecture decisions

| ADR | Subject | Status |
|---|---|---|
| `docs/architecture/adr/001-accounting-first.md` | Accounting is the financial spine | Accepted |
| `docs/architecture/adr/010-starq-account.md` | **Starq Account — the durable human identity boundary** | **Proposed**, PR #29 |

ADR 010 numbering skips 002–009 deliberately: ADR 001 already references ADRs
002–005 by name though no files exist for them.

Task decomposition for ADR 010, with the letter-to-id mapping:
`docs/architecture/2026-08-30_STARQ-ACCOUNT_TASK-PROPOSAL.md`.

---

## 9 · Safe for another agent to execute independently

These need no Elder context and no Founder ruling:

- **`SERP-381`** — make the MFA stub fail closed. **No dependencies, no
  schema, no Founder ruling.** Red-first test required: the current stub
  must be *shown* to accept a wrong code before the fix. Real TOTP is
  `SERP-366` and waits for the account layer.
- **`SERP-337`** — RLS revalidation (codex).
- **`SERP-298`** — platform console (codex).
- **`SERP-014`** — Stage 10 manufacturing (antigravity).
- **Reviewing any `review_pending` task not authored by yourself.**

**Hold for Elder or the Founder:** everything in §4; the 560 vault deletions;
any Starq Account implementation (`SERP-361`+) until its three gates clear;
and anything that would re-status another worker's task.

---

## 10 · Standing constraints that keep being re-learned

- **Rule 0 — C: is not ours.** Git Bash `/tmp` resolves to `C:\tmp`. Use the
  scratchpad.
- **No deletions, ever.** `_recyclebin` — and not even that for
  `starqERP/legacy/accounts.csv`, which may be historical accounting records
  until provenance is established.
- **Check the exit code, not the passing count.** A vitest run printed
  `419 passed` alongside `Errors 1` and exit 1, and the passing count was
  believed. `npm test` exiting 0 is the claim; the number is decoration.
- **Do not fix `SERP-342` by swapping 0.16 → 0.17.** The adjudication warns it
  reproduces the identical defect backwards. Tourism GST must resolve by time
  of supply from `tax_rate_schedules`; migration `0017` is authoritative.
- **An inconclusive result is a failing result.**


---

## 11 · Founder rulings recorded

**`SERP-369` — account recovery. RULED 30 Aug 2026.** No longer open.

- **Primary channel:** verified **Starq** recovery email — Starq-verified,
  never provider-asserted.
- **Secondary:** **Starq-generated recovery codes**, independent of the
  email channel.
- **Forbidden:** Google, Apple, Microsoft or any login provider as the
  **recovery authority**. A provider may authenticate; it may never
  authorise a recovery.
- **Must stay possible:** passkeys and verified phone added later
  **without changing the Starq Account identity**.
- **Controls:** sensitive recovery and account-takeover actions require
  additional verification, auditability, cooldown/protection controls,
  and **manual support escalation** where assurance is insufficient.
- **Not required at launch:** phone.

Carried into `SERP-370` as acceptance criteria and into ADR 010's
security model. Any document still calling this open is stale.
