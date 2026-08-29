# Access law — starqBooks

**Founder, 19 Aug 2026. Binding.** Revised same day: SaaS-ready orgs; portal = HQ; Flutter = field ops.

**Lock:** starqBooks is an ERP in baby steps. **Now:** books (correct ledger, **two orgs**). **In between:** books evolve to **POS**, then **full ERP**. **Direction:** **industry standard**. An org is the **main company**; **business names hang under it**. Starq occupancy: no shop POS; light SCM. CI: books + garage ops. Portal = HQ; Flutter = CI field ops only. See `README.md`.

Nashid is Club Ignition occupancy (garage MD). **He must never see Starq Technologies.**

**Product:** starqBooks. An **org** is the registered company (`C` number). **Business names (`BN`) hang under it.** Architecture allows any Maldivian registered business later. **This beta has two live orgs:** Starq Technologies Pvt Ltd and Club Ignition Pvt Ltd. `group` is Ali’s consolidation view, not a third legal company. **Dynamics is not a third org.**

Starq Technologies uses starqBooks to run **its own affairs** on the portal: one company ledger, **books + 8211 ERP** (Starq Dynamics / `4110`), software on the company name (`4100` / 6201). **No shop POS on this legal entity.** **SCM is light** (not garage purchasing). Club Ignition is the heavy ops / counter / field org — that is where POS/shop-floor lives. Hoadhaa Network is Starq’s second registered BN (dormant until a BAR is attached).

| Surface | Ali | Nashid / later CI staff |
|---|---|---|
| **Web portal** `:51800` | HQ: Group / Starq / CI **books**; **Starq ERP** (8211 professional services, light SCM, **no POS**); full **CI garage Ops** (including approvals). | May sign in; coerced to CI only. **Not his workplace** — Flutter is. |
| **Flutter** (`starq-ops-app`) | CI **ops + approve**. **No Starq/Group books** on this surface. | CI ops, simplified. No award/pay. No Starq books. |
| GitHub `almstq/starq-ops` | owner | **never collaborators** |
| Starq GitHub org | Ali only | **never** |
| Club Ignition GitHub org (if created later) | Ali | CI staff only after Ali says so — still not Starq |
| Google Cloud IAM on this OAuth project | Ali | **never** |
| GIS test users (Sign in with Google) | Ali | Nashid = **login only**, not IAM. Test users already added. Live Gmail is in `_secrets`, not this file. |
| `journals/starq/`, Starq entity in the **portal** books viewer | Ali | **never** |
| Starq / Group books **on Flutter** | **never** (portal only) | **never** |
| Club Ignition seats in Ops | Ali assigns | Nashid is **active** (garage only). Others after Ali activates them |

Starq org ≠ Club Ignition org. Do not put both in one mixed org.

This Google Cloud project (`club-ignition-ops` ID) is Ali-owned. Adding Nashid as an OAuth **test user** is a founder Console click while the app is Testing — not the same as GCP Viewer/Editor. Never add him to IAM. Never `gcloud` this onto C:.

Live occupancy: `D:\StarqTech\_secrets\starqBooks-allowlist.json` (and gitignored `ops/users.json`). **Ali sees all** (starq + club-ignition + group) **on the portal**. **Nashid is garage-only** (`club-ignition`). Live Gmails are not written here. Journals stay in this folder’s `journals/` (vault git — never GitHub).

SSOT for surfaces + Flutter: `D:\StarqTech\starqBooks\starq-ops-app\FLUTTER_SHELL.md`.

Work **only** under `D:\StarqTech`. Do not use `D:\!starq`.

---

## Org registry (SaaS-ready; two live)

This beta, two people:

| | Person | Company | Under it |
|---|---|---|---|
| **Trial user #0** | Ali | Starq Technologies Pvt Ltd `C29552026` | **2 business names** — Starq Dynamics, Hoadhaa Network |
| **Test user #1** | Nashid | Club Ignition Pvt Ltd `C30222026` | **its garage** (Ignition Ink) |

Ali also holds Club Ignition seats so he can run garage HQ. Nashid never sees Starq.

