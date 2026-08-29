# STARQ ERP — Chart of Accounts Specification

**Version:** 1.1 · **Effective:** 30 August 2026 · **Status:** Approved by the founder
**Owner:** Starq Technologies Pvt Ltd (Reg. C29552026)
**Prepared for:** external accountants, auditors, and implementation engineers
**Basis:** IFRS for SMEs Accounting Standard, Third Edition (2025)

> This is the authoritative description of the accounting structure in STARQ ERP: what every account
> is, when it is debited and credited, which accounts a human may post to, and how the ledger maps to
> Maldivian statutory obligations. **If the software disagrees with this document, the software is
> wrong.**

---

## 1. Basis of preparation

| | |
|---|---|
| **Framework** | IFRS for SMEs Accounting Standard, Third Edition (2025) |
| **Functional currency** | MVR (Maldivian Rufiyaa) |
| **Presentation currency** | MVR |
| **Foreign currency** | USD transacted; translated at transaction-date rate, settled at settlement-date rate, difference to realised FX gain/loss |
| **Inventory** | Perpetual, moving weighted average |
| **Depreciation** | Straight line |
| **Revenue** | Recognised on delivery of goods or completion of billed service |
| **Fiscal year** | Calendar year, 1 January – 31 December |
| **Double entry** | Every journal balances. Debits = credits, enforced at posting |

**Jurisdiction:** Republic of Maldives. Statutory counterparties are the Maldives Inland Revenue
Authority (MIRA) and the Maldives Pension Administration Office (MPAO).

---

## 2. Numbering convention

| Range | Class | Normal balance |
|---|---|---|
| `1000–1999` | Assets | Debit |
| `2000–2999` | Liabilities | Credit |
| `3000–3999` | Equity | Credit |
| `4000–4999` | Revenue | Credit |
| `5000–5999` | Cost of Goods Sold | Debit |
| `6000–6999` | Operating Expenses | Debit |

**Four digits, no exceptions.** The first digit determines the class and this is enforced, not
conventional. Codes outside `1000–6999` are invalid; there is deliberately no `7000+` block, because
an account that does not belong to one of the six classes above does not belong in the ledger.

**Depth:** up to four levels. Level 0 is the class root, level 1 a grouping, levels 2–3 postable
detail. Children sit numerically inside their parent's block (`1110` Cash & Bank contains `1111`
through `1115`) so that any report can roll up by prefix.

**Reserved:** `x000` is always the class root and is never postable.

---

## 3. Posting control classes

Every account carries exactly one control class. **This is enforced at the posting layer, not in the
user interface** — an account's control class determines what the system will accept, regardless of
what a screen offers.

| Class | Meaning | Who may post |
|---|---|---|
| **Header** | A grouping. Holds no balance of its own | **Nobody.** Direct journals are rejected |
| **Control** | Backed by a subledger that owns the detail | The owning engine only — invoicing, billing, inventory, tax. Manual journals rejected |
| **System** | Written by a defined system process | That process only — e.g. year-end close writes Retained Earnings |
| **Postable** | Ordinary account | Any authorised user, and engines |
| **Archived** | Retired | Nobody. Historic balances remain visible |

**Why control accounts are locked:** if a human can post directly to Trade Debtors, the general
ledger and the customer subledger drift apart and the receivables ageing stops reconciling. The
subledger is the detail; the control account is its total, and only the subledger may move it.

---

## 4. The Chart of Accounts

`H` header · `C` control · `S` system · `P` postable · `※` contra account

### 4.1 Assets — `1000`

