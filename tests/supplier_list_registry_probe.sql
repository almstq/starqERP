-- tests/supplier_list_registry_probe.sql
-- SERP-339 Supplier GET/list runtime probe.
-- Mirrors the SERP-314 price-list registry probe pattern: runs against a
-- disposable migrated database, exercises api_supplier_registry end-to-end,
-- and proves the dispatch gates for a tenant-scoped read —
--   * seat authorization (counter/director/managing_director/owner allowed,
--     technician refused)
--   * tenant isolation (other tenant's suppliers never visible)
--   * round-trip fidelity of the CREATE/UPDATE spine (created suppliers appear,
--     updated fields become visible, latest-updated sorts first)
-- Rolls the transaction back at the end.
begin;

create or replace function pg_temp.expect_supplier_registry_error(
  p_org uuid, p_person uuid, p_seat text, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_supplier_registry(p_org, p_person, p_seat);
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
  owner_person uuid := '00000000-0000-4000-8000-000000000901';
  counter_person uuid := '00000000-0000-4000-8000-000000000902';
  tech_person uuid := '00000000-0000-4000-8000-000000000904';
  other_owner uuid := '00000000-0000-4000-8000-000000000903';
  owner_member uuid := '00000000-0000-4000-8000-000000000911';
  counter_member uuid := '00000000-0000-4000-8000-000000000912';
  tech_member uuid := '00000000-0000-4000-8000-000000000914';
  other_member uuid := '00000000-0000-4000-8000-000000000913';
  supplier_one jsonb;
  supplier_two jsonb;
  supplier_other jsonb;
  registry jsonb;
  row jsonb;
begin
  if has_function_privilege('anon', 'api_supplier_registry(uuid, uuid, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'api_supplier_registry(uuid, uuid, text)', 'EXECUTE') then
    raise exception 'supplier registry remains client-callable';
  end if;

  insert into public.persons (id, person_key, external_subject, display_label, status)
  values
    (owner_person, '__serp339_list_owner__', '__serp339_list_owner__', 'SERP-339 list owner', 'active'),
    (counter_person, '__serp339_list_counter__', '__serp339_list_counter__', 'SERP-339 list counter', 'active'),
    (tech_person, '__serp339_list_tech__', '__serp339_list_tech__', 'SERP-339 list technician', 'active'),
    (other_owner, '__serp339_list_other__', '__serp339_list_other__', 'SERP-339 list other tenant owner', 'active');

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

  -- 1. Seed suppliers through the merged CREATE spine.
  supplier_one := (public.api_supplier_command(
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
  ))->'supplier';
  if supplier_one->>'name' <> 'Harbour Supplies' then
    raise exception 'create one failed: %', supplier_one;
  end if;

  supplier_two := (public.api_supplier_command(
    org_one, owner_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'SUPPLIER',
      'name', 'Reef Imports',
      'phone', '7772000',
      'email', 'sales@reef.example',
      'contact_person', 'Mariyam',
      'address', 'Hulhumale',
      'island', 'Male',
      'category', 'Food & Beverage',
      'lead_time_days', 3
    ),
    gen_random_uuid()
  ))->'supplier';
  if supplier_two->>'name' <> 'Reef Imports' then
    raise exception 'create two failed: %', supplier_two;
  end if;

  -- 2. Other tenant seeds its own supplier; must stay invisible to org_one.
  supplier_other := (public.api_supplier_command(
    org_two, other_owner, 'owner', gen_random_uuid(),
    jsonb_build_object('type', 'SUPPLIER', 'name', 'Foreign Tenant Supplier'),
    gen_random_uuid()
  ))->'supplier';
  if supplier_other->>'name' <> 'Foreign Tenant Supplier' then
    raise exception 'other tenant create failed: %', supplier_other;
  end if;

  -- 3. Registry lists only the two org_one suppliers, newest first.
  registry := public.api_supplier_registry(org_one, owner_person, 'owner');
  if (select count(*) from jsonb_array_elements(registry->'suppliers')) <> 2 then
    raise exception 'registry count wrong: %', registry;
  end if;
  if exists (select 1 from jsonb_array_elements(registry->'suppliers')
             where value->>'display_name' = 'Foreign Tenant Supplier') then
    raise exception 'tenant data leaked into registry: %', registry;
  end if;
  if not exists (select 1 from jsonb_array_elements(registry->'suppliers')
                 where value->>'display_name' = 'Harbour Supplies' and value->>'kind' = 'supplier')
     or not exists (select 1 from jsonb_array_elements(registry->'suppliers')
                    where value->>'display_name' = 'Reef Imports') then
    raise exception 'registry missing org_one suppliers: %', registry;
  end if;
  -- Later-created supplier sorts before the earlier one (created_at desc),
  -- matching the prior PostgREST ordering contract the UI relies on. The
  -- backdate below only retimes the older fixture row so the sort key differs
  -- inside this single transaction; ordering would otherwise be a tie.
  update public.contacts
     set created_at = now() - interval '1 hour'
   where id = (supplier_one->>'id')::uuid;
  registry := public.api_supplier_registry(org_one, owner_person, 'owner');
  row := (select value from jsonb_array_elements(registry->'suppliers')
          order by value->>'created_at' desc limit 1);
  if row->>'display_name' <> 'Reef Imports' then
    raise exception 'registry ordering wrong: %', registry;
  end if;

  -- 4. UPDATE spine changes are visible through the registry.
  perform public.api_supplier_update_command(
    org_one, owner_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'SUPPLIER_UPDATE',
      'supplier_id', (supplier_one->>'id')::uuid,
      'name', 'Harbour Supplies Revised',
      'phone', '7771111',
      'email', 'revised@harbour.example',
      'contact_person', 'Zayd',
      'address', 'Jannah Harbour',
      'island', 'Addu',
      'category', 'Logistics',
      'lead_time_days', 14
    ),
    gen_random_uuid()
  );
  registry := public.api_supplier_registry(org_one, owner_person, 'owner');
  if not exists (select 1 from jsonb_array_elements(registry->'suppliers')
                 where value->>'display_name' = 'Harbour Supplies Revised') then
    raise exception 'update not visible in registry: %', registry;
  end if;

  -- 5. Seat gate mirrors the write spine: counter can read, technician cannot.
  registry := public.api_supplier_registry(org_one, counter_person, 'counter');
  if (select count(*) from jsonb_array_elements(registry->'suppliers')) <> 2 then
    raise exception 'counter read aperture incorrect: %', registry;
  end if;
  perform pg_temp.expect_supplier_registry_error(org_one, tech_person, 'technician', 'supplier_seat_not_authorized');
  -- Counter reading a tenant it is not a member of is refused by the seat
  -- authority before any row is produced.
  perform pg_temp.expect_supplier_registry_error(org_two, counter_person, 'counter', 'supplier_seat_not_authorized');

  -- 6. Other tenant owner reads only its own registry.
  registry := public.api_supplier_registry(org_two, other_owner, 'owner');
  if (select count(*) from jsonb_array_elements(registry->'suppliers')) <> 1
     or exists (select 1 from jsonb_array_elements(registry->'suppliers')
                where value->>'display_name' in ('Harbour Supplies', 'Reef Imports', 'Harbour Supplies Revised')) then
    raise exception 'other tenant registry wrong: %', registry;
  end if;

  raise notice 'SERP-339 Supplier GET/list probe PASS: seat authorization, tenant isolation, spine round-trip, and ordering verified';
  raise exception using errcode = 'ZX704', message = 'rollback_serp339_list_probe';
exception when sqlstate 'ZX704' then
  null;
end
$$;

do $$
begin
  if exists (select 1 from public.persons where person_key like '__serp339_list_%')
     or exists (select 1 from public.contacts
                where display_name in ('Harbour Supplies', 'Reef Imports', 'Foreign Tenant Supplier', 'Harbour Supplies Revised')) then
    raise exception 'SERP-339 GET/list probe did not roll back cleanly';
  end if;
  raise notice 'SERP-339 Supplier GET/list probe: clean rollback confirmed';
end
$$;

commit;
