# For Azhad — second review of the STARQ ERP accounting surface

**Prepared:** 30 August 2026 · **By:** Elder, at the founder's instruction
**Your first review:** 29 August 2026
**What you are being asked:** look again, and try to break it.

---

## Why you are seeing this again

On 29 August you inspected the live Chart of Accounts and raised four things. All four were real.
They were then independently revalidated against current MIRA and MPAO guidance, which confirmed
them and found more, and the whole lot was reconciled against the actual repository rather than the
screen.

**That reconciliation found something none of the reviews had:** the chart shown in the product and
the accounts the ledger actually posted to were two different sets. **Five accounts out of
thirty-nine were doing what the chart said they did.**

Everything below has been fixed. **None of it is accepted until you say so.** The founder's standard
was that you should look again and struggle to find a flaw — not that the screen looks tidier.

---

## 1. Your four findings

### A · MPAO was classified as a tax

**You said:** account `2130 Maldives Pension Administration Office` carried the subtype
*"MIRA Tax & GST Payable"*. MPAO is not MIRA and pension is not a tax.

**You were right, and it was worse than the label.** `2130` also **never received a posting.** The
payroll engine credited `2170`, a code that was not in the chart at all. So the account was both
misclassified and dead — correcting the subtype alone would have left a correctly-labelled account
that nothing ever touched.

**Now:** `2130` is renamed *MPAO / MRPS Pension Contributions Payable*, carries a new
`PENSION_PAYABLE` subtype, and **receives the full 14%** — the employee's 7% deduction and the
employer's 7% — as one remittance liability. The employer's 7% is separately an expense at `6120`.

> **Please check:** run a payroll and confirm the split is what you would expect to see on an MPAO
> remittance. The employee half is a deduction from gross pay, not an additional cost.

### B · Rent and utilities shared one subtype

**You said:** `6210 Workshop & Garage Rent` and `6220 Electricity & Utilities` were separate accounts
sharing the subtype *"Rent, Power & Internet"*.

**Now:** split into `RENT_AND_LEASE` and `UTILITIES`. STELCO and FENAKA are **out of the account
name** — provider is a supplier dimension, not an account. Same for `6310`, which was *"BML & Favara
Gateway Processing Fees"* and is now *Bank & Merchant Gateway Fees*.

**A defect you could not have seen from the screen:** payroll was debiting **`6210` Workshop Rent**
for the employer pension contribution and **`6220` Electricity** for the Ramadan allowance. Opex by
category was wrong from the first payroll run, and nothing flagged it because both codes existed.

> **Please check:** a month's rent should be rent alone. There is now a standing test asserting
> exactly that, but your eye on the P&L is the real check.

### C · Retained earnings and current-year earnings

**You asked** whether a dedicated current-year earnings or closing account was needed.

**Your concern was right; the answer is deliberately not a new account.** Current-period profit is
**computed** from posted revenue and expense balances and presented in equity on the balance sheet.

The reason for not creating a postable Current Year Earnings account is that it invites manual
adjustment of profit, which is the commonest route to a misstated result. `3200 Retained Earnings` is
now **system-only**: no user can post to it, in the application or in the database, and it moves only
on the year-end close.

> **Please check:** whether you accept computed-and-presented over a postable account. If your
> practice expects a distinct CYE account for how you review, say so — it is a design decision, not
> a technical constraint, and it can change.

### D · BML and Favara fees were one account

**You said:** `6310 BML & Favara Gateway Processing Fees` bundled different payment rails.

**Now:** the account is *Bank & Merchant Gateway Fees*. Provider — BML, Favara, MIB — is a dimension
on the transaction, so reconciliation can separate them without a new GL account per bank.

> **Please check:** whether one fee account with a provider dimension gives you the reconciliation
> you need, or whether you want the rails split at GL level. Your call; it is cheap either way.

---

## 2. What the deeper review found on top

| Finding | State |
|---|---|
| Tourism GST computed at a **hard-coded 16%** — it has been 17% since 1 July 2025 | Fixed by **date**, not by swapping the number. See §4 |
| **No input GST account at all.** The chart had output GST and nothing to claim against it | `1410 Input GST Recoverable (MIRA)` added, as an **asset** |
| No Employee Withholding Tax payable | `2124` added |
| No Non-resident Withholding Tax payable | `2125` added |
| No income tax payable or charge | `2126` and `6920` added |
| Payroll liabilities incomplete | `2140 Net Salaries & Wages Payable` added |
| Green tax had no account | `2123` added |

**No rate is written into any account name.** NWT rates vary by payment category, and a rate in a
name is a rate that goes stale.

---

## 3. The chart

