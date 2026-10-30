# Club Ignition Ops — authentication and seats

**Product:** Club Ignition Ops by starqBooks (same app as the books viewer, not a second product).
**Path:** `D:\StarqTech\starqBooks\`
**Issued:** 19 August 2026 · **Status:** CONTRACT for Antigravity (Google) + shell already in tree
**Rename path later:** starqBooks → POS → ERP. Design for multi-seat staff; do not rename files now.

This file is the contract. If code and this file disagree, **this file wins** until Elder changes it.

---

## 1. Binding law (founder, 19 Aug)

> “even three people, we fill all individual roles to make scm and all workflows accountable”
> then: CRM, finance, accounts, management too.
> then: “make my user only for now. with a user management, where nashid and naleez can sign up, and i assign roles and permissions”
> then: **`founder@example.com` as superadmin**

- **Three humans. Full role seats** across CRM, SCM, finance, accounts, management, workshop.
- Google authenticates the **person**. The app authorizes the **seat** (`acting_as`).
- Every workflow event is **(person, seat, timestamp)**. Never “the shop.” Never one click that is both PO and payment, or technician and QC.
- **`founder@example.com` is the only live user until Ali activates someone.** Superadmin is a *user-management* power (`/ops/users`), not a fused workflow mega-seat. When Ali logs a job event he still **Acts as** director / FC / payer / etc.
- Nashid and Naleez **sign up**. They are `pending` with **zero seats**. Ali assigns seats and modules. Do not invent their Gmails.
- Occupancy lives in `ops/users.json` after Ali clicks Save. **Not** a static allowlist of fused accounts.

**Rejected (do not ship):**

- One Google user = one role
- A workflow click that uses `seats: ["*"]` (superadmin must still pick a real seat to log work)
- Packet `9f222055` (allowlist, no signup, no superadmin) — **void**. Founder superseded it the same afternoon.
- Inventing Gmail addresses in git
- A Flutter app that **replaces** the web portal or shows Starq books to Nashid

**Superseded 19 Aug evening:** “no Flutter” is void for the **garage ops shell**. SSOT: `../starq-ops-app/FLUTTER_SHELL.md`. Portal `:51800` stays Ali’s full view. Flutter is Nashid CI ops (simplified). Ali still runs all garage ops on **his** portal (Club Ignition / Ops), not Starq.

Antigravity implements Google token verify (done) and the Flutter shell (new). Elder owns Users / seats / portal HTML.

---

## 2. What this is / is not

**Is**

- Login gate before `/ops` **and** (once Google is configured) before the books viewer.
- Allowlist only: email → **list of seats**. No public registration.
- Signed HttpOnly session cookie; server-side session rows (`ops/sessions.json`).
- Role-seat switch with `auth.role_switch` in the ops event stream.
- Paperless audit: `auth.login` / `auth.logout` / `auth.denied` / `auth.role_switch`.

**Is not**

- The Flutter garage shell (that is `../starq-ops-app/`, client of `/ops`). **This file is the Python engine + portal contract.** Hoadha Google Sign-In is **reference only**.
- A second ledger or a Starq-branded garage app. Ops is Club Ignition.
- Permission to post `journals/`. Ops never writes books. Ali as `ledger_poster` still posts by hand (DEC-008).
- Permission to put Starq on garage paper. Footer: “by starqBooks”. Ali signs as Director of Club Ignition.
- Permission to ngrok / tunnel the app. Bind stays `127.0.0.1` until auth is real **and** the founder says otherwise.

---

## 3. Seats (first-class, even if vacant)

| Seat id | Label | Occupied today (person) | Must not be fused with |
|---|---|---|---|
| `managing_director` | Managing Director | Nashid | technician, qc_signer, receiver (switch) |
| `director` | Director (Club Ignition) | Ali | `financial_controller`, `payer` |
| `financial_controller` | Financial Controller | Ali | `payer` (award/match ≠ pay) |
| `quartermaster` | Quartermaster | Naleez | `receiver`, `payer` |
| `receiver` | Receiver (GRN) | Nashid | `payer`, `quartermaster` |
| `payer` | Payer | Ali | `quartermaster`, `financial_controller` (as one click) |
| `counter` | Counter / intake | any of the three when at the desk | — |
| `technician` | Technician | Nashid now; Ammadey/Arey later | `qc_signer` |
| `qc_signer` | QC signer | Nashid | `technician` |
| `stores` | Stores / inventory | Naleez | award / pay |
| `ledger_poster` | Ledger poster | Ali | n/a in this app (journals are not `/ops/event`) |

**SCM accountability — never merge these three, even when one human holds two of the Google seats:**

1. **Orders** — seat `quartermaster`
2. **Receives** — seat `receiver`
3. **Pays** — seat `payer` (after `financial_controller` match)

If the same Google account holds two of those seats, the app **requires** an explicit seat switch and logs `auth.role_switch` **plus** the business event. Same person paying what they ordered is allowed only as a compensating control: **second timestamp, different seat, visible on the event log**. Never a single click that is both PO and payment.

Same for technician vs QC: cannot QC own work in one click; must switch to `qc_signer`.

---

## 4. Three people → many seats

Allowlist shape is **email → list of seats**, plus `person_id`, `name`, `default_seat`, and **`entities`** (which companies’ books that person may open).

| Person | Default seat | Seats they may assume | Books entities |
|---|---|---|---|
| Ali Mushthaq Ibrahim | `director` | `director`, `financial_controller`, `payer`, `ledger_poster`, `counter` | `starq`, `club-ignition`, `group` |
| Hussain Nashid | `managing_director` | `managing_director`, `receiver`, `qc_signer`, `technician`, `counter` | `club-ignition` only |
| Naleez | `quartermaster` | `quartermaster`, `stores` | `club-ignition` only |
| Ammadey / Arey (later) | `technician` | `technician`, `counter` — **not** `qc_signer` until named | `club-ignition` only |

`entities` is occupancy, not a seat. Superadmin Users power ≠ Starq books. Ali sees Group + Starq because his person record lists those entities. See `ACCESS.md` (gate **in force**).

Emails are **FLAG — founder supplies.** Do not invent personal Gmail addresses. The example file uses `FOUNDER_MUST_SUPPLY_*` which `auth.py` refuses to authenticate.

Live allowlist path: `D:\StarqTech\_secrets\starqBooks-allowlist.json` (not in git). Example in-repo: `auth_allowlist.example.json`.

---

## 5. Approval vs seats

The shop wall remains **S-06**. The controlled expansion is `operations/scm/ignition-ink-ops/04_APPROVAL-MATRIX.md` — columns are **seats**, not fused people. `03_CONTROL-ARCHITECTURE.md` one-human patterns are **compensating exceptions** (X-01 `SOD-COLLAPSE`), not the primary model.

Roster prose: `06_SEAT-ROSTER.md`. Server enforcement: `auth.py` `authorize_event`, `check_sod`.

---

## 6. Session

| Item | Rule |
|---|---|
| Cookie | `sb_ops` — random 32-byte urlsafe token |
| Store | `ops/sessions.json` — **SHA-256 of the token**, never the token. Gitignored. |
| Flags | `HttpOnly; SameSite=Lax; Path=/`. Add `Secure` only behind TLS (not localhost http). |
| Expiry | 12 hours, sliding on use |
| Payload | email, person_id, name, seats[], acting_as, default_seat, entities[], csrf |
| CSRF | per-session token on POST `/ops/event` and `/auth/seat` |
| Bind | `127.0.0.1` remains the default in `serve.py` |

Logout deletes the server row and clears the cookie.

---

## 7. Secrets — RULE 0

| Secret | Where |
|---|---|
| Google client ID | env `STARQBOOKS_GOOGLE_CLIENT_ID` or `D:\StarqTech\_secrets\starqBooks.env` |
| Google client secret | same file, **only if** auth-code flow |
| Session secret | `STARQBOOKS_SESSION_SECRET` |
| Allowlist with real emails | `D:\StarqTech\_secrets\starqBooks-allowlist.json` |

**Not in git. Not on C:.** Example: `starqBooks.env.example`.

Authorized JavaScript origin: `http://127.0.0.1:51800` (add fallback ports in `serve.py` if used). Prefer **51800**.

