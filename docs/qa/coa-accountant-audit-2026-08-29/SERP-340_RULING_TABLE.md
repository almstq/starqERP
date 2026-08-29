# SERP-340 — Account-code ruling table

**Date:** 29 August 2026 · **Author:** Elder · **Status:** **RULED 29 Aug 2026 — founder approved §2. The seed is canonical.**
**Task:** SERP-340, one account-code universe
**Rule:** no code changes until the rulings below are settled. Each is an accounting decision, not a refactor.

---

## 1. The real shape of the problem

The audit described "3 collisions and 13 orphan codes." Having mapped every `accountCode` literal in
`web/src` against the seed, it is worse and simpler than that:

| | |
|---|---|
| Accounts in the canonical seed | **39** |
| Distinct codes the posting engines actually use | **23** |
| Codes where seed and engines **agree** | **5** — `1200`, `1300`, `3200`, `4000`, `5000` |
| Codes in both that **mean different things** | **5** (audit said 3) |
| Codes posted to that are **not in the chart** | **14** (audit said 13) |
| Seed accounts **never posted to at all** | **30 of 39** |

**Five accounts out of thirty-nine are doing what the chart says they do.**

This is not a list of defects to patch. **There are two competing chart designs in the repository**
and nobody chose between them:

| | Canonical seed | Posting engines |
|---|---|---|
| Shape | 4-level hierarchy | flat, 2-level |
| Bank | `1110` Cash & Bank → `1111` BML MVR Main, `1112` BML USD | `1010` BML MVR, `1020` BML USD |
| Receivables | `1200` AR → `1210` Trade Debtors Control | `1100` |
| Payables | `2100` → `2110` AP (Trade Creditors) | `2000` |
| Origin | accountant-reviewed, Maldives-native, rendered in the UI | ad-hoc, invented per engine |

Patching 14 orphans one at a time would preserve both designs forever. One has to win.

---

## 2. RULING REQUIRED — which design is canonical

> **RULED, 29 August 2026: the founder approved this. THE SEED IS CANONICAL.**
> Q2 settled with it — Ramadan allowance folds into `6110`. Q3 (Favara `1115`) stays open and does
> not block; it is handed to SERP-296.

**Elder's recommendation, as put to the founder: the seed wins. Every posting engine repoints to it.**

Reasons: it is the chart an accountant actually reviewed (Azhad, 29 Aug); it is hierarchical, so
reports roll up; it is Maldives-native (MIRA, MPAO, BML/MIB, STELCO/FENAKA, Favara); it is what the
Chart of Accounts screen renders, so it is what any user believes the system uses; and SERP-290
delivered it as *"Standard Maldivian Chart of Accounts seeded per industry archetype."*

The engine codes are developer conveniences that were never reconciled with it. Nothing is lost by
retiring them — no posted production data depends on them, because the ledger has never run outside
`localStorage`.

**The rest of this document assumes that ruling. If you rule the other way, it is void.**

---

## 3. Collisions — same code, two meanings

The three below are silently wrong today: the code exists, so nothing errors, and the posting lands
in the wrong account.

| Code | Seed says | Engine posts | Ruling | Why |
|---|---|---|---|---|
| **`6210`** | Workshop & Garage Rent | Employer Pension Contribution (MRPS 7%) — `payroll.ts:224` | → **new `6120`** Employer Pension Contribution (MRPS 7%) | **Payroll currently debits rent.** Pension belongs beside `6110` Staff Salaries, not in premises cost |
| **`6220`** | Electricity & Utilities (STELCO / FENAKA) | Ramadan Allowance Expense — `payroll.ts:212` | → **`6110`** Staff Base Salaries & Allowances | **Payroll currently debits electricity.** `6110`'s own description already reads "monthly payroll, food allowances, and overtime" — see §5 Q2 |
| **`1100`** | Current Assets *(header)* | Accounts Receivable — `multiCurrency.ts:126,133`, `miraTgst.ts:210` | → **`1210`** Trade Debtors Control Account | Posting to a header breaks roll-up; `1210` is the actual AR control |
| **`2000`** | Liabilities *(ROOT header)* | Accounts Payable — `multiCurrency.ts:141,148` | → **`2110`** Accounts Payable (Trade Creditors) | **Not in the audit.** Posting to the root of the liability tree |
| **`6200`** | *not in seed* | **two different names in two files** — "Salaries & Staff Wages" `payroll.ts:200`, "Direct Labor Absorbed" `manufacturing.ts:163` | → `6110` **and** new `5240` respectively | **Not in the audit.** One code, two economically different things. Direct labour absorption is COGS, not opex |

---

## 4. Orphans — posted to, absent from the chart