| Code | Account | Ctl | Cur | Purpose · when it moves |
|---|---|---|---|---|
| `1000` | **Assets** | H | — | Class root |
| `1100` | Current Assets | H | — | Resources realisable within the operating cycle |
| `1110` | Cash and Bank Equivalents | H | — | |
| `1111` | Bank of Maldives (BML) MVR Main | P | MVR | Primary operating account. **Dr** receipts, **Cr** payments |
| `1112` | Bank of Maldives (BML) USD Account | P | USD | Foreign-currency trade. Retranslated at settlement |
| `1113` | Maldives Islamic Bank (MIB) MVR Account | P | MVR | Secondary operating account |
| `1114` | Petty Cash Fund | P | MVR | Cashier drawer and workshop float |
| `1115` | Favara Instant Gateway Clearing | C | MVR | **In-transit only.** Dr on gateway capture, Cr on bank settlement. A non-zero balance means unsettled receipts — see §8 |
| `1200` | Accounts Receivable | H | — | |
| `1210` | Trade Debtors Control Account | **C** | MVR | **Dr** on customer invoice, **Cr** on receipt or credit note. Invoicing engine only |
| `1300` | Inventory and Stock Assets | H | — | |
| `1310` | Merchandise & Spare Parts Inventory | **C** | MVR | Moving weighted average. **Dr** on goods received, **Cr** on issue to job or sale. Inventory engine only |
| `1320` | Goods in Transit (Sea Freight & Clearing) | P | MVR | Imports shipped but not received. Cleared to `1310` on arrival |
| `1330` | Work-in-Progress | **C** | MVR | Jobs and production started, not complete. Absorbs `5240` labour and `5230` overhead; relieved to `5110` on completion |
| `1400` | Statutory Tax Receivables | H | — | Amounts recoverable from MIRA |
| `1410` | Input GST Recoverable (MIRA) | **C** | MVR | GST incurred on qualifying purchases, claimable as input tax. **Dr** on a qualifying supplier invoice, **Cr** on settlement against output GST. Reported **gross** on GST-201 — see §6 |
| `1500` | Fixed Assets (Property, Plant & Equipment) | H | — | |
| `1510` | Workshop Machinery & Diagnostic Equipment | P | MVR | Capitalised at cost |
| `1590` | Accumulated Depreciation — Fixed Assets ※ | **S** | MVR | **Credit balance.** Written only by the depreciation run, contra to `1510` |

### 4.2 Liabilities — `2000`

| Code | Account | Ctl | Cur | Purpose · when it moves |
|---|---|---|---|---|
| `2000` | **Liabilities** | H | — | Class root |
| `2100` | Current Liabilities | H | — | Due within one year |
| `2110` | Accounts Payable (Trade Creditors) | **C** | MVR | **Cr** on supplier bill, **Dr** on payment. Billing engine only |
| `2120` | MIRA Tax & Statutory Payables | H | — | |
| `2121` | MIRA Output GST Payable | **C** | MVR | GST charged on sales. **Cr** on invoice, **Dr** on filing payment and on credit-note reversal. **Rate is never in the account** — see §6 |
| `2122` | MIRA Tourism GST Payable (TGST) | **C** | MVR | Tourism-sector supplies. Same treatment as `2121` |
| `2123` | MIRA Green Tax Payable | **C** | MVR | Per-guest-night environmental levy where applicable |
| `2124` | MIRA Employee Withholding Tax (EWT) Payable | **C** | MVR | Withheld from remuneration, owed to MIRA. Payroll-generated only. **No rate in the account** |
| `2125` | MIRA Non-resident Withholding Tax (NWT) Payable | **C** | MVR | On specified payments to non-residents. Rate varies by payment category, so none is encoded here |
| `2126` | MIRA Income Tax Payable | **C** | MVR | Current income tax liability. Written by the tax provision, never by hand |
| `2130` | MPAO / MRPS Pension Contributions Payable | **C** | MVR | **Cr** with employee deduction *and* employer contribution, **Dr** on remittance to MPAO. **This is not a tax** — see §7 |
| `2140` | Net Salaries & Wages Payable | **C** | MVR | **Cr** with net pay on payroll run, **Dr** on disbursement |
| `2150` | Customer Advances & Deposits | **C** | MVR | Money received before delivery. A liability until earned, never revenue |

### 4.3 Equity — `3000`

| Code | Account | Ctl | Cur | Purpose · when it moves |
|---|---|---|---|---|
| `3000` | **Equity** | H | — | Class root |
| `3100` | Owner's Capital & Share Capital | P | MVR | Contributed capital |
| `3200` | Retained Earnings | **S** | MVR | **Year-end close only.** No user may post here — see §5.6 |

**There is deliberately no "Current Year Earnings" account.** Current-period profit is *computed*
from posted revenue and expense balances and presented in equity on the balance sheet. Creating a
postable earnings account invites manual adjustment of profit, which is the single most common route
to a misstated result.

### 4.4 Revenue — `4000`

