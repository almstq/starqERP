# ADR 010: Starq Account — the durable human identity boundary

## Status

**Accepted (DEC-108 / F10).** Founder direction and architecture accepted.
Rule 2 wording clarified to ensure provider authentication never silently creates
or establishes a Starq Account.

> Numbered 010 deliberately. ADR 001 already references ADR 002–005 by name
> (AI-Native Control Plane, Deterministic Base Verification, Immutable Audit
> Trail) though no file exists for them. Taking 002 here would silently
> reassign a reserved number.

## Context

### The directive

Founder, 30 Aug 2026: every human entering starqERP must ultimately enter
through a **Starq Account**. Google, Apple, Microsoft, email/password,
passwordless, passkeys and phone are **authentication methods attached to that
account** — never the canonical identity of the platform. The account must be
able to represent the same human across Starq products without collapsing
product authorization boundaries or tenant isolation.

### What is actually canonical today

Read directly from the schema and the Edge function, not from prior summaries.

| Concern | Where it lives today | Verdict |
|---|---|---|
| Human record | `public.persons` — `202608200001_core_foundation.sql:28` | Exists. Closest thing to an account. |
| Authentication identity | `persons.external_subject text unique` — **one column on the person row** | **This is the gap.** |
| Verified email | `persons.verified_email` + unique index — added `202608280028` | Exists, single-valued. |
| Session | HMAC-signed `sb_ops` cookie, `starq-api/index.ts:52,227` | Stateless. No session table. |
| Runtime authority | `public.api_session_authority(org, person, seat)` — `202608200008` | DB is authority at request time. |
| Org relationship | `public.memberships` (org × person, unique, validity-dated) | Sound. Retain. |
| Authorization | `public.membership_seats` → `public.seats` | Sound. Retain. |
| Roles/permissions | `public.roles`, `public.role_permissions` — `202608250015` | Retain. |
| Joining an org | `public.invitations` (email-addressed, token, 7-day expiry) — `202608270027` | Retain, needs re-pointing. |
| Platform operator | `platform.operator_principals` keyed by `person_id` | Retain. |
| Provider support | **Google only.** `verifyGoogleToken`, `/api/auth/google`, per-client-kind audience policy | Single provider. |
| Pilot seat grants | **`STARQBOOKS_ALLOWLIST_JSON` environment variable**, read at `index.ts:377`, upserted into `membership_seats` at `index.ts:576–592` on every sign-in | **Environment is a provisioning authority.** |

### The four findings that force this ADR

**1 · Identity is welded to one provider subject.** `external_subject` is a
single unique column on `persons`. There is no place to record a second
authentication method, so "sign in with Apple" for an existing Google user
cannot be represented at all. `establishPerson` already throws
`identity_binding_conflict` when a `person_key` carries a different subject —
correct and safe, and also proof that no linking model exists.

**2 · The account is inferred, never established.** A person row is *created as
a side effect of a successful Google token exchange*
(`index.ts:498–508`). There is no moment at which Starq itself establishes who
the human is, collects a profile, or records consent. Identity is whatever the
provider asserted.

**3 · Authorization is seeded from an environment variable.** The allowlist
supplies `person_key`, display name and **seats**, and those seats are upserted
into `membership_seats` on each sign-in. `api_session_authority` is the runtime
authority, so this is not an isolation hole — but a redeploy with an edited env
var re-grants seats, and that is not an account model.

**4 · Sessions cannot be revoked or stepped up.** The session is a signed
cookie carrying its own claims. There is no server-side session record, so
"sign out everywhere", device listing, and step-up assurance have nowhere to
live. `platform.operator_principals.mfa_required` exists as a flag with no
MFA mechanism behind it.

### What is NOT wrong

The membership / seat / role layer is well-shaped and should be **retained
unchanged in its semantics**. It already separates *what organisation you
belong to* from *what you may do there*, is validity-dated, and is enforced
server-side by a `security definer` function. The gap is beneath it, not in it.

## Decision

Introduce **`public.starq_accounts`** as the durable human identity boundary,
and demote provider subjects to rows in a linked table.

