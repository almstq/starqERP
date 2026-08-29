# Elder Reconciliation — CoA Accountant Audit vs private `main`

**Date:** 29 August 2026
**Reconciled by:** Elder, against `starqERP` private `main` at `9815813`
**Source under review:** [`ACCOUNTANT_REVIEW_REPORT.md`](./ACCOUNTANT_REVIEW_REPORT.md) (Azhad → ChatGPT second pass)
**Status:** OPEN. This is the operative instruction where it disagrees with the source report.

---

## Why this document exists

The founder's instruction was explicit: *"Before mutation, reconcile this report against the current
private repo/main, migrations and board SSOT. Public-repo evidence used in the audit establishes
visible defects but must not override newer unpublished authority."*

That reconciliation has been done. The result is that the report is **substantially correct on every
finding it raises**, but it is **wrong about where the tourism-GST defect lives**, and it **misses the
largest defect in the accounting kernel** — one that makes most of its own remediation list
unimplementable as written.

---

## 1. The finding the report did not make

> **The canonical Chart of Accounts and the posting engines use two different, disjoint account-code
> universes. Where they overlap, they disagree about what the account means.**

The 39-account seed in `web/src/data/defaultChartOfAccounts.ts` is not the chart the ledger actually
posts to. Every posting engine carries its own hard-coded codes and names:

| Code | Canonical seed says | A posting engine says | Where |
|---|---|---|---|
| **6210** | Workshop & Garage Rent | *Employer Pension Contribution (MRPS 7%)* | `domain/payroll.ts:224` |
| **6220** | Electricity & Utilities (STELCO / FENAKA) | *Ramadan Allowance Expense* | `domain/payroll.ts:212` |
| **1100** | Current Assets *(header)* | *Accounts Receivable* | `domain/multiCurrency.ts:126,133` |
| 6200 | — not in the seed — | Salaries & Staff Wages | `domain/payroll.ts:200` |
| 2170 | — not in the seed — | MRPS Pension Payable | `domain/payroll.ts:236` |
| 2180 | — not in the seed — | Net Salaries & Wages Payable | `domain/payroll.ts:247` |
| 2160 | — not in the seed — | Green Tax Payable (MIRA) | `domain/miraTgst.ts:218` |
| 4200 / 7100 | — not in the seed — | Realized FX Gain / Loss | `domain/multiCurrency.ts:127,132` |
| 1010, 1020, 1350, 1400, 2200, 2300, 5100, 5200 | — not in the seed — | various | `creditNotes`, `jobCosting`, `manufacturing`, `warehouse` |

**Consequences, in plain accounting terms:**

1. **Running payroll debits Workshop Rent and Electricity.** The employer pension contribution lands
   in the rent account and the Ramadan allowance lands in utilities. Opex by category is wrong from
   the first payroll run, and nothing flags it because both codes exist.
2. **Azhad's MPAO finding is real but aimed at a dead account.** `2130 MPAO` carries the wrong
   subtype — and it also never receives a posting, because payroll credits `2170`. Fixing 2130's
   subtype alone would leave the pension liability sitting in an account that is not in the chart at
   all.
3. **FX loss posts to 7100, which is outside every declared range.** `CLASS_CODE_RANGES` in
   `domain/accounts.ts` declares EXPENSE as 5000–6999. `accountClassForCode` only classifies 7100 as
   EXPENSE by falling through its final `else`. The account could not be created through the UI, and
   any range-validation added per the report's §5B would make the existing FX posting invalid.
4. **Multi-currency settlement posts AR into a header account** — and into `1100 Current Assets`
   rather than `1210 Trade Debtors Control`.

This is a **chart/ledger coherence defect**, not a naming defect. It outranks all four of Azhad's
findings and every item in the report's §5.

---

## 2. There is no server-side accounting authority to enforce anything against

The report repeatedly requires enforcement "at the posting/database layer" and validation
"server-side, not only in React" (§4 `isSystem`, §5A, §5B, §5C). That layer does not exist for the
chart:

- **No `chart_of_accounts` / `accounts` table exists in any migration.** The full table list across
  `supabase/migrations/` contains `journal_entries`, `journal_lines`, `accounting_periods`,
  `tax_rate_schedules`, `tax_registrations` — and no accounts table.
- **`journal_lines.account_code` is `text not null` with no foreign key**
  (`202608200003_commercial_accounting.sql:120`). The database accepts any string as an account.
- **The chart, the manual journals and the accounting periods all persist in browser
  `localStorage`** — keys `starq:chart_of_accounts:v1`, `starq:manual_journals:v1`,
  `starq:accounting_periods:v1` (`components/accounts/AccountsView.tsx:65,83,96,143`). Clearing site
  data destroys the chart. Two browsers are two charts.

So `isSystem` is not merely "weaker than it looks" — there is no authoritative store in which a
posting control could be expressed. **The first corrective work is not renaming accounts; it is
giving the chart a database table, a foreign key from `journal_lines.account_code`, and posting
controls as data.** Until that exists, items 6, 7, 8, 9 and 10 of the report's §8 acceptance gate
cannot be satisfied at all.

