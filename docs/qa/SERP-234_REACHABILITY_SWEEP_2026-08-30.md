# SERP-234 — reachability sweep

**Run:** 30 August 2026 · **By:** Elder · **Script:** `scripts/reachability-sweep.mjs`
**Result:** **20 unreviewed orphans — 11 feature views and 9 domain engines that the running
application cannot reach.** Several of them have passing tests.

> Reachability is **computed** from `web/src/main.tsx` outward, following every relative import
> transitively — not judged by reading imports by hand, which is what the acceptance asked for and
> what a human sweep gets wrong.

---

## 1. Numbers

| | |
|---|---|
| Source files under `web/src` | 220 |
| **Reachable from `main.tsx`** | **119** |
| Unreachable | 104 |
| — accounted for (tests, harness, ambient types) | 84 |
| — **unreviewed orphans** | **20** |

Reproduce:

```bash
node scripts/reachability-sweep.mjs          # report
node scripts/reachability-sweep.mjs --strict # exit 1 if unreviewed orphans exist
```

---

## 2. The finding

**Eleven complete feature views are not mounted on any route:**

```
components/admin/AgentRegistryView.tsx
components/banking/AiReconciliationView.tsx
components/inventory/MultiWarehouseView.tsx
components/invoices/BilingualInvoicePrintView.tsx
components/manufacturing/ProductionOrderView.tsx
components/onboarding/OrganisationSetupModal.tsx
components/payroll/PayrollManagementView.tsx
components/platform/StarqHQView.tsx
components/projects/JobCostingView.tsx
components/reports/ConsolidatedReportingView.tsx
components/sales/CreditDunningView.tsx
```

**And nine domain engines behind them:**

```
domain/agentRegistry.ts      domain/aiReconciliation.ts   domain/consolidatedBranches.ts
domain/creditDunning.ts      domain/dhivehiLocalization.ts domain/jobCosting.ts
domain/manufacturing.ts      domain/payroll.ts             domain/warehouse.ts
```

**The router mounts 21 routes and none of them is any of these:**

```
/login  /  customers  customers/:id  jobs  jobs/:id  invoices  invoices/:id
payments  payments/:id  expenses  accounts  inventory  purchasing  purchasing/:id
suppliers  suppliers/:id  reports  audit  settings  *
```

**This is not a lazy-loading false positive.** `grep -c "lazy(" src/app/router.tsx` returns **0** —
there are no dynamic imports hiding these behind a code-split boundary.

---

## 3. Why this is the same defect, again

Several of these orphans **have passing tests**: `payroll_view.test.tsx`,
`multi_warehouse_view.test.tsx`, `job_costing_view.test.tsx`.

So the suite is green for a screen no user can open. That is precisely how the fabricated MIRA GST
surface survived being reported removed **twice**, in good faith, by people who checked by walking
the running app. **You cannot click your way to a screen that never mounts, and you cannot click
your way to the evidence that it still exists.**

`PayrollManagementView` is referenced in exactly two places in the whole tree: its own test file,
and a **comment** in `ERPContext.tsx`. Nothing imports it.

---

## 4. What this means for last night's work — stated plainly

I spent the night correcting account codes in `payroll.ts`, `manufacturing.ts`, `warehouse.ts` and
`jobCosting.ts` under SERP-340. **All four are on this orphan list.**

That does not make the work wrong, and it does not change the defects — payroll genuinely did debit
Workshop Rent and Electricity, and that genuinely was worth fixing. Two reasons it still mattered:

1. **SERP-155 established that the revision front end is a specification with a working face.** A
   spec that says payroll debits rent produces a backend that debits rent. Fixing the spec is the
   point, whether or not the screen is currently mounted.
2. **SERP-344 put the same rules in the database**, where they are reachable by everything —
   `chart_of_accounts`, the foreign key from `journal_lines`, and the posting-control trigger. That
   half is live regardless of routing.

But I described those fixes last night without knowing the engines were unrouted, and the honest
qualification is: **correcting an unreachable engine improves the specification and the database
contract; it does not by itself change what a user experiences today.** Anyone reading last night's
summaries should read them with that attached.

---

## 5. What has NOT been done here

**Nothing was deleted, moved or retired.** Rule 2, and more importantly: deciding the fate of eleven
feature views is a product call, not a cleanup. Each one is either

- **work in flight** that will be routed when its lane lands — likely for the payments and
  manufacturing views; or
- **genuinely abandoned**, in which case it belongs in `_recyclebin` so it stops passing tests and
  implying coverage.

**I do not know which, and guessing would be worse than reporting.** The two already-known instances
(`App.tsx`, `InvoiceDetailModal.tsx`) are owned by SERP-192 and were deliberately excluded rather
than re-litigated here.

---

## 6. Recommendation

1. **Triage the eleven views** — routed soon, or retired. One line each is enough.
2. **Record the decision in the script.** `INTENTIONALLY_UNMOUNTED` in
   `scripts/reachability-sweep.mjs` takes a path fragment and a reason; an entry there is a decision
   on the record and the sweep stops reporting it.
3. **Add `--strict` to the release checklist.** It exits non-zero while unreviewed orphans exist, so
   a new one cannot appear silently between releases.

The value is not this run. It is that the next unroutable component gets caught in seconds instead
of surviving two removal reports.
