> **PRESERVED SOURCE DOCUMENT — DO NOT EDIT.**
>
> This is the accountant-led Chart of Accounts review as received, reproduced verbatim below the
> rule. It is preserved as durable project evidence under the never-delete rule.
>
> | | |
> |---|---|
> | **Received** | 29 August 2026 |
> | **Commissioned by** | Mustarq (Founder) |
> | **First reviewer** | Azhad — accountant, inspected the live CoA and raised four findings |
> | **Second pass** | ChatGPT — independent revalidation, regulatory research, deeper CoA inspection |
> | **Preserved by** | Elder, 29 August 2026 |
> | **Source file** | `starqERP_COA_Accountant_Review_Strengthening_2026-08-29.md` |
> | **SHA-256** | `d0af187690cbe44ad719d9923fe20d44a8668885b47d53eacf5b920ff6f5edc4` |
>
> **Corrections and disagreements do not belong in this file.** Elder's verification of these
> claims against private `main` is a separate document: [`ELDER_RECONCILIATION.md`](./ELDER_RECONCILIATION.md).
> Where the two disagree, the reconciliation is the operative instruction and this file remains
> the untouched record of what was reported.

---

# starqERP Chart of Accounts — Accountant Review, Regulatory Revalidation & Strengthening Report

**Date:** 29 August 2026  
**Status:** Audit finding / corrective-development reference  
**Primary task:** SERP-290 — Chart of Accounts management and account hierarchy UI  
**Cross-links:** SERP-291, SERP-292, SERP-295, SERP-296, SERP-297  
**Purpose:** Preserve the accountant-led review, correct confirmed defects, strengthen the accounting kernel, and ensure the findings are consumed when the responsible finance tasks are worked.

---

## 1. How this review started

After the current starqERP Chart of Accounts was implemented and visible in the product, Founder **Mustarq** asked **Azhad** to review it from an accounting perspective rather than relying only on the development/LLM-generated structure.

Azhad identified four issues:

1. Account **2130 — Maldives Pension Administration Office (MPAO)** was incorrectly classified with the subtype **“MIRA Tax & GST Payable.”**
2. Accounts **6210 — Workshop & Garage Rent** and **6220 — Electricity & Utilities** were separate GL accounts but shared the overly broad subtype **“Rent, Power & Internet.”**
3. The chart showed **Retained Earnings** but no obvious dedicated **Current Year Earnings / closing account**, raising a concern about year-end roll-forward.
4. Account **6310 — BML & Favara Gateway Processing Fees** bundled different payment rails/providers, reducing reconciliation granularity.

Mustarq then requested an independent revalidation of Azhad’s comments, current regulatory research, a deeper technical inspection of the implemented CoA, and identification of anything else that should be strengthened while the accounting kernel is still being built.

### People involved

- **Mustarq — Founder:** initiated the accountant review, requested independent revalidation, and set the quality target.
- **Azhad — accounting reviewer:** performed the first finance-side inspection and raised the original four findings.
- **ChatGPT — research/synthesis:** revalidated the findings against the current implementation, the starqERP task design, and current official Maldives tax/pension sources.
- **Elder — Founder’s deputy:** to preserve this report in the project record, link it to the responsible task(s), and ensure it is consumed during implementation/rework.
- **Engineering agents:** to implement only after task ownership/dependency is clear, with ledger integrity and migration safety preserved.

---

## 2. Executive verdict

Azhad’s review was valuable and directionally correct. Three of the four findings require direct structural or metadata improvement. The retained-earnings point is a valid control concern, but the current starqERP task design already intends **computed current-period net income** and a **year-end close into Retained Earnings**, so the correct response is to verify and harden that mechanism rather than automatically create a normal user-postable “Current Year Earnings” account.

The deeper review also found additional issues that are more important than the original cosmetic labels:

- The seeded tourism GST account is stale: it still says **TGST 16%**, while the official Maldives tourism GST rate has been **17% since 1 July 2025**.
- The canonical CoA has **Output GST**, but no explicit **Input GST / recoverable input tax** account despite SERP-297 requiring Standard Purchases, Input Tax and Net MIRA Payable.
- No seeded **Employee Withholding Tax payable** or **Non-resident Withholding Tax payable** was found.
- No seeded **Income Tax payable/current tax provision** account was found.
- Payroll liabilities are underdeveloped for pension, employee deductions, wages payable and withholding.
- The “system” lock is currently represented as application metadata (`isSystem`) and must be enforced at the posting/database layer.
- The Create Account UI currently exposes all subtypes to all account classes, does not enforce account-code range validity on submit, and can permit structurally unsafe hierarchy edits unless protected elsewhere.
- Provider names are mixed into some canonical GL names where a generic ledger account plus provider/settlement dimension would scale better.

