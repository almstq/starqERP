# TOP 10 COMMERCIAL BLOCKERS PREVENTING ODOO / SAP REPLACEMENT

**Document Status**: Authoritative Pre-Sales Barrier Inventory  
**Date**: 2026-08-27  

---

## The 10 Unforgiving Reasons an Established Enterprise Cannot Switch Today

| Rank | Commercial Blocker | Technical Root Cause | Customer Impact | Severity |
| :---: | :--- | :--- | :--- | :---: |
| **#1** | **Zero Data Migration & Import Tooling** | No CSV/Excel parsers, opening balance wizards, or bulk master data uploaders. | Customer cannot bring their 3,000 SKUs, 500 customers, or opening ledger balances into starqERP without manual developer SQL scripts. | **FATAL** |
| **#2** | **No Dynamic Staff Invitation & Role Management** | Authentication is gated by a hardcoded backend environment JSON allowlist (`STARQBOOKS_ALLOWLIST_JSON`). | Business owner cannot add, invite, or manage their own employees. Every new hire requires developer intervention. | **FATAL** |
| **#3** | **General Ledger & Double-Entry Not Surfaced in Runtime** | GL tables exist in PostgreSQL (`journal_entries`), but client runs on in-memory summaries without live GL posting, drilldowns, or Trial Balance. | Finance Manager / Auditor cannot verify debits and credits, audit account ledgers, or close monthly accounts. | **FATAL** |
| **#4** | **No Bank Statement Reconciliation (BML/MIB)** | No CSV/MT940 statement parser or side-by-side transaction matching interface. | Cashier/accountant must manually compare bank slips one by one without automated reconciliation against bank statements. | **HIGH** |
| **#5** | **No Landed Cost Allocation on Imports** | Purchasing records purchase price only; cannot allocate ocean freight, customs duty, and harbor handling over item cost basis. | Import-heavy traders cannot determine real landed unit cost or accurate gross margin on imported containers. | **HIGH** |
| **#6** | **No Multi-Warehouse Stock Transfers** | Schema allows multiple locations, but UI lacks formal Stock Transfer Orders, goods dispatch, and transit tracking. | Multi-branch businesses (Male' vs Hulhumale vs Thilafushi) cannot safely move inventory between warehouses. | **HIGH** |
| **#7** | **No Customer Credit Limits or Automated Aging Dunning** | Overdue days are calculated, but sales orders are not blocked when credit limits are exceeded; no automated WhatsApp/Email statements. | Wholesale suppliers risk accumulating uncontrolled bad debts. | **HIGH** |
| **#8** | **No MIRA GST-201 Formal Export Schedule** | Standard 8% GST is calculated, but no 1-click MIRA GST-201 export matching the online tax portal's exact boxes. | Tax accountant must manually transcribe invoice summaries into MIRA's portal. | **MEDIUM** |
| **#9** | **No Offline Caching or Low-Connectivity Sync** | Frontend requires active online round-trip per mutation with no service worker or local SQLite sync. | Outer-island boatyards and supply boats on unstable 4G suffer connection errors and failed commands. | **MEDIUM** |
| **#10**| **Single Monolithic Web Bundle (1.17 MB)** | All views, modals, and charts packaged into single bundle without route lazy loading. | Slower initial load time on mobile devices and 3G/4G connections. | **MEDIUM** |
