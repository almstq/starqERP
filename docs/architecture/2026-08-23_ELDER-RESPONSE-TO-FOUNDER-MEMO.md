# Elder's response to the Founder's StarqERP architecture memo

**Date:** 23 August 2026 · **To:** Founder · **From:** Elder
**Re:** "StarqERP — Architecture, Product & UX Review", 23 Aug 2026
**Status:** items 1–5 of the required response, delivered. Item 6 (consolidated proposal) is
blocked on Antigravity's five outstanding answers. Item 7 (no destructive merge before
approval) is accepted and binding on me.

Every claim below was checked against the repository, not against memory.

---

## A. Nine memo items the schema ALREADY satisfies

This is the most important section, because it changes the size of the merge. The memo was
written against the mockup. Several of its corrections describe a core we already have.

| Memo | What it asks for | What already exists |
|---|---|---|
| **§4 User ≠ Tenant** | membership joins a person to an organisation with a role | `memberships(organisation_id, person_id, status, valid_from, valid_to)`, unique per pair. **A person can already hold memberships in many organisations.** The mockup's `AppUser.tenantId` is the wrong model and the database already disagrees with it |
| **§5 Legal entity vs brand** | Organisation → Business Unit / Trading Name | `business_names(organisation_id, name, registry_code, activity_code, status)`. Club Ignition is the organisation; Ignition Ink is a business name. Modelled exactly as asked, three months ago |
| **§17 Currency** | ISO-compatible, not a two-value enum | `character(3)` on `organisations.base_currency` and on `commercial_documents.currency`. Never was an enum |
| **§22 IDs vs document numbers** | UUID identity, separate human numbering | UUID primary keys throughout, a `document_sequences` table, and a CHECK that an issued document **must** carry a `document_no` and an `issued_at` |
| **§21 Inventory movement causes** | know *why* stock moved | `stock_movements.movement_type` — opening, count, receipt, issue, adjustment, return, transfer_in, transfer_out — plus `source_type`/`source_id` linking each movement to what caused it |
| **§20 Procurement path** | quote → PO → receipt → bill → payment | `commercial_documents.document_type` already covers estimate, quotation, purchase_order, goods_receipt, supplier_bill, sales_invoice, credit_note, receipt, payment. **Missing only** purchase_request and RFQ / quotation comparison |
| **§23 Audit server-side** | audit written inside the transaction, not from React | `audit_events`, organisation-scoped, at database level |
| **§16 (part)** | tax computed per line, not per organisation | Lines carry `tax_rate`, `net_amount`, `tax_amount`, `gross_amount` with `check (gross = net + tax)` |
| **§15 (recognised)** | rates must be effective-dated | `test_tax_period.py` (SERP-122) is already written, documents the 16% → 17% change at 2025-07-01, and is **red by design** under DEC-033. The memo is confirming an item we had already specified |

**One thing the memo understates.** Isolation here is stronger than RLS alone. The foreign keys
are **composite** — `garage_jobs` references `contacts(organisation_id, id)`, not `contacts(id)`.
A row in one tenant is *structurally incapable* of referencing a row in another; the database
refuses the write regardless of policy. RLS is the second lock, not the only one. The §37
adversarial tests should assert both, and should be expected to fail at the FK layer first.

---

## B. Five items I disagree with, or must correct

### B1 · §13 Accounting core — I disagree on SEQUENCING, not on principle *(founder call)*

The memo wants chart of accounts → journal → ledger → statements inside StarqERP.
`DEC-051` and `contracts/commands.ts` say the opposite **for now**: the double-entry rules, the
chart of accounts and the activity-code controls live in the Python engine (`books.py`,
`journal_outbox.py`) and stay there **until the ERP has demonstrably held garage operations**.

The database already reflects that decision deliberately: `journal_lines.account_code` is
**free text, with no accounts table and no foreign key.** That is not an oversight — the chart
lives in Python, and Postgres is not allowed a second opinion.

