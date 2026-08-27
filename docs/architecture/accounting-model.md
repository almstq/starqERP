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
