begin;

-- =============================================================================
-- Migration: 202609191725_serp_437_erp_owner_summary_api.sql
-- SERP-437 — ERP owner-summary API: narrow, permissioned read surface for
--             Hoadha owner live-view
--
-- THE PRINCIPLE THIS ENFORCES (SERP-125 & DEC-061 / DEC-077)
--   Private ERP data is not Hoadha data. Cross-product use needs an explicit,
--   merchant-controlled publication/consent act. The owner live-view is a
--   narrow named projection (sales, stock, availability signals), NOT a filter
--   over operational tables, and must be consumable by Hoadha without direct
--   database credentials.
--
-- ACCEPTANCE CRITERIA:
--   1. Owner-summary projection is a narrow named view, not a filter over full
--      operational tables.
--   2. Nothing is exposed without an explicit, audited publication/consent act,
--      consistent with SERP-125.
--   3. A Hoadha owner-live-view consumer can read this API without any direct
--      ERP database credential.
--
-- EXACT COLUMN SCHEMA CONFORMANCE:
--   - commercial_documents: cd.document_type = 'sales_invoice', cd.status in ('issued','settled'),
--                           cd.issued_at (timestamptz), cd.gross_total (numeric(20,6)).
--   - products: p.active (boolean), p.kind (text, 'stock'/'service'/'consumable').
--   - stock_movements: sm.quantity (numeric(20,6)), sm.product_id, sm.organisation_id.
-- =============================================================================

-- 1. Consent Table (Private by default) ---------------------------------------
create table if not exists public.owner_summary_consents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  channel text not null default 'hoadha_owner_view' check (channel in ('hoadha_owner_view')),
  state text not null default 'revoked' check (state in ('consented', 'revoked')),
  consented_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, channel),
  constraint owner_summary_consents_consented_has_timestamp
    check (state <> 'consented' or consented_at is not null)
);

create index if not exists owner_summary_consents_state_idx
  on public.owner_summary_consents (organisation_id, channel)
  where state = 'consented';

alter table public.owner_summary_consents enable row level security;

create policy owner_summary_consents_current on public.owner_summary_consents
  using (app_private.has_organisation_access(organisation_id));

create policy owner_summary_consents_public on public.owner_summary_consents
  for select using (state = 'consented');

-- 2. Explicit, Audited Merchant Consent RPCs ----------------------------------
create or replace function public.api_consent_owner_summary(
  target_org uuid,
  target_person uuid,
  target_seat text,
  request_identifier uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_id uuid;
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat) then
    raise exception 'seat_not_authorized';
  end if;

  -- Merchant-controlled: only owner, managing_director, director
  if target_seat not in ('owner', 'managing_director', 'director') then
    raise exception 'acting_seat_not_legal_for_command';
  end if;

  select to_jsonb(osc) into v_before
    from public.owner_summary_consents osc
   where osc.organisation_id = target_org
     and osc.channel = 'hoadha_owner_view';

  insert into public.owner_summary_consents (
    organisation_id,
    channel,
    state,
    consented_at,
    revoked_at,
    updated_at
  ) values (
    target_org,
    'hoadha_owner_view',
    'consented',
    now(),
    null,
    now()
  )
  on conflict (organisation_id, channel) do update set
    state = 'consented',
    consented_at = now(),
    revoked_at = null,
    updated_at = now()
  returning id into v_id;

  select to_jsonb(osc) into v_after
    from public.owner_summary_consents osc where osc.id = v_id;

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
    target_org,
    target_person,
    target_seat,
    'erp.owner_summary.consent',
    'owner_summary_consent',
    v_id,
    request_identifier,
    v_before,
    v_after,
    jsonb_build_object('channel', 'hoadha_owner_view', 'state', 'consented')
  );

  return jsonb_build_object(
    'ok', true,
    'state', 'consented',
    'consent_id', v_id,
    'organisation_id', target_org
  );
end;
$$;

create or replace function public.api_revoke_owner_summary(
  target_org uuid,
  target_person uuid,
  target_seat text,
  request_identifier uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_id uuid;
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat) then
    raise exception 'seat_not_authorized';
  end if;

  if target_seat not in ('owner', 'managing_director', 'director') then
    raise exception 'acting_seat_not_legal_for_command';
  end if;

  select osc.id, to_jsonb(osc) into v_id, v_before
    from public.owner_summary_consents osc
   where osc.organisation_id = target_org
     and osc.channel = 'hoadha_owner_view';

  if v_id is null then
    raise exception 'consent_record_not_found';
  end if;

  -- RULE 2: Revocation is a state change, NEVER a delete.
  update public.owner_summary_consents
     set state = 'revoked',
         revoked_at = now(),
         updated_at = now()
   where id = v_id;

  select to_jsonb(osc) into v_after
    from public.owner_summary_consents osc where osc.id = v_id;

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
    target_org,
    target_person,
    target_seat,
    'erp.owner_summary.revoke',
    'owner_summary_consent',
    v_id,
    request_identifier,
    v_before,
    v_after,
    jsonb_build_object('channel', 'hoadha_owner_view', 'state', 'revoked')
  );

  return jsonb_build_object(
    'ok', true,
    'state', 'revoked',
    'consent_id', v_id,
    'organisation_id', target_org
  );
end;
$$;