| Code | Account | Ctl | Cur | Purpose · when it moves |
|---|---|---|---|---|
| `4000` | **Revenue** | H | — | Class root |
| `4110` | Workshop & Job Labor Revenue | P | MVR | Billed labour and diagnostic fees |
| `4120` | Spare Parts & Merchandise Sales | P | MVR | Goods sold |
| `4210` | Sales Discounts Given ※ | P | MVR | **Debit balance.** Contra-revenue; never netted into `4110`/`4120`, so gross sales stay visible |
| `4310` | Realized Foreign Exchange Gain | **S** | MVR | Settlement-date gain on a foreign-currency receivable or payable. Written by the settlement engine |

### 4.5 Cost of Goods Sold — `5000`

| Code | Account | Ctl | Cur | Purpose · when it moves |
|---|---|---|---|---|
| `5000` | **Cost of Goods Sold** | H | — | Class root |
| `5110` | Cost of Parts & Materials Consumed | **C** | MVR | Relieved from `1310`/`1330` when a sale or job is invoiced. Inventory engine only |
| `5210` | Import Customs Duties & Port Charges | P | MVR | Maldives Customs tariffs, Malé Commercial Port fees. Capitalised into inventory cost where directly attributable |
| `5220` | Manufacturing Scrap & Waste | P | MVR | Production loss written off |
| `5230` | Factory Overhead Absorbed | **S** | MVR | Overhead applied to `1330` at the standard rate |
| `5240` | Direct Labor Absorbed | **S** | MVR | Technician time charged to `1330`. **Cost of production, not administrative payroll** |

### 4.6 Operating Expenses — `6000`

| Code | Account | Ctl | Cur | Purpose · when it moves |
|---|---|---|---|---|
| `6000` | **Operating Expenses** | H | — | Class root |
| `6110` | Staff Base Salaries & Allowances | P | MVR | Gross remuneration: basic, overtime, food and Ramadan allowances |
| `6120` | Employer Pension Contribution (MRPS 7%) | P | MVR | **Employer's** 7%. An expense, distinct from the employee's deduction |
| `6210` | Workshop & Garage Rent | P | MVR | Premises lease. **Payroll must never touch this** — see §9 |
| `6220` | Electricity & Utilities | P | MVR | Power, water, waste. Provider (STELCO/FENAKA) is a supplier dimension, not an account |
| `6310` | Bank & Merchant Gateway Fees | P | MVR | Acquiring discount and transfer fees. Provider (BML/Favara/MIB) is a dimension |
| `6410` | Realized Foreign Exchange Loss | **S** | MVR | Settlement-date loss. Counterpart to `4310` |
| `6910` | Depreciation Expense | **S** | MVR | Period charge, contra-credited to `1590` |
| `6920` | Current Income Tax Expense | **S** | MVR | Period income tax charge. Counterpart to `2126`; the computation lives outside the chart |

**55 accounts.** The chart is deliberately small. Provider, customer, supplier, employee, branch and
payment-rail detail lives in **dimensions and subledgers**, never in account names — which is why
there is one `6310`, not one account per bank.

---

## 5. Standard journal templates

Every template balances. `Dr` = debit, `Cr` = credit.

### 5.1 Customer invoice — parts and labour, GST registered

```
Dr  1210  Trade Debtors Control          gross
    Cr  4120  Spare Parts & Merchandise Sales      net goods
    Cr  4110  Workshop & Job Labor Revenue         net labour
    Cr  2121  MIRA Output GST Payable              GST at the rate effective on the date of supply
```
Simultaneously, cost of sale:
```
Dr  5110  Cost of Parts & Materials Consumed   moving-average cost
    Cr  1310  Merchandise & Spare Parts Inventory
```

### 5.2 Customer receipt

```
Dr  1111  BML MVR Main
    Cr  1210  Trade Debtors Control
```
Via payment gateway, in two steps — capture, then settlement:
```
Dr  1115  Favara Gateway Clearing        gross captured
    Cr  1210  Trade Debtors Control

Dr  1111  BML MVR Main                   net settled
Dr  6310  Bank & Merchant Gateway Fees   fee withheld
    Cr  1115  Favara Gateway Clearing     gross
```

### 5.3 Supplier bill and payment

```
Dr  1310  Inventory  /  6xxx Expense
    Cr  2110  Accounts Payable

Dr  2110  Accounts Payable
    Cr  1111  BML MVR Main
```