Building a chart of accounts in Postgres now produces **two charts of accounts while the
Ignition Ink books are live.** That is the highest-consequence failure mode available to us.

**My position:** keep the memo's target, keep DEC-051's sequencing. Postgres holds
`journal_proposals` — it already does — and Python remains the only thing that posts. One
chart, one poster. If you want DEC-051 overturned, that is your call and it must be explicit.
I will not overturn it by implication inside a merge plan.

### B2 · §15 Tax — the memo's model is correct but missing our actual state

GGST 8% and TGST 17% from 1 July 2025 are right, and the repository already encodes the
16 → 17 change with its effective date. But the memo's tax model has rates and effective dates
and **no state for "not registered"** — which is what we are. `ops/masters/tax.json` currently
reads `gst_status: not_registered`, `live_invoice_rate: 0`.

A tax engine that can only express percentages will eventually let someone print an 8% line on
a day we are not entitled to charge it. **Registration status must be a first-class dimension
of the tax model, not a comment.** Time of supply selects the rate; registration status selects
whether there is a rate at all.

A related defect the memo did not catch: the mockup stores `gstRate: 0.08` in five places and
`gstRate: 8` in another. Two units, one field name. Do not carry that into the schema.

### B3 · §12 Customer → Asset — agree in principle, disagree on doing it now

`vehicles` exists, with composite foreign keys and live garage rows. Introducing a polymorphic
`assets` supertype in this merge means migrating live data to prove a generality that nothing
is yet asking for.

**Recommendation:** the *contract* names the entity `asset` from day one, so the API never
changes; the *table* stays `vehicles` until a second industry actually arrives. Deferring costs
nothing. Doing it early costs a migration against live rows.

### B4 · §27–29 Responsive — agree with the analysis, disagree with the timing

The findings are real: desktop tables scaled down, tall empty Kanban columns, horizontal
scroll. But this is the same cosmetic surface I halted this morning. Fixing table → card
transforms on a UI that is about to be rewired to a real API means **building it twice**.

Define the breakpoint strategy now — the memo asks for exactly that in §45.H — and implement
after the wiring. The strategy is the deliverable at this gate. The CSS is not.

### B5 · §45.J Rollback point — it is not where you would expect, and it is currently unsafe

`legacy/engine` is **its own git repository**, deliberately excluded from the parent vault
(`.gitignore:72`). It is on `main`, **fifteen files are dirty right now**, and there are
**no tags at all**.

Before any merge begins: commit or stash the fifteen, then tag. Untagged, the "known-good
commit" the memo requires does not exist.

Related: the AI Studio mockup is currently extracted to `legacy/engine/scratch/`, which is
*inside* that repository. Acceptable as a reference for this review. Wrong as a permanent
home — see decision F4.

---

## C. Corrections that require SCHEMA changes

| Memo | Change | Size |
|---|---|---|
| **§9, §10** | `workflows`, `workflow_stages`, `workflow_transitions`; `garage_jobs.state` → `workflow_stage_id uuid`; drop the 13-value CHECK; seed the garage's states as tenant #1 rows | **Largest single item.** Touches live job rows |
| **§7, §8** | `roles`, `role_permissions`; `memberships.role_id`; `memberships.status` gains `pending`; the creator of an organisation becomes an active Owner without approval | Medium |
| **§15, §16** | line-level `tax_mode` (inclusive / exclusive / zero-rated / exempt) and `tax_treatment`; `ops/masters/tax.json` becomes effective-dated periods carrying registration status (SERP-122) | Medium |
| **§18** | `bank_accounts(organisation_id, provider, account_name, reference, currency, type, is_default, is_active)`. The mockup's `bmlAccount` / `mibAccount` organisation fields must **never be created** | Small |
| **§20** | add `purchase_request` and `rfq` to `commercial_documents.document_type`; supplier-quotation comparison is a later view over the same rows | Small |
| **§38** | storage bucket policy mirroring organisation isolation. The attachment *rows* are already scoped; the **files may not be** | Small, and **unverified** — must be checked before it is called done |
| **§13** | **none now** — see B1 | — |
| **§12** | **deferred** — see B3 | — |
| **§5** | none — `business_names` exists. A `business_unit_id` on operational tables is needed only if you want per-branch books. That is decision F3 |

