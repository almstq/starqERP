# StarqERP Convergence Doctrine — current SSOT

**Status:** AUTHORITATIVE — current development SSOT for StarqERP
**Effective:** 28 September 2026
**Supersedes:** the pre-28-Sep component-first / schema-first completion trajectory
**Founder directive:** `single irreversible course-correction round (ChatGPT Astra) 28 Sep 2026.txt`
**Source report:** `StarqERP_Development_Convergence_Report_2026-09-28.md` (read in full; validated against the live repo)
**Implementation state:** StarqERP implementation is **ON HOLD**. This doctrine is the
instruction for planning, review and restart-readiness. It is not an authorization to implement.

---

## 0. Read this first — the one-paragraph version

Development stopped on **28 September 2026** because the programme had been organized
**component-first and schema-first** (schema → constraints → commands → tests →
orchestration), while an ERP approaching completion has to be organized
**business-process-first** (business process → business event → transaction → operational
state → accounting consequence → audit → reconciliation → reporting). The schema and control
layers had matured faster than the executable ERP workflows above them, so the board could
report high task-completion percentages while whole business processes remained unclosed.

The correction is **convergence, not rewrite**. Nothing in the architecture is being
discarded. Tenant isolation, composite foreign keys, row-level security, migration
discipline, transaction safeguards, concurrency controls, the command contract, audit
design and the test infrastructure are **assets and are retained**.

From now on a StarqERP capability is complete when a **real business process runs end to
end** — user intent → operational truth → accounting/subledger consequence → audit →
reconciliation → reporting — **not** when a ticket closes, a migration applies, or CI goes
green.

---

## 1. Why development was stopped on 28 Sep 2026

**What was wrong with the previous completion trajectory:** the programme was organized
component-first and schema-first, and it treated *technical completion* as *product
completion*. A table, migration, constraint, handler, ticket or green CI run was allowed to
stand as evidence that a business capability was finished. Under that model the board could
report high task-completion percentages while whole business processes remained unclosed,
and the schema layer ran ahead of the executable ERP workflows above it.

**What is not superseded by this correction:** the architecture, the security model, the
migrations, the command contract, the test infrastructure, every completed task, the board
itself, and every prior decision. Only the *completion model* and the *organizing principle*
changed. See §2 for what remains valid, and §10 for what was preserved untouched.

Five concrete weaknesses were identified in the live system, each evidenced in the repo:

| # | Weakness | Live evidence |
|---|----------|---------------|
| 1 | **Schema maturity ahead of executable workflow maturity.** The team could read "the database can support this safely" as "the ERP can execute this process." Those are different states. | Payment schema and safety mechanisms exist (migrations `202608290031`–`202608290034`), but the authoritative payment **command boundary** is still incomplete. |
| 2 | **Development was too bottom-up.** Isolated capabilities were produced that do not yet form complete business processes. | The SERP board tracked 429 tasks with 232 marked done, yet the five canonical ERP chains were not individually closable. |
| 3 | **Schema / application / test drift.** A material DB change landed without its consumer and fixture compatibility. | SERP-356 concurrency test: a later migration made `config_id` mandatory while an older test fixture still assumed the previous schema. |
| 4 | **Accounting consequences not converged.** Operational transactions coupled to GL through scattered direct writes from multiple modules. | `journal_proposals` exists (`202608200003`) and the posting-control guard exists, but there is **no verified first-class accounting-event/subledger abstraction** — no durable accounting-event record between an operational fact and the ledger (verified: no `create table ... accounting_event` in any migration). |
| 5 | **Acceptance criteria can pass vacuously.** "No automatic posting" can appear true simply because the payment entrypoint does not yet exist. | A missing command can satisfy a negative assertion. |

---

## 2. What remains valid from the existing architecture

**This is convergence, not replacement.** The following are canonical and must be reused,
not rebuilt. Each was verified in the live repository on 28 September 2026.

