# starqBooks

**Product vision — 19 Aug 2026.** Small accounting/operations **core**, **ERP-ready data model from day one** (company, contacts, products, accounts, tax, locations, transactions, users, permissions). **Not** a bookkeeping app that later bolts on POS.

Accounting is the **financial consequence engine** under every module — cashier, ops, and warehouse eventually create journals. **Destination:** auto-journals. **Honest now:** `journals/*.journal` are SSOT; ops do not post GL yet (DEC-008 — Ali appends). Goal is no rebuild in three years.

**Goal 1 SSOT:** [`ERP-READY-CORE.md`](ERP-READY-CORE.md) — pointer only; do not paste the full core here.

**Ladder (ASAP):** Bookkeeping → Inventory → POS → Purchasing/Sales → CRM → HR/Payroll → Projects → Manufacturing/Service → Full ERP.

**Visible v1** stays simple: Dashboard → Sales → Expenses → Banking → Contacts → Products → Reports → Accounting → Settings.

GitHub: [`almstq/starq-ops`](https://github.com/almstq/starq-ops) (private, Ali only). **Live folder:** `D:\StarqTech\starqBooks`. Access law: [`ACCESS.md`](ACCESS.md) (occupancy, portal gate, `_secrets` allowlist — paths still apply). Flutter SSOT: [`starq-ops-app/FLUTTER_SHELL.md`](starq-ops-app/FLUTTER_SHELL.md).

In `serve.py`: command home **`/`** is calendar + receipts (not books). **`/overview`** is the books recap.

Work **only** under `D:\StarqTech`. Do not use `D:\!starq`. **RULE 0:** everything that consumes disk stays on **D:** — never C:. Bind **`127.0.0.1:51800`**. No tunnel.

**Classification**
- **Product code** may live on that private GitHub remote. No collaborators.
- **Journals, `decisions.json`, live ops occupancy, secrets** stay in the vault (`D:\StarqTech\_secrets\`, `journals/`, `_git-remotes\starqos.git`). Never GitHub. Never move the vault into `starqNexus/` or give the vault itself a GitHub remote.

POS is a **product module** on the ladder. It is not “Starq HQ becomes a till.” The Starq Technologies occupancy does **not** run shop POS. Account **`4300` Product sales** is unused (not retail; leftover paint is not product, DEC-023).

---

## Orgs and surfaces

This beta has **two trial occupancies**:

| | Who | Company | Under it |
|---|---|---|---|
| **Trial user #0** | Ali | **Starq Technologies Pvt Ltd** `C29552026` | its **2 business names**: Starq Dynamics, Hoadhaa Network |
| **Test user #1** | Nashid | **Club Ignition Pvt Ltd** `C30222026` | **its garage** (Ignition Ink) |

Onboard is still MED: company `C` number; each business name with its `BN`. `group` is Ali’s combined books view, not a third company. See `ORG-REGISTRY.md`.

| Surface | What it is |
|---|---|
| **Web portal** `http://127.0.0.1:51800` | Ali HQ: Group / Starq / CI **books**, Starq **8211 ERP**, full **CI garage Ops**. Bind `127.0.0.1`. No tunnel. |
| **Flutter** (`starq-ops-app/`) | CI **paint-shop sim** — one play, exciting not a hassle. Field ops for Ali and the garage MD. **Club Ignition garage only.** Nashid never sees Starq. No Starq books, no Starq ERP, no Group, even when Ali is signed in. Not a finished app; SSOT is `FLUTTER_SHELL.md`. |

Python is the engine (journals, ops events, seats, Google verify, entity ACL). Flutter is a client of `/ops`, not a second ledger.

Goal 1 (stages 1–11, 36-section spec, architecture diagram): [`ERP-READY-CORE.md`](ERP-READY-CORE.md). Flutter = CI paint-shop sim / Nashid next-play. Portal = Ali HQ. Do not mix.

---

## Run it

Run everything from this folder. Windows Python 3.13, not WSL. **RULE 0:** venv on **D:** inside this folder — never install to C:.

```bat
cd /d D:\StarqTech\starqBooks
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe serve.py
```

Opens `http://127.0.0.1:51800`. If 51800 is taken it falls back through `51801`, `51770`, `8899`, `7654` and prints where it landed.

Google Sign-In is the gate. Unauthenticated books routes 303 to `/login`. Occupancy is person → allowed orgs (see `ACCESS.md`). Live Gmails and the OAuth client id stay in `_secrets` — not this file, not git.

**Do not tunnel** (no ngrok, no Cloudflare, no port forward). Company books. Bind stays `127.0.0.1` until the founder says otherwise.

### Ledger check (run before every commit)

```bat
.venv\Scripts\python.exe books.py check
```

| Command | What it does |
|---|---|
| `books.py check` | Parse and validate the journals. Posts nothing. |
| `books.py post` | Rebuild `books.db` from the journals |
| `books.py tb` | Trial balance, each entity |
| `books.py pl --entity CI --from 2026-08-01 --to 2026-08-31` | Profit and loss for a period |
| `books.py bs --entity STARQ --to 2026-12-31` | Balance sheet at a date |
| `books.py ledger 2410` | Every movement on one account, with a running balance |
| `books.py accounts` | The chart of accounts |
| `books.py entities` | Entities and entry counts |
| `books.py bs --consolidated` | Group view, intercompany dropped |

Journals live in the vault (`journals/starq/`, `journals/club-ignition/`), not in this GitHub tree. `books.db` is a rebuildable index — delete it, run `post`, it comes back identically. Never edit `books.db` by hand.

The portal **views** the ledger. Journals are the only way to record a books transaction (DEC-008). Ops events write `ops/events.jsonl` and cannot append a journal. Decisions (`POST /decisions/reply`) write `decisions.json` only.

---

## Writing an entry

```
2026-08-10 CI "Logo registration LG11242026" ref:MED-00404036 doc:corporate/.../evidence/logo.jpeg
  6300      300.00
  2410     -300.00
```

- **Date, entity, then the narration in double quotes.** Entities are `STARQ` and `CI`.
- `ref:` is the invoice or document number. `doc:` is a path in the vault. Both optional.
- **Debits positive, credits negative.** Every entry must sum to zero. Nothing posts unless it balances — there is no partial state.
- **Leave one amount blank and it is calculated for you.**
- `#` starts a comment.

**Which folder?** Starq entries go in `journals/starq/`, Club Ignition in `journals/club-ignition/`. `check` rejects a `CI` entry in the Starq folder and vice versa. One file per month per entity, `YYYY-MM.journal`. Never edit a closed month — post a correcting entry in the current month instead.

---

## Chart of accounts

`accounts.csv`. Five classes: 1000 assets, 2000 liabilities, 3000 equity, 4000 income, 5000/6000 cost of sales and expenses. Rows marked `heading` cannot be posted to.

- **`entities`** — `BOTH`, `STARQ` or `CI`. An account scoped to one entity cannot be posted in the other's journals.
- **`status`** — `active` or `blocked`. A blocked account is rejected at post time.

| Account | Why it is flagged |
|---|---|
| `4100` Services income — software | **Open.** MED BAR **`BP84562026`** (6 Aug 2026), ISIC **6201**, name on BAR **Starq Technologies** — activity of company `C29552026`, not a BN. Software fees credit `4100`. Not Dynamics. Not CI. |
| `4110` Services income — professional | **Open.** ISIC **8211** on BAR `BP89422026` (16 Aug 2026) — **Starq Dynamics** (business name of Starq Technologies; same `C29552026`, different trade). Professional / Dynamics fees credit `4110`. Not software. Not CI. |
| `4200`–`4230` Garage jobs (paint / wrap / repair / detailing) | **Open.** Club Ignition trading as **Ignition Ink**. BAR **`BP86372026`** (10 Aug 2026), ISIC **4520**. Service income. Not retail. Not `4100`/`4110`. |
| `4300` Product sales | **Not used.** Not retail. Leftover paint is not product (DEC-023). |
| `1220` / `2200` GST | In use from pre-opening (GGST 8%). MIRA registration is a human filing — the books decision is not the return. |
| `1290` / `2490` | Intercompany current account. They must mirror; `books.py check` enforces net zero across the group. |
| `2495` | Starq’s unpaid subscription only — kept out of `1290`/`2490`. |
| `2400` / `2410` | Directors’ personal funding. Related-party; needs minuting. |

Adding an account: add a row, keep the numbering block sensible, set `entities` and `status`, run `post`.

Live balances are the vault journals. Run `books.py tb` — do not treat a README table as the trial balance.

---

## What this is not

- Not a named-vendor clone, not an install of someone else’s suite, not full-suite parity with any one product. Direction is **industry standard**.
- Not a bookkeeping toy that later bolts on POS. Core is ERP-ready now; visible v1 stays the simple nav above.
- Not Starq POS on the Starq occupancy. Not Group or Starq books on Flutter. Nashid never Starq.
- Not a finished Flutter app. Not a folder-browser “portal.” Not a third legal org called Starq Dynamics.