### 5.4 Payroll — the run that was posting to the wrong accounts

```
Dr  6110  Staff Base Salaries & Allowances     gross remuneration incl. allowances
Dr  6120  Employer Pension Contribution        employer 7%
    Cr  2130  MPAO / MRPS Pension Payable       employee 7% + employer 7% = 14%
    Cr  2140  Net Salaries & Wages Payable      net pay
```
Then disbursement and remittance:
```
Dr  2140  Net Salaries & Wages Payable
    Cr  1111  BML MVR Main

Dr  2130  MPAO / MRPS Pension Payable
    Cr  1111  BML MVR Main
```

**The employee's 7% is a deduction from gross pay, not an additional expense.** Only the employer's
7% hits the income statement. `2130` carries both halves because MPAO is remitted as one payment;
the split is preserved in the payroll subledger.

### 5.5 Foreign-currency settlement

```
Dr  1111  BML MVR Main            MVR actually received
    Cr  1210  Trade Debtors        MVR originally recorded
    Cr  4310  Realized FX Gain     difference, if favourable
```
or, if unfavourable, `Dr 6410 Realized FX Loss` for the difference.

### 5.6 Year-end close

```
Dr  4xxx  each revenue account      to zero
    Cr  5xxx / 6xxx  each expense account   to zero
    Cr  3200  Retained Earnings      net profit
```
(or `Dr 3200` for a net loss).

**Rules:** the close runs **once** per fiscal year and is idempotent — running it twice does not
double the roll-forward. It is fully attributed in the audit trail. Once closed, the period rejects
backdated entries unless reopened through the audited unlock workflow. **No user may post to `3200`
at any time.**

---

## 6. Tax treatment

**Rates are never stored in account names or code constants.** They are held as effective-dated
schedules and resolved by **time of supply** — the earlier of invoice issue or payment received.

| Tax | Rate | Effective |
|---|---|---|
| General GST (GGST) | 6% | 2 Oct 2011 – 31 Dec 2022 |
| General GST (GGST) | **8%** | 1 Jan 2023 – current |
| Tourism GST (TGST) | 12% | 1 Nov 2015 – 31 Dec 2022 |
| Tourism GST (TGST) | 16% | 1 Jan 2023 – 30 Jun 2025 |
| Tourism GST (TGST) | **17%** | **1 Jul 2025 – current** |

**Why this matters and is not a technicality:** a return filed for June 2025 must compute at 16% and
one for July 2025 at 17%, **from the same code**. A system holding a single current rate misstates
every prior-period correction and every credit note against an older invoice. Hard-coding `0.17`
is exactly as defective as hard-coding `0.16`.

GST is charged **only** where the entity is registered for that tax type on the date of supply.
Registration status is itself effective-dated. An unregistered entity charges nothing — it does not
charge 0%, it charges nothing, and no GST account moves.

**Output GST** (`2121`, `2122`) is collected on sales and owed to MIRA. **Input GST** (`1410`) is
incurred on qualifying purchases and recoverable — it is an **asset**, not a negative liability. Both are reported gross on the GST-201 return and settled net;
they are **not** netted into a single opaque account, because a net-only figure cannot be traced back
to the transactions that produced it.

---

## 7. MPAO is not MIRA

The Maldives Retirement Pension Scheme requires **7% from the employee and 7% from the employer**.
`2130` is a **pension liability owed to MPAO**, not a tax owed to MIRA.

Classifying pension under a tax subtype is a reporting error with consequences: it inflates the
apparent tax liability, it puts a pension balance into GST reconciliation, and it makes the MIRA
position on the balance sheet wrong. `2130` carries the subtype `PENSION_PAYABLE` and reports under payroll/statutory
liabilities, never under `2120` MIRA Tax & Statutory Payables.

**Withholding tax is different and does belong to MIRA.** `2124` EWT and `2125` NWT sit under `2120`
with the subtype `WITHHOLDING_TAX_PAYABLE`, so they are visible as MIRA obligations without being
confused with GST. No rate is encoded in either name, because NWT rates vary by payment category.

---

## 8. Clearing and suspense

`1115` Favara Gateway Clearing is an **in-transit** account. It is debited on capture and credited on
settlement, and in a reconciled ledger it holds only genuinely unsettled receipts.

