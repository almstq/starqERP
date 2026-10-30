-- =============================================================================
-- SERP-438 — Reorder threshold and low-stock visibility signal
-- =============================================================================
-- Dispatch: SERP-438 (M6 counter lane)
-- Dependencies: SERP-085 (Counter hold), SERP-086 (Barcode & approved pricing)
--
-- Scope strictly:
--   1. Nullable reorder threshold at the product/inventory level, defaulting to
--      no threshold (null, no forced configuration).
--   2. Low-stock state is derived LIVE from public.stock_movements_derived_onhand
--      (never a cached or separately-maintained flag that can drift from ledger).
--   3. Visibly surfaced in the POS/catalogue UI.
--
-- Explicit non-goals:
--   - NO automatic PO creation
--   - NO RFQ or procurement automation
--   - NO demand forecasting / planning
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Schema: Nullable reorder_threshold
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.products
  add column if not exists reorder_threshold numeric(20, 6) default null
  check (reorder_threshold is null or reorder_threshold >= 0);

comment on column public.products.reorder_threshold is
  'SERP-438: Nullable minimum on-hand stock threshold. Null means no threshold configured (no low-stock alerts).';

alter table public.inventory_items
  add column if not exists reorder_threshold numeric(20, 6) default null
  check (reorder_threshold is null or reorder_threshold >= 0);

