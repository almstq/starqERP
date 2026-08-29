# Home + hamburger nav — visual / IA contract

> **VOID 19 Aug 2026 (STOP 7ef19bd3 / packet 8179fdb4).** Do not paint this as Python HTML. Flutter 1st beta **is starqBooks main** — SSOT `../starq-ops-app/FLUTTER_SHELL.md`. After Google, org occupancy changes chrome. Nashid never sees Group/Starq. This HTML viewer is the engine/Ali console until Flutter covers him.

**Product:** Club Ignition Ops by starqBooks (one Python process, two surfaces).
**Path:** `D:\!starq\00_STARQ_HQ\operations\finance\starqBooks\`
**Run:** `.venv\Scripts\python.exe serve.py` → `http://127.0.0.1:51800`
**Issued:** 19 August 2026 · **Owner of this file:** Elder · **Implements chrome:** Antigravity
**This file is SSOT for home + hamburger.** If HTML and this file disagree, this file wins until Elder changes it.

This is a garage + founder **command surface**, not a SaaS marketing landing page and not a 12-tab accounting dump as the first thing a Club Ignition occupant sees.

---

## 1. Binding law

- One web app. Books (journals viewer) + Club Ignition Ops (`/ops`). Same `serve.py`.
- Client skin: **Club Ignition Ops by starqBooks**. Ali signs garage paper as **Director of Club Ignition**, never as Starq. Product footer: “by starqBooks”.
- `a.musthaq@gmail.com` (Ali) must see **ALL**: Group, Starq Technologies, Club Ignition, Ops. Do not remove his switcher.
- A Club Ignition occupant (Nashid later, Naleez later) must **never** see Starq — not git, **especially not the portal switcher**, not ST journal rows, not a “Starq Technologies Pvt Ltd — group finance” header.
- Google authenticates the **person**. `acting_as` is the **seat**. Superadmin is Users power, not a fused workflow mega-seat. Switching seat is required (SoD); do not hide Acting as.
- Unauthenticated: `/login` only. No books peek.
- Bind `127.0.0.1`. Do not tunnel. GIS stays. No Flutter / React / Vite rewrite.

---

## 2. Occupancy — consume Elder helpers, do not invent a second model

A sibling Elder worker owns entity permissions in `auth.py` / `serve.py`. **Nav chrome must call those helpers.** Do not derive Starq/Group visibility from seats, from `superadmin`, or from `seats: ["*"]`.

Canonical occupancy slugs (already in `auth.py`):

| Occupancy slug | Visible label | Books query | Ledger token (`books.py`) |
|---|---|---|---|
| `group` | Group | `/overview` or books tab with **no** `entity` / `entity=` empty | `None` (consolidated) |
| `starq` | Starq Technologies | `?entity=STARQ` | `STARQ` |
| `club-ignition` | Club Ignition | `?entity=CI` | `CI` |

**Call these (live in `auth.py` as of 19 Aug 2026). `page()` already filters `.switch` with `user.entities` — do not un-filter it.**

| Helper | Use |
|---|---|
| `A.refresh_entities(user)` | Refresh `user.entities` before rendering any chrome. |
| `user.entities` | Ordered occupancy slugs. **This is `allowed_entities`.** There is no separate function yet. If `A.allowed_entities(user)` appears, call it; it must return the same list. |
| `A.may_view_entity(user, slug)` | Gate **before emitting an href**. If false, do not register the link. |
| `A.is_ci_only(user)` | True → Club Ignition chrome only: no Group, no Starq, no ST rows, no Starq header copy. |
| `A.LEDGER_FOR_OCCUPANCY` | Map slug → `STARQ` / `CI` / `None`. |
| `A.OCCUPANCY_FOR_LEDGER` | Map ledger token → slug. |
| `A.default_occupancy(user.entities)` | Home “current entity” when none selected. |
| `A.default_books_path(user)` | Fallback books URL. Books Overview is `/overview`. Command home is `/`. |
| `A.books_access(user, requested_raw, explicit)` | Elder gate for books routes. Do not reimplement. |

