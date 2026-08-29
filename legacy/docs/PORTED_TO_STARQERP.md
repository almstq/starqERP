# Core Ported to StarqERP Repository

Under founder ruling **DEC-067** (23 August 2026), the ERP core and authorization contracts have been separated from `starqBooks` and ported to the dedicated repository:

📂 **`D:/!starq/starqERP`**

---

### Ported Components

The following components have moved to `starqERP` and their previous local copies archived to `D:/!starq/_recyclebin/starqBooks-ported-to-starqERP-2026-08-23/` per Rule 2:

1. `contracts/` (`commands.ts` — Canonical authorization contract)
2. `supabase/` (Migrations 0001–0011, `starq-api` Edge Function, configs)
3. `tests/` (`commands_test.ts` and `test_seat_matrix.py`)
4. `scripts/sync-contract.mjs` and `scripts/check-reality.mjs`

---

### What Remains in `starqBooks` (DEC-067 F4)

* Double-entry accounting engine (`books.py`, `journal_outbox.py`, `serve.py`, `pos.py`, `ops.py`, `masters.py`, `catalog.py`).
* General ledger journal store (`journals/`).
* Parked mobile console (`starq-ops-app` — Flutter client frozen per Rule 2).

---

### Rollback Point

The complete repository state immediately prior to this separation is tagged in git as:
🏷️ **`pre-merge-2026-08-23`**
