# StarqERP ERP Process Closure Roadmap — 28 September 2026

**Status:** AUTHORITATIVE roadmap for StarqERP completion
**Governing doctrine:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](../governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
**State of the product:** implementation **ON HOLD** pending Founder restart authorization
**Basis:** live repository state verified 28 September 2026; live board
`starqNexus/data/starq-erp-tasks.json` (429 tasks, 232 done, 184 planned, 12 in progress, 1 closed)

This roadmap is **not** a restatement of remaining tickets. It answers: *how does StarqERP
go from today's system to a completed ERP?*

---

## Stage classification key

| State | Meaning |
|---|---|
| **implemented** | the stage executes as a real, verified end-to-end business operation |
| **partial** | works for some cases; gaps remain in the authoritative path |
| **schema-only** | tables/constraints exist; the executable business path does not |
| **test-only** | a test or probe exists without a complete production path behind it |
| **absent** | no implementation, no schema |

---

## Chain 1 — Order-to-Cash

| Stage | State | Evidence / note |
|---|---|---|
| Customer / Order | implemented | customer + price-list registry (SERP-314, done) |
| Pricing / Tax | partial | tax engine in `commands.ts`; date-effective rules partially landed |
| Fulfilment | partial | counter sale path exists (`202609190059`) |
| Sale / Invoice | partial | sale documents exist; end-to-end invoice chain not closed |
| Stock Issue | implemented | `202609190059` counter sale stock issue |
| COGS | partial | COGS intent in doctrine; no verified automated chain |
| Receivable / Cash | partial | AR control account exists in CoA (`202608300035`) |
| **Payment** | **schema-only** | payment schema `202608290031`–`034`; intents/attempts lifecycle (SERP-352) and webhook ingress (SERP-353) done. **The authoritative capture/refund/settlement command boundary is SERP-354, stopped.** |
| Refund | schema-only | refund ceiling concurrency test exists (`tests/test_serp356_payment_concurrency.py`); the command itself is SERP-354 |
| Settlement | schema-only | `202608290034` payment_settlements; concurrency test exists (`test_settlement_concurrency.py`); command is SERP-354 |
| Accounting | partial | `journal_proposals` + `postingControl.ts` exist; **no verified accounting-event/subledger abstraction** |
| Bank Reconciliation | partial | `web/src/domain/bankReconciliation.ts` exists; chain does not close as a verified process |

**SERP-354 is the next and most critical transaction blocker in this chain — it is not the
only one.** Payment, refund and settlement are schema-only and cannot execute. Pricing/tax,
fulfilment, sale/invoice, COGS, receivable/cash and accounting remain **partial**, and bank
reconciliation remains partial, as set out in the table above. Closing SERP-354 unblocks the
payment leg; the rest of the chain still requires its own closure work.

---

## Chain 2 — Procure-to-Pay

| Stage | State | Evidence / note |
|---|---|---|
| Supplier | implemented | supplier create/update/deactivate commands (migrations `202609100052`, `202609110053`, `202609120055`) |
| Requisition / PO | partial | SCM steps + SoD pairs defined in `commands.ts` |
| Goods Receipt | partial | no verified end-to-end receipt → valuation chain |
| Landed Cost | absent | named as `LANDED_COST_ALLOCATED` accounting event; no implementation |
| Inventory Valuation | partial | valuation referenced; no verified reconciliation |
| Supplier Invoice | partial | schema-adjacent; no closed payable chain |
| Payable | partial | AP control account exists in CoA |
| Supplier Payment | absent | no authoritative payment-out command |
| Accounting | partial | as Chain 1 |
| Bank Reconciliation | partial | as Chain 1 |

**Gap theme: Procure-to-Pay has schema and control-account foundations but no closed
operational→payable→payment chain. This is the largest single convergence gap after payment.**

---

## Chain 3 — Inventory-to-GL

| Stage | State | Evidence / note |
|---|---|---|
| Receive | partial | goods receipt not closed end to end |
| Transfer | absent | no verified transfer process |
| Reserve | absent | no verified reservation process |
| Issue | implemented | `202609190059`; POS stock movement derivation `202609200030` |
| Return | partial | counter return/void migration `202609192359` |
| Adjustment | partial | SERP-088 return/void probe work in progress (untracked test files present) |
| Valuation | partial | no verified inventory subledger = GL control reconciliation |
| COGS | partial | as Chain 1 |
| Inventory Subledger | **schema-only** | `stock_movements` table exists (`202608200002`); no formal subledger layer with accounting events |
| GL Reconciliation | absent | no executable reconciliation report or test |

---

## Chain 4 — Cash-to-Bank

| Stage | State | Evidence / note |
|---|---|---|
| Tender / Payment | schema-only | payment intents/attempts exist |
| Provider | implemented | provider registry `202608290031`; MOCK adapter (SERP-352) |
| Capture | schema-only | **SERP-354** |
| Settlement | schema-only | **SERP-354**; settlements table + concurrency test exist |
| Fees | absent | no fee model in the payment path |
| Clearing | absent | no clearing-account model |
| Bank Deposit | partial | bank accounts exist as entities |
| Reconciliation | absent | no `unsettled captures + clearing = payment clearing/bank position` executable check |
| Difference Handling | absent | no defined handling path |

**Cash-to-Bank is the least complete chain. It depends entirely on SERP-354 first.**

---

## Chain 5 — Record-to-Report

| Stage | State | Evidence / note |
|---|---|---|
| Subledger Events | **absent** | No verified first-class accounting-event/subledger abstraction. `journal_proposals` exists but no durable accounting-event record sits between operational facts and the ledger (verified: no `create table ... accounting_event` in any migration). |
| Journal Proposals | implemented | `public.journal_proposals` (`202608200003`) |
| Approval | partial | `postingControl.ts` guard exists |
| Posting | implemented | double-entry invariant + append-only triggers in `accounting-model.md` |
| Trial Balance | partial | GL exists; no verified TB report in the acceptance suite |
| Period Close | absent | no closed-period enforcement found |
| Financial Statements | partial | CoA as data (`202608300035`); no verified statement generation chain |
| Tax Reports | partial | MIRA GST model documented; no executable tax reconciliation |

**Record-to-Report has a working GL but is missing the subledger event layer that feeds it —
which is precisely why the accounting chain cannot currently close.**

---

## Convergence gap summary (the actual work)

Ordered by unblocking effect:

| # | Gap | Chains affected | Why it is high priority |
|---|---|---|---|
| **G1** | **No verified first-class accounting-event / subledger abstraction** | All five | Operational business facts have no durable, auditable intermediate between the operational write and the ledger. This is the structural blocker for Record-to-Report and the accounting leg of every other chain. |
| **G2** | **SERP-354 payment command boundary incomplete** | O2C, Cash-to-Bank | The next and most critical transaction blocker, blocking the payment leg of the two most commercially critical chains. Other O2C stages remain partial and need their own closure work. Work is already done and preserved — this is a continuation, not a build. |
| **G3** | **No executable reconciliation invariants** | All five | Inventory subledger = inventory GL control; AR/AP control; cash clearing; tax control. Without these, "complete" cannot be proven even when the flow runs. |
| **G4** | **Migration compatibility gate partial** | All five | The SERP-356 `config_id` incident is the proof that schema/fixture drift is a real, recurring failure mode here. |
| **G5** | **Cash-to-Bank incomplete beyond settlement** | Cash-to-Bank | Fees, clearing, deposit, difference handling are absent. Lowest maturity of the five chains. |
| **G6** | **Procure-to-Pay has no closed payable→payment chain** | P2P | Landed cost, valuation, supplier payment and payable are all absent or partial. |
| **G7** | **Inventory reservation/transfer/adjustment closure** | I2GL | Reserve and transfer absent; valuation reconciliation missing. |
| **G8** | **Period close / closed-period enforcement absent** | R2R | Blocks trustworthy statutory and financial reporting. |

---

## Reprioritization — what is now high, low, and paused

### High priority (convergence-critical, when the hold lifts)

1. SERP-354 — reference financial command implementation (continuation of preserved work).
2. Accounting-events / subledger layer (**G1**).
3. Reconciliation invariants as executable reports and tests (**G3**).
4. Canonical migration compatibility gate (**G4**).
5. Process acceptance suites for the five chains, using the §5 process-level definition of done.

### Deprioritized (valid work, but not convergence work)

- Additional capability screens and breadth features that do not close a chain step.
- Further CoA/archetype/branching breadth ahead of valuation and reconciliation.
- New archetype onboarding, additional workflow-stage data modelling, and UI surface growth
  that is not attached to closing a process chain.

### Not paused (legitimate regardless of the convergence doctrine)

- Security defects.
- Compliance defects.
- Data-integrity issues.
- Critical usability defects.
- Release/merge protection and the independent-review controls (DEC-072).

---

## Corrective task positions

The SERP board remains the task SSOT and its history and identifiers are preserved. New
corrective tasks were created only for gaps not already represented by an existing task.

| Task | Title | Gap | State |
|---|---|---|---|
| SERP-460 | Introduce first-class accounting-event / subledger abstraction | G1 | planned |
| SERP-461 | Executable reconciliation invariants (inventory, AR, AP, cash clearing, tax) | G3 | planned |
| SERP-462 | Canonical migration compatibility gate — fresh DB from zero + process probes | G4 | planned |
| SERP-463 | Process acceptance suites for the five canonical ERP chains | acceptance | planned |
| SERP-464 | Cash-to-Bank completion — fees, clearing, deposit, difference handling | G5 | planned |
| SERP-465 | Procure-to-Pay closure — landed cost, valuation, payable to supplier payment | G6 | planned |
| SERP-466 | Inventory-to-GL closure — reserve, transfer, valuation reconciliation | G7 | planned |
| SERP-467 | Period close and closed-period enforcement | G8 | planned |

**SERP-354 is deliberately not reopened.** Its board status remains exactly as it was at the
stop. The roadmap re-describes it; it does not restart it.

---

## First implementation wave after restart authorization

Ordered. Each wave is gated on the previous one's evidence, not on elapsed time.

1. **SERP-354 resumed under the canonical transaction architecture** — capture, refund and
   settlement as the reference implementation, reusing the existing idempotency framework,
   command contract, `journal_proposals` and posting controls. Evidence required: the
   full §5 process-level definition of done.
2. **Accounting-events layer** (SERP-460) — durable accounting events between operational
   facts and journal proposals.
3. **Reconciliation invariants** (SERP-461) — the five control relationships, executable.
4. **Migration compatibility gate** (SERP-462) — canonical fresh-database gate in CI.
5. **Process acceptance suites** (SERP-463) across all five chains.
6. Only then: chain-specific completion waves (SERP-464, 465, 466, 467) and resumption of
   broader product expansion.

---

**Room is the ledger.**
