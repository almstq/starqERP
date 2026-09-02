# Morning brief — 30 August 2026

**For:** the founder, on waking · **From:** Elder
**One thing to read if you read nothing else:** §1.

---

## 1. The payment tenant boundary is now genuinely proven

Last night the payments schema was committed, RLS was switched on across nine tables, and **nothing
had ever tried to break it.** The adversarial probe attacked seven tables and none of them were
payment tables — so a green run would have told you the boundary was proven when no adversarial
query had ever touched it.

**It is proven now. 29 of 29 assertions pass**, as `serp300_probe` — non-superuser, no bypass, row
security on:

| Attack | Result |
|---|---|
| `payment_intents` cross-tenant SELECT / UPDATE / DELETE / INSERT | **all blocked** |
| `payment_intents` cross-book isolation | **blocked** |
| `payment_attempts`, `payment_refunds`, `payment_settlements`, `payment_settlement_items`, `provider_events`, `settlement_allocations` | **blocked** |
| `provider_events` unattributed rows | **blocked** |
| the original 16 | still green |

@vision wrote the fixtures and the thirteen payment assertions — careful work with real FK chains.
It stalled before running them, so I fixed three fixture defects and executed. Commit `2b310d2`.

**This is the answer to the promise made to Club Ignition that its books are its own.** It now holds
for payment data too.

---

## 2. What else landed overnight

| Task | State |
|---|---|
| **SERP-340** one account-code universe | **done** — closed by *your* merge of PR #24, not by me |
| **SERP-341** taxonomy + six statutory accounts | built, in PR #25 |
| **SERP-344** accounts become data | built, in PR #25 |
| **SERP-360** Badge.tsx duplicates | **done** by @openclaw, reviewed by me |
| **SERP-300** payment surface | evidence extended, 29/29 |

**SERP-344 is the structural one.** `chart_of_accounts` now exists as a tenant-scoped table,
`journal_lines.account_code` has a foreign key to it, and `posting_control` is enforced by a
database trigger rather than a UI flag. Proven, not asserted:

```
1000 header    REJECTED      2120 header  REJECTED
1210 control   REJECTED      3200 system  REJECTED
9999 unknown   REJECTED
1114 postable  accepted      6210 postable accepted
```

**A defect I built and the probe caught:** my first draft exempted the `postgres` superuser from the
control check so migrations could seed freely. Every control account then accepted a manual line and
the guard could not be proven at all — the same shape as running an RLS probe as superuser. The
exemption is gone.

**All 34 migrations apply clean on a fresh cluster.** 82 test files, 295 tests pass.

---

## 3. Needs you

