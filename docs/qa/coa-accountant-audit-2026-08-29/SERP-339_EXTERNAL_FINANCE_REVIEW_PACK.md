# SERP-339 — External Finance Review Pack

**Prepared:** 4 September 2026, by Elder, at the founder's instruction, for independent parallel
review by Claude and Gemini.
**Ask:** FINANCE REVIEW — ACCEPT or HOLD. Not a code review — a review of whether the accounting
logic described below is something an accountant would sign off on.
**Scope:** the Chart of Accounts remediation chain (SERP-340–346) that sits under the SERP-339
umbrella. This pack is self-contained; only referenced files are cited, not the whole repo.

---

## 1. SERP-339 — task and acceptance criteria

**Title:** UMBRELLA — finance-kernel integrity remediation (CoA accountant audit, 29 Aug 2026)

SERP-339 holds no work of its own. It is the umbrella over SERP-340 through SERP-346 and blocks
final finance-kernel acceptance until they close. It exists because an accountant (Azhad) reviewed
the live Chart of Accounts on 29 August 2026, raised four findings, and an independent
revalidation/reconciliation confirmed all four, mis-scoped one, and found defects the audit itself
had missed — including one that made most of the audit's own remediation list unimplementable as
written (see §3).

**Acceptance criteria (verbatim from the board):**
1. SERP-340 through SERP-346 are all done.
2. The received audit has been consumed as an acceptance supplement, not filed and forgotten.
3. Every ledger-affecting change shipped with tests and a migration assessment across seed, schema,
   posting engine, reports, tax and UI — no cosmetic-only fixes.
4. **Azhad has reviewed the remediated accounting surface and cannot find a structural flaw.**

**Explicit scope boundary** (set by the founder, 29 August 2026): moving the chart, journals and
accounting periods off browser `localStorage` onto the server is **not** in this umbrella — that is
a separate, deliberate lane (SERP-155). The proven Postgres core (journal entries, tax engine, RLS)
exists underneath; the revision front end is described as "a specification with a working face."
`SERP-344` (below) gives the chart a database table and a foreign key, but wiring the React screens
to it belongs to the other lane.

---

## 2. Why Azhad's re-review is the close condition, exactly

> **AZHAD REVIEWING THE SURFACE AGAIN. Not Elder's opinion, not a green suite. The founder's bar: he
> should look again and struggle to find a flaw.**

This is a direct quote from the task's own `close_condition` field. The reasoning: code passing its
own tests is not accounting acceptance. Every fix below has been implemented and tested by the
people who found the defects — that is exactly the situation that needs an independent, adversarial
second look before anyone calls it closed. This pack is one such independent look; Azhad's is the
other, separately scheduled one.

---

## 3. The finding underneath Azhad's four findings

Azhad's original review (29 Aug) raised four specific issues (§4 below). A reconciliation against
the actual codebase found something the screen could not show him:

> **The canonical Chart of Accounts and the posting engines used two different, disjoint
> account-code universes. Where they overlapped, they disagreed about what the account meant.**

Concretely, before remediation:

| Code | The chart said | A posting engine actually did | Where |
|---|---|---|---|
| `6210` | Workshop & Garage Rent | *Employer Pension Contribution (7%)* | `web/src/domain/payroll.ts:224` |
| `6220` | Electricity & Utilities | *Ramadan Allowance Expense* | `web/src/domain/payroll.ts:212` |
| `1100` | Current Assets (header — should never be posted to) | *Accounts Receivable* | `web/src/domain/multiCurrency.ts:126,133` |
| `2170` | not in the chart at all | MRPS Pension Payable (payroll posted here) | `web/src/domain/payroll.ts:236` |

**Consequence stated plainly: running payroll debited the Workshop Rent account for the employer's
pension contribution, and the Electricity account for the Ramadan allowance.** Nothing flagged it
because both account codes existed — they just meant something different to the ledger than to the
chart. This is why Azhad's finding A (MPAO misclassified, below) was real but aimed at an account
(`2130`) that was also *dead* — payroll never posted to it at all.

This is the defect the whole remediation chain (SERP-340→346) actually fixes, in this forced order
(the acceptance-gate order the report originally proposed — taxonomy fixes first — would have
produced "a correctly-labelled chart the ledger still does not post to"):