**A clearing balance that ages is an exception, not a balance.** Any item older than the settlement
cycle must be investigated before period close. Clearing accounts are never used to park differences.

---

## 9. Control observations an auditor should test

These are the failure modes this specification exists to prevent. Each is testable.

1. **Payroll must never debit `6210` Workshop Rent or `6220` Electricity.** Post a payroll run and
   confirm the expense lines are `6110` and `6120`. *(This was a live defect, corrected under
   SERP-340.)*
2. **No posting to a header.** Attempt a direct journal to `1000`, `1100`, `2000`, `2100`, `2120` —
   each must be rejected.
3. **No manual posting to a control account.** Attempt a manual journal to `1210`, `2110`, `1310`,
   `2121` — each must be rejected outside its owning engine.
4. **`3200` Retained Earnings is unreachable by users** at all times, and moves only on close.
5. **Year-end close is idempotent.** Run it twice; the second run must not double the roll-forward.
6. **A closed period rejects backdated entries** unless reopened through the audited workflow.
7. **A June-2025 and a July-2025 tourism supply compute at 16% and 17%** from the same code path.
8. **An unregistered entity charges no GST**, and no GST account moves.
9. **Trial balance nets to zero** and **assets = liabilities + equity** after every scenario above.
10. **P&L drill-down reconciles line-for-line to GL entries**, and GST return boxes reconcile to
    tax-coded journals.
11. **Account codes cannot violate class ranges**, and the hierarchy cannot become cyclic.
12. **Every account code posted to by any engine exists in this chart** with the meaning stated here.
    *(This is the check that failed: five of thirty-nine accounts matched before SERP-340.)*

---

## 10. Change control

This chart is a controlled document.

- **Adding an account** requires an economically distinct category that belongs in the financial
  statements. If the need is analytical — a provider, a branch, a customer — it is a **dimension**,
  not an account.
- **Changing an account's meaning is prohibited.** Retire it and open a new one; historical postings
  keep the meaning they had when they were made.
- **Renaming** is permitted where it clarifies without altering meaning. Rates must never appear in
  names.
- **No deletions.** Accounts are archived; balances and history remain reportable.
- **Every ledger-affecting change ships with tests and a migration assessment** across seed → schema
  → posting engine → reports → tax → UI.

**Version history**

| Ver | Date | Change |
|---|---|---|
| 1.1 | 30 Aug 2026 | SERP-341. Six statutory accounts added — `1400`/`1410` input GST recoverable, `2124` EWT, `2125` NWT, `2126` income tax payable, `6920` income tax expense. `2130` moved off the tax subtype onto `PENSION_PAYABLE`. `RENT_AND_UTILITIES` split into `RENT_AND_LEASE` and `UTILITIES`. Provider names removed from `6220` and `6310` — STELCO, FENAKA, BML and Favara are dimensions, not accounts. 49 → 55 |
| 1.0 | 29 Aug 2026 | First issue. Establishes 49 accounts, posting-control classes, journal templates, effective-dated tax treatment, and separates MPAO from MIRA. Supersedes the undocumented 39-account seed, of which only five accounts matched what the posting engines used. |

---

## Appendix A — provenance

This specification exists because of a defect found by review, not by testing.

On 29 August 2026 the founder asked **Azhad**, an accountant, to inspect the live Chart of Accounts
rather than relying on the structure as built. Azhad raised four findings — the MPAO subtype,
rent/utilities grouping, retained-earnings treatment, and payment-fee granularity. An independent
revalidation against current MIRA and MPAO guidance confirmed all four and identified more, including
a tourism GST rate computed at a superseded 16%.

Reconciling that review against the repository showed the deeper problem: **the chart shown in the
product and the accounts the ledger actually posted to were two different sets.** Five of
thirty-nine accounts agreed. Running payroll debited Workshop Rent and Electricity.

Supporting record:

- `docs/qa/coa-accountant-audit-2026-08-29/` — the accountant's review, the reconciliation against
  the repository, and the account-by-account ruling table
- `docs/adjudications/2026-08-22_TGST-RATE-16-vs-17.md` — the tourism GST rate determination

**The chart is returned to Azhad for a second review against this specification.** The standard is
not that the screen looks correct, but that the accounting underneath withstands inspection.