Do **not** rebuild the switcher from `may_view_books` (that is the older seat-based gate). Occupancy (`user.entities`) wins. `may_view_books` may still gate books *pages*; chrome visibility is occupancy.

**Href rule (server-side, not CSS `display:none`):**

```
if slug not in set(user.entities or []):
    do not emit <a href="...?entity=STARQ"> or Group (empty entity) or any books tab with that scope
```

If `auth.py` is mid-edit and a helper is missing for one save, **wait / sync** — do not invent occupancy from seats. `may_view_books` is the older seat-based gate; occupancy (`user.entities`) wins for **what appears in the switcher**.

---

## 3. Routes (live in `serve.py` / `ops.py`)

### Auth (Elder — do not rewrite)

| Method | Path | Notes |
|---|---|---|
| GET | `/login` | Public. GIS button stays. |
| POST | `/auth/google` | GIS ID token. Do not touch `verify_google_id_token`. |
| POST | `/auth/seat` | `seat` + `csrf`. Keep the existing form. |
| GET/POST | `/logout` | Sign out. |

### Command home (this slice)

| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/` | session required once Google is configured | **Entity-aware command home** (new). Not Group TB. Not always Group overview. |
| GET | `/home` | same | Alias of `/`. Already reserved in `BOOKS_TABS`. |

Unauthenticated + Google configured → 303 `/login?next=/` (Elder already redirects books when logged out; keep that. Do not leave `/` as a books peek.)

### Books (existing handlers; Overview path change)

`/overview` is **already stubbed** in `do_GET` (`h_overview`). `/` and `/home` still call `h_overview` until AG replaces that else-branch with the command home (`# AG-OWNED: chrome/home/hamburger`).

| Label | Path | Handler |
|---|---|---|
| Overview | `/overview` | existing `h_overview` (wired) |
| Trial balance | `/tb` | `h_tb` |
| Profit & loss | `/pl` | `h_pl` |
| Balance sheet | `/bs` | `h_bs` |
| Journal | `/journal` | `h_journal` |
| Accounts | `/accounts` | `h_accounts` |
| Notes | `/notes` | `h_notes` |
| Decisions | `/decisions` | `h_decisions` |

Carry `entity`, `from`, `to` (and `account` on journal) as today. Entity query values are **ledger tokens** (`STARQ`, `CI`, or omitted for Group). `A.occupancy_from_query` already accepts aliases. Do not add new report math.

### Ops (existing)

| Label | Path |
|---|---|
| Ops (section home) | `/ops` |
| Jobs | `/ops/jobs` |
| Job | `/ops/job?id=` |
| Money | `/ops/money` |
| Purchases | `/ops/purchases` |
| Exceptions | `/ops/exceptions` |
| Event log | `/ops/events` |
| Log event | `/ops/log` |
| Users | `/ops/users` — **not in `dispatch_get` yet**. Hide until the route exists. |

Ops is always Club Ignition workflow. No entity switcher on `/ops`.

---

## 4. After-login home (`/`)

Land here after GIS unless `next` is an explicit deep link (`/ops/log`, `/tb?entity=CI`, …). Direct `/login` default `next` becomes `/` (not `/ops`).

### 4.1 Ali (`a.musthaq@gmail.com` — `user.entities` includes `group`, `starq`, `club-ignition`)

Home = **command center**. Skin = Starq Deep Space when current occupancy is `group` or `starq`; CI signal red when current occupancy is `club-ignition`.

**Blocks, in this order:**