---

## 8. Endpoints

| Method | Path | Auth | Who fills | Behaviour |
|---|---|---|---|---|
| GET | `/login` | public | Elder (done) | **starqBooks** sign-in. Google → org occupancy → seat. No CI product title. No seat-roster brand. GIS slot. |
| POST | `/auth/google` | public | **AG** verify; Elder session | Form field `credential` = Google ID token. |
| GET | `/auth/google/callback` | public | **AG** if auth-code | Optional. Prefer GIS. |
| POST | `/auth/seat` | session | Elder (done) | `seat` + `csrf`. Must be on the person's allowlist. Logs `auth.role_switch`. |
| GET/POST | `/logout` | cookie | Elder (done) | Destroy session, `auth.logout`. |
| GET | `/ops` and `/ops/*` | **session required** | Elder | 303 to `/login?next=` if logged out. |
| POST | `/ops/event` | session + csrf + seat | Elder | Stamp `actor_email`, `actor_person`, `actor_role`. Reject missing role. |
| GET | books `/`, `/tb`, … `/decisions` | **session required** once Google is configured | Elder | Entity filtered by the person’s `entities`. CI occupant: Club Ignition only. Ali: Group + Starq + CI. |
| POST | `/decisions/reply` | founder seats once configured | Elder | `director` / `financial_controller` / `ledger_poster`. |
| GET | `/assets/*` | public | — | Login page needs the CI mark. |

