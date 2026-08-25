# StarqERP Merge Proposal — for Founder approval

**Date:** 23 August 2026
**From:** Elder (architecture, existing core) and Antigravity (revision, client surface)
**Structure:** the founder's memo §45, sections A–J
**Authority it answers to:** `DEC-067` (the lane change and four settlements) · the 48-section
architecture memo of 23 Aug · `DEC-066` (core before console) · `DEC-051` (accounting stays in
Python) · `DEC-033` (no new features until the audit criticals are proven)
**Status:** **APPROVED WITH AMENDMENTS** — founder, 23 Aug 2026, `DEC-068`. Eight conditions recorded
as acceptance criteria and gates. Phase 0 complete; `SERP-173` (offsite backup) gates migration `0013`.

---

## The proposal in one paragraph

The AI Studio revision becomes the StarqERP client. The proven Supabase core stays underneath and
is generalised, not rebuilt. Three things change at the boundary and everything else follows from
them: the tenant stops being a constant, the workflow stops being code, and identity stops being an
allowlist. The Flutter console is parked frozen. Nothing is deleted. The merge is executed in nine
phases, each of which leaves the system buildable and testable, behind a rollback tag — created and
clone-tested on 23 August, before phase one began.

**The one finding that shaped everything:** the core was already multi-tenant. Every operational
table carries `organisation_id`, and **every foreign key to a tenant-scoped parent is composite** —
`garage_jobs` references `contacts(organisation_id, id)` — so a cross-tenant reference between
tenant-owned rows is *structurally impossible*, not merely policy-blocked.

> **NARROWED 23 Aug 2026 by the independent QA audit (`DEC-069`).** This originally read "the
> foreign keys are composite", full stop. That is false: `memberships.person_id`,
> `audit_events.actor_person_id` and `membership_seats.seat_code` are single-column references to
> *deliberately global* tables. The narrower claim still holds and still carries the plan. And a
> second correction, which is sharper: the isolation is enforced **at the Edge**, not in the
> database — `api_garage_command` is `SECURITY DEFINER` and accepts the organisation, the person
> and the seat as caller-supplied arguments. See `SERP-178`. The revision's `tenantId` already existed in the database. That is why this
is a merge measured in weeks rather than a rebuild measured in months.

---

## A · Current-State Map

### The existing build (`starqBooks`)

| Disposition | What | Reason |
|---|---|---|
| **KEEP** | migrations `0001–0011` | organisation-scoped from day one; composite FKs; eleven migrations of proven schema |
| **KEEP** | `functions/starq-api` boundary — auth, CSRF, session authority, idempotency, audit, security events | the expensive half; thirteen defects already beaten out of it |
| **KEEP** | `contracts/commands.ts` invariants, seat vocabulary, segregation pairs | the authorization model, and the only reason SoD is provable |
| **KEEP** | Python engine — `books.py`, `journal_outbox.py`, `ops/masters/` | `DEC-051`. It holds the live Ignition Ink books |
| **REFACTOR** | `COMMAND_SEATS` as a compile-time map | keyed by one tenant's twelve steps — see §E, this is the load-bearing change |
| **REFACTOR** | `garage_*` table naming | `garage_jobs` becomes the generic work order; rename is cosmetic and last, never first |
| **REPLACE** | `CLUB_IGNITION_ID` constant at `index.ts:218` | one constant; the entire single-tenancy of the API layer |
| **REPLACE** | `garage_jobs.state` CHECK constraint | workflow as code becomes workflow as data |
| **REPLACE** | the allowlist as a user registry | "you must be known before you can arrive" is the opposite of self-onboarding |
| **PARK FROZEN** | `starq-ops-app` (Flutter console) + `SERP-028`, `SERP-151`, `SERP-153` | Rule 2. Design system intact. Returns later as the shop-floor client |
| **DEFER** | generic `assets` supertype | `vehicles` holds live rows; generality nothing is asking for yet |
| **DEFER** | chart of accounts in Postgres | `DEC-051`. Two charts while the books are live is the worst available failure |

