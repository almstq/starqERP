# CoA Accountant Audit — 29 August 2026

Post-delivery accountant and regulatory quality audit of the starqERP Chart of Accounts and the
accounting kernel beneath it. **Not a UI polish review.**

| File | What it is |
|---|---|
| [`ACCOUNTANT_REVIEW_REPORT.md`](./ACCOUNTANT_REVIEW_REPORT.md) | The received report, verbatim and unedited. Azhad's four findings + an independent second-pass revalidation with Maldives regulatory research. Preserved evidence — do not edit. |
| [`ELDER_RECONCILIATION.md`](./ELDER_RECONCILIATION.md) | Elder's verification of every claim against private `main` at `9815813`, plus seven additional findings the report missed. **Operative where the two disagree.** |

## Provenance

Founder Mustarq asked Azhad to review the live CoA from an accountant's perspective after SERP-290
shipped on 28 August 2026. Azhad raised four findings. Mustarq then commissioned an independent
revalidation with current Maldives regulatory research, which confirmed all four and found more.
Elder reconciled the result against the private repository, migrations and board SSOT on 29 August
before any mutation.

## Standing verdict

- **Nothing in the received report is false.** One finding is mis-scoped (tourism GST), two are
  understated (payroll accounts, `isSystem`).
- **The largest defect was not in the report:** the canonical chart and the posting engines are
  disjoint account-code universes, and there is no accounts table in the database at all. Running
  payroll currently debits Workshop Rent and Electricity.
- Remediation must run **kernel-first** — one code universe, then taxonomy, then rates — before the
  UI corrections the report opens with.
- **Scope boundary:** moving the chart, journals and periods off `localStorage` onto the server is
  the SERP-155 lane change, not this audit. See the E3 amendment in the reconciliation.

## Task linkage

| Task | Role |
|---|---|
| **SERP-339** | Umbrella corrective owner. Holds no work of its own; blocks final finance-kernel acceptance. |
| **SERP-340 … 346** | The actual work, split for WIP=1. `340 → 341 → 342` is a hard chain; `343` and `344` run alongside; `346` gates the umbrella. See reconciliation §7. |
| SERP-290 | Primary subject. **Remains `done`** — delivery history preserved. Carries an audit supplement pointer. |
| SERP-291 / 292 / 295 / 296 / 297 | Downstream enforcement. Each carries the same pointer so this audit resurfaces when the task is next attended. |

Treat this folder as an **acceptance supplement**, not a loose suggestion. Every ledger-affecting
correction requires tests and a migration assessment across seed → schema → posting engine →
reports → tax → UI.

After remediation, the accounting surface returns to **Azhad for a second review**.