**[PR #25](https://github.com/almstq/starqERP/pull/25) needs review.** It carries SERP-341 and
SERP-344, plus @openclaw's SERP-360 and @vision's probe work. **It has the same mixed-scope problem
PR #24 had** — six commits from three authors on one branch, because we all share a working tree.
Merging it approves all of it. Worth splitting if you want clean provenance; worth merging as-is if
you want the kernel moving.

**One open architecture question, raised not claimed:** `public.payment_provider_config` has **no
`organisation_id`** and is unique on `(provider_id, environment)` — a platform table — yet it carries
`merchant_id`, which is normally per-merchant. That means **one merchant ID per provider per
environment across all tenants.** Either a deliberate single-merchant model with tenants as
sub-accounts, or a funds-routing problem. I can't tell from the schema and didn't guess. Recorded on
SERP-351.

---

## 4. The team

| Agent | State |
|---|---|
| **@openclaw** | Unblocked and on **SERP-343**. It hit a syntax error in migration 0035 — **that was mine**, caught mid-write in the shared tree. Verified fixed. |
| **@vision** | **SERP-342** next, unblocked. Its probe extension landed. |
| `codex` | out until **4 Sept 00:30** |
| `antigravity` | out — weekly quota 0% |
| `vscode` | out of credits |

**Both agents did the right thing under pressure last night.** @openclaw read the source and found
my brief named the wrong Badge file. @vision found the same thing from the other direction and
**refused to invent a fix for a defect it couldn't see.** That's the behaviour worth keeping.

---

## 5. On my own reliability

**Four times last night a quick query of mine produced a false reading**, and each was caught by
someone or something else rather than by me:

1. A literal grep missed a ternary account code — found only by a failing test.
2. A whole-file regex counted epics as tasks, giving 150/350 instead of 144/342.
3. Raw `JSON.parse` over `room.jsonl` bypassed the normaliser, so I reported @openclaw as silent
   when it had eight posts.
4. A too-narrow grep made me report @vision's probe extension as "zero assertions" when it had
   written all thirteen.

I also briefed @openclaw the wrong file path, and told @vision a task was open when it had been done
for four days. **The pattern is consistent: shortcuts instead of the real interface.** Everything in
§1 and §2 above was verified by execution, not by grep — but the pattern is worth you knowing about
when you read anything I report.

---

## 6. Where the kernel stands

| | Before the audit | Now |
|---|---|---|
| Accounts in the chart | 39 | **55** |
| Chart/ledger agreement | 5 of 39 | **22, zero collisions, zero orphans** |
| Chart exists in the database | no | **yes, with FK and posting control** |
| Payment tenant boundary | untested | **29/29 proven** |

Payroll no longer debits Workshop Rent and Electricity.
`docs/specs/CHART_OF_ACCOUNTS_SPECIFICATION.md` **v1.1** is the authority — if the software disagrees
with it, the software is wrong.

**Next in the chain:** SERP-342 (@vision), SERP-343 (@openclaw), then SERP-345 close hardening and
SERP-346 the acceptance gate, which is what returns the surface to Azhad.


---

## 7. Later that night — the CoA chain was finished

Everything from SERP-340 to SERP-346 now exists in code with tests. **None of it is closed**, because
I wrote it and DEC-072 says I do not close my own gates.

| Task | State |
|---|---|
| `SERP-340` one account-code universe | **done**, merged by you as PR #24 |
| `SERP-341` taxonomy + statutory accounts | built — **PR #25** |
| `SERP-342` tourism GST by time of supply | built — **PR #25** |
| `SERP-344` accounts become data | built — **PR #25** |
| `SERP-345` period lock actually in effect | built — **PR #25** |
| `SERP-346` the acceptance gate | built — **PR #25** |
| `SERP-343` CoA structural validation | built — **PR #26** |

**86 test files, 380 tests, tsc clean, build clean, all 35 migrations apply on a fresh cluster.**

### Three more instances of the same defect

1. **`assertPeriodNotLocked` had existed since SERP-295, was imported into `AccountsView.tsx`, and
   was called zero times.** Its tests passed because they invoked it directly. The production path
   posted into CLOSED periods freely.
2. **The manual journal modal defaulted both lines to `1000` Assets and `1100` Current Assets** —
   the class root and a grouping. It opened pre-loaded with a posting that must never be made, and
   an existing test asserted that posting *succeeded*.
3. **The subtype dropdown offered every subtype to every class**, and `handleSubmit` never enforced
   the code range it displayed in its own UI.

All three are the house defect — **written but never in effect** — the same family as 55 RLS
policies with zero tests.

### What I deliberately did not do

**SERP-339 stays open.** The chain being *built* is not the chain being *accepted*. Its close
condition is **Azhad reviewing the surface again**, and your bar was that he should struggle to find
a flaw. Marking it done tonight would be exactly the over-claim this audit existed to correct.

The acceptance gate also **declares its own gaps**: observation 10 — P&L drill-down and GST box
reconciliation — is **not yet proven** and needs a reporting fixture.

### I took two tasks off the agents

`SERP-342` from @vision and `SERP-343` from @openclaw, both announced on the bus with reasons. Both
are prompt-driven, both were idle with you asleep, and the chain would have sat until morning. Their
own work stands on the board with their names on it, and both have a better next task waiting —
@vision `SERP-356` payment failure modes, @openclaw `SERP-352` the MOCK adapter lifecycle.

**Both PRs need your review.**
