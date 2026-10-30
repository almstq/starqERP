begin;

-- =============================================================================
-- Migration: 202609191720_serp_436_hoadha_tenant_provisioning.sql
-- SERP-436 — Hoadha provisioning/linking: ERP-side entry point triggered by
--             Hoadha business claim/activation
--
-- THE REQUIREMENT THIS SATISFIES
--   When a Hoadha business is claimed/activated (Hoadha's DHIV-S6-T1 claim flow),
--   Hoadha triggers starqERP's provisioning workflow rather than the merchant
--   separately onboarding into ERP by hand.
--
-- ACCEPTANCE CRITERIA:
--   1. A claimed/activated Hoadha business can trigger ERP tenant provisioning
--      without manual Elder/Codex intervention.
--   2. POS module entitlement is granted ONLY AFTER the ERP-side provisioning
--      workflow completes, not before.
--
-- CONCURRENCY & RACE HARDENING:
--   Uses pg_advisory_xact_lock on the Hoadha business UUID to serialize concurrent
--   first-claims and ensure deterministic idempotent replay with zero unique-constraint
--   collision or orphaned records.
-- =============================================================================

-- 1. Hoadha Tenant Links Table -----------------------------------------------
create table if not exists platform.hoadha_tenant_links (
  id uuid primary key default gen_random_uuid(),
  hoadha_business_id uuid not null unique,
  organisation_id uuid not null references public.organisations(id),
  hoadha_claimant_id uuid,
  business_name text not null,
  owner_email text not null,
  link_status text not null default 'active' check (link_status in ('active', 'suspended', 'revoked')),
  provisioned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, hoadha_business_id)
);

create index if not exists hoadha_tenant_links_org_idx
  on platform.hoadha_tenant_links (organisation_id);

revoke all on table platform.hoadha_tenant_links from public, anon, authenticated;
grant select on table platform.hoadha_tenant_links to service_role;

