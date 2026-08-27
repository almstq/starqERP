# MALDIVES LOCALIZATION & REGULATORY READINESS AUDIT

**Document Status**: Authoritative Statutory & Local Market Fit Audit  
**Date**: 2026-08-27  
**Jurisdiction**: Republic of Maldives (MIRA, MED, MMA, Maldives Pension Administration Office)  

---

## 1. Maldives-Specific Compliance Matrix

| Statutory / Operational Requirement | Real-World Maldivian Expectation | starqERP Status | Implementation Reality & Evidence |
| :--- | :--- | :---: | :--- |
| **Base Operating Currency (MVR)** | All official books & tax records in Maldivian Rufiyaa (`MVR` / `Rf`). | **IMPLEMENTED** | Hardcoded/configured as default currency with `formatMVR` and standard rounding. |
| **Foreign Currencies (USD, EUR)** | Many importers buy in USD, pay supplier bills in USD, and accept USD cash/wire. | **PARTIAL** | Schema allows `currency character(3)`, but client lacks dynamic MMA daily exchange rate tables and realized/unrealized FX gain/loss posting. |
| **MIRA GST (8% General Sector Rate)** | 8% GST calculated on taxable supplies, excluded on zero-rated/exempt items. | **IMPLEMENTED** | Native 8% GST calculation across invoice lines with explicit GST status toggle (`registered` vs `unregistered`). |
| **MIRA Tourism GST (16% TGSTA)** | 16% TGSTA for tourism sector (safari boats, guesthouses, resort contractors). | **PARTIAL** | Tax registration schedule table exists in migration 0017; client hardcodes 8% on invoice line generator. |
| **MIRA Tax Identification Number (TIN)**| Formal TIN validation format (e.g. `1004829GST001`). | **IMPLEMENTED** | Field persisted on `organisations` and verified on invoice headers. |
| **Statutory MIRA GST-201 Return Output** | Periodic return consolidating Box 1 (Standard-rated sales), Box 5 (Total Output Tax), Box 8 (Standard-rated purchases), Box 12 (Total Input Tax), Box 13 (Net GST Payable). | **PARTIAL** | `ReportsView` calculates total sales, purchases, and net payable, but lacks official MIRA GST-201 export format. |
| **BML / MIB Payment Slip Reconciliation** | Customers transfer via Bank of Maldives (BML) or Maldives Islamic Bank (MIB) Internet Banking and send screenshot slips with BML Transaction Reference. | **PARTIAL** | Payment record captures `method: 'BML Transfer'` and transaction reference; lacks OCR slip parsing or automated MT940 statement sync. |
| **BML Favara Direct Clearing** | Real-time interbank instant payment rails (MMA Favara). | **DESIGNED ONLY** | Field available in payment metadata; no live API integration with MMA Favara gateway. |
| **Multi-Island Branch Operations** | Businesses operating in Male', Hulhumale, Villimale, Thilafushi, and outer atolls. | **IMPLEMENTED** | Island and location tags across `organisations`, `locations`, `book_locations`, and audit logs. |
| **Sea-Cargo & Island Harbor Logistics** | Tracking Dhoni / Landing Craft deliveries, harbor bill of lading, and freight fees. | **MISSING** | No dedicated harbor delivery slip or freight manifest document type. |
| **Dhivehi (Thaana) Customer Documents** | Customer invoices, receipts, and estimates rendered with Thaana text or bilingual terms. | **MISSING** | All labels, totals, and print templates are currently English-only. Thaana fonts are not yet embedded. |
| **Maldives Pension Scheme & WHT** | Mandatory 7% employer + 7% employee pension deductions and 10% Non-Resident Withholding Tax. | **MISSING** | No payroll or employee compensation deduction module currently implemented. |

---

## 2. Assessment Summary: Maldives Market Fit

### Strengths:
1. **Zero Tax Theater**: On 24 August 2026, the tax engine was corrected so that an unregistered business never renders a fake TIN or unauthorized MIRA GST liability.
2. **True Island Context**: Unlike foreign ERPs that force "State/Province/ZIP", starqERP natively understands Atolls, Islands, and Local Council registration codes.

### Immediate Localization Gaps to Close:
1. **Multi-Currency (USD/MVR) Ledger**: Import-heavy traders cannot operate without recording supplier debts in USD and settling via BML USD accounts.
2. **BML Slip Attachment & Verification**: Counter staff need to upload the BML transfer screenshot directly to the payment record for audit verification.
3. **MIRA GST-201 Filing Schedule**: A 1-click summary report matching MIRA's online portal boxes.