### The revision (AI Studio, 49 files)

| Disposition | What |
|---|---|
| **KEEP** | all 40 view and component files — this is the new client |
| **KEEP** | `types/erp.ts` as the *product* model — reconciled against the schema, not adopted wholesale |
| **KEEP** | the Needs-Attention / Starq-AI split (memo §24), the dashboard philosophy (§25), the visual language (§26) |
| **REFACTOR** | `ERPContext.tsx` → an API client. It coordinates; it does not decide |
| **REPLACE** | `AppUser.tenantId` → membership context. A user belongs to many organisations |
| **REPLACE** | `WorkflowStage` name-as-status → `workflow_stage_id` UUID |
| **REPLACE** | `bmlAccount` / `mibAccount` organisation fields → `bank_accounts` entities |
| **RETIRE** | `mockData.ts` — **deleted last, not first**; it is the fixture the wiring is tested against |
| **RETIRE** | `id: \`job-${Date.now()}\`` client-side identity; `gstRate` in two different units; the `MIRA GST 8% Compliant` badge |
| **RETIRE** | `@google/genai` as a **client** dependency — the key never reaches the browser |

---

## B · Domain Mapping

| Revision entity | Canonical entity | Migration | Breaking |
|---|---|---|---|
| `OrganisationTenant` | `organisations` + `business_names` | field additions only (TIN, GST config, FY dates) | no |
| `AppUser` | `persons` + `memberships` | **conceptual** — `tenantId` on the user is dropped | **yes, in the client** |
| `UserRole` | new `roles` + `role_permissions` | new tables | no |
| — (absent) | `seats`, `membership_seats` | exists; the revision has no concept of it | **yes** — the client must learn seats |
| `WorkflowStage` | new `workflow_stages` | new tables + backfill of live jobs | **yes, in the database** |
| `JobOrder` | `garage_jobs` → work order | `state` → `workflow_stage_id` | **yes** |
| `Customer` | `contacts` (+ `persons`) | field mapping | no |
| `Vehicle` | `vehicles` — **stays** (`asset` in the contract) | none | no |
| `Invoice` / `InvoiceLineItem` | `commercial_documents` / `_lines` | field mapping; `tax_mode` added | no |
| `Payment` | `commercial_documents` type `payment` | field mapping | no |
| `Expense` | `commercial_documents` type `supplier_bill` | mapping | no |
| `InventoryItem` / `StockMovement` | `inventory_items` / `stock_movements` | field mapping | no |
| `Supplier` | `contacts` (supplier role) | mapping | no |
| `PurchaseOrder` / `POLineItem` | `commercial_documents` type `purchase_order` | `purchase_request`, `rfq` added to the type list | no |
| `AuditLogEntry` | `audit_events` | client stops writing; server writes | **yes** |
| bank fields on tenant | new `bank_accounts` | new table | no |

**Four breaking changes, all in the client, all deliberate:** user is not tenant; seats exist;
stage identity is a UUID; audit is a server consequence, not a client call.

---

## C · Database Decision

**Retained unchanged:** `0001`–`0010` — and **verified applied on the live project**.

> **CORRECTED 24 Aug 2026.** This document previously stated that nothing had been applied to a
> database. That was wrong. `supabase migration list --linked` against `wthabguvueewgtabjsdo`
> returns `0001`–`0010` present on both local and remote, `0011` local only. Remote is behind by
> exactly one migration with **zero schema divergence**. `SERP-184`.
**`0011` is NOT applied.** It is written, reviewed and approved, and it sits deliberately
unapplied under `DEC-033` — which is why audit critical #2 is open **by choice rather than by
obstacle**. It is the *first* migration to run, at the start of phase 3, before `0012`.
**New migrations, in dependency order:**