The goal is not to create a bloated chart. The goal is a **clean Maldives-native canonical template + controlled optional accounts + strong subledger/dimension metadata**.

---

## 3. Confirmed findings and required treatment

### A. Account 2130 — MPAO subtype is wrong

**Current:**  
`2130 Maldives Pension Administration Office (MPAO)`  
Subtype: `TAX_PAYABLE` → display label `MIRA Tax & GST Payable`

**Verdict:** Confirmed defect.

MPAO is not MIRA. Pension obligations should not be classified as a tax/GST payable. The Maldives Retirement Pension Scheme requires 7% employee and 7% employer contributions to the pension scheme.

**Required treatment:**

- Introduce an appropriate liability subtype such as:
  - `PENSION_PAYABLE`, or
  - broader `PAYROLL_STATUTORY_PAYABLE` with specific account metadata.
- Rename the account more clearly to **MPAO / MRPS Pension Contributions Payable**.
- Preserve the distinction between:
  - employee pension deduction;
  - employer pension expense/contribution;
  - total amount payable to MPAO.
- The GL may use one pension payable control account if the payroll subledger separately preserves the employee/employer split. Do not create unnecessary GL proliferation solely for presentation.

**Task links:** SERP-290, SERP-291; payroll-related task if one exists.

---

### B. 6210 Rent and 6220 Utilities share an over-broad subtype

**Current:**  
Both use `RENT_AND_UTILITIES` → “Rent, Power & Internet.”

**Verdict:** Confirmed classification weakness.

The GL accounts are already separate, so the accounting entries are not merged. The problem is the reporting taxonomy.

**Required treatment:**

Split subtype/reporting categories, e.g.:

- `RENT_AND_LEASE_EXPENSE` → Premises Rent & Lease
- `UTILITIES_EXPENSE` → Electricity, Water & Utilities
- optionally `TELECOM_EXPENSE` if telecom becomes material

Do not split STELCO and FENAKA into separate GL accounts unless a tenant actually needs that level of GL analysis. Provider-level reporting belongs in vendor/subledger dimensions.

**Task links:** SERP-290, SERP-293.

---

### C. Retained Earnings / Current Year Earnings

**Azhad concern:** a dedicated current-year earnings or closing account may be needed.

**Revalidation:** concern valid; proposed solution should be refined.

The starqERP roadmap already states:

- SERP-292 Balance Sheet includes **computed period Net Income**.
- SERP-295 year-end close **zeroes revenue/expense accounts and posts net balance to Retained Earnings**.

Therefore starqERP does **not automatically need a normal Current Year Earnings GL account**.

**Required treatment:**

- Current-period profit/loss should be computed from posted revenue and expense balances.
- Balance Sheet equity presentation should include current-period net income where required.
- SERP-295 must produce an auditable, idempotent year-end close.
- Closing entry must transfer the final net result to Retained Earnings exactly once.
- Closed periods must prevent backdated mutation unless reopened through the audited workflow.
- If implementation architecture needs a temporary closing account, it must be **system-only and non-user-postable**.

**Task links:** SERP-292, SERP-295.

---

### D. 6310 BML & Favara Gateway Processing Fees

**Verdict:** Confirmed design weakness.

BML merchant/card fees and Favara/instant-payment charges can have different settlement behaviour. However, hard-coding providers into the canonical account name creates future churn.

**Preferred design:**

Canonical GL:

- `Bank Charges`
- `Merchant / Card Processing Fees`
- `Instant Payment / Payment Rail Fees` where material

Provider dimension/subledger:

- BML
- Favara
- MIB
- other current/future providers

The bank reconciliation engine should reconcile gross receipts, fees, settlement clearing and net bank deposits without requiring a new GL account for every provider.

**Task links:** SERP-290, SERP-296.

---

## 4. Newly discovered issues

### CRITICAL — Tourism GST rate is stale

The current seed contains:

`2122 MIRA Tourism GST (TGST 16%)`

Current MIRA guidance states:

- General GST: **8%**
- Tourism GST: **17% from 1 July 2025**

The seed is therefore outdated for a 2026 ERP.

**Required treatment:**

- Change current tourism GST configuration to 17%.
- Do not hard-code a single tax rate permanently into account identity.
- Tax engine must support **effective-dated rates** so historical transactions retain the correct old rate.
- Historical 16% periods must remain reportable.
- SERP-297 must use tax-period effective rates rather than only account labels.

**Task links:** SERP-290, SERP-297.

---

### HIGH — Input GST / recoverable input tax is missing from the canonical CoA

The current CoA contains Output GST payable, but no explicit Input GST / recoverable input tax account was found.

MIRA permits qualifying GST-registered businesses to claim GST incurred on eligible business purchases as input tax. SERP-297 itself requires **Standard Purchases, Input Tax and Net MIRA Payable**.

**Required treatment:**

Add or model an appropriate control account, e.g.:

- `Input GST Recoverable / GST Input Tax`
- correct asset/tax-control classification
- effective tax-code linkage
- automatic posting from qualifying supplier invoices
- blocking/flagging of non-claimable input tax where relevant
- period settlement/netting logic into GST payable/recoverable reporting

Do not merely net all purchase and sales GST into one opaque account if that prevents auditability.

**Task links:** SERP-290, SERP-291, SERP-297.

---

### HIGH — Employee Withholding Tax payable missing

Maldives employers can be required to withhold Employee Withholding Tax from remuneration and file/pay it to MIRA.

**Required treatment:**

Provide a controlled optional account and tax rule:

- `MIRA Employee Withholding Tax Payable`
- payroll-generated posting only where applicable
- linked to employee/payroll tax computation and return data
- no manual rate hard-coding in the account name

**Task links:** SERP-290; payroll/tax task; SERP-291.

---

### HIGH — Non-resident Withholding Tax payable missing

MIRA requires businesses making specified payments to non-residents to withhold and remit NWT. Current official guidance includes 10% on several payment categories and 5% for non-resident contractor income, subject to applicable rules/reliefs.

**Required treatment:**

Provide controlled tax liability infrastructure:

- `MIRA Non-resident Withholding Tax Payable`
- transaction-level tax code/rate/effective-date metadata
- supplier residency/tax-treatment flag
- filing support for MIRA 602 where in scope
- do not encode “10%” into the account identity because different NWT categories can have different rates

**Task links:** SERP-290; tax roadmap/task.

---

### MEDIUM-HIGH — Income Tax payable/current tax provision absent

The canonical seed should be able to represent the entity’s income-tax liability and tax expense without manual misuse of generic MIRA accounts.

**Required treatment:**

Consider controlled accounts such as:

- `Current Income Tax Expense`
- `Income Tax Payable / Current Tax Liability`

Tax calculation logic should remain separate from the chart structure and follow the legal entity’s applicable tax treatment.

**Task links:** SERP-290, year-end/tax tasks.

---

### HIGH — Payroll control accounts need a deliberate structure

A professional payroll posting flow normally needs enough structure to reconcile gross remuneration, employer expense, employee deductions and amounts actually paid.

Review whether the accounting kernel has or needs:

- Gross Salaries / Wages Expense
- Employer Pension Contribution Expense
- Salaries / Wages Payable or Payroll Clearing
- MPAO Pension Payable
- EWT Payable
- other lawful employee deductions payable where applicable

The objective is reconciliation, not account proliferation.

**Task links:** SERP-290, SERP-291, payroll task.

---

## 5. Technical CoA-control issues found in the implementation

### A. Subtypes are not constrained by account class in Create Account UI

The current subtype dropdown exposes the entire subtype list. This permits conceptually invalid combinations unless another layer rejects them.

Examples that must be impossible:

- Asset + Payroll Expense subtype
- Expense + Accounts Receivable subtype
- Liability + Fixed Asset subtype

**Required control:** define an allowed subtype matrix by account class and enforce it on both client and authoritative server/database paths.

---

### B. Account-code class/range is not validated on submit

The UI checks uniqueness but does not enforce the declared code range/class relationship when saving.

**Required control:**

- account code must be valid format;
- code must map to the intended account class;
- custom account allocation must respect reserved/system ranges;
- validation must exist server-side, not only in React.

---

### C. Hierarchy cycles must be impossible