| Capability | Canonical implementation | Status |
|---|---|---|
| Canonical command contract | `supabase/functions/_shared/commands.ts` (4,522 lines) + `contracts/commands.ts` (4,511 lines) — seats, SoD pairs, tax engine, financial-truth invariant, error codes | **EXISTS — canonical** |
| Idempotency framework | `supabase/migrations/202608250014_idempotency_replay.sql`; `app_private.canonical_jsonb_sha256()`; `public.idempotency_keys`; `idempotency_key_conflict` error code; replay returns `replayed` | **EXISTS — canonical** |
| Journal proposal boundary | `public.journal_proposals` (`202608200003_commercial_accounting.sql`) with `posted_entry_fk` | **EXISTS — canonical** |
| Posting control / no-direct-GL guard | `web/src/domain/postingControl.ts` — `postingControlFor()`, `assertJournalPostable()` | **EXISTS — canonical** |
| Payment schema + safety | migrations `202608290031`–`202608290034` — provider registry, payment intents/attempts, provider events, payment settlements | **EXISTS** (done: SERP-348, SERP-349) |
| Payment ingress | SERP-352 mock adapter + intent/attempt lifecycle; SERP-353 webhook verify/dedupe/normalise/enqueue | **EXISTS** (done) |
| Tenancy / RLS | Two-plane model, `organisation_id` scoping, RLS isolation probes in CI | **EXISTS** |
| Stock ledger | `public.stock_movements` (`202608200002`), POS stock movement derivation (`202609200030`), oversell guard (`202609201900`) | **EXISTS** |
| Concurrency evidence | `tests/test_serp356_payment_concurrency.py`, `tests/test_settlement_concurrency.py`, `tests/test_document_numbering_real_concurrency.py` | **EXISTS** |
| Migration lineage lint | `.github/workflows/ci.yml` → `scripts/lint-migrations.mjs`; fresh-DB migration apply in the RLS probe job | **PARTIAL — extend** |

**Rule:** when a future work item says "add idempotency", "add a posting guard", or "add
concurrency protection", the first step is to check the table above. If the mechanism
exists, the task is to *extend or wire* it, not to invent a second one.

---

## 3. The five canonical ERP process chains

All remaining StarqERP work is organized against exactly these five families. Any work
that cannot be placed in one of them is not currently in scope.

1. **Order-to-Cash** — Customer/Order → Pricing/Tax → Fulfilment → Sale/Invoice → Stock
   Issue → COGS → Receivable/Cash → Payment → Refund → Settlement → Accounting → Bank
   Reconciliation
2. **Procure-to-Pay** — Supplier → Requisition/PO → Goods Receipt → Landed Cost →
   Inventory Valuation → Supplier Invoice → Payable → Supplier Payment → Accounting →
   Bank Reconciliation
3. **Inventory-to-GL** — Receive → Transfer → Reserve → Issue → Return → Adjustment →
   Valuation → COGS → Inventory Subledger → GL Reconciliation
4. **Cash-to-Bank** — Tender/Payment → Provider → Capture → Settlement → Fees → Clearing →
   Bank Deposit → Reconciliation → Difference Handling
5. **Record-to-Report** — Subledger Events → Journal Proposals → Approval → Posting →
   Trial Balance → Period Close → Financial Statements → Tax Reports

---

## 4. Canonical transaction architecture

Every financially or inventory-significant command follows this path. It is the standard
transactional doctrine for the product.

```text
Request / UI
    ↓
Authenticated Principal            (tenant derived from the session, never from the client)
    ↓
Business Command
    ↓
Authorization                     (who acts, which org is authoritative, which permission, which source document)
    ↓
Business Invariants
    ↓
Idempotency Acquisition            (organisation + command_type + idempotency_key)
    ↓
Single Database Transaction
    ↓
Operational / Subledger State
    ↓
Accounting Event or Journal Proposal
    ↓
Audit Record / Outbox Event
    ↓
Commit
    ↓
Read Models / Reporting / External Effects
```

### 4.1 The four non-negotiable transaction rules

- **Tenancy** — the tenant is derived from the authenticated Principal/session. The client
  must never be able to decide its own authoritative `organisation_id`.
- **Authorization** — command-specific. It establishes who is acting, which organisation is
  authoritative, which permission authorizes the operation, and which source document is
  affected.
