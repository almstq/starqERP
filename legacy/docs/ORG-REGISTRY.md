# starqBooks — company signup and tradings

**Issued:** 19 August 2026 · **Status:** DESIGN (schema + UX). Not open signup this beta.  
**Live occupancy** stays the allowlist (`ACCESS.md`). This file is how a later merchant joins, and how Starq already works internally.

---

## The lock

These are **MED** numbers (Ministry of Economic Development, Transport & Trade). starqBooks onboards from the registry, not from a made-up shop name.

| MED document | Number | What starqBooks does with it |
|---|---|---|
| **Company registration** | `C########` | **Onboard the company.** That is the org. One ledger. One TIN. |
| **Business name registration** | `BN########` | **If the company has business names, add each trade by that BN.** Same company, same books. |
| **Business activity (BAR)** | `BP########` + ISIC | What that trade may earn (maps to income accounts / modules). |

You cannot invent a tenant without a proper company registration number. You cannot invent a business-name trade without its **BN**. A BAR (`BP`) is an activity on the **company** or on a **BN** — it is not a substitute for `C` or `BN`. A second BN is not a second company.

| Layer | Example |
|---|---|
| Company | Starq Technologies Pvt Ltd `C29552026` |
| Business names under it | Starq Dynamics `BN62392026`; Hoadhaa Network `BN60162026` |
| Other company | Club Ignition Pvt Ltd `C30222026` → Ignition Ink `BN60352026` |

Starq Dynamics is a **business name of Starq Technologies**, same `C29552026`. Club Ignition `C30222026` is a **different company**. Ignition Ink is a trade of Club Ignition, not of Starq.

`group` remains Ali’s consolidation view. It is not a `C` number and cannot be signed up.

---

## Signup (Google person → company → trades)

Google still authenticates the **person**. **MED** authenticates the **occupancy**.

1. **Sign in with Google.**
2. **Onboard company** — enter the **company registration number** from the MED certificate (`C29552026`). Not a trading name. Not a BAR number.
3. **If it has business names** — add each one with its **business name registration number** (`BN62392026`, `BN60162026`, `BN60352026`). Display name comes from that certificate.
4. **Attach BAR** — `BP########` + ISIC. A BAR hangs off the **company** (`C`) or off a **BN**. Maps income (`4100` for 6201 on Starq’s company BAR `BP84562026`; `4110` for 8211 on Dynamics; `4200`–`4230` for 4520 on Ignition Ink). No BAR → that occupancy cannot take that income.
5. **Choose modules** the BAR allows — books (always at **company**), ERP, ops, POS. Starq: no shop POS. CI 4520: garage ops.
6. **Invite people** onto the **company**, then optionally scope them to trades.

Do **not** let a person invent a trade without a `BN`. Do **not** let a `BN` attach to the wrong `C`. Do **not** create a new ledger because a second business name exists.

Rejected / expired names (`NRR/2026/55076` Starq Business Solutions) never become trades.

---

## Data (when `ops/orgs.json` exists)

Catalog without live emails may be in-repo. Registry numbers are public on certificates; still do not dump officer Gmails here.

```text
company
  company_id          slug (starq, club-ignition)
  reg                 C29552026          ← MED company registration
  registered_name
  ledger              STARQ | CI
  bars[]              { bp, isic, income_account }   ← e.g. BP84562026 / 6201 / 4100 on the company
  tradings[]
    trading_id
    bn                BN62392026         ← MED business name registration (required)
    display_name
    bars[]            { bp, isic, income_account }
    modules[]         books | erp | ops | pos
```

**One company → one journal folder.** Dynamics vs software is a **credit to 4110 vs 4100** on the same Starq books, not `journals/starq-dynamics/`.

---

## Manage a trade

Portal, under the company (Ali HQ). Flutter never manages Starq trades.

| Screen | Does |
|---|---|
| **Trade identity** | BN, display name, premise, trading-as line on invoices |
| **Activities** | BAR list, ISIC, which income accounts may be credited |
| **Modules** | ERP / ops / POS flags (BAR-constrained) |
| **Catalogue** | Services or shop items this trade sells |
| **People** | Who may act on this trade (invoice, jobs) |
| **Paper** | Which name appears; Ali still signs Club Ignition paper as Director of **Club Ignition**, never as Starq |

Hoadhaa Network (`BN60162026`) can sit as a **dormant trade** on Starq until a BAR and modules are attached. Same pattern for any future BN on any tenant.

---

## Worked occupancies (this beta — already true)

| | Person | Company | Under it |
|---|---|---|---|
| **Trial user #0** | Ali | Starq Technologies Pvt Ltd `C29552026` | 2 business names: Starq Dynamics, Hoadhaa Network |
| **Test user #1** | Nashid | Club Ignition Pvt Ltd `C30222026` | its garage (Ignition Ink) |

**1. Starq Technologies Pvt Ltd** `C29552026` (`starq`) — main company, one ledger `journals/starq/`
- BAR **`BP84562026`** ISIC **6201** (name on BAR: Starq Technologies) — activity **on the company**, not a BN → `4100`
- **Starq Dynamics** `BN62392026` — BAR `BP89422026` ISIC **8211** → `4110`
- **Hoadhaa Network** `BN60162026` — MED BN; dormant until a BAR is attached

**2. Club Ignition Pvt Ltd** `C30222026` (`club-ignition`) — main company, ledger `journals/club-ignition/`
- **Ignition Ink** `BN60352026` — BAR `BP86372026` ISIC **4520** → `4200`–`4230`

| MED | What | Income |
|---|---|---|
| `C29552026` | Company — Starq Technologies Pvt Ltd | one ledger |
| `BP84562026` | BAR on that company · 6201 | `4100` |
| `BN62392026` | BN Starq Dynamics (+ BAR `BP89422026` / 8211) | `4110` |
| `BN60162026` | BN Hoadhaa Network | none yet |
| `C30222026` | Company — Club Ignition Pvt Ltd | one ledger |
| `BN60352026` | BN Ignition Ink (+ BAR `BP86372026` / 4520) | `4200`–`4230` |

Nashid is invited onto **Club Ignition only**. He cannot sign up a Starq `C` number. He never sees Starq trades.

---

## This beta vs later SaaS

| Now | Later |
|---|---|
| Allowlist. Two companies. Ali activates people. | Self-serve: Google + `C` number + `BN` numbers |
| No MED API | Optional registry verify; until then certificate upload + Ali/ops review |
| Do not onboard a third merchant | New `C` is a new org row + journal folder + memberships |

Open `/signup` is **not** this week. Implementing `ops/orgs.json` in this shape is allowed; wiring public registration is not.

---

## Do not

- Treat a business name as a second company or a second trial balance  
- Sign up with a BAR number alone (BAR hangs off a trade)  
- Put Nashid on a Starq `C`  
- Credit `4110` from a 6201-only trade, or `4100` from an 8211-only invoice line  
- Shop POS on Starq occupancy  
- Invent Gmails or `C`/`BN` numbers in git  