```
starq_accounts        one row per human, permanent, Starq-owned
  └── account_identities   one row per (provider, subject) linked to that account
  └── account_profiles     Starq-owned profile attributes
  └── account_consents     policy/consent acceptance records
  └── account_sessions     server-side session records (revocable, device-aware)
  └── persons              retained, now a 1:1 projection of an account into the ERP
        └── memberships        org relationship          (unchanged)
              └── membership_seats  authorization        (unchanged)
```

### The boundary, stated once

- **Starq Account** — *who the human is.* Durable, product-independent, never
  keyed by a provider subject.
- **Account identity** — *how they authenticated.* Many per account. Disposable:
  losing one must never lose the account.
- **Person** — *the account's presence inside starqERP.* Retained so that every
  existing foreign key (`memberships`, `invitations.invited_by`,
  `operator_principals`, audit rows) keeps working.
- **Session** — *one authenticated episode,* with an assurance level.
- **Membership** — *relationship to an organisation.*
- **Membership seat** — *what may be done there.* Unchanged.
- **Organisation** — *the legal and security boundary.* Unchanged.

### Rules that follow

1. **A provider subject may never be the primary key of a human.** It is an
   attribute of an identity row.
2. **Provider authentication proves control of an AUTHENTICATION IDENTITY; Starq Account establishment is a SEPARATE Starq-controlled onboarding action.**
   A successful authentication exchange with an external provider establishes only that the caller controls that provider identity. It does not silently create, infer, or establish the canonical Starq Account. Account establishment is an explicit Starq-governed onboarding act with profile collection and statutory consent.
3. **Linking requires proof of control of the account**, never merely a
   matching email address. Email match may *offer* a link; it may not perform
   one. (Email is provider-asserted and, for some providers, mutable.)
4. **Removing an identity must leave at least one usable authentication method.**
5. **Tenant isolation is unchanged and is not an account concern.** An account
   with no membership can see no organisation data. This ADR must not move any
   authorization decision out of `api_session_authority`.
6. **Seat grants move out of the environment and into data** before the account
   layer is called done. An env var may bootstrap the very first operator; it
   may not be a standing authorization source.

## Consequences

### Positive

- A second provider becomes possible without data loss or an account fork.
- Recovery stops depending permanently on one external provider.
- Revocation, device listing and step-up gain a place to live.
- Consent and policy acceptance become records rather than assumptions.
- A shared Starq identity across products stays possible later without
  re-platforming, because the account is already not product-keyed.

### Negative / costs

- One more join on the hottest path in the system (sign-in). Mitigated by
  keeping `persons` as the ERP-facing projection so nothing downstream changes.
- Account linking is a genuine attack surface. It is the single most
  security-sensitive flow introduced here and needs its own review.
- Migration touches the identity of live pilot users. It must be reversible.

### Explicitly deferred (not designed here)

Cross-product account sharing beyond "do not make it impossible"; federation
with eFaas or any national identity; organisation-level SSO; delegated or
service accounts. Recording them as deferred is the point — none of them may
be *precluded*, none of them is being *built*.

## Migration path

Additive and reversible. No destructive step in any phase.

**Phase A — introduce, do not use.** Create the account tables. Backfill one
account per existing `persons` row, and one `account_identities` row from each
non-null `external_subject`. `persons` gains a nullable `account_id`. Nothing
reads it yet. Rollback is a `drop`.

**Phase B — read through.** `establishPerson` resolves provider subject →
`account_identities` → account → person, falling back to the current path when
`account_id` is null. Both paths must produce an identical session for the same
user; that equality is the phase's acceptance test.

**Phase C — write through.** New sign-ins create an account first, then its
person. `external_subject` becomes read-only, retained for reconciliation.

**Phase D — enforce.** `persons.account_id` becomes `not null`.
`external_subject` is dropped only after a full period with zero fallback hits
recorded.

**Precondition on all phases:** the backup and scratch-restore contract
(SERP-037) must be proven first. This migration rewrites how humans reach their
own data, and an unrehearsed restore is not an acceptable position to be in
while doing that.

## Security model