| # | Contents | Touches live rows |
|---|---|---|
| `0012` | `workflows`, `workflow_stages`, `workflow_transitions` | no |
| `0013` | `garage_jobs.workflow_stage_id`; backfill the twelve steps as tenant-one seed rows; drop the CHECK | **YES — reversible migration required** |
| `0014` | `roles`, `role_permissions`; `memberships.role_id`; `memberships.status` gains `pending` | no |
| `0015` | `bank_accounts`; `organisations` gains TIN, FY start/end, GST config | no |
| `0016` | `commercial_document_lines.tax_mode`; `purchase_request` and `rfq` document types | no |
| `0017` | storage bucket policies mirroring organisation isolation | no |

**Tenant isolation strategy — two layers, and the first is the strong one.**
Structural: composite foreign keys make a cross-tenant reference impossible; the database refuses
the write regardless of policy. Policy: RLS as the second lock. The organisation is resolved from
session authority and **never** from a request payload. `§G` tests both, and expects the foreign
key to fail first — if a cross-tenant write ever succeeds at the FK layer, a composite key has been
dropped somewhere and that is a graver finding than a missing policy.

**Membership model:** `person → membership(organisation, role, status) → membership_seats`.
One person, many organisations, a different role and different seats in each.

**Accounting additions: none.** `DEC-051`. `journal_lines.account_code` stays free text with no
accounts table, deliberately, so Postgres cannot hold a second opinion about the chart. The ERP
emits `journal_proposals`; Python remains the only thing that posts.

**Audit design:** unchanged in shape, changed in origin. The table exists and is
organisation-scoped. What changes is that `logAuditEvent` stops being something the client calls
and becomes something the server does inside the same transaction as the mutation. An audit trail
the actor can choose not to write is not evidence.

---

## D · Front-End Decision

**The revision is the primary UI.** All forty view and component files become the StarqERP web
application: dashboard, customers, jobs, invoices, payments, inventory, purchasing, reports, audit,
settings, onboarding, AI copilot.

**What carries across from the existing work rather than being thrown away:**
the design tokens and the industrial red accent discipline (red only on the active action; refusals
and idle states neutral); and — more valuable than the CSS — the **refusal semantics** the console
proved with a real person clicking things. `SERP-151` established that a lock banner must
distinguish *held*, *held but not acting*, and *held by another role*, and must name the role and
never the person. That is a specification the new client inherits.

**What the revision must learn that it does not currently know:** seats; that refusals are routine
and correct rather than exceptional; and that some actions are visible-but-refused rather than
hidden — `DEC-065`'s segregation pairs bite even when a person holds every seat.

**`ERPContext.tsx` becomes an API client.** Memo §35, and it is the discipline the whole front-end
decision rests on: it coordinates, it does not decide. Accounting postings, tenant isolation,
permission enforcement, stock mutation, approvals, reconciliation, audit, numbering and tax logic
all live behind the API. **Front-end state is not a security boundary and not an accounting
boundary.**

**Flutter console:** parked frozen. It returns as the shop-floor technician client once the web
application is live — which is the founder's own sequence at `DEC-066`: desktop web app to set up
the organisation, then users, then the app. *App is last.*

---

## E · API and Contract Decision — the load-bearing section

**The finding.** `COMMAND_SEATS` is `Record<CommandName, SeatCode[]>` — a compile-time map whose
keys are `CALL, BOOKING, INTAKE, ESTIMATE, AUTHORISATION, JOB_CARD, PARTS_PROCUREMENT, WORK, QC,
HANDOVER, INVOICE_PAYMENT, CLOSE`. **Those are one tenant's twelve workflow steps compiled into the
contract.** A second tenant with different stages cannot be expressed in it at all.

Meanwhile Antigravity's inventory of `ERPContext.tsx` found **twenty-five mutations**, and the
majority — create a customer, raise an invoice, receive stock, invite a user, authorise a user,
create a role, create a tenant, add a workflow stage — **have no command in the contract at all.**
The contract covers a garage's job journey and almost nothing a business does around it.

**The decision: the contract splits into two layers.**