-- 3. Narrow Named Projection View --------------------------------------------
--    security_invoker = true ensures row policy admission.
--    Explicitly projects only aggregate operational signals.
--    Excluded by construction: customer PII, vendor costs, margins, GL accounts.
create or replace view public.owner_summary_projection
with (security_invoker = true) as
select
  htl.organisation_id,
  htl.hoadha_business_id,
  htl.business_name,
  now() as as_of,
  -- Today's sales count and volume from commercial_documents
  coalesce((
    select count(distinct cd.id)::integer
      from public.commercial_documents cd
     where cd.organisation_id = htl.organisation_id
       and cd.document_type = 'sales_invoice'
       and cd.status in ('issued', 'settled')
       and cd.issued_at >= date_trunc('day', now())
       and cd.issued_at < date_trunc('day', now()) + interval '1 day'
  ), 0) as today_sales_count,
  coalesce((
    select sum(cd.gross_total)
      from public.commercial_documents cd
     where cd.organisation_id = htl.organisation_id
       and cd.document_type = 'sales_invoice'
       and cd.status in ('issued', 'settled')
       and cd.issued_at >= date_trunc('day', now())
       and cd.issued_at < date_trunc('day', now()) + interval '1 day'
  ), 0.000000)::numeric(20,6) as today_sales_total_mvr,
  -- Catalog active product count
  coalesce((
    select count(*)::integer
      from public.products p
     where p.organisation_id = htl.organisation_id
       and p.active = true
  ), 0) as active_products_count,
  -- Low stock count (derived on-hand between 1 and 5)
  coalesce((
    select count(*)::integer
      from (
        select sm.product_id, sum(sm.quantity) as on_hand
          from public.stock_movements sm
         where sm.organisation_id = htl.organisation_id
         group by sm.product_id
        having sum(sm.quantity) > 0 and sum(sm.quantity) <= 5
      ) low_stock
  ), 0) as low_stock_products_count,
  -- Out of stock count (active stock products with zero or negative on-hand)
  coalesce((
    select count(*)::integer
      from public.products p
     where p.organisation_id = htl.organisation_id
       and p.active = true
       and p.kind = 'stock'
       and not exists (
         select 1 from public.stock_movements sm
          where sm.organisation_id = p.organisation_id
            and sm.product_id = p.id
          group by sm.product_id
         having sum(sm.quantity) > 0
       )
  ), 0) as out_of_stock_products_count,
  osc.state as consent_status,
  osc.consented_at
from platform.hoadha_tenant_links htl
join public.owner_summary_consents osc
  on osc.organisation_id = htl.organisation_id
where osc.channel = 'hoadha_owner_view'
  and osc.state = 'consented'
  and htl.link_status = 'active';

comment on view public.owner_summary_projection is
  'SERP-437: Narrow named projection for Hoadha owner live-view. Consented tenants only, aggregate signals only.';

-- 4. Hoadha Consumer Read RPC (No Direct ERP DB Credentials) -----------------
create or replace function public.api_get_owner_summary_for_hoadha(
  p_hoadha_business_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, platform, app_private, pg_temp
as $$
declare
  v_org_id uuid;
  v_consent_state text;
  v_summary record;
begin
  if p_hoadha_business_id is null then
    raise exception 'hoadha_business_id_required';
  end if;

  -- 1. Resolve ERP organisation from Hoadha business UUID
  select organisation_id into v_org_id
    from platform.hoadha_tenant_links
   where hoadha_business_id = p_hoadha_business_id
     and link_status = 'active';

  if v_org_id is null then
    raise exception 'hoadha_link_not_found';
  end if;

  -- 2. Verify explicit merchant consent (Private by default)
  select state into v_consent_state
    from public.owner_summary_consents
   where organisation_id = v_org_id
     and channel = 'hoadha_owner_view';

  if v_consent_state is null or v_consent_state <> 'consented' then
    raise exception 'owner_summary_consent_required';
  end if;

  -- 3. Read from the narrow named projection
  select
    organisation_id,
    hoadha_business_id,
    business_name,
    as_of,
    today_sales_count,
    today_sales_total_mvr,
    active_products_count,
    low_stock_products_count,
    out_of_stock_products_count,
    consent_status,
    consented_at
  into v_summary
  from public.owner_summary_projection
  where hoadha_business_id = p_hoadha_business_id;

  if v_summary.organisation_id is null then
    raise exception 'projection_unavailable';
  end if;

  return jsonb_build_object(
    'ok', true,
    'summary', jsonb_build_object(
      'organisation_id', v_summary.organisation_id,
      'hoadha_business_id', v_summary.hoadha_business_id,
      'business_name', v_summary.business_name,
      'as_of', v_summary.as_of,
      'today_sales_count', v_summary.today_sales_count,
      'today_sales_total_mvr', v_summary.today_sales_total_mvr,
      'active_products_count', v_summary.active_products_count,
      'low_stock_products_count', v_summary.low_stock_products_count,
      'out_of_stock_products_count', v_summary.out_of_stock_products_count,
      'consent_status', v_summary.consent_status,
      'consented_at', v_summary.consented_at
    )
  );
end;
$$;

-- 5. Strict Permission Revocations and Grants ---------------------------------
revoke all on public.owner_summary_consents from public, anon, authenticated;
revoke all on public.owner_summary_projection from public, anon, authenticated;

revoke all on function public.api_consent_owner_summary(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.api_revoke_owner_summary(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.api_get_owner_summary_for_hoadha(uuid)
  from public, anon, authenticated;

grant select on public.owner_summary_projection to service_role;
grant execute on function public.api_consent_owner_summary(uuid, uuid, text, uuid) to service_role;
grant execute on function public.api_revoke_owner_summary(uuid, uuid, text, uuid) to service_role;
grant execute on function public.api_get_owner_summary_for_hoadha(uuid) to service_role;

commit;
