# Task Execution Report: SERP-125
## Permissioned Publication Boundary — Private by Default, Merchant-Controlled

- **Phase:** Phase 4 — Adversarial security & accounting truth
- **Priority:** P1
- **Execution state:** Implemented and probed. **Review pending — not closed.**
- **Date:** 2026-08-28
- **Accountable owner:** Elder (Claude)
- **Branch:** `claude/serp-125-publication-boundary` (worktree `worktrees/serp-125-claude`, cut from `6b0c2cd`)
- **Depends on:** SERP-124 (RLS policies exercised) — `done`
- **Authority:** `DEC-061`; vision §19 and §27, `00_STARQ_HQ/vision/MASTER-ARC-2026-2031.md`

---

## 1. What the task actually requires

Vision §19 requires ERP→Hoadhaa publishing to be **permissioned, private by default and
merchant-controlled**. The binding rule, stated in the master arc's gate list:

> Private ERP data is not Hoadhaa data. Cross-product use needs an explicit purpose and lawful
> basis. Private by default, merchant-controlled publication (§19, §27).

Hoadhaa integration is a 2028 item. The **boundary** is not — it is a property of the accounting
spine being written now. Retrofitting it after the ledger exists means touching every table and
every read path. Built in while the spine is being written, the task card says, it "costs a column
and a view." That framing set the scope: this is a database-level boundary, not a Hoadhaa feature.
`DEC-077` reinforces it — a starqERP session does not carry Hoadha in its working set.

---

## 2. The design decision that carries the whole task

**A projection, not a filter.** `public.product_publications` is a separate table that enumerates
every publishable field explicitly. It is deliberately *not* a `published` flag on
`public.products`, and *not* a view over it.

The difference is what happens to the *next* column somebody adds. Under a filter, a new column on
`products` — a supplier note, a landed cost, a margin — flows to the public surface the moment it
exists, and privacy depends on nobody forgetting. Under a projection, a new column on `products` is
private by construction: it cannot appear downstream until someone deliberately adds it here, in a
file whose diff a reviewer reads. This is acceptance criterion 3, and it is also the reason the
other three criteria are cheap to hold.

The existing `products.sale_allowed` flag was deliberately **not** reused. It already defaults to
false, which makes it superficially attractive, but it means "may be sold", not "may be listed
publicly". Overloading one boolean with two authorisations is how a boundary quietly disappears.

Secondary decisions:

- **`security_invoker = true` on the feed view.** Postgres views run with *owner* rights by default,
  which would silently bypass the row policy. The boundary would then be a property of view
  ownership — invisible, untested, and undone by any future `create or replace`. With
  `security_invoker`, the row policy is what admits a row, so it can be attacked and proven.
- **Actor identity is not on the publication row.** Who published is recorded in
  `public.audit_events`, which is append-only, rather than on a row a public reader can see.
- **Revocation is a state, not a delete** (`RULE 2`). The row and its history survive.
- **Nothing is granted to `anon`.** Every table in this schema is revoked from `anon` and
  `authenticated`, and this migration keeps that true. Opening the feed to a public reader is a
  separate, deliberate act for the Hoadhaa era. The boundary is built and proven first; the door is
  opened later, by decision.

---

## 3. Files created

| File | Purpose |
| :--- | :--- |
| `supabase/migrations/202609031046_permissioned_publication_boundary.sql` | The boundary: projection table, feed view, two row policies, two audited RPCs, grants |
| `tests/publication_boundary_fixture.sql` | Synthetic two-tenant fixture with an owner seat and a counter seat |
| `tests/publication_boundary_probe.sql` | Behavioural proof, 8 sections, runs in a transaction and rolls back |
| `tests/run_publication_boundary_probe.ps1` | Disposable-Postgres runner with **five negative controls** |
| `tests/publication_boundary.test.mjs` | CI gate — asserts in CI what the probe proves behaviourally |

Modified: `.github/workflows/ci.yml` (registers the gate), `scripts/lint-migrations.mjs`
(registers 0028 as `UNAPPLIED_FORWARD_ONLY`).

---

## 4. Acceptance criteria — evidence

| # | Criterion | Where it is proven |
| :-- | :--- | :--- |
| 1 | Publication is an explicit, audited act; nothing publishable by default | Probe §1 (`state` defaults to `revoked`, feed empty with products present), §2 (a directly inserted row is *not* published), §3 (counter seat refused), §4 (owner publishes, `erp.publish` audit row written) |
| 2 | A test proves an unpublished record is invisible to the publication read path | Probe §2 and §5. §5 re-runs the check as `serp125_publication_probe`, a `nobypassrls`, non-owner role holding an explicit `SELECT` grant — so a revoked grant cannot masquerade as an RLS pass |
| 3 | The publishable surface is a narrow named projection, not a filter | Probe §0 asserts the feed's column set exactly, and that no private column (`sku`, `income_account`, `cogs_account`, `inventory_account`, `unit_cost`, `state`) appears |
| 4 | Revoking publication is tested and takes effect | Probe §6 — feed drops the row, `state` becomes `revoked`, the row still exists, `erp.unpublish` audited, the other tenant is unaffected. §7 re-publishes |

**Positive control.** Probe §4 and §5 assert that a published row *is* visible, and that both
tenants' published rows appear. Without it, an empty table would pass every invisibility assertion.

---

## 5. Test evidence

### Behavioural probe — real PostgreSQL, real read path

`pwsh tests/run_publication_boundary_probe.ps1` — applies all 28 migrations to a disposable
`public.ecr.aws/supabase/postgres:17.6.1.155` container, loads the fixture, runs the probe.