| Layer | Examples | Authorization | Lives as |
|---|---|---|---|
| **Stage transitions** | the twelve steps, and whatever any other tenant defines | `workflow_stages.allowed_seats` | **DATA**, per tenant |
| **Platform commands** | `CUSTOMER_CREATE`, `INVOICE_ISSUE`, `PAYMENT_RECORD`, `STOCK_RECEIVE`, `STOCK_ADJUST`, `PURCHASE_*`, `USER_INVITE`, `USER_AUTHORIZE`, `USER_SUSPEND`, `ROLE_*`, `WORKFLOW_*`, `ORG_CREATE`, `ORG_UPDATE` | a compile-time seat map — this part survives unchanged | **CONSTANTS**, tenant-independent |

`PURCHASE` with its six `SCM_STEPS` and its segregation pairs is a **platform** command, not a
workflow stage, and keeps its matrix exactly as it is. Procurement segregation is universal; paint
booth stages are not.

**Consequence to plan for, not discover:** `authorize()` currently takes a `CommandName`. Splitting
the layers changes that signature, and the seat vocabulary migration must precede the matrix change
— the contract already warns that reversing the order "would convert a silent authorization hole
into a hard outage."

**Contract version → `0.2.0`.** It reaches `1.0.0` on its own stated terms: every conformance test
passing against a real runtime, and at least two of three runtimes importing their authorization
decision from the file rather than reimplementing it.

**Endpoints. Verified against `index.ts`, not taken on report.** Existing and confirmed:
`/api/auth/google`, `/api/auth/logout`, `/api/auth/seat`, `/api/me`, `/api/meta`, `/api/ops/job`,
`/api/ops/event`, `/api/ops/pulse`, `/api/ops/purchases`, `/health`.

Required and absent: contacts read/write · inventory read/adjust · commercial documents and
payments (general, not job-scoped) · reports aggregation · audit read · admin surface for
organisations, users, roles and workflows · workflow stage query · AI copilot proxy.

**Every one of them — reads included — resolves the organisation from session authority and
enforces permission.** A read route is not exempt from isolation. Memo §39: search and reports
respect organisation and permission, or they become the leak that the row policies prevented
everywhere else.

---

## F · Data Migration Strategy

Three populations, three different fates. **They must never mix.**

| Population | Where | Fate |
|---|---|---|
| **Live garage rows** — jobs, contacts, vehicles, stock, documents | Supabase | **MIGRATE.** Only migration `0013` touches them. Reversible, rehearsed against a restored copy first |
| **Live books** — journals, ledger, GST position | Python engine, plain-text journals | **UNTOUCHED.** `DEC-051`. Not in scope for any phase of this merge |
| **Revision mock data** — 1,984 lines | `mockData.ts` | **DISCARDED as truth. RESEEDED as a demo tenant.** |

**On the demo tenant, which is where a quiet disaster would otherwise live.** The revision carries
sample TINs, bank account numbers, phone numbers, emails, supplier identities and invoice numbers.
Memo §32 is right that they must be distinguishable from production, and the mechanism is stronger
than a naming convention: the demo data lives in **its own organisation**, which the composite
foreign keys then make structurally incapable of touching a real tenant's rows. Demo separation
becomes a property the database enforces rather than a discipline people remember.

Reseeded to a coherent **August 2026** period — the revision's records sit in **May 2025** and the
interface looks stale the moment it opens — with dates internally consistent across invoices,
payments, purchase orders, dashboards and GST periods. Metrics that cannot derive from events are
removed rather than fabricated: `98.4% First Pass` is hardcoded at `ReportsView.tsx:261` and shows
the same value against every technician.

`mockData.ts` is deleted **after** the wiring proves out, not before.

---

## G · Security Review