```
340  One account-code universe    reconcile chart vs every posting engine
341  Taxonomy + missing accounts  MPAO, rent/utilities split, MIRA statutory accounts
342  Tourism GST by time-of-supply, not a hard-coded rate
343  CoA control validation       class/subtype matrix, code ranges, hierarchy acyclicity
344  Accounts become data         chart_of_accounts table + FK from journal_lines
345  Year-end close hardening     idempotent, audited, system-only Retained Earnings
346  Acceptance gate              prove all of the above, then return to Azhad
```

---

## 4. Azhad's four original findings, and what was found on top

### A · MPAO classified as a tax
**Azhad:** account `2130 Maldives Pension Administration Office` carried subtype "MIRA Tax & GST
Payable." MPAO is not MIRA and pension is not a tax.
**Confirmed, and worse:** `2130` also never received a posting — payroll credited `2170`, a code not
in the chart at all.
**Fix:** `2130` renamed *MPAO / MRPS Pension Contributions Payable*, new `PENSION_PAYABLE` subtype,
now receives the full 14% (employee's 7% + employer's 7%) as one remittance liability. Employer's 7%
is separately expensed at `6120`.

### B · Rent and utilities shared one subtype
**Azhad:** `6210 Workshop & Garage Rent` and `6220 Electricity & Utilities` shared subtype "Rent,
Power & Internet."
**Confirmed, and worse:** both codes were simultaneously being posted to by payroll (see §3).
**Fix:** split into `RENT_AND_LEASE` and `UTILITIES`; provider names (STELCO, FENAKA, BML, Favara)
removed from account names — provider is now a transaction dimension, not part of the GL account.

### C · Retained earnings / current-year earnings
**Azhad:** should there be a dedicated current-year-earnings or closing account?
**Disposition:** deliberately no new account. Current-period profit is *computed* from posted
revenue/expense balances and presented in equity. `3200 Retained Earnings` is now **system-only** —
no user can post to it in the application or the database; it moves only on year-end close. This is
flagged in the pack itself as a design decision Azhad should explicitly weigh in on, not a settled
technical fact.

### D · BML and Favara fees bundled
**Azhad:** `6310 BML & Favara Gateway Processing Fees` bundled different payment rails into one
account name.
**Fix:** renamed *Bank & Merchant Gateway Fees*; provider (BML/Favara/MIB) is now a transaction
dimension, allowing reconciliation without one GL account per bank.

### What the deeper review added on top of Azhad's four
| Finding | Resolution |
|---|---|
| Tourism GST hard-coded at 16% (has been 17% since 1 July 2025) | Fixed by **effective-dated schedule resolved at time of supply**, not by swapping the constant — see §6 |
| No input GST account existed at all | `1410 Input GST Recoverable (MIRA)` added, as an asset |
| No Employee Withholding Tax payable | `2124` added |
| No Non-resident Withholding Tax payable | `2125` added |
| No income tax payable/charge | `2126` and `6920` added |
| Payroll liabilities incomplete | `2140 Net Salaries & Wages Payable` added |
| Green tax had no account | `2123` added |

No rate is written into any account *name* — rates vary by category and a rate baked into a name is
a rate that goes stale, per the tourism-GST lesson above.

---

## 5. PR #25 and PR #26 — what actually shipped

Both are **open, unmerged, and independently branched off `main`** — this matters, see §9.

### PR #25 — `fix(SERP-341): taxonomy corrections and the missing Maldives statutory accounts`
Branch `elder/2026-08-30-serp341-taxonomy`. +1811/−41 across 17 files. Covers SERP-341, SERP-342,
and (per the board) SERP-344/345/346 groundwork.

