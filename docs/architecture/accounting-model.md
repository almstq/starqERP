<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document REMAINS VALID and is extended, not superseded, by the 28 Sep 2026 course correction.**
>
> Double-entry invariant and MIRA tax model remain canonical. Now read with the accounting-event/subledger layer requirement and the posting boundary. Follow the extension below where it touches StarqERP completion doctrine.
>
> **Current development SSOT:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](../governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
> **Current roadmap:** [`ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`](../roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md)
> **Supersession index:** [`SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md`](../governance/SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md)
>
> **What changed on 28 Sep 2026:** StarqERP development was stopped and the completion model
> was corrected from *complete the remaining modules* to *close the remaining business
> processes*. The five canonical ERP process chains are Order-to-Cash, Procure-to-Pay,
> Inventory-to-GL, Cash-to-Bank and Record-to-Report. This is **convergence, not rewrite** —
> all existing architecture, migrations, tests, evidence and completed tasks remain valid.
> **StarqERP implementation is ON HOLD** pending explicit Founder restart authorization.
>
> **Original content is preserved verbatim below.** Nothing was removed or rewritten.
>
---

# Double-Entry Bookkeeping & Maldives Tax Model

starqERP implements a strict double-entry ledger engine compliant with international accounting standards and localized for the Maldives Inland Revenue Authority (MIRA).

---

## 1. Double-Entry Invariant

Every financial transaction posted in starqERP generates immutable `journal_entries` and balanced `journal_lines`:

$$\sum \text{Debits} = \sum \text{Credits}$$

### Standard Account Types
- **1000–1999 (Assets)**: Cash on Hand, Bank Accounts, Accounts Receivable, Inventory Asset.
- **2000–2999 (Liabilities)**: Accounts Payable, GST Output Tax Payable, Accrued Expenses.
- **3000–3999 (Equity)**: Retained Earnings, Owner Capital.
- **4000–4999 (Revenue)**: Service Revenue, Parts Sales, Merchandise Sales.
- **5000–5999 (Cost of Goods Sold)**: Direct Parts COGS, Direct Labor COGS.
- **6000–6999 (Operating Expenses)**: Rent, Utilities, Salaries, Software Licenses.

---

## 2. Maldives MIRA Tax Compliance

### Supported Tax Regimes
1. **General GST (8%)**: Applied on standard taxable supplies across Maldives domestic trade.
2. **Tourism GST / TGST (16%)**: Applied on tourism goods and services sector transactions.
3. **Zero-Rated & Exempt Supplies**: For designated basic food items, educational services, and healthcare.

### Tax Period Filing & Allocation
- Automatic accrual into `tax_periods` (monthly or quarterly calendar cycles).
- Input GST on verified supplier invoices offsets Output GST on sales invoices.
- Automated generation of MIRA GST return schedules with audit reconciliations.