- **Idempotency** — one canonical mechanism across financially mutating commands. The
  conceptual key is `organisation + command_type + idempotency_key`. Same key + same request
  returns the existing result; same key + materially different request is refused
  (`idempotency_key_conflict`); no second financial mutation is ever allowed.
  **Already implemented** — see §2.
- **Concurrency** — lock only the rows or aggregates that require serialization, and only
  where multiple writers could corrupt financial truth.

### 4.2 Accounting boundary

A business command must **not** perform uncontrolled finalized GL posting. The chain is:

```text
Business fact → Accounting event → Accounting rule → Journal proposal / subledger entry
              → Approval / posting policy → General Ledger
```

### 4.3 Genuine gaps in this architecture (verified 28 Sep 2026)

These are the real, currently-open items. They are roadmap work, not implementation work in
this round.

- **No verified first-class accounting-event / subledger abstraction.** `journal_proposals` and
  the posting-control guard exist, but there is no durable accounting-event record between an
  operational business fact and the ledger. Business events (`PAYMENT_CAPTURED`,
  `SALE_INVOICED`, `INVENTORY_RECEIVED`, `COGS_RECOGNIZED`, `LANDED_COST_ALLOCATED`, …) are
  not modelled as durable records (verified: no `create table ... accounting_event` in any
  migration). **The requirement is the abstraction, not a specific table shape** — the
  implementation may be a table, an event log, an outbox-backed record, or an equivalent
  mechanism, chosen from repository evidence at implementation time.
- **No reconciliation invariant enforcement.** The five control relationships (inventory
  subledger = inventory GL control; customer open balances = AR control; supplier open
  balances = AP control; unsettled captures + clearing = payment clearing/bank position;
  tax detail = tax control = statutory totals) are documented intent, not executable
  reconciliation reports or automated tests.
- **Migration compatibility gate is partial.** CI has a migration lineage linter and a
  fresh-database apply in the RLS probe, but there is no single canonical gate that applies
  *all* migrations from zero, loads a canonical ERP fixture, and runs critical process
  probes plus RLS/privilege and accounting-invariant verification.
- **Bank reconciliation is frontend-domain only.** `web/src/domain/bankReconciliation.ts`
  exists; the Cash-to-Bank chain does not close as a verified end-to-end process.
- **Concurrency assurance is uneven.** Refund and settlement concurrency evidence exists;
  equivalent protection is not established for every allocation or valuation invariant.

---

## 5. Process-level definition of done

The SERP board remains the task SSOT. But **task completion is no longer the measure of ERP
completion.** A financially or inventory-significant capability is complete only when, as
applicable, it has evidence across all of these dimensions:

| Dimension | Required evidence |
|---|---|
| Functional | the real business flow executes end to end |
| Authorization | an unauthorized user is refused |
| Tenant isolation | cross-tenant access is refused |
| Idempotency | replay causes no duplicate financial effect |
| Concurrency | competing writers preserve the financial invariant |
| Operational persistence | the operational/subledger state is written correctly |
| Accounting consequence | the correct accounting event or journal proposal is generated |
| Prohibited direct posting | unauthorized direct GL posting to finalized records is proven impossible |
| Auditability | actor, tenant, source document, and result are recorded |
| Migration compatibility | a fresh database from all migrations passes |
| Reporting | the result appears correctly in operational and financial reports |
| Reconciliation | the capability reconciles to settlement, cash/bank and control accounts |
| Reversal / correction | corrections use controlled reversal semantics, not deletion |

**Both required and prohibited behaviour must be proven.** Negative tests are mandatory
for financial commands — a criterion that passes because the code path does not exist is a
false pass.

**Fit this into the existing testing and review architecture** (`docs/development/testing.md`,
`docs/product/quality-gates.md`, DEC-072 independent review). The objective is stronger ERP
correctness, **not heavier bureaucracy**.

---

## 6. Reversal and correction semantics

Financial facts are rarely deleted or overwritten. StarqERP uses controlled corrections:

```text
Sale            → Return / Reversal
Payment         → Refund / Reversal
Journal         → Reversal Journal
Goods Receipt   → Supplier Return / Adjustment
Settlement      → Settlement Correction / Reversal
Stock error     → Inventory Adjustment
```

