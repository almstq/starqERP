-- =============================================================================
-- Migration: 202609090051_serp314_price_list_registry.sql
-- SERP-314 Gap 2 — authoritative tenant-scoped price-list registry.
--
-- This migration is intentionally additive. It does not alter invoice commands
-- or invoice-line identity. Customer.price_list_id remains the stable code
-- (retail/wholesale/resort/vip or an admin-created code); the UUID registry id
-- is internal to CRUD updates.
--
-- Do not apply this migration to production from this worktree. The executable
-- synthetic probe is tests/run_serp314_price_list_registry_probe.ps1.
-- =============================================================================

begin;

create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  discount_percent numeric(5, 2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  active boolean not null default true,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, code),
  unique (organisation_id, id),
  check (code ~ '^[a-z0-9][a-z0-9_-]{0,62}$'),
  check (length(btrim(name)) between 1 and 200),
  check (description is null or length(description) <= 1000)
);

create table public.price_list_item_overrides (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  price_list_id uuid not null,
  product_id uuid not null,
  unit_price numeric(20, 6) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, price_list_id, product_id),
  unique (organisation_id, id),
  foreign key (organisation_id, price_list_id)
    references public.price_lists(organisation_id, id) on delete cascade,
  foreign key (organisation_id, product_id)
    references public.products(organisation_id, id)
);

alter table public.price_lists enable row level security;
alter table public.price_list_item_overrides enable row level security;

create policy price_lists_tenant on public.price_lists
  for all to public
  using (app_private.has_organisation_access(organisation_id))
  with check (app_private.has_organisation_access(organisation_id));

create policy price_list_item_overrides_tenant on public.price_list_item_overrides
  for all to public
  using (app_private.has_organisation_access(organisation_id))
  with check (app_private.has_organisation_access(organisation_id));

revoke all on public.price_lists, public.price_list_item_overrides from anon, authenticated;

create or replace function app_private.seed_default_organisation_price_lists(target_org uuid)
returns void language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
begin
  -- No discount policy is invented here. These compatibility records start at
  -- 0%; an authorised admin configures the commercial rate through CRUD.
  insert into public.price_lists (organisation_id, code, name, discount_percent)
  values
    (target_org, 'retail', 'Retail', 0),
    (target_org, 'wholesale', 'Wholesale', 0),
    (target_org, 'resort', 'Resort', 0),
    (target_org, 'vip', 'VIP', 0)
  on conflict (organisation_id, code) do nothing;
end
$$;

-- This helper is used only by provisioning triggers and migration backfill.
-- Never expose it as a client-callable mutation surface.
revoke execute on function app_private.seed_default_organisation_price_lists(uuid)
  from public, anon, authenticated;

-- Existing organisations need the compatibility registry, and this trigger
-- keeps newly provisioned tenants on the same contract without changing the
-- provisioning authority.
select app_private.seed_default_organisation_price_lists(id)
  from public.organisations;

-- Forward-only compatibility inspection. This migration never rewrites or
-- silently backfills existing contacts.metadata.price_list_id values. A
-- historical code remains explicitly legacy_unregistered until an admin
-- rebinds the customer to an active registry code. New CUSTOMER writes and
-- updates are rejected unless the code is active in this tenant.
create or replace function app_private.price_list_binding_compatibility(
  target_org uuid,
  binding_code text
)
returns text language sql stable security definer
set search_path = public, app_private, extensions, pg_temp as $$
  select case
    when nullif(btrim(coalesce(binding_code, '')), '') is null then 'unbound'
    when exists (
      select 1 from public.price_lists pl
       where pl.organisation_id = target_org
         and pl.code = lower(btrim(binding_code))
         and pl.active
    ) then 'active_registry'
    when exists (
      select 1 from public.price_lists pl
       where pl.organisation_id = target_org
         and pl.code = lower(btrim(binding_code))
         and not pl.active
    ) then 'archived_registry'
    else 'legacy_unregistered'
  end;
$$;

create or replace function app_private.seed_price_lists_after_organisation_insert()
returns trigger language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
begin
  perform app_private.seed_default_organisation_price_lists(new.id);
  return new;
end
$$;

create trigger organisations_seed_default_price_lists
after insert on public.organisations
for each row execute function app_private.seed_price_lists_after_organisation_insert();

create or replace function app_private.validate_customer_price_list_binding()
returns trigger language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  binding_code text := nullif(btrim(coalesce(new.metadata->>'price_list_id', '')), '');
  old_binding_code text;
  old_organisation_id uuid;
  old_kind text;
