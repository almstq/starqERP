-- tests/serp314_price_list_registry_probe.sql
-- SERP-314 Gap 2 — executable synthetic DB probe.
-- Creates/list/updates/archives a registry row and proves tenant, seat,
-- malformed-input, override, audit, compatibility, and no-delete invariants.
begin;

create or replace function pg_temp.expect_price_list_error(
  p_org uuid, p_person uuid, p_seat text, p_command jsonb, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_price_list_command(
    p_org, p_person, p_seat, gen_random_uuid(), p_command, gen_random_uuid()
  );
  raise exception 'expected % but command succeeded: %', p_expected, ignored;
exception
  when others then
    if sqlerrm <> p_expected then
      raise exception 'expected %, got %', p_expected, sqlerrm;
    end if;
end
$$;

create or replace function pg_temp.expect_customer_error(
  p_org uuid, p_person uuid, p_seat text, p_command jsonb, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_garage_command(
    p_org, p_person, p_seat, gen_random_uuid(), p_command, gen_random_uuid()
  );
  raise exception 'expected % but customer command succeeded: %', p_expected, ignored;
exception
  when others then
    if sqlerrm <> p_expected then
      raise exception 'expected %, got %', p_expected, sqlerrm;
    end if;
end
$$;

create or replace function pg_temp.expect_registry_error(
  p_org uuid, p_person uuid, p_seat text, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_price_list_registry(p_org, p_person, p_seat);
  raise exception 'expected % but registry read succeeded: %', p_expected, ignored;
exception
  when others then
    if sqlerrm <> p_expected then
      raise exception 'expected %, got %', p_expected, sqlerrm;
    end if;
end
$$;

do $$
declare
  org_one uuid := '20000000-0000-4000-8000-000000000001';
  org_two uuid := '10000000-0000-4000-8000-000000000001';
  admin_person uuid := '00000000-0000-4000-8000-000000000901';
  counter_person uuid := '00000000-0000-4000-8000-000000000902';
  other_admin uuid := '00000000-0000-4000-8000-000000000903';
  admin_member uuid := '00000000-0000-4000-8000-000000000911';
  counter_member uuid := '00000000-0000-4000-8000-000000000912';
  other_member uuid := '00000000-0000-4000-8000-000000000913';
  tech_person uuid := '00000000-0000-4000-8000-000000000904';
  tech_member uuid := '00000000-0000-4000-8000-000000000914';
  custom_id uuid;
  archived_customer_id uuid;
  own_product uuid := '00000000-0000-4000-8000-000000000922';
  other_product uuid := '00000000-0000-4000-8000-000000000921';
  other_list_id uuid;
  archive_id uuid;
  default_id uuid;
  registry jsonb;
  row jsonb;
  audit_row record;
begin
  if has_function_privilege('anon', 'app_private.seed_default_organisation_price_lists(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'app_private.seed_default_organisation_price_lists(uuid)', 'EXECUTE') then
    raise exception 'provisioning seed helper remains client-callable';
  end if;

  insert into public.persons (id, person_key, external_subject, display_label, status)
  values
    (admin_person, '__serp314_gap2_admin__', '__serp314_gap2_admin__', 'SERP-314 Gap 2 admin', 'active'),
    (counter_person, '__serp314_gap2_counter__', '__serp314_gap2_counter__', 'SERP-314 Gap 2 counter', 'active'),
    (other_admin, '__serp314_gap2_other_admin__', '__serp314_gap2_other_admin__', 'SERP-314 Gap 2 other tenant admin', 'active'),
    (tech_person, '__serp314_gap2_tech__', '__serp314_gap2_tech__', 'SERP-314 Gap 2 technician', 'active');

  insert into public.memberships (id, organisation_id, person_id, status)
  values
    (admin_member, org_one, admin_person, 'active'),
    (counter_member, org_one, counter_person, 'active'),
    (tech_member, org_one, tech_person, 'active'),
    (other_member, org_two, other_admin, 'active');

  insert into public.membership_seats (membership_id, seat_code)
  values
    (admin_member, 'owner'),
    (counter_member, 'counter'),
    (tech_member, 'technician'),
    (other_member, 'owner');

  insert into public.products (id, organisation_id, sku, kind, name, sale_allowed)
  values
    (other_product, org_two, 'SERP314-OTHER', 'stock', 'Other Tenant Product', true),
    (own_product, org_one, 'SERP314-OWN', 'stock', 'Own Tenant Product', true);

  -- 1. Owner can create a custom list using the PRICE_LIST command.
  row := (public.api_price_list_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'sop', 'PRICE_LIST',
      'action', 'create',
      'code', 'trade_15',
      'name', 'Trade 15',
      'description', 'Tenant-specific trade pricing',
      'discount_percent', 15,
      'overrides', jsonb_build_array(jsonb_build_object('product_id', own_product, 'unit_price', 42))
    ),
    gen_random_uuid()
  ))->'price_list';
  if row->>'code' <> 'trade_15' or (row->>'active')::boolean is not true then
    raise exception 'create failed: %', row;
  end if;
  custom_id := (row->>'registry_id')::uuid;

  -- CUSTOMER bindings are checked against this tenant's active registry.
  perform public.api_garage_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'CUSTOMER', 'name', 'Bound Customer', 'price_list_id', 'trade_15'
    ), gen_random_uuid()
  );
  if not exists (
    select 1 from public.contacts
     where organisation_id = org_one
       and display_name = 'Bound Customer'
       and metadata->>'price_list_id' = 'trade_15'
  ) then
    raise exception 'valid active customer binding was not persisted';
  end if;
  select id into archived_customer_id
    from public.contacts
   where organisation_id = org_one
     and display_name = 'Bound Customer'
     and metadata->>'price_list_id' = 'trade_15';

  row := (public.api_price_list_command(
    org_two, other_admin, 'owner', gen_random_uuid(),
    jsonb_build_object('type', 'PRICE_LIST', 'action', 'create', 'code', 'org2_only', 'name', 'Other Tenant Only'),
    gen_random_uuid()
  ))->'price_list';
  other_list_id := (row->>'registry_id')::uuid;
  if other_list_id is null then raise exception 'other tenant registry seed failed'; end if;

  -- 2. The registry has all compatibility codes and no standard sentinel row.
  registry := public.api_price_list_registry(org_one, admin_person, 'owner');
  if (select count(*) from jsonb_array_elements(registry->'price_lists')
      where value->>'code' in ('retail', 'wholesale', 'resort', 'vip')) <> 4 then
    raise exception 'compatibility registry incomplete: %', registry;
  end if;
  if registry::text ilike '%standard%' then
    raise exception 'unbound standard pricing was incorrectly persisted: %', registry;
  end if;
  if not exists (select 1 from jsonb_array_elements(registry->'price_lists') where value->>'code' = 'trade_15') then
    raise exception 'created list missing from registry: %', registry;
  end if;
  if app_private.price_list_binding_compatibility(org_one, null) <> 'unbound'
     or app_private.price_list_binding_compatibility(org_one, 'retail') <> 'active_registry'
     or app_private.price_list_binding_compatibility(org_one, 'legacy_historical_code') <> 'legacy_unregistered' then
    raise exception 'forward-only historical binding compatibility status failed';
  end if;

  -- 3. Update is authoritative and records prior/current audit state.
  row := (public.api_price_list_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'PRICE_LIST',
      'action', 'update',
      'price_list_id', custom_id,
      'expected_version', 1,
      'name', 'Trade 15 Updated',
      'description', 'Updated by probe',
      'discount_percent', 15,
      'overrides', '[]'::jsonb
    ),
    gen_random_uuid()
  ))->'price_list';
  if row->>'name' <> 'Trade 15 Updated' or (row->>'version')::integer <> 2 then
    raise exception 'update failed: %', row;
  end if;
  select * into audit_row
    from public.audit_events
   where organisation_id = org_one
     and object_type = 'price_list'
     and object_id = custom_id
     and action = 'price_list.update'
   order by id desc limit 1;
  if audit_row.before_state->>'name' <> 'Trade 15'
     or jsonb_array_length(audit_row.before_state->'overrides') <> 1
     or audit_row.before_state->'overrides'->0->>'product_id' <> own_product::text
     or audit_row.before_state->'overrides'->0->>'unit_price' <> '42.000000'
     or audit_row.after_state->>'name' <> 'Trade 15 Updated' then
    raise exception 'prior/current audit state missing: before=%, after=%', audit_row.before_state, audit_row.after_state;
  end if;

  -- A stale administrator write must fail rather than silently overwrite the
  -- newer version that was just committed above.
  perform pg_temp.expect_price_list_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRICE_LIST', 'action', 'update',
      'price_list_id', custom_id, 'expected_version', 1,
      'name', 'Stale Write', 'discount_percent', 1),
    'price_list_version_conflict'
  );

  -- UUID grammar is v1-v8 in both the TypeScript contract and SQL boundary.
  perform pg_temp.expect_price_list_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRICE_LIST', 'action', 'update',
      'price_list_id', '00000000-0000-8000-8000-000000000001',
      'expected_version', 1,
      'name', 'Missing v8', 'discount_percent', 0),
    'price_list_not_found'
  );
  perform pg_temp.expect_price_list_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRICE_LIST', 'action', 'update',
      'price_list_id', '00000000-0000-9000-8000-000000000001',
      'name', 'Invalid v9', 'discount_percent', 0),
    'price_list_id_invalid'
  );

  -- 4. Archive is the only removal operation; the row remains queryable.
  row := (public.api_price_list_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object('sop', 'PRICE_LIST', 'action', 'create', 'code', 'archive_me', 'name', 'Archive Me'),
    gen_random_uuid()
  ))->'price_list';
  archive_id := (row->>'registry_id')::uuid;
  select (value->>'registry_id')::uuid into default_id
    from jsonb_array_elements(public.api_price_list_registry(org_one, admin_person, 'owner')->'price_lists')
   where value->>'code' = 'retail';
  perform pg_temp.expect_price_list_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('sop', 'PRICE_LIST', 'action', 'archive', 'price_list_id', default_id),
    'price_list_default_cannot_archive'
  );
  perform pg_temp.expect_price_list_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('sop', 'PRICE_LIST', 'action', 'archive', 'price_list_id', custom_id),
    'price_list_in_use'
  );
  perform public.api_price_list_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object('sop', 'PRICE_LIST', 'action', 'archive', 'price_list_id', archive_id),
    gen_random_uuid()
  );
  select value into row from jsonb_array_elements(
    public.api_price_list_registry(org_one, admin_person, 'owner')->'price_lists'
  ) where value->>'code' = 'archive_me';
  if row->>'active' <> 'false' then raise exception 'archive failed: %', row; end if;
  if not exists (select 1 from public.price_lists where organisation_id = org_one and id = archive_id) then
    raise exception 'archive physically removed row';
  end if;
  -- A live customer binding prevents archiving the referenced registry entry.
  update public.contacts
     set metadata = metadata
   where id = archived_customer_id;
  if not exists (
    select 1 from public.contacts
     where id = archived_customer_id
       and metadata->>'price_list_id' = 'trade_15'
  ) then
    raise exception 'unchanged archived customer binding was not preserved';
  end if;

  -- 5. Non-admin seat and every malformed/duplicate/delete path are refused.
  perform pg_temp.expect_price_list_error(
    org_one, counter_person, 'counter',
    jsonb_build_object('type', 'PRICE_LIST', 'action', 'create', 'code', 'counter_try', 'name', 'Denied'),
    'price_list_seat_not_authorized'
  );
  perform pg_temp.expect_price_list_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRICE_LIST', 'action', 'create', 'code', 'trade_15', 'name', 'Duplicate'),
    'price_list_code_exists'
  );

  -- 5b. Founder ruling (09 Sep 2026): counter seats read the applicable tenant
  -- registry read-only; they never mutate, and read access stays
  -- tenant-isolated and seat-scoped.
  registry := public.api_price_list_registry(org_one, counter_person, 'counter');
  if not exists (select 1 from jsonb_array_elements(registry->'price_lists') where value->>'code' = 'trade_15')
     or (select count(*) from jsonb_array_elements(registry->'price_lists')
         where value->>'code' in ('retail', 'wholesale', 'resort', 'vip')) <> 4
     or exists (select 1 from jsonb_array_elements(registry->'price_lists') where value->>'code' = 'org2_only') then
    raise exception 'counter read aperture incorrect: %', registry;
  end if;
  -- Counter may read only its own tenant's registry.
  perform pg_temp.expect_registry_error(org_two, counter_person, 'counter', 'price_list_seat_not_authorized');
  -- Non-CUSTOMER-facing seats still cannot read the registry.
  perform pg_temp.expect_registry_error(org_one, tech_person, 'technician', 'price_list_seat_not_authorized');
  perform pg_temp.expect_price_list_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRICE_LIST', 'action', 'create', 'code', 'bad code', 'name', 'Invalid'),
    'price_list_code_invalid'
  );
  perform pg_temp.expect_price_list_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRICE_LIST', 'action', 'create', 'code', 'negative', 'name', 'Invalid', 'discount_percent', -1),
    'price_list_discount_invalid'
  );
  perform pg_temp.expect_price_list_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRICE_LIST', 'action', 'create', 'code', 'too_long_description', 'name', 'Invalid', 'description', repeat('x', 1001)),
    'price_list_description_invalid'
  );
  perform pg_temp.expect_price_list_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRICE_LIST', 'action', 'delete', 'price_list_id', custom_id),
    'price_list_action_invalid'
  );

  -- 6. A valid UUID from another tenant cannot be used as an override product.
  perform pg_temp.expect_price_list_error(
    org_one, admin_person, 'owner',
    jsonb_build_object(
      'type', 'PRICE_LIST', 'action', 'create', 'code', 'cross_tenant',
      'name', 'Cross Tenant', 'discount_percent', 0,
      'overrides', jsonb_build_array(jsonb_build_object('product_id', other_product, 'unit_price', 1))
    ),
    'price_list_product_not_found'
  );

  perform pg_temp.expect_customer_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'CUSTOMER', 'name', 'Archived Binding', 'price_list_id', 'archive_me'),
    'customer_price_list_invalid'
  );
  perform pg_temp.expect_customer_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'CUSTOMER', 'name', 'Missing Binding', 'price_list_id', 'not_real'),
    'customer_price_list_invalid'
  );
  perform pg_temp.expect_customer_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'CUSTOMER', 'name', 'Foreign Binding', 'price_list_id', 'org2_only'),
    'customer_price_list_invalid'
  );

  -- 7. Other tenant sees only its own registry and cannot mutate org_one.
  registry := public.api_price_list_registry(org_two, other_admin, 'owner');
  if exists (select 1 from jsonb_array_elements(registry->'price_lists') where value->>'code' = 'trade_15') then
    raise exception 'tenant data leaked into other registry: %', registry;
  end if;
  perform pg_temp.expect_price_list_error(
    org_two, other_admin, 'owner',
    jsonb_build_object('type', 'PRICE_LIST', 'action', 'update', 'price_list_id', custom_id, 'expected_version', 1, 'name', 'Cross Tenant', 'discount_percent', 0),
    'price_list_not_found'
  );

  -- 8. Archived list still has prior/current audit evidence.
  select * into audit_row
    from public.audit_events
   where organisation_id = org_one
     and object_type = 'price_list'
     and object_id = archive_id
     and action = 'price_list.archive'
   order by id desc limit 1;
  if audit_row.before_state->>'active' <> 'true'
     or audit_row.after_state->>'active' <> 'false' then
    raise exception 'archive audit state missing: before=%, after=%', audit_row.before_state, audit_row.after_state;
  end if;

  raise notice 'SERP-314 Gap 2 probe PASS: CRUD, registry, compatibility, tenant isolation, seat authorization, validation, override scope, archive, and audit verified';
  raise exception using errcode = 'ZX703', message = 'rollback_serp314_gap2_probe';
exception when sqlstate 'ZX703' then
  null;
end
$$;

do $$
begin
  if exists (select 1 from public.persons where person_key like '__serp314_gap2_%')
     or exists (select 1 from public.price_lists where code in ('trade_15', 'archive_me', 'counter_try', 'cross_tenant')) then
    raise exception 'SERP-314 Gap 2 probe did not roll back cleanly';
  end if;
  raise notice 'SERP-314 Gap 2 probe: clean rollback confirmed';
end
$$;

commit;