There is **no** `/signup`. There is **no** `/auth/bootstrap`. There is **no** `/ops/users` mega-admin. Occupancy is the allowlist file the founder edits.

`google_configured()` = client ID present. `google_ready()` = client ID **and** `GOOGLE_VERIFY_IMPLEMENTED is True`.

Until AG wires verify, `/ops` still requires a session, so the founder sees the login shell (“waiting for Google”). Once Google is configured, **books also require a session**.

Entity gate: `ACCESS.md`. Ali’s person record lists `starq` + `club-ignition` + `group`. CI occupants list `club-ignition` only. The switcher and every books query honour that list. Superadmin is not a Starq-books grant.

---

## 9. Token verification (Antigravity writes the code)

1. Login page uses **Google Identity Services** (GIS) with `data-client_id`.
2. GIS returns a JWT **ID token** in `credential`.
3. POST `/auth/google` with that value. **Do not** create a session from the JS payload alone.
4. Server: `google.oauth2.id_token.verify_oauth2_token(token, request, audience=CLIENT_ID)` via package `google-auth`.
5. Reject unless `email_verified` is true.
6. Normalize email to lowercase, `lookup_person(email)` against the allowlist.
7. Placeholder emails and unknown emails → `auth.denied`, stay on `/login`.
8. Allowlisted → `create_session` with `default_seat`, `auth.login`, Set-Cookie, 303 to `next`.
9. Authorized origins: localhost ports above.

**Python install (RULE 0):** venv **inside this folder on D:**

```bat
cd /d D:\StarqTech\starqBooks
py -3.13 -m venv .venv
.venv\Scripts\python.exe -m pip install google-auth
```

Do **not** `winget`, `pip install --user`, or any default that lands on C:. If the installer cannot target D:, **stop and ask**.

Hoadha Flutter Google Sign-In (`03_PROJECTS/hoadha`) is **not** this app. Do not build a Flutter garage client for this task.

Search `# AG-OWNED` in `auth.py`.

---

## 10. Event records

Workflow events **must** include `actor`, `actor_email`, `actor_person`, `actor_role`. Reject if `actor_role` would be missing. Stamp from session — do not trust the form.

`PURCHASE` requires `fields.scm_step` ∈ `need | quote | award | receive | match | pay`.

Auth stream (same `ops/events.jsonl`): `auth.login`, `auth.logout`, `auth.denied`, `auth.role_switch` (`fields.from_seat`, `fields.to_seat`).

---

## 11. Failure modes

| Case | Result |
|---|---|
| No session on `/ops` | 303 `/login?next=` |
| Token layer missing | login page; POST denied `auth.denied` reason `token_layer_missing` |
| Email not allowlisted / placeholder | deny + `auth.denied` |
| Seat not on person’s list | cannot switch / cannot log |
| PO then pay without `auth.role_switch` | reject |
| Tech then QC without switch | reject |
| CSRF mismatch | 400 |

---

## 12. Files

| File | Owner |
|---|---|
| `AUTH_DESIGN.md` | Elder — this contract |
| `auth.py` | Elder shell; **AG** fills `verify_google_id_token`, `GOOGLE_VERIFY_IMPLEMENTED` |
| `auth_allowlist.example.json` | Elder placeholders |
| `starqBooks.env.example` | Elder |
| `seats.json` | Catalog of the same 11 seats (no emails, no `*`) |
| `serve.py` / `ops.py` | Elder |
| `../scm/ignition-ink-ops/04_APPROVAL-MATRIX.md` | seats, not fused people |
| `../scm/ignition-ink-ops/03_CONTROL-ARCHITECTURE.md` | seats primary; one-human compensating |
| `../scm/ignition-ink-ops/06_SEAT-ROSTER.md` | occupancy lists, not superadmin |