| Area | Position at approval | Work required |
|---|---|---|
| Authentication | Google SSO, CSRF on every state-changing route, session authority (`0008`) | none |
| Organisation membership | `memberships` + `membership_seats`; revocation permanent until explicit grant (Invariant 1) | `pending` status; self-onboarding replaces the allowlist |
| RBAC | seats enforced server-side | roles added as the visibility layer — **never as the authorization layer** |
| RLS | organisation-scoped, plus composite FKs | extend to new tables |
| **Object/file access** | rows scoped by `unique (organisation_id, storage_key)`. **The files themselves are UNVERIFIED** | `0017`. Do not isolate rows correctly and leave object URLs globally readable |
| Audit | table exists, organisation-scoped | move authorship from client to server, inside the transaction |
| Cross-tenant isolation | structural + policy | adversarial suite, `§37` |
| **AI tenant isolation** | **nothing exists yet** | retrieval, embeddings, prompts, logs and analytics inside the same boundary. A copilot that can read another tenant is a breach with a friendly interface |
| AI authority | — | observe → explain → recommend → prepare → **human approval** → execute. No unapproved authority over money, ever |
| Secrets | — | `GEMINI_API_KEY` server-side only, rate-limited per organisation, actions audited |

**Multi-tenancy is not verified because two tenants render correctly. It is verified when attacks
fail.** Nine of them, from memo §37, each with a test.

---

## H · Responsive Strategy — specification now, implementation after wiring

Elder disagreed with the memo on timing and the founder accepted it: building transforms against a
UI about to be rewired means **building it twice**. The spec is the deliverable at this gate.

| Surface | ≥1280 | 768–1279 | <768 |
|---|---|---|---|
| **Tables** | full table | fewer columns, no horizontal scroll | **cards** — document number and status, who and what, the money, the due date, two actions |
| **Kanban** | all stage columns | 3 columns, horizontal scroll | **stage strip with counts**, then the active stage's cards. Never tall empty columns stacked vertically |
| **Dashboard** | 4-up | 2-up | 1-up; Needs Attention first |
| **Drawers / modals** | side drawer | side drawer | full-screen sheet |
| **Navigation** | persistent sidebar | collapsed rail | bottom bar, five destinations |
| **Reports** | full | full, scroll container | summary figures; detail on demand |

Rule for every wide element: it scrolls inside its own container. **The page body never scrolls
horizontally.**

---

## I · Phased Execution

Each phase leaves the system buildable and testable. No phase begins before the previous one is
proven.

| Phase | Task | Contents | Done when |
|---|---|---|---|
| **0** | `SERP-160` | **DONE 23 Aug.** Three deliberate commits; tag `pre-merge-2026-08-23`; clone-tested | tag restores a working system — **but not the books, see J** |
| **1** | `SERP-159` | New `starqERP` repository on **D:**; revision moved out of `scratch`; core ported under version control | both halves build in one tree |
| **2** | `SERP-161` | `CLUB_IGNITION_ID` removed; organisation from session; payload organisation ignored | a second organisation transacts with no code change |
| **3** | `SERP-162` + §E | Workflow as data; contract splits; `0012`/`0013` | the twelve steps are seed rows; live jobs backfilled reversibly |
| **4** | `SERP-163` | Roles, `pending`, founder-of-a-new-org exception; `0014` | a stranger creates an organisation and gets in; an invitee waits |
| **5** | `SERP-167` | The missing endpoints, specified against the contract, then built | every screen has a real route |
| **6** | `SERP-166` + `SERP-168` | Wire the twenty-five mutations; AI proxy; `mockData.ts` deleted **last** | no business invariant left in React state |
| **7** | `SERP-164`, `SERP-165` | Tax as effective-dated periods with registration status; bank accounts as entities; `0015`/`0016` | `SERP-122` goes green |
| **8** | `SERP-172` + `0017` | Adversarial isolation suite including storage and AI | all nine attacks fail |
| **9** | `SERP-170`, `SERP-171` | Responsive implementation; demo tenant reseeded to Aug 2026 | no page scrolls horizontally; no undeliverable metric |

**Audit criticals.** `DEC-033` freezes features until the five are closed **and proven in effect**.
Migration `0011` is written, reviewed and unapplied; it closes the last one and is applied at the
start of phase 3. Phases 0–2 are structural, not features, and do not breach the freeze.

---

## J · Rollback Point — COMPLETE, with one part still open

> **Status: Phase 0 executed 23 August 2026.** Tag `pre-merge-2026-08-23` exists and has been
> clone-tested. This section previously recorded the pre-execution condition — fifteen dirty files
> and no tags — which was true when the proposal was written and is no longer true.