**39 → 55 accounts.** Deliberately still small. Provider, customer, supplier, employee and branch
detail lives in dimensions and subledgers, never in account names — which is why there is one `6310`
and not one account per bank.

Full listing with normal balances, what moves each account, and standard journal templates:
**`docs/specs/CHART_OF_ACCOUNTS_SPECIFICATION.md` v1.1.**

That document is now the authority. **If the software disagrees with it, the software is wrong.**

---

## 4. The tourism GST fix, because the method matters more than the number

The engine computed at `0.16`. The rate has been **17% since 1 July 2025**.

**It was not fixed by changing the constant to `0.17`.** A system holding one current rate misstates
every prior-period correction and every credit note raised against an older invoice.

Rates are now an **effective-dated schedule resolved by time of supply** — the earlier of invoice
issue or payment received:

| | |
|---|---|
| General GST | 6% to 2022-12-31, **8% from 2023-01-01** |
| Tourism GST | 12%, then 16% to 2025-06-30, **17% from 2025-07-01** |

> **Please check:** raise a credit note dated against a June-2025 tourism invoice and confirm it
> computes at **16%**, while a July-2025 supply computes at **17%**. There is a test asserting
> exactly that, and a test asserting a 2026 correction against a 2025 invoice yields 800 and not 850.

---

## 5. What the system now refuses to do

These are enforced in **both** the application and the database. Not conventions — refusals.

| Attempt | Result |
|---|---|
| Post to a header (`1000`, `1100`, `2000`, `2100`, `2120`) | **Rejected** |
| Manually post to a control account (`1210` AR, `2110` AP, `1310` Inventory, `2121` GST) | **Rejected** — the owning engine only |
| Post to `3200` Retained Earnings as a user | **Rejected** — the close only |
| Post to an account not in the chart | **Rejected** |
| Post into a **CLOSED** or **LOCKED** period | **Rejected** |
| Run the year-end close twice | **Rejected** |
| Create an account whose code is outside its class range | **Rejected** |
| Give an account a subtype from another class | **Rejected** |
| Make an account a child of its own descendant | **Rejected** |

> **Please check:** try to do these. They are the controls a misstatement would need in order to
> happen, and they are the ones worth attacking.

---

## 6. What is proven, and what is not

**Proven by execution, not by inspection:**

- Every journal balances; the trial balance nets to zero; **assets = liabilities + equity** with the
  current-period result carried into equity.
- Every P&L line equals a **recomputed** movement from the underlying journal lines — the report is
  checked against the ledger, not against its own totals.
- GST output reconciles to revenue at the statutory rate for the supply date.
- Tenant isolation on all payment tables: 29 of 29 adversarial checks pass.
- 87 test files, **399 tests**. All 35 database migrations apply cleanly.

**Not proven, and stated plainly:**

- **This review.** Code passing its own tests is not acceptance.
- The application still runs its ledger in the browser rather than against the database. The
  database now holds the chart, the foreign key and the posting controls, but wiring the screens to
  it is separate, scheduled work. **What you see on screen is the specification, and the accounting
  logic behind it is what is being reviewed.**
- Multi-currency revaluation, depreciation schedules and inventory costing beyond moving average
  have not been examined by anyone in accounting terms.

---

## 7. What would be most useful from you

Not a sign-off. **Specifically:**

1. **Anything in §1 where the fix is not what an accountant would have done.** Particularly C — the
   computed-earnings decision — and D, the fee-account granularity.
2. **Anything missing from the 55.** Prepayments, accruals, provisions, director's loan, deferred
   revenue: some of these exist as subtypes without accounts, deliberately, because an unused
   account is clutter. If your practice would expect one from day one, name it.
3. **Anything in the journal templates in the specification that would not survive an audit.**
   §5 of that document has the entries for sale, receipt, gateway settlement, supplier bill,
   payroll, FX settlement and year-end close.
4. **A statutory obligation we have not represented at all.** That is the failure mode we cannot
   test our way out of, because we do not know what we have not thought of.

If something is wrong, it is more useful said plainly than softened. The last round of your findings
turned out to be the visible edge of a much larger problem, and saying so early is what made it
fixable.

---

## Appendix — the record

| | |
|---|---|
| Your review and the revalidation | `docs/qa/coa-accountant-audit-2026-08-29/ACCOUNTANT_REVIEW_REPORT.md` |
| What was verified against the repository | `.../ELDER_RECONCILIATION.md` |
| The account-by-account rulings | `.../SERP-340_RULING_TABLE.md` |
| The specification | `docs/specs/CHART_OF_ACCOUNTS_SPECIFICATION.md` v1.1 |
| The tourism GST determination | `docs/adjudications/2026-08-22_TGST-RATE-16-vs-17.md` |