```
OK  Section 0: projection is narrow, named, and invoker-scoped
OK  Section 1: private by default — products exist, feed is empty
OK  Section 2: an unpublished row is invisible on the read path
OK  Section 3: publication is merchant-controlled — counter seat refused
OK  Section 4: owner published, row is visible, act is audited
OK  Section 5: powerless role sees published listings only, never the ERP record
OK  Section 6: revocation is effective, audited, and non-destructive
OK  Section 7: re-publication works and every act left an audit row
=== SERP-125 publication boundary probe: ALL SECTIONS PASSED (0-7) ===
SERP-125 publication boundary probe: PASS          (17s)
```

### Shown to go red — `DEC-072`

> "No test counts as proof unless it executes the real path and has been shown to go red."

Five negative controls, each breaking exactly one property. All five were executed:

| Switch | Breaks | Probe verdict | Failure raised |
| :--- | :--- | :--- | :--- |
| `-SimulateWideProjection` | AC3 | **RED** | `AC3: publication_feed columns drifted ... income_account` |
| `-SimulateLeakyPolicy` | AC2 | **RED** | `AC2: a directly inserted, unpublished row reached the feed` |
| `-SimulateOwnerScopedView` | AC2 | **RED** | `AC2: publication_feed is not security_invoker; the row policy is not load-bearing` |
| `-SimulateSeatBypass` | AC1 | **RED** | `AC1: the counter seat was allowed to publish` |
| `-SimulateHardDelete` | AC4 / RULE 2 | **RED** | `RULE 2: revocation deleted the publication row` |

With no switches the probe returns to **PASS**.

> Note on `-SimulateSeatBypass`: the first version granted the counter membership an `owner` seat
> and the probe stayed green — correctly, because the RPC gates on the *acting seat passed in*, not
> on which seats the person holds. The control was rewritten to widen the seat list itself, which is
> the only thing that actually breaks merchant control. Recorded because it is a useful distinction:
> holding a seat and acting in one are different, and the probe was right.

### CI gate — also shown to go red

`node tests/publication_boundary.test.mjs` → **9/9 PASS**. Mutation-tested against the migration:

| Mutation | Result |
| :--- | :--- |
| `state` default → `'published'` | **RED** |
| `security_invoker` → `false` | **RED** |
| `income_account` added to the feed | **RED** |
| seat list widened to `counter` | **RED** |
| a comment-only edit (control) | GREEN, correctly |

The migration was restored byte-identical afterwards (`cmp` clean) and the gate re-run green.

---

## 6. What is deliberately NOT done

1. **The migration is not applied to any database.** Registered `UNAPPLIED_FORWARD_ONLY` in
   `scripts/lint-migrations.mjs`. Vision gate 7: *nothing reaches a database, deployment or secret
   without two independent reviews and the founder's word.* It has been exercised only against a
   disposable container that is destroyed on exit.
2. **The command surface is not wired.** `api_publish_product` / `api_revoke_publication` are
   `security definer` RPCs granted to `service_role`; they are not yet registered as commands in
   `contracts/commands.ts` (`COMMANDS`, `COMMAND_SEATS`, `SQL_REQUIRED_SEAT`, `SQL_PERMITTED_SEATS`)
   nor in the `api_garage_command` allowlist. Two reasons: the acceptance criteria are satisfied at
   the database layer, which is where the task card puts them ("a column and a view"); and
   `contracts/commands.ts` is a high-collision file while `@antigravity` is running consecutive
   finance tasks in the main worktree. **Recommend a separate task** for the command-surface
   wiring, sequenced after AG's current run.
3. **No `anon` grant, and no UI.** Both belong to the Hoadhaa era and to a decision, not to this
   task.
4. **This gate is not closed by me.** `DEC-072`: no worker closes its own gate. The board entry
   stays `in_progress` pending independent review.

---

## 7. Defects found in passing (not fixed, not in scope)

- `tests/rls_isolation_probe.sql` hardcodes an expected catalogue of 31 tables / 27 policies and
  asserts exact counts (lines 117-132). Adding `product_publications` will trip it. Its classifier
  also has no category for a table intended to be readable by a public role. **This must be
  reconciled before 0028 is applied** — flagged as the one hard prerequisite.
- `docs/history/ELDER_RETURN_BRIEF_2026-08-28.md` §3 lists migration filenames for 0024-0027 that do not
  match the files on disk.
- Pre-existing and unrelated: `web/src/test/serp_197_jobs_runtime_regression.test.tsx` hangs
  indefinitely on its fourth test — an unstable `switchCurrentUser` dependency in
  `web/src/context/ERPContext.tsx:1183` drives an unbounded `setUsers` loop. Reported to
  `@opencode` and `@antigravity` on the Nexus bus.

---

## 8. Review checklist for whoever closes this

1. Read the migration's header comment and decide whether "projection, not filter" is the right
   call. Everything else follows from it.
2. Confirm `security_invoker = true` is understood as load-bearing, not decoration.
3. Re-run the probe with **all five** negative controls and confirm each goes red.
4. Reconcile `tests/rls_isolation_probe.sql`'s hardcoded catalogue counts (§7) — required before
   apply.
5. Decide whether `product_publications` should also carry `force row level security`. It is not
   forced today, consistent with 26 of 27 existing migrations; forcing it would subject the
   `security definer` write path to RLS and require a write policy. The probe compensates by using a
   non-owner `nobypassrls` role, which is the same approach SERP-124 took.
6. Only then: two reviews, the founder's word, and apply.
