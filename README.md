# StarqERP — Multi-Tenant Maldives SME ERP

**StarqERP** is a multi-tenant SaaS operating system engineered for Maldivian Small and Medium Enterprises (SMEs) across automotive garages, boatyards, clinics, and wholesale trade.

Established under founder ruling **DEC-067** (23 August 2026).

---

## 🏛️ Repository Architecture

* `contracts/`: Canonical command contract (`commands.ts`) — Single Source of Truth (SSOT) for authorization, Segregation of Duties (SoD per DEC-065), and idempotency.
* `supabase/`: Database migrations (0001–0011), Row-Level Security (RLS) policies, and Deno Edge functions (`starq-api`).
* `web/`: Front-end multi-tenant application (React 19 + TypeScript + Vite + TailwindCSS).
* `tests/`: Boundary test suite (`commands_test.ts`) and cross-runtime drift detector (`test_seat_matrix.py`).
* `scripts/`: Verification tools (`check-reality.mjs`) and bundle synchronization (`sync-contract.mjs`).
* `docs/`: Architecture specifications and decision records.

---

## 📦 System Split & Relationship to `starqBooks` (DEC-067 F4)

Per founder decision **DEC-067 F4**, core accounting and operational ledger processing remain segregated:

* **What stayed in `starqBooks`**:
  * Python double-entry accounting engine (`books.py`, `journal_outbox.py`, `serve.py`, `pos.py`, `ops.py`, `masters.py`, `catalog.py`).
  * Ledger journal files and chart of accounts.
  * Parked mobile console (`starq-ops-app` — Flutter client frozen per Rule 2).
* **Rollback Anchor**:
  * The full monolithic state prior to this separation is tagged in `starqBooks` as `pre-merge-2026-08-23`.

---

## 🛠️ Verification & Development Commands

```bash
# Verify canonical contract against edge generated copy
node scripts/sync-contract.mjs --check

# Run cross-runtime seat matrix drift detector
python tests/test_seat_matrix.py

# Run configured vs declared reality checks
node scripts/check-reality.mjs

# Build web application
cd web && npm install && npm run build
```
