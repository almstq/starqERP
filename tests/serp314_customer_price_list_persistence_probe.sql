-- tests/serp314_customer_price_list_persistence_probe.sql
-- SERP-314 Gap 1 — DB round-trip probe: a CUSTOMER command's price_list_id
-- must survive into public.contacts.metadata, and only when genuinely present.
--
-- Mirrors the 202608200007 self-test pattern: seeds its own person/membership,
-- executes api_garage_command, and rolls everything back on exit. The negative
-- control (runner with -SkipPersistenceMigration) must turn this probe RED.

begin;

-- Session-scoped helper so the five commands stay readable. Lives in pg_temp,
-- so it disappears with the session and can never leak into the schema.
create or replace function pg_temp.serp314_probe_create_customer(
  p_org uuid, p_person uuid, p_seat text, p_name text, p_phone text, p_price_list text
) returns jsonb language plpgsql as $$
declare
  v_cmd_key uuid := gen_random_uuid();
  v_req_id uuid := gen_random_uuid();
  v_res jsonb;
begin
  v_res := public.api_garage_command(
    p_org, p_person, p_seat, v_cmd_key,
    jsonb_build_object(
      'sop', 'CUSTOMER',
      'name', p_name,
      'phone', p_phone,
      'price_list_id', p_price_list
    ),
    v_req_id
  );
  if coalesce(v_res->>'ok', 'false') <> 'true' then
    raise exception 'SERP-314 probe: CUSTOMER command failed: %', v_res;
  end if;
  return v_res;
end
$$;

do $$
declare
  org_id uuid := '20000000-0000-4000-8000-000000000001'; -- post-SERP-275 canonical CI org
  person_id uuid := '00000000-0000-4000-8000-000000000801';
  membership_id uuid := '00000000-0000-4000-8000-000000000802';
  c_meta jsonb;
begin
  insert into public.persons (id, person_key, external_subject, display_label, status)
  values (person_id, '__serp314_persistence_probe__', '__serp314_persistence_probe__', 'SERP-314 persistence probe', 'active');

  insert into public.memberships (id, organisation_id, person_id, status)
  values (membership_id, org_id, person_id, 'active');

  insert into public.membership_seats (membership_id, seat_code)
  values (membership_id, 'counter');

  -- 1. A customer bound to 'wholesale' must round-trip into metadata.
  perform pg_temp.serp314_probe_create_customer(org_id, person_id, 'counter', 'Ahmed Wholesale Batch', '7770001', 'wholesale');
  select metadata into c_meta from public.contacts
   where organisation_id = org_id and display_name = 'Ahmed Wholesale Batch';
  if c_meta is null then
    raise exception 'SERP-314 probe: bound customer not found';
  end if;
  if c_meta->>'price_list_id' <> 'wholesale' then
    raise exception 'SERP-314 probe: price_list_id round-trip failed. Expected wholesale, got %', c_meta->>'price_list_id';
  end if;

  -- 2. Whitespace is trimmed before persistence.
  perform pg_temp.serp314_probe_create_customer(org_id, person_id, 'counter', 'VIP Resort Guest', '7770002', '  vip  ');
  select metadata into c_meta from public.contacts
   where organisation_id = org_id and display_name = 'VIP Resort Guest';
  if c_meta->>'price_list_id' <> 'vip' then
    raise exception 'SERP-314 probe: trim failed. Expected vip, got %', c_meta->>'price_list_id';
  end if;

  -- 3. A customer without a binding must store NULL, not a fabricated value.
  perform pg_temp.serp314_probe_create_customer(org_id, person_id, 'counter', 'Standard Walk In', '7770003', null);
  select metadata into c_meta from public.contacts
   where organisation_id = org_id and display_name = 'Standard Walk In';
  if c_meta->>'price_list_id' is not null then
    raise exception 'SERP-314 probe: unbound customer stored a binding: %', c_meta->>'price_list_id';
  end if;

  -- 4. A blank string is treated as no binding.
  perform pg_temp.serp314_probe_create_customer(org_id, person_id, 'counter', 'Blank Tier Customer', '7770004', '');
  select metadata into c_meta from public.contacts
   where organisation_id = org_id and display_name = 'Blank Tier Customer';
  if c_meta->>'price_list_id' is not null then
    raise exception 'SERP-314 probe: blank string stored a binding: %', c_meta->>'price_list_id';
  end if;

  -- 5. The first customer's binding is unchanged by later commands (no bleed).
  select metadata into c_meta from public.contacts
   where organisation_id = org_id and display_name = 'Ahmed Wholesale Batch';
  if c_meta->>'price_list_id' <> 'wholesale' then
    raise exception 'SERP-314 probe: binding bleed detected: %', c_meta->>'price_list_id';
  end if;

  raise notice 'SERP-314 Gap 1 persistence probe PASS: price_list_id round-trip, trim, NULL and bleed guards verified';
  raise exception using errcode = 'ZX702', message = 'rollback_serp314_persistence_probe';
exception when sqlstate 'ZX702' then
  null;
end
$$;

-- The subtransaction rollback must have removed everything the probe seeded.
do $$
begin
  if exists (select 1 from public.persons where id = '00000000-0000-4000-8000-000000000801')
     or exists (select 1 from public.contacts where organisation_id = '20000000-0000-4000-8000-000000000001'
                and display_name in ('Ahmed Wholesale Batch', 'VIP Resort Guest', 'Standard Walk In', 'Blank Tier Customer'))
     or exists (select 1 from public.idempotency_keys where organisation_id = '20000000-0000-4000-8000-000000000001'
                and command_type = 'CUSTOMER') then
    raise exception 'SERP-314 probe: transaction did not roll back cleanly';
  end if;
  raise notice 'SERP-314 Gap 1 persistence probe: clean rollback confirmed';
end
$$;

commit;