1. **Identity** — name, email, **Acting as** seat switcher (same POST `/auth/seat` + csrf as `A.who_strip`). Seat list = `user.seats` with labels from `A.SEATS`. Current seat marked.
2. **Entity chips** — one chip per slug in `user.entities`, labels from the table in §2. Current occupancy `on`. Clicking a chip sets occupancy and reloads `/` (and books links) with the matching `?entity=`. **Do not omit Group or Starq for Ali.**
3. **CI Ops pulse** — cards + shortcuts into `/ops`. Read existing `O.stats()`, `O.jobs_sorted()`, `O.events_for()` (cap ~5 events, ~5 open jobs). If state is empty, show empty copy + “Open Ops” / “Log event”. Do not invent dummy jobs.
4. **Books pulse for the currently selected occupancy** — Cash (accounts `1110` `1120` `1121` `1125` as `h_overview` already does) and Result (from `report_bs`). Group when occupancy is Group. Do not show ST figures when occupancy is CI. Do not show Group consolidation to a CI-only user (they never reach this block with Group selected).
5. **Primary actions** (buttons, 44px min height on phone):
   - Open Ops → `/ops`
   - Open books for current entity → `/overview` + matching `entity`
   - Users → `/ops/users` **only if** that route exists **and** the person is superadmin (Elder helper if present; else hide). Superadmin is not a reason to show Starq chips — chips come only from `user.entities`.

Do not open on Trial balance. Do not bury Acting as.

### 4.2 Club Ignition occupant (Nashid / Naleez / any `A.is_ci_only(user)`)

Home = **Club Ignition only**. Skin = CI (`body.ci`). Mark = `/assets/ci-logo.png`. Trading name **Ignition Ink** occupancy. Ops-first.

**Must show:** name + Acting as; CI mark; Ops pulse (jobs, intake, purchasing seats via `/ops`, `/ops/log`, `/ops/purchases`); books pulse for **CI only**; primary Open Ops; Open books → `/overview?entity=CI` only.

**Must not show:** Group chip; Starq Technologies chip; any `?entity=STARQ`; any `entity=` empty Group books link; ST pills / ST journal rows; header or stamp “Starq Technologies Pvt Ltd — group finance”; “Starq Group”; “subsidiary of Starq Technologies” on the home hero. Books heading: **Club Ignition Pvt Ltd** (legal) / Ignition Ink (shop). Footer “by starqBooks” is OK.

### 4.3 Unauthenticated

`/login` only. GIS button stays. No TB, no overview cards, no ops dashboard peek.

---

## 5. Hamburger + desktop nav

Garage will be used on a **phone at the counter**.

| Viewport | Chrome |
|---|---|
| `min-width: 900px` | Slim sticky top bar. Primary links visible. No drawer unless opened. |
| `< 900px` | Top bar: **hamburger (left)** + logo + current seat pill. Primary nav is the drawer. |

**Drawer side: left.** Overlay `rgba(0,0,0,.45)`. Hamburger hit target **44×44px**. `button` type, not a styled `div`.

**Accessibility (required):**

- Button `aria-expanded="true|false"` `aria-controls="sb-drawer"` `aria-label="Menu"`
- Drawer `id="sb-drawer"` `role="dialog"` `aria-modal="true"` `aria-label="Menu"`
- Esc closes. Overlay click closes. After navigate, close the drawer.
- Light focus trap while open (Tab cycles hamburger + drawer links + Sign out). Restore focus to the hamburger on close.
- Current item: `aria-current="page"` and visual `on` class (existing `nav a.on`).

Small inline JS in `serve.py` / `ops.py` is allowed. No new JS framework. No ngrok. No public marketing nav.

### 5.1 Menu IA — exact labels, hrefs, visibility

Shared chrome on **books pages and `/`**. Ops pages (`ops.py` `shell`) use the **same drawer IA** so the counter phone has one menu, not two apps. Ops sub-pages stay reachable from the Ops row / `/ops` tabs as today.