---

## 3. Correction: the tourism-GST finding is mis-scoped

The report escalates `2122 MIRA Tourism GST (TGST 16%)` to **CRITICAL** and treats it as a stale
seed requiring a rate change. That is partly right and materially mis-aimed.

**Newer authority the report did not have:**

- `docs/adjudications/2026-08-22_TGST-RATE-16-vs-17.md` **already settled this on 22 August** — 17%
  from 1 July 2025, sourced to MIRA's own circular, marked CLOSED with "cite this rather than
  re-arguing it."
- The **tax engine already complies.** `202608250017_tax_regimes_and_periods.sql:45-47` seeds
  effective-dated schedules: TGST 12% (2015-11-01→2022-12-31), **16% (2023-01-01→2025-06-30)**,
  **17% (2025-07-01→open)**, resolved by time of supply in `app_private.calculate_line_tax`. This is
  exactly the design the report asks for, already shipped.

**The actual live defect is worse than a label, and in a different file:**

- `web/src/domain/miraTgst.ts` **hard-codes the rate in the arithmetic** — `round2(subtotal * 0.16)`
  at line 116, the reverse-charge divisor `(16 / 116)` at line 133, and the selector
  `inv.gstRate === 0.16` at line 114. The tourism GST return schedule computes at 16%.
- `web/src/domain/miraGst201.ts:49` types the bucket as `'tourism_16'`.

So: the seed label is cosmetic, the **computation is wrong**, and it is wrong in direct violation of
a decision closed seven days earlier — including that adjudication's own explicit warning that
swapping the constant to `0.17` reproduces the identical defect pointing the other way. The fix is
for `miraTgst.ts` to resolve the rate from `tax_rate_schedules` by time of supply, not to edit a
constant.

**Reclassify:** report's "CRITICAL — stale seed label" → **CRITICAL — tourism GST is computed at a
hard-coded 16% in `miraTgst.ts`, breaching adjudication 2026-08-22.**

---

## 4. Line-by-line verdict on the report

| Report finding | Verdict against private `main` | Evidence |
|---|---|---|
| A. `2130` MPAO subtype `TAX_PAYABLE` | **Confirmed** — and the account is unused; payroll credits `2170` | `defaultChartOfAccounts.ts` 2130; `payroll.ts:236` |
| B. `6210`/`6220` share `RENT_AND_UTILITIES` | **Confirmed** — and both codes are simultaneously claimed by payroll | `accounts.ts` SUBTYPE_LABELS; `payroll.ts:212,224` |
| C. Retained earnings / current-year earnings | **Confirmed as a control concern; the report's refinement is correct.** Close posts to `3200` from computed net income, so no user-postable CYE account is needed | `lib/periodClosing.ts:134-155` |
| D. `6310` BML & Favara bundled | **Confirmed** — provider names in canonical GL names | `defaultChartOfAccounts.ts` 6310 |
| CRITICAL — TGST 16% | **Confirmed but mis-scoped — see §3.** DB engine already correct; the *computation* in `miraTgst.ts` is the defect | migration `…0017:45-47`; `miraTgst.ts:114,116,133` |
| HIGH — Input GST missing | **Confirmed.** Seed has output GST (`2121`, `2122`) and no input-tax account | `defaultChartOfAccounts.ts` |
| HIGH — EWT payable missing | **Confirmed.** Note the DB already anticipates it: `tax_registrations.tax_type` accepts `'withholding_tax'` | `…0017:26` |
| HIGH — NWT payable missing | **Confirmed** | — |
| MED-HIGH — Income tax payable missing | **Confirmed.** The DB already registers `income_tax` for both tenants with no GL account to carry it | `…0017:54,61` |
| HIGH — payroll control accounts underdeveloped | **Confirmed and understated — see §1** | `payroll.ts:200-248` |
| §5A subtypes unconstrained by class | **Confirmed.** The dropdown iterates the entire `SUBTYPE_LABELS` map | `NewAccountModal.tsx:236` |
| §5B code range not validated on submit | **Confirmed.** `handleSubmit` checks required + uniqueness only | `NewAccountModal.tsx:94-117` |
| §5C hierarchy cycles possible | **Confirmed.** `eligibleParents` excludes self only, not descendants | `NewAccountModal.tsx:136-138` |
| §5D `isSystem` is only metadata | **Confirmed and understated — see §2** | — |
| §5E code suggestion not hierarchy-aware | **Confirmed.** Max code across the whole class | `NewAccountModal.tsx:59-68` |
| "39-account canonical seed" | **Accurate** — 39 records | `defaultChartOfAccounts.ts` |

**Nothing in the report was found to be false.** One finding is mis-scoped (§3); two are understated
(§1, §2).

---

## 5. Elder's additional findings