| Org slug | Company (`C`) | Business names / trades | Modules (this beta) | Who |
|---|---|---|---|---|
| `starq` | **Starq Technologies Pvt Ltd** `C29552026` — main company, ledger `journals/starq/` | BAR **`BP84562026`** / **6201** on the **company** → `4100`. BN **Starq Dynamics** `BN62392026` — BAR `BP89422026` / **8211** → `4110`. BN **Hoadhaa Network** `BN60162026` — MED BN, dormant (no BAR yet). | **Books + 8211 ERP.** **No POS.** Light SCM. | Trial user #0 |
| `club-ignition` | **Club Ignition Pvt Ltd** `C30222026` — main company, ledger `journals/club-ignition/` | **Ignition Ink** `BN60352026` — BAR `BP86372026` ISIC **4520** → `4200`–`4230` | **Books + garage Ops.** POS/shop-floor on this org’s product path, not on Starq. `4300` unused (not retail). | Test user #1 (+ Ali as CI officer) |
| `group` | — not a company | — | Books (portal switcher) | Trial user #0 |

When code grows a file, `ops/orgs.json` is the catalog. Keep live emails out of git.

**Signup (design):** onboard with a proper **MED company registration** (`C########`). If the company has business names, add each with its **BN########**. Same books. BAR/ISIC hangs off the trade. SSOT: `ORG-REGISTRY.md`. Open `/signup` is not this week. This beta still has two live companies only.

---

## Portal gate — **in force** (19 Aug 2026)

The books viewer is no longer open. Google is configured, so unauthenticated `/`, `/tb`, `/pl`, `/bs`, `/journal`, `/accounts`, `/notes`, `/decisions` **303 to `/login`**. `/login` is the login shell only; it never renders Group books. A signed-in Ali visiting `/login` is sent to **Group** (`/`). A CI occupant is sent to Club Ignition (`/?entity=CI`) or `/ops`.

**Permission is person → allowed entities**, stored on the occupancy record — not inferred from `seats: ["*"]`, and not a hardcoded `if email is nashid`. Superadmin Users power is a future `/ops/users` control. It does **not** mean “see Starq books.” Ali sees Starq because he is the Starq person.

| Field | Where | Values |
|---|---|---|
| `entities` | each row in `_secrets/starqBooks-allowlist.json` (and `ops/users.json` when occupancy is copied there) | occupancy slugs below |
| `starq` | parent company books | ledger token `STARQ` |
| `club-ignition` | subsidiary books | ledger token `CI` |
| `group` | consolidation (ST + CI, intercompany dropped) | `?entity=` empty |

| Person | `entities` | Portal | Flutter |
|---|---|---|---|
| Ali (`person_id` `ali`) | `starq`, `club-ignition`, `group` | Group / Starq / CI books; **Starq ERP** (8211 services, no POS); full CI Ops + approvals | CI garage ops + approve. **No** Starq books or Starq ERP on Flutter |
| Nashid (`person_id` `nashid`) | `club-ignition` only | CI only if he opens it; not his workplace | CI ops simplified. No award/pay. No Starq |
| Other CI occupants (not activated) | `club-ignition` only | Same gate when Ali supplies a real Gmail | Same as Nashid when activated |

If `entities` is omitted on a row, Ali (`person_id` `ali` or that Gmail) still gets the full set so the founder cannot be locked out by a missing field. Everyone else defaults to `club-ignition` only. Nashid is **active** with `"entities": ["club-ignition"]`. Do not put `*` in `entities`. Do not put live Gmails in this file.

Server-side: `auth.entities_for_person` / `auth.books_access` / `auth.may_view_books`. Hiding a tab in HTML is not the gate — `/tb?entity=STARQ` is rejected for a CI session. Ops (`/ops`) stays Club Ignition workflow and still never posts journals.

Run the occupancy check: `.venv\Scripts\python.exe test_entities.py`

Flutter chrome must **not** render Group/ST books **or Starq ERP** even if Ali’s session `entities` include them. CI garage item approvals are Club Ignition Ops, never a Starq inbox. Starq professional-services work is portal ERP under the **Starq** occupancy, not Flutter.