The parent selector excludes the account itself but can still expose descendants unless another control exists.

**Required control:**

- an account cannot become a child of itself or any descendant;
- system control groups cannot be arbitrarily re-parented;
- hierarchy integrity must be enforced authoritatively.

---

### D. `isSystem` must mean more than a lock icon

The current model contains `isSystem: true`, but UI metadata is not sufficient accounting protection.

**Required control classes should be explicit:**

1. **Header / non-postable**
2. **Control account / auto-post only**
3. **System closing account / system-only**
4. **Normal user-postable account**
5. **Inactive / archived**

Posting engine/database must reject invalid direct postings, not rely on UI behaviour.

Examples:

- Assets / Liabilities / Equity headers → non-postable
- AR control → invoice/settlement engine controlled
- AP control → bill/settlement engine controlled
- Inventory control → inventory engine controlled
- GST control → tax engine controlled
- Retained Earnings → year-end/system controlled
- clearing accounts → controlled according to settlement workflow

---

### E. Custom-account code suggestion should be hierarchy-aware

Using the maximum code across an entire account class to suggest the next code is technically simple but can create poor account numbering.

Prefer parent/range-aware allocation so a new utility account is suggested in a utility block rather than simply after the highest-numbered expense account.

---

## 6. Maldives-native strengthening doctrine

The canonical chart should remain **small and professional**.

Do not solve every requirement by adding another account. Use the correct layer:

- **GL account:** economically distinct category that belongs in financial statements/reconciliation.
- **Subtype/reporting taxonomy:** grouping for management reports.
- **Tax code:** rate, effective date, taxable/exempt/zero-rated treatment and filing mapping.
- **Vendor/payment-provider dimension:** BML, MIB, Favara, STELCO, FENAKA, etc.
- **Subledger:** customer, supplier, employee, inventory item, bank transaction.
- **Operating Book / Legal Entity:** reporting and consolidation boundary.

This prevents the CoA from becoming a list of company names while preserving drill-down detail.

---

## 7. Task ownership / cross-link map

### SERP-290 — PRIMARY OWNER
**Chart of Accounts management and account hierarchy UI**

Attach this report to SERP-290 as a **post-delivery accountant/regulatory audit and corrective reference**.

SERP-290 must own:

- MPAO subtype correction
- subtype taxonomy improvements
- TGST seed correction
- Input GST account design
- EWT/NWT/income-tax payable account availability
- account-class/subtype validation
- code-range validation
- hierarchy integrity
- explicit posting-control metadata

Do not erase the fact that SERP-290 was previously delivered. Preserve this as a real post-delivery quality finding.

### SERP-291
**Live double-entry journal posting UI and General Ledger explorer**

Must consume:

- posting restrictions for header/control/system accounts
- automatic tax/payroll/control postings
- prevention of manual misuse of control accounts
- complete audit attribution

### SERP-292
**Trial Balance and authoritative Balance Sheet**

Must consume:

- current-period Net Income treatment
- retained earnings presentation
- contra-account behaviour
- GST recoverable/payable classification

### SERP-295
**Period lock, month-end close and year-end roll-forward**

Must consume:

- Azhad’s retained-earnings concern
- computed current-year earnings
- idempotent year-end closing
- system-only Retained Earnings posting
- locked-period integrity

### SERP-296
**Bank & cash ledger / reconciliation**

Must consume:

- BML/Favara fee separation strategy
- settlement clearing vs fee expense distinction
- provider metadata/dimensions
- bank fee auto-booking

### SERP-297
**MIRA GST-201 schedule/export**

Must consume:

- current general GST 8%
- tourism GST 17% from 1 July 2025
- effective-dated historical rates
- Input GST
- Output GST
- net payable/recoverable
- tax-code-to-return-box mapping

---

## 8. Required implementation acceptance gate

Do not mark the accounting clean-up complete until all applicable checks pass:

1. No MPAO balance can appear under a MIRA GST subtype/report.
2. Tourism GST uses 17% for transactions from 1 July 2025 onward while preserving historical 16% treatment.
3. Input GST is traceable from supplier transaction → GL → GST return schedule.
4. Output GST is traceable from sale → GL → GST return schedule.
5. EWT/NWT liabilities are available where applicable without contaminating ordinary GST balances.
6. Header accounts reject direct journals.
7. AR/AP/inventory/tax control accounts reject unauthorized manual postings where the subledger should control them.
8. Account subtype choices are valid for their account class.
9. Account codes cannot violate class/range/reserved-code policy.
10. Account hierarchy cannot become cyclic.
11. Current-period profit is correctly represented without manual retained-earnings manipulation.
12. Year-end close is repeat-safe/idempotent and audited.
13. Provider settlement fees can be reconciled without hard-coding the chart to only BML/Favara.
14. Trial Balance remains balanced after every test scenario.
15. Balance Sheet remains Assets = Liabilities + Equity after every test scenario.
16. P&L drill-down reconciles exactly to GL lines.
17. GST return values reconcile to underlying tax-coded journals.
18. Existing posted data is migrated without rewriting historical economic meaning.

---

## 9. Quality target

The target is not “the screen looks cleaner.”

The target is:

> **An accountant can inspect the Chart of Accounts, posting behaviour, close process, GST treatment, payroll liabilities and reconciliation flow and struggle to find a structural flaw.**

Founder’s quality bar for the next accountant review:

> **Azhad should be able to look again and say: “I can’t see a flaw in it.”**

That means the review must cover both **what the account is called** and **what the system is allowed to do with it**.

---

## 10. Instruction to Elder

**Elder — Founder’s deputy:**

1. Save this report into the durable starqERP finance/accounting documentation area.
2. Preserve its provenance: this was initiated by Mustarq after Azhad’s accountant review of the live CoA on 29 Aug 2026.
3. Attach/link the report to **SERP-290 as the primary corrective owner**.
4. Cross-link the relevant sections to **SERP-291, SERP-292, SERP-295, SERP-296 and SERP-297** so the report resurfaces automatically when each task is worked.
5. Do not allow these findings to disappear merely because SERP-290 was previously marked done.
6. If board governance prefers a new corrective task instead of reopening SERP-290, create one umbrella finance-quality task that references SERP-290 and blocks final finance-kernel acceptance until this report is consumed.
7. Before any implementation, verify private-repo/main reality and current migrations. Public-repo inspection in this report is evidence of the visible implementation, not authority over unpublished private changes.
8. When each linked task is attended, use this report as an acceptance supplement, not a loose suggestion.
9. Require tests and migration notes for every ledger-affecting correction.
10. After remediation, return the CoA to Azhad for a second accountant review.

---

## 11. Research basis

### Official Maldives sources checked

- Maldives Inland Revenue Authority — GST overview / FAQ:
  https://www.mira.gov.mv/Pages/View/gst
  https://www.mira.gov.mv/Pages/View/FAQ_GST

- MIRA — Input Tax:
  https://www.mira.gov.mv/Pages/View/gstinputtax

- MIRA — Employee Withholding Tax:
  https://www.mira.gov.mv/Pages/View/ewtoverview

- MIRA — Non-resident Withholding Tax:
  https://www.mira.gov.mv/Pages/View/FAQ_NWT

- MIRA — Company Income Tax:
  https://www.mira.gov.mv/Pages/View/ictcompanies

- Maldives Pension Office — MRPS contribution guidance:
  https://pension.gov.mv/en/mrps-investment

### Accounting-standard basis

- IFRS Foundation — IFRS for SMEs Accounting Standard, Third Edition (2025), including statement of income and retained earnings requirements:
  https://www.ifrs.org/content/dam/ifrs/publications/ifrs-for-smes/english/2025/ifrs-for-smes.pdf

### starqERP evidence checked

- `web/src/data/defaultChartOfAccounts.ts`
- `web/src/domain/accounts.ts`
- `web/src/components/accounts/NewAccountModal.tsx`
- SERP-290 through SERP-297 task definitions/evidence in the StarqNexus ERP task records
- SERP-290 implementation evidence showing the 39-account canonical seed and delivery commit

---

## 12. Final disposition

**Azhad’s four findings:** preserved and validated, with the retained-earnings recommendation refined.

**Additional confirmed issue:** stale 16% TGST in the seed is a production-relevant regulatory defect.

**Additional strengthening required:** Input GST, withholding/payroll liabilities, tax provision capability, authoritative posting controls, subtype/class integrity, code/hierarchy validation, and scalable provider reconciliation.

**Primary remediation anchor:** SERP-290  
**Downstream enforcement:** SERP-291 / 292 / 295 / 296 / 297

**Do not treat this as a UI polish report. It is a finance-kernel integrity report.**