Key files:
- `supabase/migrations/202608300035_chart_of_accounts_as_data.sql` — gives the chart a database
  table (SERP-344's core deliverable)
- `web/src/data/defaultChartOfAccounts.ts` — the 39→55 account seed
- `web/src/domain/taxRates.ts` (+ `taxRates.test.ts`) — effective-dated rate resolution
- `web/src/domain/miraTgst.ts`, `web/src/domain/miraGst201.ts` — tourism/general GST engines,
  no longer hard-coding a rate
- `web/src/domain/postingControl.ts` (+ `postingControl.test.ts`) — the "system now refuses to do"
  enforcement list in §7 below
- `web/src/test/serp_346_acceptance_gate.test.ts` — the acceptance-gate test suite
- `docs/specs/CHART_OF_ACCOUNTS_SPECIFICATION.md` — now the chart's authority document

**Test evidence, independently re-run just now (not taken from the PR description):**
`postingControl.test.ts`, `taxRates.test.ts`, `serp_346_acceptance_gate.test.ts` → **3 files, 65
tests, all pass.**

### PR #26 — `fix(SERP-343): Chart of Accounts structural validation — four gaps, enforced`
Branch `elder/2026-08-30-serp343-coa-validation`. +1107/−37 across 10 files. Covers SERP-343.

Key files:
- `web/src/domain/accountValidation.ts` (+ `accountValidation.test.ts`) — class/subtype matrix,
  code-range enforcement, hierarchy-acyclicity check
- `web/src/components/accounts/NewAccountModal.tsx` — UI wired to the validation above
- `web/src/test/serp_346_reconciliation.test.ts`

**Test evidence, independently re-run just now:** `accountValidation.test.ts`,
`serp_346_reconciliation.test.ts` → **2 files, 39 tests, all pass.**

**Combined: 5 test files, 104 tests, all passing — on each branch independently.** They have not
been tested together; see §9.

---

## 6. The tourism GST fix, in more detail (because the method is the actual point)

The engine computed at a hard-coded `0.16`. The correct rate has been **17% since 1 July 2025**
(settled by a prior adjudication, `docs/adjudications/2026-08-22_TGST-RATE-16-vs-17.md`, sourced to
MIRA's own circular). The fix was **not** to change the constant to `0.17` — a system holding one
current rate misstates every prior-period correction and every credit note raised against an older
invoice.

Rates are now an effective-dated schedule, resolved by **time of supply** (earlier of invoice issue
or payment received):

| Tax | Schedule |
|---|---|
| General GST | 6% to 2022-12-31, 8% from 2023-01-01 |
| Tourism GST | 12%, then 16% to 2025-06-30, **17% from 2025-07-01** |

A test asserts a credit note dated against a June-2025 invoice computes at 16%, and a 2026
correction against a 2025 invoice yields the original 800, not a re-rated 850.

---

## 7. What the system now refuses to do (enforced in both application and database)

| Attempt | Result |
|---|---|
| Post to a header account (`1000`, `1100`, `2000`, `2100`, `2120`) | Rejected |
| Manually post to a control account (AR `1210`, AP `2110`, Inventory `1310`, GST `2121`) | Rejected — owning engine only |
| Post to `3200` Retained Earnings as a user | Rejected — year-end close only |
| Post to an account not in the chart | Rejected |
| Post into a CLOSED or LOCKED period | Rejected |
| Run the year-end close twice | Rejected |
| Create an account whose code is outside its class range | Rejected |
| Give an account a subtype from another class | Rejected |
| Make an account a child of its own descendant | Rejected |

These are the controls a misstatement would need to get past, and are the specific things an
adversarial reviewer should try to break.

---

## 8. Six representative accounting flows (from the specification's §5, quoted verbatim)

**8.1 Customer invoice — parts and labour, GST registered**
```
Dr  1210  Trade Debtors Control          gross
    Cr  4120  Spare Parts & Merchandise Sales      net goods
    Cr  4110  Workshop & Job Labor Revenue         net labour
    Cr  2121  MIRA Output GST Payable              GST at the rate effective on the date of supply
```
Simultaneously: `Dr 5110 Cost of Parts & Materials Consumed / Cr 1310 Inventory` at moving-average cost.

**8.2 Customer receipt (direct, and via payment gateway)**
```
Dr  1111  BML MVR Main  /  Cr  1210  Trade Debtors Control
```
Via gateway (capture then settlement):
```
Dr 1115 Favara Gateway Clearing (gross) / Cr 1210 Trade Debtors
Dr 1111 BML MVR Main (net) + Dr 6310 Bank & Merchant Gateway Fees (fee) / Cr 1115 Gateway Clearing
```

**8.3 Supplier bill and payment**
```
Dr  1310 Inventory / 6xxx Expense  /  Cr  2110  Accounts Payable
Dr  2110  Accounts Payable         /  Cr  1111  BML MVR Main
```

**8.4 Payroll — the run that was posting to the wrong accounts before remediation**
```
Dr  6110  Staff Base Salaries & Allowances     gross remuneration
Dr  6120  Employer Pension Contribution        employer 7%
    Cr  2130  MPAO / MRPS Pension Contributions Payable  employee 7% + employer 7% = 14%
    Cr  2140  Net Salaries & Wages Payable      net pay
```
Then disbursement: `Dr 2140 / Cr 1111` and remittance: `Dr 2130 / Cr 1111`. The employee's 7% is a
deduction from gross pay, not an additional expense — only the employer's 7% hits the P&L.

**8.5 Foreign-currency settlement**
```
Dr  1111  BML MVR Main (MVR actually received)
    Cr  1210  Trade Debtors (MVR originally recorded)
    Cr  4310  Realized FX Gain (or Dr 6410 Realized FX Loss if unfavourable)
```

**8.6 Year-end close**
```
Dr  4xxx  each revenue account (to zero)
    Cr  5xxx/6xxx  each expense account (to zero)
    Cr  3200  Retained Earnings (net profit; Dr for a net loss)
```
Runs once per fiscal year, idempotent (a second run does not double the roll-forward), fully
attributed in the audit trail. No user may post to `3200` at any time.

---

## 9. Explicitly NOT proven — read this section as carefully as the rest

**9.1 PR #25 and PR #26 have not been tested together, and they conflict.**
Just verified directly: attempting to merge `elder/2026-08-30-serp343-coa-validation` into
`elder/2026-08-30-serp341-taxonomy` produces an **add/add conflict on
`web/src/test/serp_346_acceptance_gate.test.ts` itself** (plus a docs file). The 104 passing tests
cited in §5 are two separate, non-overlapping test runs — not one combined run. Someone has to
reconcile this before both can land, and the task record separately notes the *default chart of
accounts data itself* has drifted into **three divergent states** across branches (`origin/main` 49
accounts, one Elder branch 51, the two branches in this pack 55) — merging either branch alone
would silently drop accounts the other one added.

**9.2 Neither PR has been reviewed or merged.** Both are open against `main` as of this pack.

**9.3 Azhad has not re-reviewed.** This is the actual close condition (§2) and it is outstanding.

**9.4 The React screens are not wired to the new `chart_of_accounts` table.** By design (§1's scope
boundary) — the database now holds the chart, the foreign key, and posting controls, but the UI
still runs against `localStorage`. What is on screen is described as "the specification with a
working face"; the accounting logic under review here is that specification, not the live screen.

**9.5 Two fabricated TINs' real-world blast radius is a records question, not a code question,**
and is explicitly outside what a code review (external or internal) can answer:
> Were `1099882GST501` or `1002345GST501` ever used on a real invoice, GST/TGST return, MIRA filing,
> or any other document sent to a customer or MIRA? If yes — which document, and when?
Both were fabricated defaults that rendered on statutory UI surfaces; they've been removed from code
and a regression test prevents their return, but removing them from the code does not un-send
anything that already left the building. Per the founder's own ruling (`DEC-098`, 4 Sep 2026): the
founder verified from real records that **neither reached any actual filing or invoice** — the
records half is closed. The **code half** (the fix itself, on a separate branch/PR carrying its own
outstanding review findings) is tracked separately and is not part of this SERP-339 chain.

**9.6 Multi-currency revaluation, depreciation schedules, and inventory costing beyond moving
average have not been examined by anyone in accounting terms.**

**9.7 "Passing its own tests is not acceptance."** This is the task's own stated position, quoted
directly in §2 — worth repeating here as the frame for how to read everything else in this pack.

---

## Appendix — full source documents (for anyone who wants to go deeper than this pack)

| Document | Path |
|---|---|
| Azhad's original review + revalidation | `starqERP/docs/qa/coa-accountant-audit-2026-08-29/ACCOUNTANT_REVIEW_REPORT.md` |
| Full reconciliation against the repository | `starqERP/docs/qa/coa-accountant-audit-2026-08-29/ELDER_RECONCILIATION.md` |
| Account-by-account ruling table | `starqERP/docs/qa/coa-accountant-audit-2026-08-29/SERP-340_RULING_TABLE.md` |
| The pack written directly for Azhad's second review | `starqERP/docs/qa/coa-accountant-audit-2026-08-29/AZHAD_SECOND_REVIEW_PACK.md` |
| The chart specification (now the authority document) | `starqERP/docs/specs/CHART_OF_ACCOUNTS_SPECIFICATION.md` |
| Tourism GST rate determination | `starqERP/docs/adjudications/2026-08-22_TGST-RATE-16-vs-17.md` |
| PR #25 | https://github.com/almstq/starqERP/pull/25 |
| PR #26 | https://github.com/almstq/starqERP/pull/26 |
