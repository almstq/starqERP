<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document is SUPERSEDED and is retained as history only.**
>
> Pre-28-Sep task proposal. Its accounting intent survives in the corrected doctrine; its task-scoped framing does not. Do not use it to plan, implement, review or decide current StarqERP work.
>
> **Current development SSOT:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](../governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
> **Current roadmap:** [`ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`](../roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md)
> **Supersession index:** [`SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md`](../governance/SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md)
>
> StarqERP development is **ON HOLD** pending explicit Founder restart authorization. The
> completion model is *close complete business processes*, not *complete the remaining
> modules*, across the five canonical chains: Order-to-Cash, Procure-to-Pay, Inventory-to-GL,
> Cash-to-Bank, Record-to-Report. This is **convergence, not rewrite** — existing
> architecture, migrations, tests, evidence and completed tasks all remain valid.
>
> **Original content is preserved verbatim below.** Nothing was removed or rewritten.
>
---

# Starq Account — proposed SERP tasks

**Author:** Elder · **Date:** 30 Aug 2026 · **Status:** APPLIED to the SSOT

Authority: [`ADR 010 — Starq Account`](adr/010-starq-account.md).

> **Applied 30 Aug 2026 on Founder direction.** This file was first
> written as a proposal held *off* the board, because Vision holds the
> open repo-vs-board reconciliation. The Founder directed that the whole
> requirement be represented on the canonical Kanban rather than held in
> a document, so it was applied: **epic `SERP-E12` and tasks
> `SERP-361`–`SERP-378`** are now in
> `starqNexus/data/starq-erp-tasks.json`.
>
> The edit was verified purely additive: **0 pre-existing tasks
> modified, 0 removed, no other top-level key changed**, `done`
> unchanged at 143.
>
> The board moved **342 → 360 tasks**, so completion reads
> **41.81% → 39.72%**. That drop is real. It is the cost of
> representing work honestly and must not be avoided by keeping the
> requirement off the board.
>
> Task text below is the authored source; the board rows are canonical.

## Sequencing

```
   SERP-037 (backup proven)  ─┐
   RECOVERY RULING (Founder) ─┼─► A1 ─► A2 ─► B1 ─► B2 ─► C1 ─► C2 ─► D1 ─► D2
   PR #25/#26/#27 merged     ─┘         └─► S1, S2 (parallel from B2)
                                          └─► O1 (parallel from C1)
```

Nothing starts before the two hard gates. **A1 does not begin while PRs
#25–#27 are unmerged** — it adds migrations, and merge order is already
load-bearing.

### Board ids

The letters above are this document's shorthand. The canonical rows are:

| here | board | |
|---|---|---|
| A1 | `SERP-361` | Account schema |
| A2 | `SERP-362` | Backfill + reconciliation |
| B1 | `SERP-363` | Resolve identity through the account |
| B2 | `SERP-364` | Server-side sessions |
| S1 | `SERP-365` | Assurance and step-up |
| — | **`SERP-366`** | **Real TOTP — replaces the accept-all stub** |
| S2 | `SERP-367` | Passkeys |
| C2 | `SERP-368` | Link and unlink |
| — | **`SERP-369`** | **Recovery channel — RULED 30 Aug 2026** |
| — | `SERP-370` | Recovery flows |
| O1/C1 | `SERP-371` | Onboarding, profile, consent |
| — | `SERP-372` | Invitations re-pointed at accounts |
| D1 | `SERP-373` | Retire the allowlist |
| — | `SERP-374` | Migrate pilot users, rehearsed |
| D2 | `SERP-375` | Enforce `account_id` |
| — | `SERP-376` | Identity audit |
| — | `SERP-377` | Adversarial identity suite |
| — | `SERP-378` | Android parity |

`SERP-366` and `SERP-369` have no letter above because neither was in
the first draft. `SERP-366` was found while researching the ADR and is
described in full in the commit that added it; `SERP-369` was promoted
from a footnote to its own row because it is a Founder ruling, not a
task anyone can work. **It was ruled the same day** — see above.

`SERP-381` is also absent from the letters: it is the immediate,
dependency-free half of `SERP-366`, split out after the cold-start
test showed `SERP-366` was not reachable as startable work.

---

## Phase A — introduce, do not use

### A1 · Starq Account schema, additive only
Create `starq_accounts`, `account_identities`, `account_profiles`,
`account_consents`. Add nullable `persons.account_id`. RLS on every new
table from the same migration that creates it.

**Acceptance**
- Migration applies to an empty Postgres and to a restored copy of live.
- Every new table has RLS enabled and a deny-by-default policy.
- `down` path proven: dropping the new tables leaves the system working.
- No existing table's semantics change. `external_subject` untouched.
- Zero reads of the new tables anywhere in application code.

### A2 · Backfill, with reconciliation proof
One account per `persons` row; one `account_identities` row per non-null
`external_subject`.

**Acceptance**
- `count(starq_accounts) = count(persons)` after backfill.
- Every person with a subject has exactly one identity row; every person
  without one has zero.
- Re-running the backfill changes nothing (idempotent).
- A reconciliation query is committed and returns zero discrepancies.

---

## Phase B — read through

### B1 · Resolve identity via account, with fallback
`establishPerson` resolves subject → identity → account → person, falling
back to the current path when `account_id` is null. Fallback hits are
counted and logged.

**Acceptance**
- **Equality test: for every existing pilot user, the session produced by
  the new path is byte-identical to the session produced by the old.**
- Fallback hit count is observable.
- `identity_binding_conflict` still raises for a genuine conflict.
- Adversarial: an identity row pointing at another tenant's account
  grants nothing — `api_session_authority` is still the authority.

### B2 · Server-side sessions
`account_sessions`. The `sb_ops` cookie becomes a reference to a session
record rather than a self-carrying claim set.

**Acceptance**
- Revoking a session refuses the very next request with that cookie.
- "Sign out everywhere" ends all of an account's sessions.
- A deleted session record cannot be replayed from a held cookie.
- Session lookup adds no unbounded query to the request path.
- Existing cookies either keep working through the change or are evicted
  cleanly — never silently downgraded.

---

## Phase C — write through

### C1 · Account-first sign-in
New sign-ins create an account, then its person. `external_subject`
becomes read-only.

**Acceptance**
- A brand-new user has an account, an identity, a profile and a person.
- No code path writes `external_subject` any more.
- A first-time user with no membership reaches a valid no-access state
  rather than an error.

### C2 · Link and unlink a second method
Requires an authenticated session on the target account **and** proof on
the incoming identity.

**Acceptance**
- Linking on a matching email alone is **refused**.
- Unlinking the last usable method is **refused**.
- Linking an identity already bound elsewhere is refused, no data merged.
- Both actions write `audit_events`.
- Adversarial: a linking attempt from an unauthenticated caller fails
  closed, and the attempt is recorded.

---

## Phase D — enforce

### D1 · Retire the allowlist as an authorization source
Seats come from data. `STARQBOOKS_ALLOWLIST_JSON` may bootstrap the first
operator and nothing else. Overlaps **SERP-287**.

**Acceptance**
- No sign-in path writes `membership_seats` from the environment.
- Editing the env var and redeploying grants nobody anything.
- Existing pilot users keep exactly the seats they hold today — proven by
  a before/after diff of `membership_seats`.

### D2 · Make `account_id` mandatory
`persons.account_id` becomes `not null`; `external_subject` is dropped.

**Acceptance**
- Preceded by a recorded period with **zero** Phase-B fallback hits.
- Backup taken and restore rehearsed immediately before.
- Reconciliation from A2 still returns zero discrepancies.

---

## Cross-cutting

### S1 · Identity assurance and step-up *(parallel from B2)*
Sessions carry an assurance level. Sensitive commands may demand a minimum.

**Acceptance**
- A command with a minimum is refused at a lower assurance and the refusal
  is auditable.
- Step-up raises the existing session; it does not mint a new identity.
- `operator_principals.mfa_required` becomes enforceable, not advisory.

### S2 · Passkeys as an identity type *(parallel from B2)*
WebAuthn is an `account_identities` type, not a special case.

**Acceptance**
- A passkey is added and removed by the same flows as any other method.
- A passkey-only account can still sign in and still recover.

### O1 · Onboarding — what Starq collects for itself *(parallel from C1)*
Starq display name, versioned consent, security-method offer, then the
organisation relationship.

**Acceptance**
- Consent is stored with its policy version and timestamp.
- The provider's display name is a default, never the record.
- An account with no membership sees no organisation data anywhere.

---

## Blocked, and named as such

- ~~Recovery channel — Founder ruling required.~~ **RULED 30 Aug 2026.**
  Verified Starq recovery email primary; Starq-generated recovery codes
  secondary and independent; **no login provider is ever the recovery
  authority**; passkeys and verified phone addable later without
  changing the account identity; phone not required at launch. See
  `SERP-369`, `SERP-370` and ADR 010. **No longer a blocker.**
- **SERP-037** (backup and scratch-restore) must be proven before A1.
- **eFaas / national identity** — unassessed. Not a dependency. Must not
  be precluded by any decision above.
