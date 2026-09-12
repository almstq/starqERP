-- tests/supplier_deactivate_contract_probe.sql
-- SERP-339 Supplier DEACTIVATE runtime probe.
-- Mirrors the supplier create/update probe pattern: runs against a disposable
-- migrated database, exercises api_supplier_deactivate_command end-to-end, and
-- proves the dispatch gates (tenant isolation, RBAC, idempotency, audit) plus
-- deactivate semantics (status -> inactive, version bump, no delete). Rolls the
-- transaction back at the end.
begin;

create or replace function pg_temp.expect_supplier_deactivate_error(
  p_org uuid, p_person uuid, p_seat text, p_command jsonb, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_supplier_deactivate_command(
    p_org, p_person, p_seat, gen_random_uuid(), p_command, gen_random_uuid()
  );
  raise exception 'expected % but supplier deactivate succeeded: %', p_expected, ignored;
exception
  when others then
    if sqlerrm <> p_expected then
      raise exception 'expected %, got %', p_expected, sqlerrm;
    end if;
end
$$;

create or replace function pg_temp.expect_supplier_deactivate_key_error(
  p_org uuid, p_person uuid, p_seat text, p_command jsonb, p_key uuid, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_supplier_deactivate_command(
    p_org, p_person, p_seat, p_key, p_command, gen_random_uuid()
  );
  raise exception 'expected % but supplier deactivate succeeded: %', p_expected, ignored;
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
  owner_person uuid := '00000000-0000-4000-8000-000000000901';
  counter_person uuid := '00000000-0000-4000-8000-000000000902';
  tech_person uuid := '00000000-0000-4000-8000-000000000904';
  other_owner uuid := '00000000-0000-4000-8000-000000000903';
  owner_member uuid := '00000000-0000-4000-8000-000000000911';
  counter_member uuid := '00000000-0000-4000-8000-000000000912';
  tech_member uuid := '00000000-0000-4000-8000-000000000914';
  other_member uuid := '00000000-0000-4000-8000-000000000913';
  key uuid := gen_random_uuid();
  supplier_id uuid;
  supplier_other uuid;
  create_response jsonb;
  deactivate_response jsonb;
  replay_response jsonb;
  audit_row record;
  status_text text;
  version_num bigint;
begin
  insert into public.persons (id, person_key, external_subject, display_label, status)
  values
    (owner_person, '__serp339_deact_owner__', '__serp339_deact_owner__', 'SERP-339 deactivate owner', 'active'),
    (counter_person, '__serp339_deact_counter__', '__serp339_deact_counter__', 'SERP-339 deactivate counter', 'active'),
    (tech_person, '__serp339_deact_tech__', '__serp339_deact_tech__', 'SERP-339 deactivate technician', 'active'),
    (other_owner, '__serp339_deact_other__', '__serp339_deact_other__', 'SERP-339 deactivate other tenant owner', 'active');

  insert into public.memberships (id, organisation_id, person_id, status)
  values
    (owner_member, org_one, owner_person, 'active'),
    (counter_member, org_one, counter_person, 'active'),
    (tech_member, org_one, tech_person, 'active'),
    (other_member, org_two, other_owner, 'active');

  insert into public.membership_seats (membership_id, seat_code)
  values
    (owner_member, 'owner'),
    (counter_member, 'counter'),
    (tech_member, 'technician'),
    (other_member, 'owner');

  -- 1. Create two suppliers via the merged CREATE spine.
  create_response := public.api_supplier_command(
    org_one, owner_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'SUPPLIER',
      'name', 'Harbour Supplies',
      'phone', '7771000',
      'email', 'orders@harbour.example',
      'contact_person', 'Zayd',
      'address', 'Jannah Harbour',
      'island', 'Addu',
      'category', 'Logistics',
      'lead_time_days', 7
    ),
    gen_random_uuid()
  );
  supplier_id := (create_response->'supplier'->>'id')::uuid;
  perform public.api_supplier_command(
    org_one, owner_person, 'owner', gen_random_uuid(),
    jsonb_build_object('type', 'SUPPLIER', 'name', 'Reef Imports'),
    gen_random_uuid()
  );

  -- Other tenant supplier must stay untouched and invisible.
  supplier_other := (public.api_supplier_command(
    org_two, other_owner, 'owner', gen_random_uuid(),
    jsonb_build_object('type', 'SUPPLIER', 'name', 'Foreign Tenant Supplier'),
    gen_random_uuid()
  )->'supplier'->>'id')::uuid;

  -- 2. Deactivate the first supplier; version bumped, status inactive, row kept.
  deactivate_response := public.api_supplier_deactivate_command(
    org_one, owner_person, 'owner', key,
    jsonb_build_object('type', 'SUPPLIER_DEACTIVATE', 'supplier_id', supplier_id),
    gen_random_uuid()
  );
  if deactivate_response->'supplier'->>'status' <> 'inactive' then
    raise exception 'deactivate status wrong: %', deactivate_response;
  end if;
  if (deactivate_response->'supplier'->>'version')::integer <> 2 then
    raise exception 'deactivate version wrong: %', deactivate_response;
  end if;

  select status, version into status_text, version_num
    from public.contacts
   where organisation_id = org_one and id = supplier_id and kind = 'supplier';
  if status_text <> 'inactive' or version_num <> 2 then
    raise exception 'deactivate not persisted: status=%, version=%', status_text, version_num;
  end if;
  if not exists (select 1 from public.contacts where organisation_id = org_one and id = supplier_id) then
    raise exception 'deactivate physically removed the supplier row';
  end if;

  -- Deactivated supplier vanishes from the active-only GET/list registry.
  if exists (select 1
             from jsonb_array_elements(public.api_supplier_registry(org_one, owner_person, 'owner')->'suppliers')
             where value->>'id' = supplier_id::text) then
    raise exception 'deactivated supplier still listed in registry';
  end if;

  -- 3. Same key replay -> stored response, no second version bump.
  replay_response := public.api_supplier_deactivate_command(
    org_one, owner_person, 'owner', key,
    jsonb_build_object('type', 'SUPPLIER_DEACTIVATE', 'supplier_id', supplier_id),
    gen_random_uuid()
  );
  if replay_response->'supplier'->>'status' <> 'inactive'
     or (replay_response->'supplier'->>'version')::integer <> 2 then
    raise exception 'idempotent replay failed: %', replay_response;
  end if;
  select version into version_num
    from public.contacts where organisation_id = org_one and id = supplier_id;
  if version_num <> 2 then
    raise exception 'idempotent replay created a second version: %', version_num;
  end if;

  -- 4. Same key, different digest -> hard conflict.
  perform pg_temp.expect_supplier_deactivate_key_error(
    org_one, owner_person, 'owner',
    jsonb_build_object('type', 'SUPPLIER_DEACTIVATE', 'supplier_id', supplier_id, 'name', 'Different'),
    key,
    'idempotency_key_conflict'
  );

  -- 5. Already-inactive supplier refused on a fresh key.
  perform pg_temp.expect_supplier_deactivate_error(
    org_one, owner_person, 'owner',
    jsonb_build_object('type', 'SUPPLIER_DEACTIVATE', 'supplier_id', supplier_id),
    'supplier_inactive'
  );

  -- 6. RBAC mirrors the write spine: counter allowed, technician refused.
  perform public.api_supplier_deactivate_command(
    org_one, counter_person, 'counter', gen_random_uuid(),
    jsonb_build_object('type', 'SUPPLIER_DEACTIVATE',
      'supplier_id', (select id from public.contacts where organisation_id = org_one and display_name = 'Reef Imports')),
    gen_random_uuid()
  );
  select status into status_text
    from public.contacts where organisation_id = org_one and display_name = 'Reef Imports';
  if status_text <> 'inactive' then
    raise exception 'counter deactivate failed: %', status_text;
  end if;
  perform pg_temp.expect_supplier_deactivate_error(
    org_one, tech_person, 'technician',
    jsonb_build_object('type', 'SUPPLIER_DEACTIVATE',
      'supplier_id', (select id from public.contacts where organisation_id = org_one and display_name = 'Reef Imports')),
    'seat_not_authorized'
  );

  -- 7. Tenant isolation: foreign tenant owner cannot deactivate org_one rows.
  perform pg_temp.expect_supplier_deactivate_error(
    org_two, other_owner, 'owner',
    jsonb_build_object('type', 'SUPPLIER_DEACTIVATE', 'supplier_id', supplier_id),
    'supplier_not_found'
  );
  -- Foreign tenant can deactivate its own row; org_one row untouched.
  perform public.api_supplier_deactivate_command(
    org_two, other_owner, 'owner', gen_random_uuid(),
    jsonb_build_object('type', 'SUPPLIER_DEACTIVATE', 'supplier_id', supplier_other),
    gen_random_uuid()
  );
  select status into status_text
    from public.contacts where organisation_id = org_one and id = supplier_id;
  if status_text <> 'inactive' or (select status from public.contacts where id = supplier_other) <> 'inactive' then
    raise exception 'tenant isolation violated during deactivate';
  end if;

  -- 8. Nonexistent supplier_id -> supplier_not_found; missing id -> supplier_id_required.
  perform pg_temp.expect_supplier_deactivate_error(
    org_one, owner_person, 'owner',
    jsonb_build_object('type', 'SUPPLIER_DEACTIVATE', 'supplier_id', gen_random_uuid()),
    'supplier_not_found'
  );
  perform pg_temp.expect_supplier_deactivate_error(
    org_one, owner_person, 'owner',
    jsonb_build_object('type', 'SUPPLIER_DEACTIVATE'),
    'supplier_id_required'
  );

  -- 9. Audit evidence with before/after state and acting seat.
  select * into audit_row
    from public.audit_events
   where organisation_id = org_one
     and object_type = 'contact'
     and object_id = supplier_id
     and action = 'erp.supplier.deactivate'
   order by id desc limit 1;
  if audit_row.before_state->>'status' <> 'active'
     or audit_row.after_state->>'status' <> 'inactive'
     or audit_row.acting_seat <> 'owner' then
    raise exception 'deactivate audit evidence missing: %', audit_row;
  end if;

  raise notice 'SERP-339 Supplier DEACTIVATE probe PASS: deactivate, idempotency, RBAC, tenant isolation, validation, and audit verified';
  raise exception using errcode = 'ZX702', message = 'rollback_serp339_deactivate_probe';
exception when sqlstate 'ZX702' then
  null;
end
$$;

do $$
begin
  if exists (select 1 from public.persons where person_key like '__serp339_deact_%')
     or exists (select 1 from public.contacts
                where display_name in ('Harbour Supplies', 'Reef Imports', 'Foreign Tenant Supplier')) then
    raise exception 'SERP-339 DEACTIVATE probe did not roll back cleanly';
  end if;
  raise notice 'SERP-339 Supplier DEACTIVATE probe: clean rollback confirmed';
end
$$;

commit;