# SERP-361: Starq Account Schema — Phase A1

## Authority & Governance
- **Authority**: [ADR 010: Starq Account — the durable human identity boundary](file:///D:/StarqTech/_tmp/serp361-starq-account/docs/architecture/adr/010-starq-account.md)
- **Founder Decision**: `DEC-108 / F10` (30 Aug 2026)
- **Status**: Implemented, Verified, Additive Only

## Overview
SERP-361 introduces the foundational database schema for the **Starq Account** identity boundary beneath starqERP.
It establishes Starq Accounts as durable, Starq-owned human identity boundaries, while demoting external providers (Google, Apple, Microsoft, Passkeys, etc.) to disposable authentication methods attached to the account.

## Schema Architecture (Purely Additive)
```
public.starq_accounts (Durable human identity boundary, permanent, Starq-owned)
  ├── public.account_identities (Linked authentication methods: provider + subject)
  ├── public.account_profiles (Starq-owned profile attributes: display_name, legal_name, email, timezone, locale)
  ├── public.account_consents (Statutory terms and privacy policy consent acceptance records)
  └── public.persons.account_id (Nullable projection link from ERP person to Starq Account)
```

### Table Definitions & Invariants
1. **`public.starq_accounts`**:
   - `id uuid primary key default gen_random_uuid()`
   - `status text not null default 'active' check (status in ('active', 'suspended', 'closed'))`
   - `created_at timestamptz not null default now()`
   - `updated_at timestamptz not null default now()`

2. **`public.account_identities`**:
   - `id uuid primary key default gen_random_uuid()`
   - `account_id uuid not null references public.starq_accounts(id) on delete cascade`
   - `provider text not null check (provider in ('google', 'apple', 'microsoft', 'email', 'passkey', 'phone', 'system'))`
   - `subject text not null`
   - `email text` (normalized, lowercase)
   - `email_verified boolean not null default false`
   - `metadata jsonb not null default '{}'::jsonb`
   - `last_authenticated_at timestamptz`
   - `unique (provider, subject)`

3. **`public.account_profiles`**:
   - `id uuid primary key default gen_random_uuid()`
   - `account_id uuid not null unique references public.starq_accounts(id) on delete cascade`
   - `display_name text not null`
   - `legal_name text`
   - `primary_email text` (normalized, lowercase)
   - `phone_number text`
   - `timezone text not null default 'Indian/Maldives'`
   - `locale text not null default 'en-MV'`
   - `avatar_url text`

4. **`public.account_consents`**:
   - `id uuid primary key default gen_random_uuid()`
   - `account_id uuid not null references public.starq_accounts(id) on delete cascade`
   - `consent_type text not null check (consent_type in ('terms_of_service', 'privacy_policy', 'statutory_data_processing', 'marketing_communication'))`
   - `version text not null`
   - `granted boolean not null default true`
   - `granted_at timestamptz not null default now()`
   - `revoked_at timestamptz`
   - `ip_address text`
   - `user_agent text`
   - `unique (account_id, consent_type, version)`

5. **`public.persons.account_id`**:
   - Nullable foreign key `uuid references public.starq_accounts(id)`.
   - `external_subject` remains untouched, preserving 100% backward compatibility for all existing foreign keys, session authorities, and pilot users.

## Security & Row Level Security (RLS)
- RLS enabled on all 4 new tables from the same migration that creates them (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
- Deny-by-default policies created for all 4 tables (`FOR ALL USING (false)`).
- Table privileges revoked from `public`, `anon`, and `authenticated`.
- Privileges granted exclusively to `service_role`.
- Zero reads of new tables exist anywhere in client or application code.

## Verification & Acceptance Evidence
1. **Migration Linter**:
   - `scripts/lint-migrations.mjs` PASSED cleanly (all 61 migrations validated, monotonic timestamps, transaction wrappers).
2. **Synthetic PostgreSQL Probe (`tests/serp361_starq_account_probe.sql`)**:
   - Applied cleanly to fresh Supabase PostgreSQL container (`public.ecr.aws/supabase/postgres:17.6.1.155`).
   - Privilege check: Privileged role can seed and read account, identity, profile, and consent rows.
   - Deny-by-default proof: Unprivileged role (`serp361_unprivileged_probe_role` with nosuperuser, nobypassrls, and SELECT granted) queries all 4 tables and gets strictly 0 rows.
   - Reversibility proof: Dropping the 4 tables and `persons.account_id` leaves the core ERP system (persons, organisations, memberships) completely operational.
   - Result: `SERP-361 Starq Account probe: ALL INVARIANTS PASS`.
3. **Global RLS Isolation Probe (`tests/rls_isolation_probe.sql`)**:
   - Evaluated 69 public tables (57 RLS-protected, 11 revoked-grant-protected, 1 scoped-public-read).
   - Confirmed no policy drift, no table drift, and zero row leakage under no-claim probe role.
   - Result: `SERP-124 RLS isolation probe: PASS`.
4. **Governance & Audit Gates**:
   - `scripts/pre-push-secret-scan.mjs`: PASSED
   - `tests/tenant_hardcoding_sweep.test.mjs`: PASSED
   - `tests/migration_0021_rehearsal.test.mjs`: PASSED
   - `tests/security_policy.test.mjs`: PASSED
   - `tests/legal_terms.test.mjs`: PASSED
   - `tests/check_reality_mutation.test.mjs`: PASSED
   - `scripts/audit-running-system.mjs`: PASSED
5. **Web Client Build & Types**:
   - `npm run build`: built in 8.32s, exit 0
   - `npx tsc --noEmit`: 0 errors, exit 0