---

## 13. What Antigravity must NOT do

- Do not implement Google user = one role.
- Do not invent Gmail addresses.
- Do not install anything to C: (RULE 0).
- Do not post journals / touch `journals/`.
- Do not put Starq on garage paper.
- Do not ngrok or bind `0.0.0.0`.
- Do not commit secrets or live allowlist emails.
- Do not restyle this HTML as the 1st beta. Do not replace the portal. Flutter garage shell: `../starq-ops-app/FLUTTER_SHELL.md`.
- Do not collapse `quartermaster` + `receiver` + `payer` into one permission blob.
- Do not add `SUPERADMIN` / `seats: ["*"]` / open signup.
- Do not skip ID-token verify because GIS already “signed in” in the browser.
- Do not commit unless the founder asks.

---

## 14. Success criteria

1. Allowlisted Google account signs in; session cookie persists across refresh.
2. Header shows **person name** and **Acting as: [seat]**; seat switch works only for listed seats.
3. `/ops` blocked when logged out (login shell).
4. `auth.login` / `logout` / `denied` / `role_switch` appear in `ops/events.jsonl`.
5. `/ops/event` stores `actor_email` **and** `actor_role`; rejects missing role.
6. Same person cannot log quartermaster-quote and payer-pay (or technician WORK and QC) without a seat switch in between.
7. Books viewer still read-only; Decisions tab still works; `python books.py check` still green.
8. Unauthenticated app still not tunnelled.

---

## 15. Founder must still supply

1. Google Cloud OAuth **client ID** (Web application) — origin `http://127.0.0.1:51800`.
2. Real Google emails for Ali, Nashid, Naleez (Ammadey/Arey when they start).
3. Optional: client secret if AG chooses auth-code instead of GIS.
4. `STARQBOOKS_SESSION_SECRET` in `D:\StarqTech\_secrets\starqBooks.env`.

Until those exist, the login page is the branded shell with “waiting for Google”.

**Org / IAM (founder 19 Aug, binding):** Nashid must never see Starq. GIS test user ≠ GCP IAM. Never add CI staff as GitHub collaborators on `almstq/starq-ops` or as IAM on this Cloud project. Before Nashid is activated, the books viewer must hide the Starq entity. See `ACCESS.md`.

---

## 16. How to run the shell

```bat
cd /d D:\StarqTech\starqBooks
python serve.py
```

- Books (session required once Google is configured): http://127.0.0.1:51800/ — Ali lands on Group; a CI occupant lands on `/?entity=CI`
- Ops (login required): http://127.0.0.1:51800/ops → `/login`
- Direct login: http://127.0.0.1:51800/login — never renders Group books

---

## 17. Chrome — allowed entities only; Ali sees all

**Issued:** 19 August 2026 · **Painter:** Antigravity · **Designer:** Elder · **SSOT:** `HOME_NAV.md`

The wrapping tab bar (Overview / TB / P&L / BS / Journal / Accounts / Notes / Decisions / Club Ignition Ops) and the Group / Starq / CI pill switcher leak org structure on a phone. Chrome becomes:

1. **Top bar** — mark (CI or Starq for the current entity), product title, **Acting as [seat]**, hamburger.
2. **Hamburger drawer** — overlay, focus trap, Esc/close. Sections: Entity (filtered), Books (if allowed), Shop `/ops` (hidden if no CI), Account (seat switch, Users for Ali only, Sign out).
3. **Home** is `/` (alias `/home`) after login. Unauthenticated → `/login`. Home is **applicable**: group finance for Ali in Group/Starq context; garage-ops for CI context and for CI-only occupants.

Nav items are filtered by `user.entities` / `A.may_view_entity` / `A.is_ci_only` (alias `A.allowed_entities` if it exists). Isolation is server-side; chrome must not revert it. Do not rebuild the switcher from `may_view_books`.

- **Ali sees all** — Group, Starq Technologies, Club Ignition. Do not hide Group/Starq from him.
- **CI occupants never see Starq** — not as a tab, not as a disabled tease, not as ST rows, not as a group-finance header.
- **Users** (`/ops/users`) is an Ali/superadmin slot in the drawer only. Occupancy CRUD is Elder. AG does not implement it.
- Footer: product “by starqBooks”. Ali signs garage paper as Director of Club Ignition.

`# AG-OWNED: chrome/home/hamburger` in `serve.py` `page()` and `ops.py` `shell()`.
