# Starq Account — proposed SERP tasks

**Author:** Elder · **Date:** 30 Aug 2026 · **Status:** PROPOSAL — not applied to the board

Authority: [`ADR 010 — Starq Account`](adr/010-starq-account.md).

> **Why this is a file and not board rows.** The Nexus board is SSOT and
> Vision currently holds the repo-vs-board verification. Writing eleven
> tasks into `starq-erp-tasks.json` mid-audit would put new rows under
> someone else's reconciliation. These are ready to apply verbatim once
> the Founder accepts ADR 010 and Vision's sweep is closed.
>
> The board stands at **143 / 342 = 41.81%**. Adding eleven tasks moves it
> to **143 / 353 = 40.51%** before any work is done. That drop is correct
> and should not be avoided by hiding the work.

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

- **Recovery channel — Founder ruling required.** Email-only recovery
  re-creates the single-provider dependency the whole ADR exists to
  remove. Nothing in Phase C or later should start before this is ruled.
- **SERP-037** (backup and scratch-restore) must be proven before A1.
- **eFaas / national identity** — unassessed. Not a dependency. Must not
  be precluded by any decision above.
