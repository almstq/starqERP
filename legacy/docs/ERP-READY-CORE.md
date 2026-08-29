# starqBooks — ERP-ready core (Goal 1, ASAP)

| | |
|---|---|
| **Date** | 20 Aug 2026 |
| **Status** | NORTH STAR / first goal — **OPEN** (not complete) |
| **Live path** | `D:\StarqTech\starqBooks` |
| **Occupancies** | **Trial user #0** Starq Technologies Pvt Ltd `C29552026` (BNs Starq Dynamics, Hoadhaa Network). **Test user #1** Club Ignition + Ignition Ink garage. See `ACCESS.md` / `ORG-REGISTRY.md`. |
| **Principle** | **Not** a bookkeeping app that later bolts on POS. Small accounting/operations core, **ERP-ready data model from day one**. Accounting is the financial consequence engine under everything. |
| **Surfaces** | **Portal** = Ali HQ. **Flutter** = CI paint-shop sim / Nashid next-play. Do not mix. |

This file is SSOT for Goal 1. Occupancy law stays in `ACCESS.md`. Do not contradict it.

---

## Honest current state (do not rewrite history)

- **`journals/*.journal` are SSOT.** `books.db` is derived (`books.py post`). Never edit `books.db` by hand.
- **Ops events do not post GL yet.** DEC-008 is a **ledger-write gate only** (Ali appends `journals/` daily, then `books.py check`; ops/engine never writes the live ledger). It does **not** block product-dev. Destination is auto-journals **after trust**; work continues now. Do not pretend auto-post is live.
- Visible product today is books + CI garage ops events + catalog + SoD — **not** a full ERP UI.
- **Dashboard Next draft** is occupancy-correct gates (need issue / need price / need count / need amount / DEC-008 copy). No fake progress %. Starq has no shop POS, so need price is not a Starq till gate.
- **Customer invoice capture** on Sales (mirror of supplier bill): authorised seat types amount; customer is occupancy contact or an ops name — never invented. Tax 0. AR `1200` draft. Issue is still the existing Issue control (`issued` stays 0 until that click). Starq `4110` credits only when CoA + Dynamics BAR/8211 on disk allow it — will not invent BAR clearance. Contacts still `[]` and no ops customer names on live disk, so the capture form waits. Goal 1 remains **OPEN**.
- **Honest masters:** contacts `[]`, payroll employees `[]`, `INK-CAGE` `not_counted` (qty null), occupancy `sell_price_mvr` still empty, issued PO/INV still 0, tax live rate **0**, leftover paint inactive. Do not invent those figures. **Starter / Dhiraagu hosting is not a books fact** — do not put it on this product SSOT.
- **T-03 step 1 (local):** `scripts/backup-journals.py` copies `journals/` → `backups/journals-YYYY-MM-DD/` on D: only. Never deletes source. **Offsite encrypted copy still founder-gated** (SBK-032). Restore not rehearsed.
- **Occupancy chrome:** Starq Sales/Expenses/Contacts/Products/**Ops** list Starq events and docs only. CI garage events, cage SKUs, and CI till stay on Club Ignition. Reverse: Starq purchases / Starq CALL names do not render on CI chrome. Group is a labelled view, not a third company.
- **Ops tab** (`/transactions`) = occupancy-correct **ops events feed** plus posted journals (not fused). Accounting links here; duplicate event panel removed from Accounting.
- **Notes tab** = append-only local file per occupancy (`ops/notes/{group|starq|ci}.txt` on D:). Report guidance stays read-only in a collapsible section.
- **Decisions tab** = `decisions.json` filtered to **starqBooks/journals** items already on disk. Portal scm / Nexus deploy decisions stay out. No invented rows.

### Maldives (live)

- **GST not registered** — no 8% on live invoices.
- **`4300` retail blocked** on Club Ignition (not retail; leftover paint is not product).
- BAR / ISIC maps income: **`4100`** (Starq company, 6201 software), **`4110`** (Starq Dynamics, 8211), **`4200`–`4230`** (Ignition Ink garage, 4520).

### Visible v1 (first commercial release — keep simple)

**Dashboard → Sales → Expenses → Banking → Contacts → Products → Reports → Accounting → Settings.**

That sequence is the primary chrome in `serve.py` (19 Aug). Trial balance / P&amp;L / balance sheet sit under **Reports**; journal + chart under **Accounting**. Do not expose the full ladder in the chrome. Grow behind this foundation.

---

## Already true here

| Foundation | Now (starqBooks) | Goal |
|---|---|---|
| Chart of accounts | **Exists** — `accounts.csv` (classes, entity scope, blocked accounts) | Same CoA; subaccounts / import later |
| General ledger | **Double-entry exists** — `journals/` + `books.py check`. **Accounting** validates copy-ready outbox (PASS/FAIL: occupancy, known accounts, debit=credit, tax 0, leftover `4300` blocked, Starq no POS sale) **without writing journals**. **Ops tab** = occupancy-correct ops events on disk (the log until GL posts) plus posted journals, not fused. | Auto journals from ops; still no fake auto-post |
| Company / multi-company | **Two companies + BNs** plus fiscal period 2026, invoice/PO prefixes. **Issued increments only on explicit issue** by an authorised seat (not on award). Live issued still 0 until a valued event is issued. Cash/bank codes on the org record | Same model; later merchants via MED `C`/`BN` (`ORG-REGISTRY.md`) |
| Workshop / jobs | **Garage cycle as ops events.** Valued **CLOSE / INVOICE_PAYMENT** draft occupancy-correct income (CI `4200`–`4230`; Starq `4110` 8211 / `4100` 6201). **Customer invoice capture** on Sales types amount + occupancy customer (contact or ops name — never invent) → AR `1200` draft, Tax 0, unissued until Issue. Starq `4110` refused if BAR/8211 gate on disk is blocked. **AUTHORISATION** with amount drafts **2500** WIP/deferred. No amount → no draft. Never 8% GST, never `4300`. Ali still copies (DEC-008). Empty bay is honest. **Sales job costing** lists revenue / materials / labour **only when those amounts already exist on occupancy events**. Profit only when revenue and a cost amount both exist. No invented labour. | Job costing that posts journals |
| Purchasing | **SoD + GL drafts.** **Need → PR draft; quote → RFQ draft** (no invented vendor/amount; Expenses panel). **Linked chains** (`need_event_id` / `quote_event_id` or `scm_ref`) → award with real amount drafts **unissued PO** (`CI-PO-` / `ST-PO-`). **Authorised seat issues** → occupancy sequence increments `issued` and shows next. **GRN draft** only against an **issued PO** with **qty already on the receive event** — refuse if unissued / no qty. Occupancy-correct. Counted SKU may bump on-hand; `not_counted` gets a Products count link (will not invent opening qty). Need without amount is not a PO. Leftover refused. Ali still copies journals (DEC-008). **Local HTML print** (letterhead from org master, Tax 0, watermark **DRAFT** until issued). Missing amount or customer/supplier → print refused, not invented. Live issued still 0, so live GRN refuses until a PO is issued. **Three-way match** on Expenses: PO / GRN / INV columns from issued docs + GRN drafts on disk. **issued=0 → empty honest**, not fake matches. Sales INV is listed, not paired onto a PO. **Supplier bill capture** on Expenses: authorised seat types amount + occupancy vendor (contact if exists, else name already on ops — never invent). Optional issued PO. Tax 0. Ops event + AP outbox draft (`2100`). Not auto-post. | Full PR → PO → GRN → bill → payment + auto journals |
| Item master | **`ops/masters/products.json`** — CI 4520 services + Starq 6201/8211; leftover paint SKU inactive (`4300` blocked). Occupancy **SKU create** is id+name; sell_price and qty stay empty. Leftover cannot be created again. Starq Products chrome does not list CI cage SKUs. Catalog still holds rent/utilities cadence | Inventory qty + POS SKUs |
| Inventory qty | **`1300` on chart.** Qty field exists on `inventory.json`. `INK-CAGE` is still **`not_counted`** (qty **null**, not zero). Stock take writes qty (optional unit cost → **1300 draft**, not posted). Leftover paint not countable. **PURCHASE of a counted SKU with unit cost drafts 1300** (copy-paste); uncosted stays 5100; leftover refused | Destination: auto-journals / perpetual post **after trust**; masters, qty, and 1300 drafts continue now (DEC-008 is ledger-write only, not a coding blocker) |
| Auto-journals | **Outbox drafts exist** (`journal_outbox.py`). Copy-ready drafts **validate** on Accounting (PASS/FAIL). Ali still copies into `journals/` (DEC-008). Ops never appends GL | Every operational txn posts GL |
| POS | **CI till stub** at `/pos`. Counted qty consume. **Sale draft** only if occupancy `sell_price_mvr` is set (qty × master; CI `4200`–`4230`; COGS `5100`/`1300` if unit cost). Empty price → consume-only, refuse sale. Leftover never priced. **Not** on Starq occupancy | Live till after Ali writes a real price **and** a real count |
| CRM master | **Create is live.** Occupancy-scoped name + type (`customer` / `vendor` / `other`). Master stays **empty until Ali (or an authorised occupancy seat) adds someone**. **CALL party** may be added to contacts **only when the CALL already has a name string** — never invent the name. No seed, no fake Gmails. List = master rows + **ops-derived names labeled not masters**. **CRM pipeline** on Contacts uses existing CALL / garage ops steps as columns. No invented leads. Occupancy-correct. Nashid cannot write Starq. **Optional `contact_id` on issue/sale** only when that occupancy row exists — never created to satisfy the link. **Contacts now open a master row straight into Statement / ledger review, and Sales/Expenses can prefill that same existing contact.** **Statement of account** refuses while `contacts []`. | Lead → won → quotation |
| Locations / tax | **Create is live on Settings.** Occupancy-scoped name + type (`office` / `workshop` / `warehouse` / `godown` / `other`). **H. Kiev godown kept.** Starq still **no shop floor**; shop/POS type refused. No seed sites. **`tax.json`** live rate **0** until GST Active. Invoice/PO/sale drafts print **Tax: 0**. Posted 8 is refused. | Multi-warehouse later |
| Payroll / HR | **Create is live on Settings.** Occupancy-scoped name + job seat. **`rate_mvr` optional on Settings** when a row exists — Ali types it; empty clears. Pay draft only when rate on disk. `users.json` stays the person_id master; `payroll.json` is employment only (not a second people file). Roster **empty until Ali adds**. No seed, no invented salaries. **Payroll GL draft refuses** while `rate_mvr` is empty. Nashid never a Starq employee. Not a v1 nav tab | Timesheets / auto-post pay |
| Banking | **Org statuses on disk** — cash `1110` / wallet `1125` **open**; MIB `1120`/`1121` **not_opened**. Named cash/wallet on RECEIPT / pay / FIN_BANK drafts copy-ready on **Banking + Accounting**. **Customer payment/receipt against an issued INV** (amount already on ops, named cash/wallet → `1110`/`1125`; unnamed refuses inventing `1110`). Tax 0. Transfer does not invent a statement or opening. Ali copies (DEC-008). | Rec / feeds later |
| Audit / roles | **`ops/masters/users.json` + `permissions.json`** — person_id, entities, seats. Settings shows a **read-only seat × action matrix** from that file. Not editable in chrome. **Append-only master audit** (`ops/master_audit.jsonl`) of contact / SKU / location / employee / price / count writes, occupancy-correct, on Settings. Empty until a real write. No invented history. | Broader field/value audit later |

---

## Growth ladder (Stages 1–11)

A good way to design this is **not** as “a bookkeeping app that later gets POS bolted onto it.” Build it from day one as a **small accounting/operations core** that can progressively grow:

**Bookkeeping → Inventory → POS → Purchasing/Sales → CRM → HR/Payroll → Projects → Manufacturing/Service → Full ERP.**

The important part is that the underlying data model—company, contacts, products, accounts, tax, locations, transactions, users, permissions—is ERP-ready from the beginning.

| Stage | Product | Already true here / honest gap |
| ----- | ----------------------- | --- |
| **1** | Bookkeeping | **LIVE** — journals SSOT |
| **2** | Inventory | `INK-CAGE` still **not_counted** (qty null). Counted SKU + unit cost drafts 1300 |
| **3** | POS | CI consume stub live. Sale draft gated on occupancy `sell_price_mvr` (still empty). **Not** Starq occupancy |
| **4** | Sales + Purchasing | Unissued **PO/INV** drafts from valued SoD. **PR/RFQ ladder drafts** on Expenses (need/quote; no invented vendor/amount). **Issue engine** allocates occupancy-correct numbers (not on award). **GRN draft** against issued PO + qty (else refuse). **INV cash/wallet receipt** against issued INV only (unnamed will not invent `1110`). Live issued still 0. **Aging** empty honest until issued. **Three-way match** empty honest until issued. **Supplier bill capture** (typed amount + occupancy vendor, optional issued PO, Tax 0, AP draft). **Customer invoice capture** on Sales (typed amount + occupancy customer, Tax 0, AR `1200` draft; Issue still separate). Starq `4110` refused if BAR/8211 gate on disk is blocked. **Local HTML print** (org letterhead, Tax 0, DRAFT until issued). Auto-post still false |
| **5** | CRM | CALL exists as ops. Master still empty until a real name is written. **Add CALL party** uses the name already on the CALL — never invents it. **Pipeline** on Contacts = existing CALL / garage steps as columns. No invented leads. Not lead → won → quotation |
| **6** | Multi-branch | Later |
| **7** | HR + Payroll | Occupancy create (name+seat). **`rate_mvr` on Settings when row exists.** Employees []. Rates empty → no GL draft |
| **8** | Projects / Job Costing | Garage cycle + valued close/deposit **drafts**. **Sales panel** from real job amounts only (no invented labour/profit). Auto-post still false |
| **9** | Warehouse | Later |
| **10** | Manufacturing / Service | Paint-shop sim is Flutter / Nashid next-play — **not** Portal HQ |
| **11** | Full ERP platform | Destination; no rebuild of the core |

---

## 1. Core company setup

Every business account should have its own organization profile:

* Company/legal name
* Registration number
* TIN / GST number
* Financial year
* Base currency
* Time zone
* Accounting method
  * Accrual
  * Cash basis
* Default tax settings
* Fiscal periods
* Branches/locations
* Warehouses
* Bank accounts
* Cash accounts
* Opening balances
* Logo/document branding
* Invoice numbering
* Credit note numbering
* Purchase order numbering
* User roles and permissions

Eventually this becomes a **multi-company / multi-branch ERP structure**.

Live beta already has two companies with BNs hanging under them (`ORG-REGISTRY.md`). Open signup is not this week.

---

# 2. Chart of Accounts

This is the heart of the bookkeeping system.

Support standard account categories:

**Assets**

* Cash
* Bank
* Accounts receivable
* Inventory
* Prepayments
* Fixed assets
* Deposits
* Other current/non-current assets

**Liabilities**

* Accounts payable
* Loans
* Credit cards
* Accrued expenses
* Tax payable
* Other liabilities

**Equity**

* Share capital
* Owner's equity
* Retained earnings
* Drawings
* Dividends

**Income**

* Product sales
* Service revenue
* Other income
* Discounts
* Finance income

**Cost of Goods Sold**

* Product cost
* Freight
* Import costs
* Direct labour
* Production costs

**Expenses**

* Salaries
* Rent
* Utilities
* Marketing
* Repairs
* Fuel
* Office expense
* Professional fees
* Bank fees
* Depreciation
* etc.

Users should be able to:

* Create accounts
* Edit accounts
* Disable/archive accounts
* Create subaccounts
* Set account types
* View ledger entries
* View balances
* Set opening balances
* Import chart of accounts

And importantly:

> **Every operational transaction should ultimately create journal entries automatically.**

That is what makes the future ERP financially integrated.

**Already true here:** `accounts.csv` is the CoA. Income is BAR-mapped (`4100` / `4110` / `4200`–`4230`). Auto-journals from ops are the destination, not live.

---

# 3. General ledger

The system should maintain a proper double-entry ledger.

Functions:

* Journal entries
* Automatic journal generation
* Manual journals
* Recurring journals
* Reversing journals
* Journal approval
* Journal attachments
* Journal notes
* Account reconciliation
* Debit/credit validation
* Posting date
* Transaction date
* Reference number
* Source module
* Source document
* Created by
* Approved by
* Audit history

Example:

Customer invoice for MVR 1,000:

**Debit**
Accounts Receivable 1,000

**Credit**
Sales Revenue 1,000

If inventory is involved:

**Debit**
Cost of Goods Sold

**Credit**
Inventory

This same engine later supports POS, payroll, manufacturing, procurement and everything else.

**Already true here:** double-entry journals + `books.py check`. Automatic generation is **not** live (DEC-008 ledger-write gate). Destination: auto-journals after trust; coding continues now.

---

# 4. Customers / Accounts Receivable

Maintain a complete customer master.

Customer information:

* Name
* Business name
* TIN
* Registration number
* Phone
* Email
* Billing address
* Delivery address
* Contact persons
* Credit limit
* Payment terms
* Currency
* Tax treatment
* Price list
* Assigned salesperson
* Notes
* Attachments

Functions:

* Create quotations
* Convert quotation → sales order
* Convert sales order → invoice
* Direct invoice
* Recurring invoices
* Credit notes
* Customer payments
* Partial payments
* Advance payments
* Deposits
* Refunds
* Customer statement
* Aging report
* Outstanding invoice tracking
* Credit limit warnings
* Overdue reminders

Eventually:

**Lead → Opportunity → Quotation → Sales Order → Delivery → Invoice → Payment**

That's your ERP sales workflow.

**Already true here:** **AR aging** from issued INV minus named receipts on disk. **issued=0 → empty honest.** **Statement** refuses while `contacts []` — no invented customer. Live issued still 0.

---

# 5. Suppliers / Accounts Payable

Supplier master:

* Supplier name
* TIN
* Registration number
* Contacts
* Address
* Bank details
* Payment terms
* Currency
* Lead time
* Supplier category
* Preferred products
* Documents/contracts

Basic bookkeeping functions:

* Enter supplier bill
* Upload invoice
* Record expense
* Record supplier payment
* Partial payment
* Supplier credit
* Advance payment
* Supplier statement
* Payables aging
* Recurring bills

Future procurement workflow:

**Purchase Request → RFQ → Supplier Quotes → Comparison → Purchase Order → Goods Receipt → Supplier Bill → Payment**

**Already true here:** purchase SoD in ops. Award drafts unissued PO. Issue allocates occupancy numbers. **GRN draft** against issued PO with qty (count link if SKU not counted; bump only on counted path). **AP aging** from issued PO minus named pays (GRN qty does not settle). issued=0 empty honest. **Three-way match** on Expenses from issued PO/INV + GRN drafts. issued=0 empty honest, not fake matches. **Supplier bill capture** on Expenses (authorised seat, typed amount, occupancy vendor, optional issued PO, Tax 0, AP draft). Ali copies (DEC-008). Not auto-post.

---

# 6. Sales invoices

A QuickBooks-level system needs a strong invoicing engine.

Invoice should support:

* Customer
* Invoice date
* Due date
* Products/services
* Description
* Quantity
* Unit price
* Discount
* GST/tax
* Subtotal
* Shipping/freight
* Additional charges
* Grand total
* Amount paid
* Balance
* Payment terms
* Notes
* Attachments

Statuses:

**Draft → Sent → Partially Paid → Paid → Overdue → Cancelled**

Features:

* PDF invoice
* Print
* Email/share
* Duplicate invoice
* Recurring invoice
* Payment link eventually
* Invoice templates
* Custom fields
* Tax invoice formatting

**Maldives live:** no 8% GST on live invoices until GST is Active on MIRA.

**Already true here:** local HTML print of valued PO/INV (`GET /documents/print`, bind `127.0.0.1`). Letterhead from the occupancy org master. Tax 0. Watermark **DRAFT** until issued. Missing amount or customer → refuse, never invent. Print does not allocate a number and does not write `journals/`. **Customer invoice capture** on Sales: authorised seat types amount; customer from occupancy contact or ops name — never invented. Debit AR `1200`. Tax 0. Unissued INV draft; `issued` stays 0 until Issue. Starq `4110` only if CoA + Dynamics BAR/8211 on disk allow it (live CoA note is UNBLOCKED 16 Aug with `BP89422026` — that is a disk fact, not invented clearance). Contacts still empty on live disk.

---

# 7. Expenses

Very simple UX here is important.

User enters:

> Paid MVR 1,500 to STO for workshop supplies.

Select:

* Expense category
* Supplier
* Amount
* GST
* Payment method
* Account
* Date
* Receipt
* Notes

The accounting engine generates the journal automatically.

Support:

* Expense receipts
* Petty cash
* Reimbursements
* Staff expenses
* Recurring expenses
* Expense approvals
* Split expenses across accounts
* Cost centre allocation

**Already true here:** catalog items such as rent (10th) and utilities on `6210`. **Supplier bill** on Expenses: authorised seat types amount; vendor is occupancy contact or an ops name — never invented. Optional issued PO. Tax 0. AP outbox draft. Journals still Ali-appended (DEC-008). Dashboard **Next draft** lists honest gates (need issue / need price / need count / need amount / DEC-008 copy) — not a fake progress %.

---

# 8. Banking

Basic system:

* Bank accounts
* Cash accounts
* Credit cards
* Transfers
* Deposits
* Withdrawals
* Bank charges
* Interest
* Reconciliation

**Already true here:** org cash (`1110`, `1125` open) and MIB (`1120`, `1121` not_opened). Named cash/wallet events draft copy-ready text on Banking. No invented openings. No statement. Auto-post still false.

Later:

* Bank statement CSV import
* Automatic matching
* Bank feeds
* Transaction rules
* AI classification
* Duplicate detection
* Suspicious transaction alerts

Bank reconciliation screen should show:

**Bank Statement**

vs.

**Books**

and allow matching discrepancies.

---

# 9. Cash management

Especially important for POS.

Track:

* Main cash
* Petty cash
* Cash drawers
* Branch cash
* Employee floats
* Cash deposits
* Cash withdrawals
* Cash transfers

POS later adds:

* Opening float
* Cash sales
* Cash refunds
* Paid-in
* Paid-out
* Closing cash
* Expected cash
* Counted cash
* Variance

---

# 10. Tax / GST

For Maldives businesses, tax shouldn't be treated as an afterthought.

The tax engine should support:

* GST rates
* Tax-inclusive pricing
* Tax-exclusive pricing
* Input tax
* Output tax
* Exempt transactions
* Zero-rated transactions
* Tax adjustments
* Tax liability
* Tax period reporting

Reports could include:

* Sales GST
* Purchase GST
* Net GST payable
* Taxable sales
* Exempt sales
* Input tax claimed

Architect it so additional taxes can eventually be added instead of hardcoding one GST rate.

**Live:** GST not registered — do not put 8% on live invoices. Accounts `1220` / `2200` exist from pre-opening (GGST). MIRA registration is a human filing.

---

# 11. Products and services

Even before inventory exists, create a proper item master.

Types:

* Product
* Service
* Non-stock item
* Consumable
* Digital item
* Expense item

Attributes:

* SKU
* Barcode
* Name
* Description
* Category
* Brand
* Unit
* Sales price
* Cost price
* Tax
* Income account
* Expense/COGS account
* Inventory account
* Supplier
* Images

Later expand to:

* Variants
* Size
* Colour
* Batch
* Serial number
* Expiry
* Packaging
* Units of measure
* Multiple suppliers
* Multiple price lists

This is one of the biggest foundations for ERP expansion.

**Already true here:** `ops/masters/products.json` SKUs (CI 4520 + Starq 6201/8211) plus `ops/catalog/` cadence items (rent / utilities). Not a barcode retail master. `4300` leftover inactive. Starq occupancy has no cage SKU on Products chrome.

---

# 12. Inventory

I'd actually introduce inventory **before** POS.

Basic inventory:

* Stock on hand
* Stock value
* Purchases
* Sales
* Adjustments
* Opening stock
* Damaged stock
* Lost stock
* Returned stock

Then:

* Warehouses
* Locations/bins
* Stock transfers
* Goods received
* Goods issued
* Reserved inventory
* Available inventory
* Reorder level
* Reorder quantity
* Low-stock alerts
* Stock counting
* Cycle counting

Valuation:

* FIFO
* Weighted average

Eventually:

* Lots
* Serial numbers
* Expiry
* Landed costs
* Multi-warehouse routes
* Drop shipping
* Consignment

**Already true here:** qty schema on `inventory.json`. **Honest gap:** `INK-CAGE` still `not_counted` (qty null). Null is not zero. Stock take is live on CI Products. Starq has no shop cage.

---

# 13. POS

Once accounting + products + inventory are sound, POS becomes relatively straightforward.

## POS screen

Fast product selection:

* Search
* Category tiles
* Barcode scan
* Favourite items
* Product images

Cart:

* Product
* Quantity
* Price
* Discount
* Tax
* Notes
* Customer

Payments:

* Cash
* Card
* Bank transfer
* Wallet
* Split payment
* Credit
* Gift card eventually

Operations:

* Hold sale
* Resume sale
* Void line
* Void transaction
* Refund
* Exchange
* Return
* Reprint receipt

Receipts:

* Thermal receipt
* Email receipt
* WhatsApp/share
* Tax invoice

**Occupancy:** POS/shop-floor is the **Club Ignition** product path. **Starq Technologies occupancy does not run shop POS.**

---

# 14. POS session management

Each cashier should open a session.

Example:

**Ali — Counter 1**

Opening cash:
MVR 2,000

During shift:

* Sales
* Refunds
* Cash movements

Closing:

System expected:
MVR 8,740

Cashier counted:
MVR 8,700

Difference:
**-40**

Manager reviews the variance.

This integrates directly with accounting.

---

# 15. Sales Orders

Once you move toward ERP:

Quotation

↓

Sales Order

↓

Delivery

↓

Invoice

↓

Payment

You need:

* Order status
* Fulfilment status
* Invoice status
* Payment status
* Partial delivery
* Partial invoicing
* Backorders
* Reservations

---

# 16. Procurement

The ERP-grade purchasing module would add:

**Purchase Requisition**

↓

**Request for Quotation**

↓

Multiple supplier quotations

↓

**Quote Comparison**

↓

Approval

↓

**Purchase Order**

↓

Goods Received

↓

Supplier Invoice

↓

Payment

Useful features:

* Procurement approval limits
* Supplier comparisons
* Lead times
* Purchase history
* Supplier performance
* Price history
* Preferred suppliers
* Minimum order quantities

**Already true here:** purchase SoD in ops. GRN draft against issued PO + qty. **Three-way match** panel (PO / GRN / INV) empty honest while issued=0. Full chain + auto journals still the goal.

---

# 17. CRM

Then build the customer acquisition side.

CRM pipeline:

**Lead → Qualified → Opportunity → Proposal → Negotiation → Won/Lost**

Track:

* Leads
* Contacts
* Calls
* Meetings
* Follow-ups
* Sales activities
* Opportunity value
* Probability
* Expected closing date
* Salesperson
* Notes
* Attachments

Won opportunity can generate a quotation.

**Already true here:** CRM **create** is occupancy-scoped (name + type). Master is still empty until a real name is written. **CALL party → contacts** only when the CALL already has a name string. Other ops names stay labeled **not masters**. **Master contacts open straight into Statement / ledger review and can prefill Sales/Expenses using the same existing contact row.** **Pipeline** on Contacts uses existing CALL / garage ops steps as columns — no invented leads. **Optional QUO draft** when ESTIMATE/CALL has amount/rate on disk — unissued prefix, Tax 0, one per job. Not lead → won → quotation workflow.

---

# 18. Fixed assets

QuickBooks-level functionality should eventually include:

* Asset register
* Purchase cost
* Acquisition date
* Asset category
* Useful life
* Depreciation method
* Accumulated depreciation
* Book value
* Disposal
* Sale
* Write-off

Examples:

* Vehicles
* Machinery
* Computers
* Furniture
* Paint booth
* Workshop equipment

Automatic monthly depreciation journals.

---

# 19. Payroll

You don't need payroll in the first release, but the accounting structure should permit it.

Employee:

* Salary
* Allowances
* Overtime
* Deductions
* Advances
* Loans
* Pension
* Taxes
* Bonuses

Payroll run:

**Gross Pay**

− deductions

= **Net Pay**

Accounting journal generated automatically.

**Gap:** occupancy **create** is live (name + seat on Settings). **`rate_mvr` is optional on Settings** when a row exists — Ali types it; empty clears. Roster is still empty until a real name is written. `users.json` remains the person master. **Payroll run drafts only when `rate_mvr` exists** — empty rates refuse. No invented salaries. Not a v1 nav tab.

---

## T-03 backup (Tier 1 journals)

**Step 1 — local dated copy (live on disk):**

```text
python scripts/backup-journals.py
```

Copies `journals/` → `backups/journals-YYYY-MM-DD/` under `D:\StarqTech\starqBooks`. Never deletes source. Never C:. `backups/` is gitignored.

**Still founder-gated (Goal 1 OPEN):**

- Encrypted **offsite** copy (DEC-019 / SBK-032)
- Restore rehearsal once
- Corporate record / accounts offsite (not just journals)

---

# 20. HR

When moving toward Odoo territory:

Employee records

* Contracts
* Departments
* Positions
* Attendance
* Leave
* Holidays
* Timesheets
* Performance
* Documents
* Recruitment
* Onboarding
* Offboarding
* Expenses

---

# 21. Projects and jobs

Extremely useful for service companies.

Create a project/job:

> Vehicle Repaint — Toyota Land Cruiser

Associate:

* Customer
* Quotation
* Materials
* Labour
* Expenses
* Purchase orders
* Tasks
* Timesheets
* Invoice

Then calculate:

**Revenue**

− Materials

− Labour

− Other direct cost

= **Job Profit**

Eventually this becomes project accounting.

**Already true here:** CI workshop job cycle as **ops events**. **Sales job costing** is a read of amounts already on those events. Not job P&L posted to GL.

---

# 22. Service/workshop management

If you want the ERP to support garages, repairs, maintenance, etc.:

Customer

↓

Vehicle / Asset

↓

Job Card

↓

Inspection

↓

Estimate

↓

Customer approval

↓

Work order

↓

Parts issued

↓

Labour logged

↓

QC

↓

Invoice

↓

Payment

Functions:

* Vehicle registry
* VIN
* Plate
* Mileage
* Photos
* Damage diagrams
* Job cards
* Technician assignment
* Parts consumption
* Labour hours
* QC
* Warranty
* Service history

**Surfaces:** CI garage ops on **portal HQ** (Ali) and **Flutter** (Nashid next-play / paint-shop sim). Flutter does not carry Starq books or Starq ERP.

---

# 23. Manufacturing

A future full ERP could add:

**Bill of Materials — BOM**

For example:

Product A requires:

* Material X × 2
* Material Y × 5
* Labour × 1 hour

Then:

Sales demand

↓

Manufacturing order

↓

Raw materials consumed

↓

Production

↓

Finished goods inventory

Features:

* BOM
* Work centres
* Routings
* Production orders
* Material consumption
* Scrap
* Production costing
* Quality checks

---

# 24. Warehouse management

Beyond simple inventory:

* Warehouse
* Zone
* Aisle
* Rack
* Bin

Movement engine:

Supplier

→ Receiving

→ Inspection

→ Storage

→ Picking

→ Packing

→ Dispatch

Support:

* Pick lists
* Packing lists
* Barcode scanning
* Internal transfers
* Reservation
* Put-away rules
* Replenishment rules

---

# 25. Reports

Bookkeeping reports are critical.

### Financial

* Profit & Loss
* Balance Sheet
* Cash Flow
* Trial Balance
* General Ledger
* Journal Report

### Sales

* Sales by customer
* Sales by item
* Sales by category
* Sales by salesperson
* Invoice aging
* Customer balances

### Purchasing

* Purchases by supplier
* Purchase history
* Supplier balances
* Payables aging

### Inventory

* Inventory valuation
* Stock on hand
* Stock movement
* Dead stock
* Fast-moving products
* Low stock
* Stock aging

### POS

* Daily sales
* Sales by cashier
* Sales by terminal
* Payment method
* Refunds
* Discounts
* Cash variance

Then ERP:

* Profit by branch
* Profit by department
* Profit by project
* Profit by product
* Profit by customer
* Profit by salesperson

**Already true here:** `books.py` P&L, BS, TB, ledger. **Reports + Accounting** show a live `books.py check` line (entries / postings / balanced) plus occupancy-correct outbox labelled **DRAFT — not posted**. **AR/AP aging** from **issued** PO/INV minus named cash/wallet receipts/pays already on disk (GRN qty does not settle AP). **issued=0 → empty honest**, not fake buckets. **Statement of account** only for a master `contact_id`; **contacts [] refuses** (no invented customer). **Sub-reports on Reports tab:** **inventory valuation** = counted SKU with unit cost on this occupancy only (qty × cost when both on disk; else empty honest); **sales summary** = issued INV + valued capture events on disk (no combined fake total); **payroll summary** = employees with `rate_mvr` only (roster empty → empty honest). **Dashboard approvals inbox** lists pending SoD steps from ops (need/quote/award/receive/match/pay + unissued QUO/INV) occupancy-filtered, read-only links to Expenses/Sales. **Optional QUO draft** when ESTIMATE/CALL has real amount/rate — unissued `ST-QUO-` / `CI-QUO-`, Tax 0, issue on click; skips duplicate per job. **Accounting** also PASS/FAIL-validates copy-ready drafts (no journal write) and lists occupancy ops events as the transaction log until GL posts. Drafts are not merged into `books.db`. Not the full sales/inventory/POS report set. Auto-post still false.

---

# 26. Cost centres / analytic accounting

This becomes extremely important as the product grows.

Example expenses:

**MVR 50,000 Rent**

Can be allocated:

* Malé Branch — 20k
* Warehouse — 15k
* Workshop — 15k

Or by department:

* Operations
* Sales
* Administration
* Logistics

This allows proper managerial accounting without contaminating the chart of accounts.

Odoo calls similar functionality **analytic accounting**.

Build this concept early.

---

# 27. Budgets

Later:

* Annual budget
* Monthly budget
* Department budget
* Project budget
* Capex budget

Compare:

**Budget / Actual / Variance**

Managers can receive alerts when spending exceeds limits.

---

# 28. Approval workflows

ERP-grade applications need workflow rules.

Examples:

Purchase < MVR 5,000

→ Manager approval

Purchase > MVR 25,000

→ Director approval

Purchase > MVR 100,000

→ Board/CFO approval

Same engine can later handle:

* Expenses
* Payments
* Discounts
* Supplier onboarding
* Purchase orders
* Journals
* Refunds
* Leave
* Capex

Don't hardcode approvals per module.

Build a generic **workflow/approval engine**.

**Already true here:** CI garage item approvals in Ops (portal). Not a generic engine across modules.

---

# 29. Documents and attachments

Every business object should support attachments.

For example:

Supplier bill

→ supplier PDF

Purchase order

→ quotation

Employee

→ contract

Asset

→ warranty

Customer

→ signed agreement

Eventually you can have:

* Document folders
* Tags
* Search
* Permissions
* Expiry alerts
* Version history

Journals already support optional `doc:` paths in the vault.

---

# 30. Notifications

Internal notifications:

* Invoice overdue
* Bill due
* Low inventory
* PO pending approval
* Stock received
* Large expense
* Cash variance
* Customer credit limit exceeded
* Contract expiring
* Supplier price changed

Channels eventually:

* In-app
* Email
* SMS
* WhatsApp
* Push notification

---

# 31. Audit log

**Absolutely mandatory from version one.**

Track:

> Ali changed Invoice INV-1027
> Amount MVR 12,000 → MVR 10,500
> 19 Aug 2026 18:42

Record:

* User
* Time
* Device/IP if appropriate
* Previous value
* New value
* Action
* Related record

Financial records should generally not simply disappear.

Instead:

**Void / reverse / credit / adjust.**

Closed months: do not edit; post a correcting entry in the current month.

**Already true here:** append-only `ops/master_audit.jsonl` for occupancy master **creates** (contact, SKU, location, employee, price, count). Shown on Settings. Empty until a real write. No invented rows. Not a full field-level invoice change log yet.

---

# 32. Users, roles and permissions

Example roles:

* Owner
* Administrator
* Accountant
* Finance Manager
* Salesperson
* Cashier
* Storekeeper
* Procurement Officer
* Manager
* Auditor
* Employee

Permissions should operate at:

**Module**

and eventually:

**Record / Branch / Company / Field / Action**

For example cashier:

Can create POS sale.

Cannot:

* See P&L
* Change product cost
* Delete invoices
* Edit journal entries

**Already true here:** person → allowed orgs (`ACCESS.md`). Nashid never sees Starq. Superadmin Users power is a future `/ops/users` control — it does **not** mean “see Starq books.”

---

# 33. Multi-company

Design this from the beginning even if you initially expose only one company.

One login could eventually manage:

```text
Business Group

├── Company A
├── Company B
└── Company C
```

Separate:

* Accounts
* Tax
* Inventory
* Users
* Branches

But potentially consolidated reporting later.

**Already true here:** Starq + Club Ignition + Ali `group` view. Not a third legal org. Dynamics is a BN, not Company C.

---

# 34. Multi-branch

Company:

```text
Head Office
├── Malé Shop
├── Hulhumalé Shop
└── Warehouse
```

Each location could have:

* Inventory
* POS
* Cash
* Staff
* Sales
* Expenses

But consolidated company reporting.

---

# 35. API and integrations

If you're planning for Odoo-level scale, this is another **day-one architectural decision**.

Everything should eventually be addressable through an API.

Examples:

```text
/api/customers
/api/products
/api/invoices
/api/orders
/api/payments
/api/inventory
/api/purchases
```

Then you can integrate:

* E-commerce
* Banking
* Payment gateways
* Delivery apps
* Mobile apps
* Supplier portals
* Customer portals
* Government systems
* AI agents

Today: portal + `/ops` (Flutter client). Bind `127.0.0.1`. No tunnel.

---

# 36. AI layer

A modern system shouldn't merely imitate QuickBooks or Odoo.

You can eventually have:

### Receipt AI

Upload photograph:

> Detect supplier, date, tax, amount and category.

### Bookkeeping AI

> “MVR 1,200 paid for internet.”

AI proposes:

**Internet Expense → Bank**

(That is an architecture example. It is **not** a books fact. Do not put a telco or hosting vendor on this SSOT.)

### Financial assistant

User asks:

> Why did profit fall this month?

AI analyses:

* Revenue
* COGS
* Expenses
* Customer mix
* Inventory
* Discounts

### Inventory AI

> You will likely run out of Product X in 11 days.

### Procurement AI

> Supplier B is 7% cheaper but normally delivers four days slower.

### Management AI

> Cash flow suggests a MVR 120,000 shortfall next month.

This is where a newer product can significantly outperform legacy bookkeeping software.

---

# How I would build the product

Don't attempt an Odoo clone in v1.

I would structure the roadmap roughly like this:

| Stage  | Product                 |
| ------ | ----------------------- |
| **1**  | Bookkeeping             |
| **2**  | Inventory               |
| **3**  | POS                     |
| **4**  | Sales + Purchasing      |
| **5**  | CRM                     |
| **6**  | Multi-branch            |
| **7**  | HR + Payroll            |
| **8**  | Projects / Job Costing  |
| **9**  | Warehouse               |
| **10** | Manufacturing / Service |
| **11** | Full ERP platform       |

But underneath them all would be one common platform:

```text
                    ERP APPLICATIONS
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
      POS              SALES           PURCHASING
       │                 │                 │
       ├──────── INVENTORY / PRODUCTS ─────┤
       │                 │                 │
       └──────────── ACCOUNTING ────────────┘
                         │
            GENERAL LEDGER / JOURNALS
                         │
          ┌──────────────┼───────────────┐
        TAX           CONTACTS        PAYMENTS
                         │
                  ORGANIZATION
                         │
            USERS / ROLES / AUDIT
                         │
                 PLATFORM / API
```

### The key design principle

**Accounting should not be a separate app inside the ERP.**

It should be the **financial consequence engine underneath everything else.**

A cashier sells something → accounting entry.

Warehouse receives goods → inventory valuation.

Procurement buys something → payable.

Payroll runs → salary liability.

Manufacturing consumes stock → inventory/production costing.

Asset depreciates → expense.

Customer pays → bank reconciliation.

That's how you go from a small **QuickBooks-like bookkeeping application** to an **Odoo-class ERP** without having to rebuild the core three years later.

And for the first commercial release, I'd resist trying to expose all of this. The visible product could be beautifully simple:

**Dashboard → Sales → Expenses → Banking → Contacts → Products → Reports → Accounting → Settings.**

Everything else can grow behind that foundation.