| # | Finding | Severity |
|---|---|---|
| E1 | Canonical CoA and posting engines are disjoint code universes; `6210`, `6220`, `1100` collide with different meanings | **CRITICAL** |
| E2 | No accounts table in the database; `journal_lines.account_code` is unconstrained free text | **CRITICAL** |
| E3 | Chart, journals and periods persist in browser `localStorage` — no server authority, no durability, no multi-user coherence | ~~CRITICAL~~ **CONTEXT — see amendment below** |
| E4 | `miraTgst.ts` computes tourism GST at a hard-coded 16%, breaching closed adjudication 2026-08-22 | **CRITICAL** |
| E5 | `7100` (FX Loss) falls outside `CLASS_CODE_RANGES.EXPENSE` (5000–6999); classified only by the `else` fallback | **HIGH** |
| E6 | `CLASS_CODE_RANGES.EXPENSE` declares `prefix: '5'` but `max: '6999'` — auto-suggest and any prefix check will disagree | **MEDIUM** |
| E7 | Multi-currency settlement posts AR to `1100`, a header account, and the wrong one (`1210` is the AR control) | **HIGH** |

---

### Amendment, 29 August 2026 — E3 was overstated

Sizing the remediation turned up context that changes how E3 should be read, so it is corrected here
rather than left standing.

The web application touches Supabase in **exactly one non-test file** — `services/auth.ts`. The
entire finance kernel is `localStorage`; the Postgres core (journal entries, tax engine, RLS,
append-only triggers) exists and the UI never calls it. That much is accurate as stated in §2.

**But it is not a finding of this audit.** `SERP-155` already settled it as a deliberate lane change:
the revision front end is *"a specification with a working face"* — mock data, with the proven core
underneath. Listing it as a CRITICAL discovery alongside E1 and E4 implied it was unknown. It was
known, and it was chosen.

**What does not soften:** E1 and E4 are defects **inside the specification**. A spec that says
payroll debits rent will produce a backend that debits rent. That is precisely why they are worth
correcting now, while correcting them is cheap.

**Consequence for scope:** moving the chart, journals and periods onto the server is **not** part of
this remediation — it is the SERP-155 lane. `SERP-344` gives the chart a table and a foreign key;
wiring the React surface to it belongs to the lane. §2's conclusion stands as a statement of where
enforcement must eventually live, not as a work item this audit opens.

---

## 6. Consequence for sequencing

The report's §8 acceptance gate is correct as a destination and unreachable in its stated order.
Corrective work must run **kernel-first**:

```
1. Accounts become data        → chart_of_accounts table, FK from journal_lines.account_code,
                                 posting-control classes as columns, not UI metadata
2. One code universe           → reconcile seed vs posting engines; migrate existing posted rows
                                 without rewriting historical economic meaning
3. Rates become lookups        → miraTgst.ts / miraGst201.ts resolve from tax_rate_schedules
4. Missing accounts added      → input GST, EWT, NWT, income tax, payroll control set
5. Taxonomy corrections        → MPAO subtype, rent/utilities split, provider-name removal
6. UI validation               → class/subtype matrix, code range, hierarchy acyclicity
7. Close hardening             → idempotent, audited year-end roll-forward
```

Steps 5 and 6 are where the report starts. Doing them first produces a correctly-labelled chart that
the ledger still does not post to.

**Every step is ledger-affecting and requires tests plus a migration assessment** — seed → schema →
posting engine → reports → tax → UI. No cosmetic-only fixes, per the founder's instruction.

---

## 7. Disposition

- **SERP-290 remains `done`.** Its delivery history (completed 2026-08-28 by Antigravity) is
  preserved intact. This is a post-delivery quality audit, not a reversal.
- **Corrective ownership sits with SERP-339**, the umbrella finance-kernel integrity task, which
  references SERP-290 and blocks final finance-kernel acceptance. It holds no work of its own — the
  work is **SERP-340 … SERP-346**:

  | Task | Part | Depends on |
  |---|---|---|
  | `SERP-340` | One account-code universe — reconcile the chart against every posting engine | — |
  | `SERP-341` | Taxonomy corrections + the missing Maldives statutory accounts | 340 |
  | `SERP-342` | Tourism GST resolves by time of supply — remove the hard-coded `0.16` | 341 |
  | `SERP-343` | CoA control validation — class/subtype matrix, code ranges, hierarchy integrity | — |
  | `SERP-344` | Accounts become data — `chart_of_accounts` table + FK from `journal_lines` | — |
  | `SERP-345` | Year-end close hardening — idempotent, audited, system-only Retained Earnings | 340, 344 |
  | `SERP-346` | Acceptance gate — prove it, then return the surface to Azhad | all |

  `340 → 341 → 342` is a hard chain. `343` and `344` run alongside. `346` gates the umbrella.
  The split was made for **WIP=1**: the duty roster shows one available engineer, so the value is in
  making each piece independently acceptable in sequence, not in parallelising across a team that is
  not on.
- **SERP-290, 291, 292, 295, 296 and 297 each carry an `audit_supplement` pointer to this folder**,
  so the report resurfaces when any of them is next attended.
- **After remediation, the accounting surface returns to Azhad for a second review.** The bar is the
  founder's: not that the screen looks right, but that the accounting underneath holds up.