| # | Label | Href | Ali | CI occupant | Notes |
|---|---|---|---|---|---|
| 1 | Home | `/` | yes | yes | Command home. Mark current on `/`. |
| 2 | Ops | `/ops` | yes | yes | CI workflow. Mark current on `/ops` and `/ops/*`. |
| 3 | Books *(section)* | — | if any books occupancy | if `club-ignition` in entities | Nested links below. Do not show the section if the person has no books occupancy. |
| 3a | Overview | `/overview` + entity qs | yes | CI qs only | |
| 3b | Trial balance | `/tb` + entity qs | yes | CI qs only | |
| 3c | Profit & loss | `/pl` + entity qs | yes | CI qs only | |
| 3d | Balance sheet | `/bs` + entity qs | yes | CI qs only | |
| 3e | Journal | `/journal` + entity qs | yes | CI qs only | |
| 3f | Accounts | `/accounts` + entity qs | yes | CI qs only | |
| 3g | Notes | `/notes` + entity qs | yes | CI qs only | |
| 3h | Decisions | `/decisions` + entity qs | yes | CI qs only | Untagged decisions are Group-finance (Elder `decision_visible`). Do not list Group-tagged decisions to CI-only. |
| 3i | Entity switcher | same path, new `entity` qs | **yes** | **omit** | Inside the drawer, under Books. Same three chips as home. Hidden when `A.is_ci_only`. Single entity → no switcher. |
| 4 | Acting as | POST `/auth/seat` | yes | yes | Seat `<select>` + csrf. Required for SoD. Never hide. |
| 5 | Users | `/ops/users` | Ali only (`email == a.musthaq@gmail.com` or `person_id == ali`) | hide | Slot only. 404 is OK until Elder lands the page. Do not build Users CRUD. |
| 6 | Sign out | `/logout` | yes | yes | Last item. |

**Do not register** Group or Starq hrefs when `group` / `starq` ∉ `user.entities`. Server-side omit. CSS hide is not enough.

Desktop slim bar: mark · title · Acting as · “you are here” crumb · hamburger. Entity chips live **inside the drawer** (and may repeat as a compact filtered `.switch` on desktop for Ali only). CI-only: no `.switch`. Do not restore wrapping books/ops tab rows.

Today `page()` always emits Group / Starq Technologies / Club Ignition. **That is the leak.** Filter it. Logo link: Ali may keep `/`. CI-only logo → `/` still (their home is CI), mark is CI, **not** `starq-logo.png`.

Ops `who_strip` currently hardcodes `/?entity=CI` for “Books →”. Change to `/overview?entity=CI` for CI-only, and for Ali use `A.default_books_path` / current occupancy mapped through `LEDGER_FOR_OCCUPANCY`. Do not point CI occupants at `/` if `/` would still be Group overview during the remap — after remap `/` is safe home for both.

---

## 6. Visual contract

Keep existing tokens. Skin by occupancy / surface. Do not invent a third brand.

### 6.1 Starq (Group + Starq Technologies books, Ali on those occupancies)

Already in `serve.py` `CSS` `:root` / `BRAND_IDENTITY.md`:

| Token | HEX |
|---|---|
| Deep Space `--deep` / `--ink` | `#0B1437` / `#060A18` |
| Aurora Blue `--accent` | `#2E88FF` |
| Cyan Pulse `--accent2` | `#00C9FF` |
| Text / muted | `#F3F5FA` / `#8E97B3` |

Logo: `/assets/starq-logo.png`. Favicon: `starq-favicon.png`.

### 6.2 Club Ignition (Ops, CI books, CI-only session, login)

Already `body.ci` and `ops.py` `OPS_CSS` / `LOGIN_CSS`:

| Token | HEX |
|---|---|
| Signal red `--accent` | `#E01B24` |
| Light red `--accent2` | `#FF6A70` |
| Ground | `#12141f` → `#08090d` |

Logo: `/assets/ci-logo.png`. Favicon: `ci-favicon.png`.

### 6.3 Type + layout