comment on column public.inventory_items.reorder_threshold is
  'SERP-438: Optional outlet/location override for product reorder threshold.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. api_product_command — support reorder_threshold in create/update/read
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.api_product_command(
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
  action_name text := lower(trim(coalesce(command->>'action', '')));
  request_digest text := app_private.canonical_jsonb_sha256(command);
  v_product_id uuid;
  v_sku text;
  v_name text;
  v_kind text;
  v_barcode text;
  v_reorder_threshold numeric;
  v_update_threshold boolean := false;
  v_income text;
  v_cogs text;
  v_inventory text;
  v_sale_allowed boolean;
  v_onhand numeric;
  v_product jsonb;
  response jsonb;
begin
  if event_name <> 'PRODUCT' then
    raise exception 'unsupported_command';
  end if;
  if action_name not in ('create', 'read', 'update', 'deactivate') then
    raise exception 'product_action_invalid';
  end if;
  if command_key is null or request_identifier is null then
    raise exception 'valid_idempotency_key_required';
  end if;
  -- Seat gate mirrors COMMAND_SEATS.PRODUCT / SQL_PERMITTED_SEATS.PRODUCT.
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  -- Claim first. On replay the stored response wins and no mutation occurs.
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
    v_sku := upper(btrim(coalesce(command->>'sku', '')));
    v_name := btrim(coalesce(command->>'name', ''));
    v_kind := lower(btrim(coalesce(command->>'kind', '')));
    v_barcode := upper(nullif(btrim(coalesce(command->>'barcode', '')), ''));
    v_reorder_threshold := nullif(btrim(coalesce(command->>'reorder_threshold', '')), '')::numeric;

    if v_sku !~ '^[A-Z0-9][A-Z0-9._-]{0,63}$' then raise exception 'product_sku_invalid'; end if;
    if v_barcode is not null and v_barcode !~ '^[0-9A-Z][0-9A-Z._-]{0,31}$' then
      raise exception 'product_barcode_invalid';
    end if;
    if v_reorder_threshold is not null and v_reorder_threshold < 0 then
      raise exception 'product_reorder_threshold_invalid';
    end if;
    if v_name = '' or length(v_name) > 200 then raise exception 'product_name_invalid'; end if;
    if v_kind not in ('service', 'stock', 'consumable') then raise exception 'product_kind_invalid'; end if;
    if exists (select 1 from public.products where organisation_id = target_org and sku = v_sku) then
      raise exception 'product_sku_exists';
    end if;
    if v_barcode is not null and exists (
      select 1 from public.products
       where organisation_id = target_org and barcode = v_barcode
    ) then
      raise exception 'product_barcode_exists';
    end if;
    v_sale_allowed := coalesce((command->>'sale_allowed')::boolean, false);
    v_income := nullif(btrim(coalesce(command->>'income_account', '')), '');
    v_cogs := nullif(btrim(coalesce(command->>'cogs_account', '')), '');
    v_inventory := nullif(btrim(coalesce(command->>'inventory_account', '')), '');
    if v_kind = 'stock' and v_inventory is null then raise exception 'product_inventory_account_required'; end if;

    insert into public.products
      (id, organisation_id, sku, kind, name, barcode, reorder_threshold,
       income_account, cogs_account, inventory_account, active, sale_allowed)
    values
      (gen_random_uuid(), target_org, v_sku, v_kind, v_name, v_barcode, v_reorder_threshold,
       v_income, v_cogs, v_inventory, true, v_sale_allowed)
    returning id into v_product_id;

    v_product := jsonb_build_object(
      'id', v_product_id, 'sku', v_sku, 'kind', v_kind, 'name', v_name, 'barcode', v_barcode,
      'reorder_threshold', v_reorder_threshold,
      'sale_allowed', v_sale_allowed,
      'income_account', v_income, 'cogs_account', v_cogs, 'inventory_account', v_inventory
    );
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'product', v_product);

  elsif action_name = 'read' then
    v_product_id := nullif(coalesce(command->>'product_id', ''), '')::uuid;
    if v_product_id is null then
      v_sku := upper(btrim(coalesce(command->>'sku', '')));
      select id into v_product_id
        from public.products
       where organisation_id = target_org and sku = v_sku;
    end if;
    if v_product_id is null then raise exception 'product_not_found'; end if;

    select jsonb_build_object(
             'id', p.id, 'sku', p.sku, 'kind', p.kind, 'name', p.name, 'barcode', p.barcode,
             'reorder_threshold', p.reorder_threshold,
             'sale_allowed', p.sale_allowed, 'active', p.active,
             'income_account', p.income_account, 'cogs_account', p.cogs_account,
             'inventory_account', p.inventory_account,
             'locations', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'location_id', o.location_id,
                        'on_hand', o.on_hand,
                        'reorder_threshold', p.reorder_threshold,
                        'is_low_stock', (p.reorder_threshold is not null and o.on_hand <= p.reorder_threshold)
                      ))
                 from (select
                         lhs.location_id,
                         coalesce(d.derived_quantity, 0) as on_hand
                         from public.locations lhs
                         left join public.stock_movements_derived_onhand(target_org, lhs.id, p.id) d on true
                        where lhs.organisation_id = target_org and lhs.active) o
             ), '[]'::jsonb)
           )
      into v_product
      from public.products p
     where p.organisation_id = target_org and p.id = v_product_id;
    if v_product is null then raise exception 'product_not_found'; end if;
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'product', v_product);

  elsif action_name = 'update' then
    v_product_id := nullif(coalesce(command->>'product_id', ''), '')::uuid;
    if v_product_id is null then raise exception 'product_id_required'; end if;
    if not exists (select 1 from public.products where organisation_id = target_org and id = v_product_id) then
      raise exception 'product_not_found';
    end if;
    v_name := btrim(coalesce(command->>'name', ''));
    v_barcode := upper(nullif(btrim(coalesce(command->>'barcode', '')), ''));
    if v_barcode is not null and v_barcode !~ '^[0-9A-Z][0-9A-Z._-]{0,31}$' then
      raise exception 'product_barcode_invalid';
    end if;
    if v_name = '' or length(v_name) > 200 then raise exception 'product_name_invalid'; end if;
    if v_barcode is not null and exists (
      select 1 from public.products
       where organisation_id = target_org and barcode = v_barcode and id <> v_product_id
    ) then
      raise exception 'product_barcode_exists';
    end if;

    if command ? 'reorder_threshold' then
      v_reorder_threshold := nullif(btrim(coalesce(command->>'reorder_threshold', '')), '')::numeric;
      if v_reorder_threshold is not null and v_reorder_threshold < 0 then
        raise exception 'product_reorder_threshold_invalid';
      end if;
      v_update_threshold := true;
    end if;

    v_sale_allowed := coalesce((command->>'sale_allowed')::boolean, false);
    v_income := nullif(btrim(coalesce(command->>'income_account', '')), '');
    v_cogs := nullif(btrim(coalesce(command->>'cogs_account', '')), '');
    v_inventory := nullif(btrim(coalesce(command->>'inventory_account', '')), '');

    update public.products
       set name = v_name,
           barcode = v_barcode,
           sale_allowed = v_sale_allowed,
           income_account = v_income,
           cogs_account = v_cogs,
           inventory_account = v_inventory,
           reorder_threshold = case when v_update_threshold then v_reorder_threshold else reorder_threshold end
     where organisation_id = target_org and id = v_product_id
     returning id into v_product_id;

    select jsonb_build_object(
             'id', p.id, 'sku', p.sku, 'kind', p.kind, 'name', p.name, 'barcode', p.barcode,
             'reorder_threshold', p.reorder_threshold,
             'sale_allowed', p.sale_allowed, 'active', p.active,
             'income_account', p.income_account, 'cogs_account', p.cogs_account,
             'inventory_account', p.inventory_account)
      into v_product
      from public.products p
     where p.organisation_id = target_org and p.id = v_product_id;
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'product', v_product);

  else -- deactivate
    v_product_id := nullif(coalesce(command->>'product_id', ''), '')::uuid;
    if v_product_id is null then raise exception 'product_id_required'; end if;
    update public.products
       set active = false
     where organisation_id = target_org and id = v_product_id
     returning id into v_product_id;
    if v_product_id is null then raise exception 'product_not_found'; end if;
    select jsonb_build_object(
             'id', p.id, 'sku', p.sku, 'kind', p.kind, 'name', p.name, 'barcode', p.barcode,
             'reorder_threshold', p.reorder_threshold,
             'sale_allowed', p.sale_allowed, 'active', p.active)
      into v_product
      from public.products p
     where p.organisation_id = target_org and p.id = v_product_id;
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'product', v_product);
  end if;

  update public.idempotency_keys
     set state = 'accepted', response_code = 200, response_body = response
   where organisation_id = target_org and key = command_key;

  insert into public.audit_events
    (organisation_id, actor_person_id, acting_seat, action, object_type,
     object_id, request_id, after_state, metadata)
  values
    (target_org, target_person, target_seat, 'erp.product.' || action_name,
     'product', v_product_id, request_identifier, response,
     jsonb_build_object('idempotency_key', command_key));

  return response;