---

## 7. Migration, application and test compatibility

**Every material database change is a three-part change:**

1. the schema change;
2. consumer/application compatibility;
3. test and fixture compatibility.

CI must continuously rebuild a fresh database from migration zero and execute the critical
business probes against the resulting canonical schema. A migration that breaks an existing
fixture is a defect in the migration change-set, not a defect in the test.

Current state: `scripts/lint-migrations.mjs` and the RLS probe job's fresh apply exist; the
full canonical gate described above does not yet exist and is roadmap work.

---

## 8. Horizontal expansion is paused

Until the core process chains close, **new breadth is limited**. The principal development
priority is:

> **Converge existing capabilities into complete business processes.**

Security defects, compliance defects, data-integrity issues and critical usability defects
remain legitimate and are not paused.

### 8.1 What is now high priority

When the hold lifts, in order — each wave gated on the previous wave's evidence, not on
elapsed time:

1. **SERP-354** — the reference financial command implementation, as a *continuation* of
   preserved work under §4.
2. **Accounting-events / subledger layer** (SERP-460) — the structural blocker; nothing
   downstream of an operational fact can currently reach the ledger durably.
3. **Reconciliation invariants** (SERP-461) — the five control relationships, executable.
4. **Canonical migration compatibility gate** (SERP-462).
5. **Process acceptance suites** (SERP-463) across the five chains, against the §5 standard.

### 8.2 What is now deprioritized

This work is **valid but not convergence work**. It must not compete for capacity with
process closure until the core chains are coherent:

- additional capability screens and breadth features that do not close a chain step;
- further chart-of-accounts, archetype and branching breadth ahead of inventory valuation
  and reconciliation;
- new archetype onboarding, additional workflow-stage data modelling, and UI surface growth
  that is not attached to closing a process chain.

**Not paused** — legitimate regardless of the freeze: security defects, compliance defects,
data-integrity issues, critical usability defects, and release/merge protection with the
independent-review controls (DEC-072).

---

## 9. ERP restart gate

StarqERP implementation may resume **only** when the Founder gives explicit restart
authorization. When it resumes, the first implementation wave is, in order:

1. **SERP-354 as the reference financial command implementation** — resume the *existing
   stopped work* under the canonical transaction architecture in §4. The three commands are
   `PAYMENT_CAPTURE`, `PAYMENT_REFUND`, `PAYMENT_SETTLEMENT_RECORD`. This is not a new build;
   it is the continuation of preserved branches, commits and test work.
2. **Accounting-event / subledger abstraction** — introduce the missing first-class
   accounting-event abstraction so operational facts reach accounting through a durable
   intermediate. The abstraction is the requirement; the concrete mechanism (table, event log,
   outbox-backed record or equivalent) is chosen from repository evidence at implementation
   time.
3. **Process acceptance suites** for the five chains — each with normal, negative, retry,
   concurrency, reversal and reconciliation paths.
4. **Migration compatibility gate** — canonical fresh-database gate.
5. **Resume product expansion** only after the core chains are coherent.

---

## 10. Preservation — what this correction did NOT touch

- Current canonical `main` and `origin/main` — unchanged.
- The stopped **SERP-354** state — branches, commits, mappings and test work preserved.
- All existing branches and worktrees, including dirty and prunable historical checkouts.
- Devin's payment-RLS work and PR #166.
- All existing decisions and evidence.
- No history was rewritten, reset, squashed or cosmetically cleaned.

---

## 11. Document precedence

If a live authoritative document disagrees with this file, **this file wins** for
development doctrine, and the disagreement is a defect to be fixed in that document.

Precedence order for StarqERP development questions:

1. This doctrine (28 Sep 2026 course correction).
2. `docs/roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md` (process-gap state and sequencing).
3. `docs/governance/SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md` (what was superseded, and the index of marked documents).
4. The live board `starqNexus/data/starq-erp-tasks.json` (task SSOT).
5. Founder decisions `00_STARQ_HQ/decisions.json` (DEC-100 and later).
6. All other repository documents, subject to the supersession markers in §3 of the
   supersession record.

---

**Room is the ledger.**