begin
  if tg_op = 'UPDATE' then
    old_binding_code := nullif(btrim(coalesce(old.metadata->>'price_list_id', '')), '');
    old_organisation_id := old.organisation_id;
    old_kind := old.kind;
  end if;

  if new.kind = 'customer' and binding_code is not null and not exists (
    select 1
      from public.price_lists pl
     where pl.organisation_id = new.organisation_id
        and pl.code = lower(binding_code)
        and pl.active
  ) and not (
    tg_op = 'UPDATE'
    and old_kind = 'customer'
    and old_organisation_id = new.organisation_id
    and old_binding_code = binding_code
    and exists (
      select 1
        from public.price_lists pl
       where pl.organisation_id = new.organisation_id
         and pl.code = lower(binding_code)
         and not pl.active
    )
  ) then
    raise exception 'customer_price_list_invalid';
  end if;
  return new;
end
$$;

create trigger contacts_validate_price_list_binding
before insert or update of organisation_id, kind, metadata on public.contacts
for each row execute function app_private.validate_customer_price_list_binding();

create or replace function app_private.price_list_snapshot(target_org uuid, target_price_list uuid)
returns jsonb language sql stable security definer
set search_path = public, app_private, extensions, pg_temp as $$
  select jsonb_build_object(
    'registry_id', pl.id,
    'code', pl.code,
    'name', pl.name,
    'description', pl.description,
    'discount_percent', pl.discount_percent,
    'active', pl.active,
    'version', pl.version,
    'created_at', pl.created_at,
    'updated_at', pl.updated_at,
    'overrides', coalesce((select jsonb_agg(jsonb_build_object(
      'product_id', o.product_id, 'unit_price', o.unit_price) order by o.product_id)
      from public.price_list_item_overrides o
     where o.organisation_id = target_org and o.price_list_id = pl.id), '[]'::jsonb)
  )
    from public.price_lists pl
   where pl.organisation_id = target_org and pl.id = target_price_list;
$$;