end
$$;

revoke all on function public.api_product_command(uuid, uuid, text, uuid, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.api_product_command(uuid, uuid, text, uuid, jsonb, uuid)
  to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. api_counter_price_resolution — carries reorder_threshold in product
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.api_counter_price_resolution(
  target_org uuid,
  target_person uuid,
  target_seat text,
  p_product_id uuid default null,
  p_barcode text default null,
  p_price_list_code text default null,
  p_tax_mode text default 'exclusive'
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  v_pid uuid;
  v_product jsonb;
  v_price_list_id uuid;
  v_pl_version bigint;
  v_pl_discount numeric := 0;
  v_resolved numeric := null;
  v_source text := 'none';
  v_tax_mode text := lower(trim(coalesce(p_tax_mode, 'exclusive')));
  v_line_amount numeric;
  v_tax_row record;
  v_org_currency character(3);
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;
  if v_tax_mode not in ('inclusive', 'exclusive', 'zero_rated', 'exempt') then
    raise exception 'counter_sale_tax_mode_invalid';
  end if;

  select base_currency into v_org_currency
    from public.organisations where id = target_org;
  if v_org_currency is null then raise exception 'organisation_not_found'; end if;

  if p_product_id is not null and p_barcode is not null then
    raise exception 'product_identifier_ambiguous';
  end if;
  if p_product_id is not null then
    v_pid := p_product_id;
  elsif p_barcode is not null then
    select id into v_pid
      from public.products
     where organisation_id = target_org
       and barcode = upper(btrim(p_barcode))
       and active;
  else
    raise exception 'product_identifier_required';
  end if;
  if v_pid is null then raise exception 'product_not_found'; end if;

  select jsonb_build_object(
           'id', p.id, 'sku', p.sku, 'kind', p.kind, 'name', p.name, 'barcode', p.barcode,
           'reorder_threshold', p.reorder_threshold,
           'active', p.active, 'sale_allowed', p.sale_allowed)
    into v_product
    from public.products p
   where p.organisation_id = target_org and p.id = v_pid and p.active;
  if v_product is null then raise exception 'product_not_found'; end if;

  if p_price_list_code is not null then
    select pl.id, pl.version, pl.discount_percent
      into v_price_list_id, v_pl_version, v_pl_discount
      from public.price_lists pl
     where pl.organisation_id = target_org
       and pl.code = lower(btrim(p_price_list_code))
       and pl.active
     limit 1;
    if v_price_list_id is null then raise exception 'stock_line_price_list_not_found'; end if;
  end if;

  if v_price_list_id is not null then
    select o.unit_price into v_resolved
      from public.price_list_item_overrides o
     where o.organisation_id = target_org
       and o.price_list_id = v_price_list_id
       and o.product_id = v_pid;
    if v_resolved is not null then v_source := 'price_list_override'; end if;
  end if;
  if v_resolved is null then
    select pp.amount into v_resolved
      from public.product_prices pp
     where pp.organisation_id = target_org
       and pp.product_id = v_pid
       and pp.currency = v_org_currency
       and now() >= pp.valid_from
       and (pp.valid_to is null or now() <= pp.valid_to)
     order by pp.valid_from desc
     limit 1;
    if v_resolved is not null then v_source := 'product_prices'; end if;
  end if;

  if v_resolved is null then
    return jsonb_build_object(
      'ok', true,
      'product', v_product,
      'price', jsonb_build_object(
        'resolved', false, 'reason', 'stock_line_no_price',
        'source', 'none', 'unit_amount', 0, 'currency', v_org_currency),
      'resolution', false);
  end if;

  if v_pl_discount > 0 then
    v_resolved := round(v_resolved * (1 - v_pl_discount / 100), 6);
  end if;

  v_line_amount := v_resolved;
  select * into v_tax_row from app_private.calculate_line_tax(
    target_org, 'gst_general', current_date, v_tax_mode, v_line_amount);
  if v_tax_mode = 'inclusive' then
    v_line_amount := coalesce(v_tax_row.gross_amount, v_line_amount + coalesce(v_tax_row.tax_amount, 0));
  end if;

  return jsonb_build_object(
    'ok', true,
    'product', v_product,
    'price', jsonb_build_object(
      'resolved', true,
      'source', v_source,
      'unit_amount', v_resolved,
      'discount_percent', v_pl_discount,
      'price_list_id', v_price_list_id,
      'price_list_version', v_pl_version,
      'currency', v_org_currency),
    'tax', jsonb_build_object(
      'mode', v_tax_mode,
      'rate', coalesce(v_tax_row.tax_rate, 0),
      'tax_amount', coalesce(v_tax_row.tax_amount, 0),
      'net_amount', coalesce(v_tax_row.base_amount, v_line_amount - coalesce(v_tax_row.tax_amount, 0)),
      'gross_amount', coalesce(v_tax_row.gross_amount, v_line_amount + coalesce(v_tax_row.tax_amount, 0))),
    'resolution', true);
end
$$;

revoke all on function public.api_counter_price_resolution(uuid, uuid, text, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.api_counter_price_resolution(uuid, uuid, text, uuid, text, text, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. api_counter_low_stock_signals — LIVE derived low-stock visibility query
-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only, seat-gated query. Computes low-stock signals strictly from
-- public.stock_movements_derived_onhand(org, loc, prod).
-- Never uses a cached or separately-maintained column.
-- Filter: active stock products with reorder_threshold is not null and on_hand <= reorder_threshold.
create or replace function public.api_counter_low_stock_signals(
  target_org uuid,
  target_person uuid,
  target_seat text,
  p_location_id uuid default null
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  signals jsonb := '[]'::jsonb;
  r record;
  v_count integer := 0;
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  if p_location_id is not null and not exists (
    select 1 from public.locations
     where organisation_id = target_org and id = p_location_id and active
  ) then
    raise exception 'location_not_found';
  end if;

  for r in
    select
      p.id as product_id,
      p.sku,
      p.name,
      p.barcode,
      p.reorder_threshold,
      l.id as location_id,
      l.name as location_name,
      l.code as location_code,
      coalesce(d.derived_quantity, 0) as on_hand,
      round(coalesce(d.derived_quantity, 0) - p.reorder_threshold, 6) as variance_to_threshold
    from public.products p
    cross join public.locations l
    left join lateral public.stock_movements_derived_onhand(target_org, l.id, p.id) d on true
    where p.organisation_id = target_org
      and p.active
      and p.kind = 'stock'
      and p.reorder_threshold is not null
      and l.organisation_id = target_org
      and l.active
      and (p_location_id is null or l.id = p_location_id)
      and coalesce(d.derived_quantity, 0) <= p.reorder_threshold
    order by (coalesce(d.derived_quantity, 0) - p.reorder_threshold) asc, p.name asc
  loop
    v_count := v_count + 1;
    signals := signals || jsonb_build_array(
      jsonb_build_object(
        'product_id', r.product_id,
        'sku', r.sku,
        'name', r.name,
        'barcode', r.barcode,
        'reorder_threshold', r.reorder_threshold,
        'location_id', r.location_id,
        'location_name', r.location_name,
        'location_code', r.location_code,
        'on_hand', r.on_hand,
        'variance_to_threshold', r.variance_to_threshold,
        'is_low_stock', true
      )
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'location_id', p_location_id,
    'count', v_count,
    'low_stock_items', signals
  );
end;
$$;

revoke all on function public.api_counter_low_stock_signals(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.api_counter_low_stock_signals(uuid, uuid, text, uuid)
  to service_role;

commit;