| Requirement | Position |
|---|---|
| Linking | Requires an authenticated session on the target account **and** proof on the incoming identity. Email match never suffices. |
| Unlinking | Refused if it would leave zero usable methods. Audited. |
| Recovery | **RULED — `SERP-369`, Founder, 30 Aug 2026.** Primary: **verified Starq recovery email** (Starq-verified, never provider-asserted). Secondary: **Starq-generated recovery codes**, independent of the email channel. **No login provider — Google, Apple, Microsoft — may ever be the recovery authority**; a provider may authenticate, it may never authorise a recovery. Passkeys and verified phone must be addable later **without changing the Starq Account identity**. Phone is **not** mandatory for initial launch. Sensitive recovery and account-takeover actions require additional verification, auditability, cooldown/protection controls, and **manual support escalation** where assurance is insufficient. |
| Sessions | Server-side records; revocable individually and in bulk. The signed cookie becomes a *reference* to a session, not the session itself. |
| Assurance | Each session carries an assurance level derived from the method used. Sensitive commands may demand a minimum. |
| Step-up | Re-authentication raises assurance on the existing session; it does not mint a new identity. |
| MFA / passkeys | WebAuthn is an identity *type*, not a special case. `operator_principals.mfa_required` becomes enforceable rather than advisory. |
| Impersonation | If ever built: a distinct session kind, never a seat, always recorded in `audit_events` with both the operator and the subject. Not in scope now. |
| Audit | Every identity-sensitive action (link, unlink, recovery, credential change, assurance change, revocation) writes an audit event. |

## Onboarding model

What Starq must collect *after* a provider authenticates someone and *before*
they reach any organisation data:

1. **Account establishment** — Starq-owned display name; the provider's is a
   default, not the record.
2. **Consent** — terms and privacy acceptance, versioned, timestamped.
3. **Security setup** — at minimum an offer of a second method; mandatory for
   platform operators.
4. **Organisation relationship** — join via invitation, apply, or create. This
   is where the existing `invitations` flow attaches, re-pointed at accounts.

An account with no membership is a valid state: a real human, no access.
This is the state that makes "sign up" safe to open later.

## Blockers and unknowns

1. ~~Recovery channel is a Founder decision.~~ **RULED 30 Aug 2026 —
   `SERP-369`. No longer a blocker.**
   - **Primary:** verified **Starq** recovery email — Starq-verified,
     never provider-asserted.
   - **Secondary:** **Starq-generated recovery codes**, independent of
     the email channel.
   - **Forbidden:** Google, Apple, Microsoft or any login provider as the
     **recovery authority**. A provider may authenticate; it may never
     authorise a recovery.
   - **Must stay possible:** passkeys and verified phone added later
     **without changing the Starq Account identity**.
   - **Controls:** sensitive recovery and account-takeover actions require
     additional verification, auditability, cooldown/protection controls,
     and **manual support escalation** where assurance is insufficient.
   - **Not required at launch:** phone.

   `SERP-370` carries this verbatim as its acceptance criteria.
2. **The allowlist must retire.** Its removal is a prerequisite for Phase D,
   and it overlaps SERP-287, which is already open.
3. **eFaas / national identity is unassessed.** Not a dependency; must not be
   precluded.
4. **Vision's reconnaissance produced no findings.** The file at
   `workspaces/vision/starq-account-research.md` and its `/tmp` original
   contain only an evidence-preservation note asserting their own existence.
   Every current-state fact above was read from the repository directly. This
   is recorded so nobody later assumes a prior survey exists.

## Placement in the dependency chain

Starq Account sits **beneath** onboarding, invitations and platform operator
access, and **beside** the accounting spine — it does not block ledger work.

It is gated behind SERP-037 (backup/restore proven) and the recovery ruling. It
should not begin while PRs #25–#27 are unmerged, because Phase A adds
migrations and merge order is already load-bearing.

## Related

ADR 001 (Accounting-First). SERP-026, SERP-027 (session boundary),
SERP-030 (seat/SoD engine), SERP-042 (membership and seat lifecycle),
SERP-287 (allowlist removal), SERP-037 (backup and restore).