create or replace function public.api_price_list_command(
  target_org uuid,
  target_person uuid,
  target_seat text,
  command_key uuid,
  command jsonb,
  request_identifier uuid
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  existing public.idempotency_keys%rowtype;
  event_name text := upper(trim(coalesce(command->>'type', command->>'sop', '')));
  action_name text := lower(trim(coalesce(command->>'action', 'create')));
  request_digest text := app_private.canonical_jsonb_sha256(command);
  v_price_list_id uuid;
  price_list_code text;
  price_list_name text;
  discount numeric;
  override_row jsonb;
  v_product_id uuid;
  v_unit_price numeric;
  expected_version bigint;
  before_state jsonb;
  event_payload jsonb;
  response jsonb;
begin
  if event_name <> 'PRICE_LIST' then
    raise exception 'unsupported_command';
  end if;
  if command_key is null or request_identifier is null then
    raise exception 'valid_idempotency_key_required';
  end if;
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('owner', 'director', 'managing_director') then
    raise exception 'price_list_seat_not_authorized';
  end if;
  if action_name not in ('create', 'update', 'archive') then
    raise exception 'price_list_action_invalid';
  end if;

  begin
    insert into public.idempotency_keys
      (organisation_id, key, command_type, request_hash, state, expires_at)
    values
      (target_org, command_key, event_name, request_digest, 'processing', now() + interval '7 days');
  exception when unique_violation then
    select * into existing
      from public.idempotency_keys
     where organisation_id = target_org and key = command_key;
    if not found then raise exception 'idempotency_replay_missing'; end if;
    if existing.request_hash <> request_digest or existing.command_type <> event_name then
      raise exception 'idempotency_key_conflict';
    end if;
    return coalesce(existing.response_body, jsonb_build_object('ok', false, 'state', existing.state));
  end;

  if action_name = 'create' then
    price_list_code := lower(btrim(coalesce(command->>'code', '')));
    price_list_name := btrim(coalesce(command->>'name', ''));
    if price_list_code !~ '^[a-z0-9][a-z0-9_-]{0,62}$' then
      raise exception 'price_list_code_invalid';
    end if;
    if price_list_name = '' or length(price_list_name) > 200 then
      raise exception 'price_list_name_invalid';
    end if;
    if command->>'description' is not null and length(command->>'description') > 1000 then
      raise exception 'price_list_description_invalid';
    end if;
    if exists (select 1 from public.price_lists where organisation_id = target_org and code = price_list_code) then
      raise exception 'price_list_code_exists';
    end if;
    if command->>'discount_percent' is not null
       and btrim(command->>'discount_percent') !~ '^[0-9]+(\.[0-9]+)?$' then
      raise exception 'price_list_discount_invalid';
    end if;
    discount := coalesce(nullif(btrim(command->>'discount_percent'), '')::numeric, 0);
    if discount < 0 or discount > 100 then raise exception 'price_list_discount_invalid'; end if;

    insert into public.price_lists (organisation_id, code, name, description, discount_percent)
    values (target_org, price_list_code, price_list_name,
            nullif(btrim(coalesce(command->>'description', '')), ''), discount)
    returning id into v_price_list_id;

  elsif action_name = 'update' then
    if btrim(coalesce(command->>'price_list_id', '')) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'price_list_id_invalid';
    end if;
    v_price_list_id := nullif(btrim(coalesce(command->>'price_list_id', '')), '')::uuid;
    if v_price_list_id is null then raise exception 'price_list_id_required'; end if;
    if btrim(coalesce(command->>'expected_version', '')) !~ '^[0-9]+$' then
      raise exception 'price_list_version_required';
    end if;
    expected_version := (command->>'expected_version')::bigint;
    if expected_version <= 0 then raise exception 'price_list_version_required'; end if;
    price_list_name := btrim(coalesce(command->>'name', ''));
    if price_list_name = '' or length(price_list_name) > 200 then
      raise exception 'price_list_name_invalid';
    end if;
    if command->>'description' is not null and length(command->>'description') > 1000 then
      raise exception 'price_list_description_invalid';
    end if;
    if command->>'discount_percent' is not null
       and btrim(command->>'discount_percent') !~ '^[0-9]+(\.[0-9]+)?$' then
      raise exception 'price_list_discount_invalid';
    end if;
    discount := coalesce(nullif(btrim(command->>'discount_percent'), '')::numeric, 0);
    if discount < 0 or discount > 100 then raise exception 'price_list_discount_invalid'; end if;

    before_state := app_private.price_list_snapshot(target_org, v_price_list_id);
    if before_state is null then raise exception 'price_list_not_found'; end if;
    if (before_state->>'active')::boolean is not true then raise exception 'price_list_archived'; end if;

    update public.price_lists
       set name = price_list_name,
           description = nullif(btrim(coalesce(command->>'description', '')), ''),
           discount_percent = discount,
           version = version + 1,
           updated_at = now()
     where organisation_id = target_org and id = v_price_list_id
       and active and version = expected_version;
    if not found then
      if exists (select 1 from public.price_lists
                  where organisation_id = target_org and id = v_price_list_id
                    and active and version <> expected_version) then
        raise exception 'price_list_version_conflict';
      end if;
      raise exception 'price_list_not_found';
    end if;

  elsif action_name = 'archive' then
    if btrim(coalesce(command->>'price_list_id', '')) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'price_list_id_invalid';
    end if;
    v_price_list_id := nullif(btrim(coalesce(command->>'price_list_id', '')), '')::uuid;
    if v_price_list_id is null then raise exception 'price_list_id_required'; end if;
    before_state := app_private.price_list_snapshot(target_org, v_price_list_id);
    if before_state is null then raise exception 'price_list_not_found'; end if;
    if (before_state->>'active')::boolean is not true then raise exception 'price_list_archived'; end if;
    if lower(coalesce(before_state->>'code', '')) in ('retail', 'wholesale', 'resort', 'vip') then
      raise exception 'price_list_default_cannot_archive';
    end if;
    if exists (
      select 1 from public.contacts c
       where c.organisation_id = target_org
         and lower(nullif(btrim(c.metadata->>'price_list_id'), '')) = lower(before_state->>'code')
    ) then
      raise exception 'price_list_in_use';
    end if;
    update public.price_lists
       set active = false, version = version + 1, updated_at = now()
     where organisation_id = target_org and id = v_price_list_id and active;
    if not found then raise exception 'price_list_not_found'; end if;
  end if;

  -- Item overrides are replaced atomically on create/update. They are keyed by
  -- product_id, which is the stable product identity behind InventoryItem.id;
  -- no invoice-line identity is introduced here.
  if action_name in ('create', 'update') and command ? 'overrides' then
    if jsonb_typeof(command->'overrides') <> 'array' then
      raise exception 'price_list_overrides_invalid';
    end if;
    delete from public.price_list_item_overrides plo
     where plo.organisation_id = target_org and plo.price_list_id = v_price_list_id;
    for override_row in select value from jsonb_array_elements(command->'overrides') loop
      if btrim(coalesce(override_row->>'product_id', '')) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         or btrim(coalesce(override_row->>'unit_price', '')) !~ '^[0-9]+(\.[0-9]+)?$' then
        raise exception 'price_list_override_invalid';
      end if;
      v_product_id := nullif(btrim(coalesce(override_row->>'product_id', '')), '')::uuid;
      v_unit_price := nullif(btrim(coalesce(override_row->>'unit_price', '')), '')::numeric;
      if v_product_id is null or v_unit_price is null or v_unit_price < 0 then
        raise exception 'price_list_override_invalid';
      end if;
      if not exists (select 1 from public.products p where p.organisation_id = target_org and p.id = v_product_id) then
        raise exception 'price_list_product_not_found';
      end if;
      if exists (select 1 from public.price_list_item_overrides plo
                  where plo.organisation_id = target_org
                    and plo.price_list_id = v_price_list_id
                    and plo.product_id = v_product_id) then
        raise exception 'price_list_override_invalid';
      end if;
      insert into public.price_list_item_overrides (organisation_id, price_list_id, product_id, unit_price)
      values (target_org, v_price_list_id, v_product_id, v_unit_price);
    end loop;
  end if;

  select jsonb_build_object(
           'registry_id', pl.id,
           'code', pl.code,
           'name', pl.name,
           'description', pl.description,
           'discount_percent', pl.discount_percent,
           'active', pl.active,
           'version', pl.version,
           'created_at', pl.created_at,
           'updated_at', pl.updated_at,
           'overrides', coalesce((select jsonb_agg(jsonb_build_object(
             'product_id', o.product_id, 'unit_price', o.unit_price) order by o.product_id)
             from public.price_list_item_overrides o
            where o.organisation_id = target_org and o.price_list_id = pl.id), '[]'::jsonb)
         )
    into event_payload
    from public.price_lists pl
   where pl.organisation_id = target_org and pl.id = v_price_list_id;

  response := jsonb_build_object('ok', true, 'state', 'accepted', 'price_list', event_payload);
  update public.idempotency_keys
     set state = 'accepted', response_code = 200, response_body = response
   where organisation_id = target_org and key = command_key;
  insert into public.audit_events
    (organisation_id, actor_person_id, acting_seat, action, object_type,
     object_id, request_id, before_state, after_state, metadata)
  values
    (target_org, target_person, target_seat, 'price_list.' || action_name,
     'price_list', v_price_list_id, request_identifier, before_state,
     event_payload,
     jsonb_build_object('idempotency_key', command_key));
  return response;
end
$$;

create or replace function public.api_price_list_registry(
  target_org uuid,
  target_person uuid,
  target_seat text
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  result jsonb;
begin
  -- Read-only registry aperture (Founder ruling, 09 Sep 2026): counter seats
  -- may read the applicable tenant registry where an authorised CUSTOMER/sales
  -- workflow needs it. Mutations remain gated by api_price_list_command
  -- (owner/director/managing_director only). This query is strictly read-only,
  -- and every row is scoped by the asserted active-seat organisation, so tenant
  -- isolation is unchanged.
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'owner', 'director', 'managing_director') then
    raise exception 'price_list_seat_not_authorized';
  end if;

  select jsonb_build_object(
    'ok', true,
    'price_lists', coalesce(jsonb_agg(jsonb_build_object(
      'registry_id', pl.id,
      'code', pl.code,
      'name', pl.name,
      'description', pl.description,
      'discount_percent', pl.discount_percent,
      'active', pl.active,
      'version', pl.version,
      'created_at', pl.created_at,
      'updated_at', pl.updated_at,
      'overrides', coalesce((select jsonb_agg(jsonb_build_object(
        'product_id', o.product_id, 'unit_price', o.unit_price) order by o.product_id)
        from public.price_list_item_overrides o
       where o.organisation_id = target_org and o.price_list_id = pl.id), '[]'::jsonb)
    ) order by pl.active desc, pl.name), '[]'::jsonb)
  ) into result
  from public.price_lists pl
 where pl.organisation_id = target_org;
  return result;
end
$$;

revoke all on function public.api_price_list_command(uuid, uuid, text, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.api_price_list_command(uuid, uuid, text, uuid, jsonb, uuid) to service_role;
revoke all on function app_private.price_list_snapshot(uuid, uuid) from public, anon, authenticated;
revoke all on function public.api_price_list_registry(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.api_price_list_registry(uuid, uuid, text) to service_role;

commit;
