begin;

-- =============================================================================
-- Migration: SERP-361 (Starq Account schema — Phase A1)
-- Authority: docs/architecture/adr/010-starq-account.md
--
-- Purely additive foundation introducing Starq Account schema:
--   * public.starq_accounts: durable human identity boundary (Starq-owned)
--   * public.account_identities: authentication methods linked to the account
--   * public.account_profiles: Starq-owned profile attributes
--   * public.account_consents: versioned policy and statutory consent records
--   * public.persons.account_id: nullable projection link (external_subject untouched)
--
-- Security boundary:
--   * RLS enabled on all 4 new tables from creation
--   * Deny-by-default policy for non-service roles
--   * Public/anon/authenticated privileges revoked
--   * Service role access granted
-- =============================================================================

-- 1. Durable human account
create table if not exists public.starq_accounts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Authentication identities (methods linked to the account)
create table if not exists public.account_identities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.starq_accounts(id) on delete cascade,
  provider text not null check (provider in ('google', 'apple', 'microsoft', 'email', 'passkey', 'phone', 'system')),
  subject text not null,
  email text,
  email_verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  last_authenticated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, subject),
  constraint account_identities_email_normalized check (
    email is null or (
      email = lower(btrim(email)) and position('@' in email) > 1
    )
  )
);

create index if not exists idx_account_identities_account_id
  on public.account_identities(account_id);

-- 3. Starq-owned profile attributes
create table if not exists public.account_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.starq_accounts(id) on delete cascade,
  display_name text not null,
  legal_name text,
  primary_email text,
  phone_number text,
  timezone text not null default 'Indian/Maldives',
  locale text not null default 'en-MV',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_profiles_primary_email_normalized check (
    primary_email is null or (
      primary_email = lower(btrim(primary_email)) and position('@' in primary_email) > 1
    )
  )
);

-- 4. Statutory policy and consent records
create table if not exists public.account_consents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.starq_accounts(id) on delete cascade,
  consent_type text not null check (consent_type in ('terms_of_service', 'privacy_policy', 'statutory_data_processing', 'marketing_communication')),
  version text not null,
  granted boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (account_id, consent_type, version)
);

create index if not exists idx_account_consents_account_id
  on public.account_consents(account_id);

-- 5. Add nullable account_id to persons (ERP projection link, additive only)
alter table public.persons
  add column if not exists account_id uuid references public.starq_accounts(id);

create index if not exists idx_persons_account_id
  on public.persons(account_id);

-- 6. Row Level Security and Deny-By-Default Policies
alter table public.starq_accounts enable row level security;
alter table public.account_identities enable row level security;
alter table public.account_profiles enable row level security;
alter table public.account_consents enable row level security;

create policy starq_accounts_deny_by_default on public.starq_accounts
  for all using (false);

create policy account_identities_deny_by_default on public.account_identities
  for all using (false);

create policy account_profiles_deny_by_default on public.account_profiles
  for all using (false);

create policy account_consents_deny_by_default on public.account_consents
  for all using (false);

-- Revoke all permissions from public, anon, and authenticated
revoke all on table public.starq_accounts from public, anon, authenticated;
revoke all on table public.account_identities from public, anon, authenticated;
revoke all on table public.account_profiles from public, anon, authenticated;
revoke all on table public.account_consents from public, anon, authenticated;

-- Grant access to service_role
grant all on table public.starq_accounts to service_role;
grant all on table public.account_identities to service_role;
grant all on table public.account_profiles to service_role;
grant all on table public.account_consents to service_role;

commit;