- One type scale. Family already used: `"Space Grotesk", Inter, system-ui, sans-serif`. Readable on a phone (`font-size` ≥ 15px body; labels ≥ 12px).
- Home metrics = **cards** (existing `.cards` / `.card`). TB / journal stay denser **tables**.
- No 2014 table-only chrome on home. No new marketing hero, no pricing, no “Sign up free”.
- Radius already `--radius: 14px` on books; keep it.
- Hamburger 44px; overlay 40–50% black (use 45%).
- Login page stays the same system: CI mark, GIS slot, seats explainer, footer by starqBooks. Do not restyle GIS into a fake button that skips verify.

Footer on CI surfaces: Ignition Ink / Club Ignition Private Limited paper line + **by starqBooks**. Ali as Director of Club Ignition. Starq is not the shop identity.

Footer on Ali’s Group/Starq books may keep Starq confidential copy. Never use that copy on a CI-only session.

---

## 7. AG must / must-not

**Must**

- Implement home `/` + hamburger/drawer + filtered entity switcher + shared nav IA in `serve.py` HTML/CSS/small JS and `ops.py` `shell` / `who_strip`.
- Consume occupancy helpers in §2. Hide Group/Starq when not allowed. Ali still sees all three chips.
- Mark current item. Close drawer on navigate. Accessibility in §5.
- Keep GIS, `verify_google_id_token`, bind `127.0.0.1`, venv on **D:**.
- If `serve.py` entity coerce (`books_access` / 403 / redirect) lands while you work: **sync, do not revert**.

**Must not**

- Flutter, React, Vite, Next, or a second garage app.
- Rewrite `auth.py` occupancy, `lookup_person`, session cookies, `verify_google_id_token`, or SoD.
- Post or edit `journals/`. Touch `books.py` report math. Install anything to **C:**.
- Commit unless the founder asks. Do not push. Do not add GitHub collaborators.
- Tunnel / ngrok / public marketing nav.
- Show Starq or Group to a CI occupant (href, chip, header, ST row, stamp).
- Fuse superadmin into a mega-seat or use it as the Starq switcher.
- Build `/ops/users` in this slice.
- Duplicate a permission model if helpers are briefly missing — wait/sync.

`# AG-OWNED` for this slice: home body HTML, drawer markup/CSS/JS, filtered `.switch`, ops `shell` nav alignment, login default `next=/`. Elder owns session, occupancy, GIS verify, journal integrity.

---

## 8. Success criteria

1. Logged out + Google configured → any books or `/` or `/ops` URL ends at `/login`. No TB peek.
2. Ali signs in → `/` is a command center with **Group / Starq Technologies / Club Ignition** chips, Acting as, Ops pulse, books pulse for the selected occupancy, Open Ops / Open books.
3. A user with `entities == ["club-ignition"]` (Nashid later) → home and drawer have **no** Group, **no** Starq Technologies, **no** `entity=STARQ`, **no** group-finance header. Books links are CI only. Footer may say by starqBooks.
4. Viewport `< 900px` → hamburger; drawer left; overlay; Esc/overlay/navigate close; 44px target; `aria-expanded`.
5. Viewport `≥ 900px` → slim top bar; Ali still has the switcher.
6. Acting as remains visible and posts `/auth/seat` with csrf on both Ali and CI occupant.
7. GIS button still posts `credential` to `/auth/google`. Verify function untouched.
8. `python books.py check` (or existing journal check) still green. No new framework. Bind 127.0.0.1.

---

## 9. Current chrome to replace (do not keep the leak)

In `serve.py` `page()` today:

- `.switch` always emits Group + Starq Technologies + Club Ignition.
- Stamp for non-CI: “Starq Technologies Pvt Ltd · group finance”.
- `nav` always includes every books tab + “Club Ignition Ops”.
- Empty path is Group/entity overview, not a command home.
- `@media(max-width:640px)` only hides switcher labels — **not** a hamburger.

In `ops.py` `shell` / `who_strip` today:

- Separate ops-only tab row (fine to keep as local ops tabs).
- “Books →” hardcoded `/?entity=CI` (update to `/overview?entity=CI` and never to Group).

Filter, remap `/` vs `/overview`, add the drawer. That is the slice.