-- 2. Automated Stored Procedure for Hoadha Claim Provisioning ----------------
create or replace function platform.provision_hoadha_business(
  p_hoadha_business_id uuid,
  p_business_name text,
  p_owner_email text,
  p_owner_name text,
  p_owner_phone text default null,
  p_hoadha_claimant_id uuid default null,
  p_archetype_id text default 'retail',
  p_request_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = platform, public, app_private, extensions, pg_temp
as $$
declare
  v_existing platform.hoadha_tenant_links%rowtype;
  v_org_id uuid;
  v_biz_name_id uuid;
  v_location_id uuid;
  v_book_id uuid;
  v_person_id uuid;
  v_person_key text;
  v_membership_id uuid;
  v_owner_role uuid;
  v_slug text;
  v_registry_code text;
  v_clean_name text;
  v_clean_email text;
  v_archetype text;
  v_final_modules text[];
begin
  -- 1. Parameter null guard
  if p_hoadha_business_id is null then
    raise exception 'hoadha_business_id_required';
  end if;

  -- 2. CONCURRENCY GUARD: Acquire transaction-scoped advisory lock on the business UUID
  --    Keyed directly on p_hoadha_business_id so a concurrent call blocks immediately,
  --    and takes the clean idempotent replay branch upon commit.
  perform pg_advisory_xact_lock(hashtext(p_hoadha_business_id::text)::bigint);

  -- 3. Parameter sanitization & validation
  v_clean_name := trim(coalesce(p_business_name, ''));
  if v_clean_name = '' then
    raise exception 'business_name_required';
  end if;

  v_clean_email := lower(trim(coalesce(p_owner_email, '')));
  if v_clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'valid_owner_email_required';
  end if;

  v_archetype := coalesce(nullif(p_archetype_id, ''), 'retail');
  if v_archetype not in (
    'general_business', 'automotive_workshop', 'wholesale_trading',
    'marine_service', 'construction_contracting', 'retail'
  ) then
    raise exception 'invalid_archetype';
  end if;

  -- 3. Idempotency check: if already linked, return existing record
  select * into v_existing
    from platform.hoadha_tenant_links
   where hoadha_business_id = p_hoadha_business_id;

  if found then
    select modules into v_final_modules
      from platform.tenant_module_entitlements
     where organisation_id = v_existing.organisation_id;

    return jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'organisation_id', v_existing.organisation_id,
      'hoadha_business_id', v_existing.hoadha_business_id,
      'business_name', v_existing.business_name,
      'link_status', v_existing.link_status,
      'modules', coalesce(v_final_modules, '{}'::text[]),
      'pos_entitled', ('pos' = any(coalesce(v_final_modules, '{}'::text[])))
    );
  end if;

  -- 4. Generate unique slug and registry code
  v_slug := lower(regexp_replace(v_clean_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if length(v_slug) < 2 then
    v_slug := 'hoadha-' || substring(p_hoadha_business_id::text from 1 for 8);
  end if;

  if exists (select 1 from public.organisations where slug = v_slug) then
    v_slug := v_slug || '-' || substring(p_hoadha_business_id::text from 1 for 6);
  end if;

  v_registry_code := 'H-' || upper(substring(p_hoadha_business_id::text from 1 for 6)) || '-' || to_char(now(), 'YYYY');
  if exists (select 1 from public.organisations where registry_code = v_registry_code) then
    v_registry_code := v_registry_code || '-' || substring(p_hoadha_business_id::text from 7 for 4);
  end if;

  -- 5. Create Organisation (Legal Entity)
  v_org_id := gen_random_uuid();
  insert into public.organisations (
    id,
    legal_name,
    slug,
    registry_code,
    status
  ) values (
    v_org_id,
    v_clean_name,
    v_slug,
    v_registry_code,
    'active'
  );

  -- 6. Create Business Name (Trading Brand)
  v_biz_name_id := gen_random_uuid();
  insert into public.business_names (
    id,
    organisation_id,
    name,
    status
  ) values (
    v_biz_name_id,
    v_org_id,
    v_clean_name,
    'active'
  );

  -- 7. Create Primary Location
  v_location_id := gen_random_uuid();
  insert into public.locations (
    id,
    organisation_id,
    code,
    name,
    kind,
    active
  ) values (
    v_location_id,
    v_org_id,
    'MAIN',
    v_clean_name || ' Main Location',
    'office',
    true
  );

  -- 8. Create Operating Activity Book
  v_book_id := gen_random_uuid();
  insert into public.books (
    id,
    organisation_id,
    business_name_id,
    archetype_id,
    code,
    name,
    currency,
    is_default,
    status
  ) values (
    v_book_id,
    v_org_id,
    v_biz_name_id,
    v_archetype,
    'MAIN',
    'Main Commercial Book',
    'MVR',
    true,
    'active'
  );

  -- 9. Link Book to Location
  insert into public.book_locations (
    organisation_id,
    book_id,
    location_id,
    is_primary
  ) values (
    v_org_id,
    v_book_id,
    v_location_id,
    true
  );

  -- 10. Seed Default Organisation Roles
  perform app_private.seed_default_organisation_roles(v_org_id);

  select id into strict v_owner_role
    from public.roles
   where organisation_id = v_org_id and code = 'owner';

  -- 11. Resolve or create person
  v_person_key := 'email:' || v_clean_email;
  v_person_id := gen_random_uuid();
  insert into public.persons (
    id,
    person_key,
    display_label,
    status
  ) values (
    v_person_id,
    v_person_key,
    trim(coalesce(p_owner_name, v_clean_name)),
    'active'
  )
  on conflict (person_key) do update set
    display_label = excluded.display_label
  returning id into v_person_id;

  -- 12. Create Owner Membership
  v_membership_id := gen_random_uuid();
  insert into public.memberships (
    id,
    organisation_id,
    person_id,
    role_id,
    status
  ) values (
    v_membership_id,
    v_org_id,
    v_person_id,
    v_owner_role,
    'active'
  )
  on conflict (organisation_id, person_id) do update set
    status = 'active'
  returning id into v_membership_id;

  -- 13. Grant Membership Seats: owner and managing_director
  insert into public.membership_seats (membership_id, seat_code)
  values
    (v_membership_id, 'owner'),
    (v_membership_id, 'managing_director')
  on conflict (membership_id, seat_code) do nothing;

  -- 14. Grant Book Membership
  insert into public.book_memberships (
    organisation_id,
    membership_id,
    book_id
  ) values (
    v_org_id,
    v_membership_id,
    v_book_id
  )
  on conflict (membership_id, book_id) do nothing;

  -- 15. Register Tenant in platform.tenant_registry
  -- NOTE: This triggers tenant_registry_seed_entitlements, creating baseline
  --       entitlements WITHOUT 'pos'.
  insert into platform.tenant_registry (
    organisation_id,
    archetype_id,
    plan_code,
    subscription_status,
    provisioning_status,
    onboarding_state,
    schema_version,
    is_demo,
    active_seats
  ) values (
    v_org_id,
    v_archetype,
    'hoadha_linked',
    'active',
    'ready',
    'complete',
    '202609191720',
    false,
    1
  );

  -- 16. Record durable Hoadha <-> ERP link (defense-in-depth with ON CONFLICT)
  insert into platform.hoadha_tenant_links (
    hoadha_business_id,
    organisation_id,
    hoadha_claimant_id,
    business_name,
    owner_email,
    link_status,
    provisioned_at
  ) values (
    p_hoadha_business_id,
    v_org_id,
    p_hoadha_claimant_id,
    v_clean_name,
    v_clean_email,
    'active',
    now()
  )
  on conflict (hoadha_business_id) do update set
    updated_at = now();

  -- 17. Record provisioning run (mode must be clean_production or demo_sample)
  insert into platform.provisioning_runs (
    organisation_id,
    mode,
    requested_by,
    status,
    completed_at
  ) values (
    v_org_id,
    'clean_production',
    v_person_id,
    'ready',
    now()
  );

  -- ===========================================================================
  -- ACCEPTANCE CRITERION 2:
  -- POS module entitlement is granted ONLY AFTER the ERP-side provisioning
  -- workflow completes, not before.
  -- ===========================================================================
  update platform.tenant_module_entitlements
     set modules = array_append(modules, 'pos'),
         updated_at = now()
   where organisation_id = v_org_id
     and not ('pos' = any(modules))
  returning modules into v_final_modules;

  -- 18. Audit event
  insert into public.audit_events (
    organisation_id,
    actor_person_id,
    acting_seat,
    action,
    object_type,
    object_id,
    request_id,
    before_state,
    after_state,
    metadata
  ) values (
    v_org_id,
    v_person_id,
    'owner',
    'hoadha.tenant.provision',
    'organisation',
    v_org_id,
    p_request_key,
    jsonb_build_object('status', 'not_provisioned'),
    jsonb_build_object('status', 'provisioned', 'modules', v_final_modules),
    jsonb_build_object(
      'hoadha_business_id', p_hoadha_business_id,
      'hoadha_claimant_id', p_hoadha_claimant_id,
      'pos_entitled', true
    )
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'organisation_id', v_org_id,
    'hoadha_business_id', p_hoadha_business_id,
    'book_id', v_book_id,
    'membership_id', v_membership_id,
    'person_id', v_person_id,
    'slug', v_slug,
    'status', 'provisioned',
    'modules', v_final_modules,
    'pos_entitled', true
  );
end;
$$;

revoke all on function platform.provision_hoadha_business(uuid, text, text, text, text, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function platform.provision_hoadha_business(uuid, text, text, text, text, uuid, text, uuid)
  to service_role;

commit;