**What was done.** The working tree was resolved in **three deliberate commits, not one bulk
commit**, because a tag over an unreviewed tree preserves the mess rather than the known-good
state:

| Commit | What | Why it mattered |
|---|---|---|
| `95fcfa1` | Console design system, exactly as it stood before the freeze | **It had never been committed.** Parking the console with this work uncommitted would have lost it — the tokens, the red ramp, `jobs_list_view`, `job_card_screen`, `seat_chip`, the intake view, the guidance panel |
| `c262a23` | `0011` self-test corrected | It asserted `seat_not_held`; `api_garage_command` raises `seat_not_authorized`, at line 127 of the same file. The name was invented rather than read — precisely the defect class `0011` exists to close |
| `cff9198` | The proposal and the two reviews that produced it | The decision record enters version control |

The AI Studio revision was deliberately **excluded** via `.git/info/exclude`: it is a reference copy
that moves to the new repository in phase 1, and does not belong in this tag.

**The tag.** `pre-merge-2026-08-23`, annotated, recording the state it marks — `0011` written,
reviewed and unapplied; console parked frozen; nothing deployed, nothing applied to a database.

**Restore test performed.** The tag was cloned to a scratch tree and verified: **335 files, 11
migrations, contract present, Edge boundary present, Python engine present, 22 Dart files.**
`git fsck` clean.

### The finding the restore test produced — and it sharpens A1 rather than contradicting it

**The tag does not cover the books.** `journals/` and `books.db` are gitignored — deliberately and
correctly, because they are Tier 1 ledger data and the repository may go to GitHub. But the
consequence is that the live journals sit in **no repository at all**:

```
journals/club-ignition/2026-07_pre-incorporation.journal
journals/club-ignition/2026-08.journal
journals/starq/2026-08.journal
```

Their only protection is `backups/journals-2026-08-20` and `journals-2026-08-22` — **on the same
drive as the thing they protect against.**

### What remains open

**Founder amendment A1 (`DEC-068`) — `SERP-173`, a hard gate.** An encrypted backup stored
independently of the development machine, a documented restoration procedure, and a **passed
restore test** against that backup. Scope is now explicitly three things, not one: **the Supabase
database, the `starqBooks` repository including this tag, and the plain-text journals that *are* the
books.**

> **Migration `0013` must not touch a live row until `SERP-173` closes.** It is the only migration
> in the merge that touches live data. `DEC-019` closes with it.

Every subsequent phase branches, and `0013` is additionally rehearsed against a restored copy
before it runs for real.

## Risks we are choosing to accept

1. **A core built with no live user drifts.** Named at `DEC-066` and unchanged. Mitigation is
   unchanged too: the garage keeps running on paper and on the Python portal, and the paper is the
   specification, so tenant setup models what Ignition Ink actually does.
2. **`0013` touches live jobs.** The only phase that can lose data. Reversible, rehearsed, tagged.
3. **The contract split changes `authorize()`.** Vocabulary before matrix, or a silent
   authorization hole becomes a hard outage.
4. **Two frontends were parked to avoid paying twice — and the console is where the refusal
   semantics were actually learned.** The mitigation is that those semantics move into the new
   client as specification (`§D`), not that the console stays alive.

---

## What approval means

Approving this authorises phases 0–9 as scoped, the eighteen tasks in epic `SERP-E10`, and
migrations `0011`–`0017`. It does not authorise: any deletion (Rule 2); a chart of accounts in
Postgres (`DEC-051`); the generic asset model; a live GST line while `gst_status` is
`not_registered`; MIRA return generation or bank slip verification; subdomain routing, WebSockets,
PWA offline or SMS gateways. Each of those returns as its own decision.

**Signed by both agents.** Antigravity: the revision, its mutation inventory, the client wiring, the
responsive spec and the demo dataset. Elder: the core, the boundary, the contract, the migrations,
the isolation suite and the rollback.

Awaiting the founder.