**Not schema, but boundary:** `functions/starq-api/index.ts:218` hardcodes `CLUB_IGNITION_ID`
and rejects every other organisation's session outright. One constant. It is the entire
distance between the current system and a multi-tenant one at the API layer.

---

## D. Corrections that are UI or configuration only — no schema

§11 industry polymorphism (configuration, not four ERPs) · §24 the AI ladder
observe → explain → recommend → prepare → **human approval** → execute, and the rule that AI
never holds unapproved authority over money · §25 dashboard philosophy · §26 visual language,
including "do not redesign during the merge" · §28–29 table → card and Kanban transforms ·
§30 metric credibility — `98.4% First Pass` is hardcoded at `ReportsView.tsx:261` and appears
against every technician; the memo is right · §31 demo dataset — **seventy records sit in May
2025**; the memo is right · §32 demo versus production seed separation · §33 compliance
language · §39 search scoping · §40 the New Action command surface · §41 module map.

**On §33 I go further than the memo.** It says do not decorate. Our position is harder: we are
not GST-registered, so no live invoice may carry 8% or 16% or 17%, and nothing may describe
Starq as GST-registered, until GST is Active on MIRA. The mockup's `MIRA GST 8% Compliant`
badge is not merely unsupported by its data — it is a claim we are not entitled to make.

---

## E. Reconciliation with Antigravity

AG's proposal was written without reading the repository or the comms bus. Measured against the
memo's own §44 "what must not happen" list, it proposed four of the forbidden things:

| AG proposed | Memo §44 forbids | Repository reality |
|---|---|---|
| "Provision PostgreSQL / Supabase cluster with tenant RLS" in Week 1 | replacing proven database work | eleven migrations already applied |
| `tenant_id` on the user | equating user with tenant | `memberships` already exists |
| RLS via an `auth_users` table and `auth.uid()` alone | client-shaped authorization | no such table; authority comes from session authority (migration 0008) plus an acting seat |
| "8% GGST, 16% TGST", automated MIRA returns | hardcoded GST percentages, decorative compliance | stale rate, and we are not registered at all |

It also omitted **seats** entirely, and proposed rebuilding the idempotency and audit
machinery that already exists.

What AG contributed that is genuinely good and should survive into the joint proposal: the
polymorphic workflow framing, the emphasis on kernel-level isolation, and the industry examples
as evidence that industries are *configuration*. It has been sent a corrective brief and owes
five answers — the load-bearing one being a complete inventory of every mutation in
`ERPContext.tsx`, because that list **is** the command surface the API must expose.

---

## F. Four decisions that block the consolidated proposal

1. **Seats or roles.** (a) both, layered — roles gate what you SEE, seats gate what you DO;
   (b) roles only; (c) seats only. **Recommend (a).** The only option that preserves DEC-065.
2. **Does DEC-051 stand?** Accounting remains in Python until the ERP has held garage
   operations — or is the accounting core built into StarqERP now? **Recommend it stands.**
3. **Is a branch a tenant?** Memo §6 asks for a deliberate answer. **Recommend: no.** The
   tenant is the legal, security and accounting boundary; branches are units inside it.
4. **Where does the merged application live?** A new top-level `starqERP` repository, or inside
   `legacy/engine`. **Recommend a new repository**, with the foundation engine continuing as what it already
   is — the accounting engine and the Python portal.

---

## G. What happens next, and what will not

Per §47, I will not convert the AI Studio application into the main StarqERP application, and
no destructive migration will occur, until you approve one joint plan.

Sequence from here: AG returns its five answers → we reconcile and resolve disagreements → one
consolidated Merge Proposal in the §45 A–J structure → your approval → tag a rollback point in
`legacy/engine` → incremental merge, buildable and testable after every stage.
