-- tests/supplier_update_contract_probe.sql
-- SERP-339 Supplier UPDATE runtime probe.
-- Mirrors the SERP-314 Gap 2 probe pattern: runs against a disposable migrated
-- database, exercises api_supplier_update_command end-to-end, and proves the
-- four dispatch gates (tenant isolation, RBAC, idempotency, audit) plus
-- validation and version bump. Rolls the transaction back at the end.
begin;

create or replace function pg_temp.expect_supplier_update_error(
  p_org uuid, p_person uuid, p_seat text, p_command jsonb, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_supplier_update_command(
    p_org, p_person, p_seat, gen_random_uuid(), p_command, gen_random_uuid()
  );
  raise exception 'expected % but supplier update succeeded: %', p_expected, ignored;
exception
  when others then
    if sqlerrm <> p_expected then
      raise exception 'expected %, got %', p_expected, sqlerrm;
    end if;
end
$$;

create or replace function pg_temp.expect_supplier_update_key_error(
  p_org uuid, p_person uuid, p_seat text, p_command jsonb, p_key uuid, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_supplier_update_command(
    p_org, p_person, p_seat, p_key, p_command, gen_random_uuid()
  );
  raise exception 'expected % but supplier update succeeded: %', p_expected, ignored;
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
  supplier_id uuid;
  create_response jsonb;
  update_response jsonb;
  replay_response jsonb;
  audit_row record;
  row public.contacts%rowtype;
  key uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
begin
  if has_function_privilege('anon', 'public.api_supplier_update_command(uuid, uuid, text, uuid, jsonb, uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.api_supplier_update_command(uuid, uuid, text, uuid, jsonb, uuid)', 'EXECUTE') then
    raise exception 'supplier update function remains client-callable';
  end if;

  insert into public.persons (id, person_key, external_subject, display_label, status)
  values
    (owner_person, '__serp339_upd_owner__', '__serp339_upd_owner__', 'SERP-339 update owner', 'active'),
    (counter_person, '__serp339_upd_counter__', '__serp339_upd_counter__', 'SERP-339 update counter', 'active'),
    (tech_person, '__serp339_upd_tech__', '__serp339_upd_tech__', 'SERP-339 update technician', 'active'),
    (other_owner, '__serp339_upd_other_owner__', '__serp339_upd_other_owner__', 'SERP-339 update other owner', 'active');

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

  -- 1. Create a supplier through the merged CREATE spine, then UPDATE it.
  create_response := public.api_supplier_command(
    org_one, owner_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'SUPPLIER',
      'name', 'Harbour Supplies',
      'phone', '7771234',
      'email', 'contact@harbour.example',
      'contact_person', 'Adam',
      'address', 'Marine Drive',
      'island', 'Malé',
      'category', 'Marine',
      'lead_time_days', 7
    ),
    gen_random_uuid()
  );
  supplier_id := (create_response->'supplier'->>'id')::uuid;
  if supplier_id is null then raise exception 'supplier create did not return an id: %', create_response; end if;

  update_response := public.api_supplier_update_command(
    org_one, owner_person, 'owner', key,
    jsonb_build_object(
      'type', 'SUPPLIER_UPDATE',
      'supplier_id', supplier_id,
      'name', 'Harbour Supplies Revised',
      'phone', '7779999',
      'email', 'revised@harbour.example',
      'contact_person', 'Zayd',
      'address', 'Jannah Harbour',
      'island', 'Addu',
      'category', 'Logistics',
      'lead_time_days', 14
    ),
    request_id
  );
  if update_response->>'state' <> 'accepted'
     or update_response->'supplier'->>'name' <> 'Harbour Supplies Revised' then
    raise exception 'update failed: %', update_response;
  end if;

  select * into row
    from public.contacts
   where organisation_id = org_one and id = supplier_id and kind = 'supplier';
  if row.display_name <> 'Harbour Supplies Revised'
     or row.phone <> '7779999'
     or row.email <> 'revised@harbour.example'
     or row.metadata->>'contact_person' <> 'Zayd'
     or row.metadata->>'island' <> 'Addu'
     or row.metadata->>'category' <> 'Logistics'
     or (row.metadata->>'lead_time_days')::integer <> 14
     or row.version <> 2 then
    raise exception 'update did not persist expected fields: %', row;
  end if;

  -- 2. Replaying the same command_key is idempotent-accepted.
  replay_response := public.api_supplier_update_command(
    org_one, owner_person, 'owner', key,
    jsonb_build_object(
      'type', 'SUPPLIER_UPDATE',
      'supplier_id', supplier_id,
      'name', 'Harbour Supplies Revised',
      'phone', '7779999',
      'email', 'revised@harbour.example',
      'contact_person', 'Zayd',
      'address', 'Jannah Harbour',
      'island', 'Addu',
      'category', 'Logistics',
      'lead_time_days', 14
    ),
    gen_random_uuid()
  );
  if replay_response->>'state' <> 'accepted' then
    raise exception 'idempotent replay was not accepted: %', replay_response;
  end if;

  -- 3. Same key, different request digest -> hard conflict.
  perform pg_temp.expect_supplier_update_key_error(
    org_one, owner_person, 'owner',
    jsonb_build_object(
      'type', 'SUPPLIER_UPDATE',
      'supplier_id', supplier_id,
      'name', 'Different Full Name',
      'phone', '7771111',
      'email', 'revised@harbour.example',
      'contact_person', 'Zayd',
      'address', 'Jannah Harbour',
      'island', 'Addu',
      'category', 'Logistics',
      'lead_time_days', 14
    ),
    key,
    'idempotency_key_conflict'
  );

  -- 4. RBAC: the UPDATE command is refused for a non-authorized seat.
  perform pg_temp.expect_supplier_update_error(
    org_one, tech_person, 'technician',
    jsonb_build_object('type', 'SUPPLIER_UPDATE', 'supplier_id', supplier_id, 'name', 'Denied'),
    'seat_not_authorized'
  );

  -- 5. Tenant isolation: another tenant's owner cannot touch org_one's row.
  perform pg_temp.expect_supplier_update_error(
    org_two, other_owner, 'owner',
    jsonb_build_object('type', 'SUPPLIER_UPDATE', 'supplier_id', supplier_id, 'name', 'Cross Tenant'),
    'supplier_not_found'
  );

  -- 6. A nonexistent supplier id inside the tenant is refused, not silently ignored.
  perform pg_temp.expect_supplier_update_error(
    org_one, owner_person, 'owner',
    jsonb_build_object('type', 'SUPPLIER_UPDATE', 'supplier_id', '00000000-0000-4000-8000-00000000ffff', 'name', 'Missing'),
    'supplier_not_found'
  );

  -- 7. Validation: supplier_id required, blank name required, name too long.
  perform pg_temp.expect_supplier_update_error(
    org_one, owner_person, 'owner',
    jsonb_build_object('type', 'SUPPLIER_UPDATE', 'name', 'No Id'),
    'supplier_id_required'
  );
  perform pg_temp.expect_supplier_update_error(
    org_one, owner_person, 'owner',
    jsonb_build_object('type', 'SUPPLIER_UPDATE', 'supplier_id', supplier_id, 'name', '   '),
    'supplier_name_required'
  );
  perform pg_temp.expect_supplier_update_error(
    org_one, owner_person, 'owner',
    jsonb_build_object('type', 'SUPPLIER_UPDATE', 'supplier_id', supplier_id, 'name', repeat('x', 201)),
    'supplier_name_invalid'
  );
  perform pg_temp.expect_supplier_update_error(
    org_one, owner_person, 'owner',
    jsonb_build_object('type', 'SUPPLIER_UPDATE', 'supplier_id', supplier_id, 'name', 'Too Long Email', 'email', repeat('e', 321)),
    'supplier_email_invalid'
  );
  perform pg_temp.expect_supplier_update_error(
    org_one, owner_person, 'owner',
    jsonb_build_object('type', 'SUPPLIER_UPDATE', 'supplier_id', supplier_id, 'name', 'Too Long Phone', 'phone', repeat('7', 65)),
    'supplier_phone_invalid'
  );

  -- 8. Audit carries prior/current state for the UPDATE.
  select * into audit_row
    from public.audit_events
   where organisation_id = org_one
     and object_type = 'contact'
     and object_id = supplier_id
     and action = 'erp.supplier.update'
   order by id desc limit 1;
  if audit_row.before_state->>'name' <> 'Harbour Supplies'
     or audit_row.before_state->>'version' <> '1'
     or audit_row.after_state->>'name' <> 'Harbour Supplies Revised'
     or audit_row.after_state->>'version' <> '2'
     or audit_row.acting_seat <> 'owner'
     or audit_row.request_id <> request_id then
    raise exception 'audit prior/current state missing: before=%, after=%', audit_row.before_state, audit_row.after_state;
  end if;

  raise notice 'SERP-339 Supplier UPDATE probe PASS: update, idempotency, RBAC, tenant isolation, validation, and audit verified';
  raise exception using errcode = 'ZX704', message = 'rollback_serp339_supplier_update_probe';
exception when sqlstate 'ZX704' then
  null;
end
$$;

do $$
begin
  if exists (select 1 from public.persons where person_key like '__serp339_upd_%') then
    raise exception 'SERP-339 Supplier UPDATE probe did not roll back cleanly';
  end if;
  raise notice 'SERP-339 Supplier UPDATE probe: clean rollback confirmed';
end
$$;

commit;