| Code | Posts as | Ruling | Target |
|---|---|---|---|
| `1010` | BML MVR Account | repoint | **`1111`** BML MVR Main |
| `1020` | BML USD Operating Account | repoint | **`1112`** BML USD Account |
| `1350` | Goods-in-Transit (Sea Freight Inter-Island) | repoint | **`1320`** Goods in Transit (Sea Freight & Clearing) |
| `2170` | Maldives Retirement Pension Payable (MRPS) | repoint | **`2130`** MPAO — *this is the SERP-341 account. It exists and is exactly this. Fixing 2130's subtype without this repoint leaves it dead* |
| `2200` | Output GST Payable (Reversal) | repoint | **`2121`** MIRA Output GST Payable — a reversal is a debit to the same account, never a second account |
| `1400` | Work-in-Progress | **new** | `1330` under `1300` Inventory |
| `2140` | Net Salaries & Wages Payable *(was `2180`)* | **new** | `2140` under `2100` |
| `2150` | Customer Advances & Deposits *(was `2300`)* | **new** | `2150` under `2100` |
| `2123` | MIRA Green Tax Payable *(was `2160`)* | **new** | `2123` under `2120` MIRA Tax & Statutory Payables |
| `4310` | Realized Foreign Exchange Gain *(was `4200`)* | **new** | `4310` under `4000`, subtype `OTHER_INCOME` |
| `6410` | Realized Foreign Exchange Loss *(was `7100`)* | **new** | `6410` under `6000` — **this also fixes the out-of-range `7100`**, see §5 |
| `5220` | Manufacturing Scrap & Waste | **new** | `5220` under `5000` COGS |
| `5230` | Factory Overhead Absorbed | **new** | `5230` under `5000` COGS |
| `5240` | Direct Labor Absorbed *(from `6200`)* | **new** | `5240` under `5000` COGS |

**Ten new accounts, five repointed.** The chart goes **39 → 49**. *(Corrected 29 Aug: an earlier
draft of this table said nine and 48. Recounting by class gives ten — the miscount omitted `6410`
from the new-account tally while listing it in the table above.)* That is still small and professional,
and every addition is an economically distinct category that belongs in the statements — none of it
is provider or vendor detail, which stays in dimensions per the audit's own doctrine (§6).

---

## 5. Two range defects this closes

**`7100` is outside every declared range.** `CLASS_CODE_RANGES.EXPENSE` is `5000–6999`, so `7100`
is classified EXPENSE only by the final `else` in `accountClassForCode`, and could never be created
through the UI. Moving FX Loss to `6410` removes the anomaly rather than widening the range.

**`CLASS_CODE_RANGES.EXPENSE` is internally inconsistent** — `prefix: '5'` but `max: '6999'`. Any
prefix check and the auto-suggest disagree with each other. Once `7100` is gone, the honest fix is to
declare EXPENSE as two blocks (COGS `5000–5999`, OpEx `6000–6999`) or drop `prefix` in favour of the
range. **That is SERP-343's to land, not this task's** — flagged here so it is not lost.

---

## 6. Questions that are yours, not mine

**Q1 — Do you accept the §2 ruling that the seed is canonical?** Everything above depends on it.
My recommendation is yes and I do not think it is close, but it is a founder call because it decides
which of two designs the product carries.

**Q2 — Ramadan allowance: fold into `6110`, or its own account?**
Folding matches the audit's "don't proliferate GL accounts" doctrine and `6110` already says
"allowances." A separate `6130` would let you see the Ramadan cost as a line without a drill-down,
which matters if it is budgeted separately. **I lean fold**, but you know whether that number gets
looked at on its own.

**Q3 — Is `1115` Favara Instant Gateway Clearing settled?** It is in the seed as a system account and
is never posted to. Either the Favara flow is unbuilt, or it posts somewhere else. Not blocking, but
SERP-296 owns bank reconciliation and should not inherit an unexplained clearing account.

---

## 7. Sequencing once ruled

1. Add the nine new seed accounts. *Seed only — no engine changes yet.*
2. Repoint the five, one engine at a time, each with a test asserting the debit and credit land in
   the intended account.
3. Delete no codes: `6210` and `6220` keep their seed meanings; the payroll postings move off them.
4. Re-run the full domain test suite. `payroll.test.ts` and `warehouse.test.ts` currently pass
   against the wrong accounts and **must be updated to assert the right ones** — a green suite today
   is not evidence of correctness here.
5. Hand to SERP-341 for the taxonomy work, which now has `2130` actually receiving pension postings.

**No cosmetic-only fixes.** Every step touches seed → posting engine → tests, per the founder's
instruction and the audit's acceptance gate.
