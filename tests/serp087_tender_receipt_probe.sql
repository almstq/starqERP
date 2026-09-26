-- tests/serp087_tender_receipt_probe.sql
-- SERP-087 — executable synthetic DB probe (OpenCode lane).
-- Proves tender + receipt financial consequence against a disposable PostgreSQL
-- runtime (structure mirrors the SERP-086 probe):
--   * COUNTER_SALE records tender legs + a receipt register in the SAME
--     transaction as the sale, with SERVER-authoritative change;
--   * functional currency flows from organisations.base_currency everywhere in
--     the POS path (SERP-434 regression) — a non-MVR org carries its own
--     currency through price lookup, tender legs and the register;
--   * receipt_get is read-only + idempotent: reprints return the SAME record
--     and SAME receipt_number; mark_rendered increments renders and audits;
--   * duplicate-proof: re-rendering never mints a second register row or a
--     second number; the schema uniques reject any direct duplicate mint;
--   * a replayed idempotency key does not double-record consequence;
--   * every negative tender path fails the sale CLOSED and atomically, and
--     seat/tenant gates hold on every surface.
--
-- The COUNTER_SALE response is nested: jsonb -> 'counter_sale'. Assertions
-- read through that nest. All "expected rejection but accepted" markers carry
-- NO expected-code string, so an ACCEPT can never be swallowed by the
-- error-handler that checks for the expected code.
begin;

-- Assert a COUNTER_SALE command is REJECTED with the expected code. On success
-- of the RPC the helper RETURNS and the caller raises a code-free acceptance
-- marker; on rejection the expected error propagates to the caller's handler.
create or replace function pg_temp.expect_sale_error(
  p_org uuid, p_person uuid, p_seat text, p_command jsonb, p_expected text
) returns jsonb language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_garage_command(
    p_org, p_person, p_seat, gen_random_uuid(), p_command, gen_random_uuid());
  return ignored;
end
$$;

-- Any insert into the register that is NOT the sale RPC mint must FAIL: the
-- one-record-per-sale + unique-number rule is enforced at the schema level.
create or replace function pg_temp.expect_register_mint_rejected(
  p_org uuid, p_receipt_id uuid, p_sale_id uuid, p_number text,
  p_currency text, p_tendered numeric, p_change numeric
) returns void language plpgsql as $$
declare
  inserted uuid;
begin
  insert into public.counter_receipts
    (organisation_id, receipt_id, sale_id, receipt_number, currency,
     tendered_amount, change_amount, renders, issued_at, issued_by, issued_seat)
  values
    (p_org, p_receipt_id, p_sale_id, p_number, p_currency,
     p_tendered, p_change, 0, now(), '00000000-0000-4000-8000-000000000902', 'counter')
  returning id into inserted;
  raise exception 'DUPLICATE MINT ACCEPTED: %', inserted;
exception
  when unique_violation then
    null;
end
$$;

do $$
declare
  -- fixtures
  org_one uuid := '20000000-0000-4000-8000-000000000001';
  org_two uuid := '10000000-0000-4000-8000-000000000001';
  admin_person uuid := '00000000-0000-4000-8000-000000000901';
  counter_person uuid := '00000000-0000-4000-8000-000000000902';
  tech_person uuid := '00000000-0000-4000-8000-000000000904';
  usd_admin uuid := '00000000-0000-4000-8000-000000000905';
  other_counter uuid := '00000000-0000-4000-8000-000000000906';
  admin_member uuid := '00000000-0000-4000-8000-000000000911';
  counter_member uuid := '00000000-0000-4000-8000-000000000912';
  tech_member uuid := '00000000-0000-4000-8000-000000000914';
  usd_admin_member uuid := '00000000-0000-4000-8000-000000000915';
  other_counter_member uuid := '00000000-0000-4000-8000-000000000916';
  loc_one uuid;
  loc_two uuid;
  prod_a uuid;
  prod_b uuid;
  row jsonb;
  sale jsonb;
  replay jsonb;
  r_get jsonb;
  r_get2 jsonb;
  command_key uuid;
  command jsonb;
  receipt_one uuid;
  sale_one uuid;
  receipt_two uuid;
  number_one text;
  number_two text;
  ignored jsonb;
  leg_total integer := 0;
  cash_leg numeric := 0;
  card_leg numeric := 0;
  reg_count integer := 0;
  tnd_count integer := 0;
begin
  -- ──────────────────────────── SETUP ────────────────────────────
  -- org_two is a NON-MVR tenant (currency regression probe); org_one keeps the
  -- MVR default. Members, seats, products, prices, locations, opening stock.
  update public.organisations set base_currency = 'USD' where id = org_two;

  insert into public.persons (id, person_key, external_subject, display_label, status)
  values
    (admin_person, '__serp087_admin__', '__serp087_admin__', 'SERP-087 admin', 'active'),
    (counter_person, '__serp087_counter__', '__serp087_counter__', 'SERP-087 counter', 'active'),
    (tech_person, '__serp087_tech__', '__serp087_tech__', 'SERP-087 technician', 'active'),
    (usd_admin, '__serp087_usd_admin__', '__serp087_usd_admin__', 'SERP-087 USD admin', 'active'),
    (other_counter, '__serp087_other_counter__', '__serp087_other_counter__', 'SERP-087 other counter', 'active');

  insert into public.memberships (id, organisation_id, person_id, status)
  values
    (admin_member, org_one, admin_person, 'active'),
    (counter_member, org_one, counter_person, 'active'),
    (tech_member, org_one, tech_person, 'active'),
    (usd_admin_member, org_two, usd_admin, 'active'),
    (other_counter_member, org_two, other_counter, 'active');

  insert into public.membership_seats (membership_id, seat_code)
  values
    (admin_member, 'owner'),
    (counter_member, 'counter'),
    (tech_member, 'technician'),
    (usd_admin_member, 'owner'),
    (other_counter_member, 'counter');

  select id into loc_one from public.locations
   where organisation_id = org_one and active order by created_at limit 1;
  if loc_one is null then
    insert into public.locations (id, organisation_id, code, name, kind)
      values ('20000000-0000-4000-8000-000000000731', org_one, 'MAIN', 'Main Location', 'office')
      returning id into loc_one;
  end if;
  select id into loc_two from public.locations
   where organisation_id = org_two and active order by created_at limit 1;
  if loc_two is null then
    insert into public.locations (id, organisation_id, code, name, kind)
      values ('10000000-0000-4000-8000-000000000731', org_two, 'MAIN', 'Main Location', 'office')
      returning id into loc_two;
  end if;

  row := (public.api_product_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'PRODUCT', 'action', 'create',
      'sku', 'SERP087-A', 'name', 'Serp087 Stock A', 'kind', 'stock',
      'inventory_account', '1300', 'barcode', '6291041500213'
    ), gen_random_uuid()
  ))->'product';
  prod_a := (row->>'id')::uuid;
  if prod_a is null then raise exception 'product A create failed: %', row; end if;
  insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from)
    values (org_one, prod_a, 'MVR', 100, now() - interval '5 days');

  row := (public.api_product_command(
    org_two, usd_admin, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'PRODUCT', 'action', 'create',
      'sku', 'SERP087-B', 'name', 'Serp087 Stock B', 'kind', 'stock',
      'inventory_account', '1300', 'barcode', '5060138492201'
    ), gen_random_uuid()
  ))->'product';
  prod_b := (row->>'id')::uuid;
  if prod_b is null then raise exception 'product B create failed: %', row; end if;
  insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from)
    values (org_two, prod_b, 'USD', 50, now() - interval '5 days');

  insert into public.stock_movements
    (organisation_id, location_id, product_id, movement_type, quantity,
     source_type, source_id, idempotency_key, occurred_at, recorded_by)
  values
    (org_one, loc_one, prod_a, 'opening', 500, 'OPENING_BALANCE', prod_a,
     '20000000-0000-4000-8000-000000000741', now(), admin_person),
    (org_two, loc_two, prod_b, 'opening', 500, 'OPENING_BALANCE', prod_b,
     '10000000-0000-4000-8000-000000000741', now(), usd_admin);

  -- ─────────────── SELL 1: single cash, money reconciled, MVR ───────────────
  -- zero_rated keeps the server total EXACT (100) so money is assertable.
  sale := public.api_garage_command(
    org_one, counter_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 200))
    ), gen_random_uuid());
  if (sale->'counter_sale'->>'total_amount')::numeric <> 100 then raise exception 'S1 server total wrong: %', sale; end if;
  if (sale->'counter_sale'->>'tendered_amount')::numeric <> 200 then raise exception 'S1 tendered wrong: %', sale; end if;
  if (sale->'counter_sale'->>'change_amount')::numeric <> 100 then raise exception 'S1 change wrong: %', sale; end if;
  if sale->'counter_sale'->>'payment_method' <> 'cash' then raise exception 'S1 payment_method not surfaced: %', sale; end if;
  if sale->'counter_sale'->>'currency' <> 'MVR' then raise exception 'S1 currency not derived: %', sale; end if;
  if sale->'counter_sale'->>'receipt_number' is null then raise exception 'S1 receipt_number missing: %', sale; end if;

  receipt_one := (sale->'counter_sale'->>'payment_id')::uuid;
  sale_one := (sale->'counter_sale'->>'invoice_id')::uuid;
  number_one := sale->'counter_sale'->>'receipt_number';
  select count(*) into reg_count from public.counter_receipts where organisation_id = org_one;
  if reg_count <> 1 then raise exception 'S1 register should have exactly one row, got %', reg_count; end if;
  select to_jsonb(t) into row from public.counter_receipts t where organisation_id = org_one;
  if row->>'currency' <> 'MVR' then raise exception 'S1 register currency not derived: %', row; end if;
  if (row->>'tendered_amount')::numeric <> 200 or (row->>'change_amount')::numeric <> 100 then
    raise exception 'S1 register money wrong: %', row;
  end if;
  if (row->>'renders')::integer <> 0 then raise exception 'S1 initial renders not 0: %', row; end if;

  select count(*) into leg_total from public.counter_tenders where organisation_id = org_one;
  if leg_total <> 1 then raise exception 'S1 expected 1 tender leg, got %', leg_total; end if;
  for row in select to_jsonb(t) from public.counter_tenders t where organisation_id = org_one
  loop
    if row->>'payment_method' <> 'cash' or (row->>'amount_tendered')::numeric <> 200
       or (row->>'tender_order')::integer <> 1 or row->>'currency' <> 'MVR' then
      raise exception 'S1 tender leg wrong: %', row;
    end if;
  end loop;

  -- ─────────── DUPLICATE-PROOF RECEIPT: get + renders + distinct sales ───────────
  r_get := public.api_counter_receipt_get(org_one, counter_person, 'counter', receipt_one);
  r_get2 := public.api_counter_receipt_get(org_one, counter_person, 'counter', receipt_one);
  if r_get::text <> r_get2::text then raise exception 'receipt get not idempotent'; end if;
  if (r_get->'receipt'->>'receipt_number') <> number_one then
    raise exception 'get returned wrong number: %', r_get;
  end if;
  if (r_get->'receipt'->>'tendered_amount')::numeric <> 200
     or (r_get->'receipt'->>'change_amount')::numeric <> 100
     or (r_get->'receipt'->>'subtotal')::numeric <> 100
     or (r_get->'receipt'->>'total_amount')::numeric <> 100 then
    raise exception 'S1 receipt money wrong: %', r_get;
  end if;
  if (r_get->'receipt'->>'currency') <> 'MVR' then raise exception 'receipt currency not derived: %', r_get; end if;
  if (r_get->'receipt'->>'renders')::integer <> 0 then raise exception 'get mutated renders: %', r_get; end if;
  if (select count(*) from jsonb_array_elements(r_get->'receipt'->'lines')) <> 1 then
    raise exception 'receipt lines missing: %', r_get;
  end if;
  if (select count(*) from jsonb_array_elements(r_get->'receipt'->'tender')) <> 1 then
    raise exception 'receipt tender legs missing: %', r_get;
  end if;

  perform public.api_counter_receipt_mark_rendered(org_one, counter_person, 'counter', receipt_one, gen_random_uuid());
  perform public.api_counter_receipt_mark_rendered(org_one, counter_person, 'counter', receipt_one, gen_random_uuid());
  r_get := public.api_counter_receipt_get(org_one, counter_person, 'counter', receipt_one);
  if (r_get->'receipt'->>'renders')::integer <> 2 then raise exception 'renders not incremented: %', r_get; end if;
  if (r_get->'receipt'->>'receipt_number') <> number_one then
    raise exception 'reprint minted a NEW receipt number: %', r_get;
  end if;
  if (select count(*) from public.counter_receipts where organisation_id = org_one) <> 1 then
    raise exception 're-rendering minted a second register row';
  end if;

  -- SELL 2: a second sale must mint a DISTINCT number.
  sale := public.api_garage_command(
    org_one, counter_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 100))
    ), gen_random_uuid());
  number_two := sale->'counter_sale'->>'receipt_number';
  if number_two is null or number_two = number_one then
    raise exception 'S2 reused a receipt number: % / %', number_one, sale;
  end if;

  -- ─────────── IDEMPOTENT REPLAY: no double financial consequence ───────────
  command_key := gen_random_uuid();
  command := jsonb_build_object(
    'type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
    'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
    'payment_method', 'cash',
    'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 300)));
  sale := public.api_garage_command(org_one, counter_person, 'counter', command_key, command, gen_random_uuid());
  replay := public.api_garage_command(org_one, counter_person, 'counter', command_key, command, gen_random_uuid());
  if (replay->'counter_sale'->>'receipt_number') <> (sale->'counter_sale'->>'receipt_number') then
    raise exception 'replay minted a NEW receipt: % vs %', sale, replay;
  end if;
  select count(*) into reg_count from public.counter_receipts where organisation_id = org_one;
  if reg_count <> 3 then raise exception 'replay doubled consequence: expected 3, got %', reg_count; end if;

  -- ─────────── NON-MVR TENANT: USD flows through price/legs/register ───────────
  sale := public.api_garage_command(
    org_two, other_counter, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_two,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_b, 'quantity', 1)),
      'payment_method', 'mixed',
      'tender', jsonb_build_array(
        jsonb_build_object('method', 'cash', 'amount_tendered', 50),
        jsonb_build_object('method', 'card', 'amount_tendered', 20))
    ), gen_random_uuid());
  if (sale->'counter_sale'->>'total_amount')::numeric <> 50 then raise exception 'USD total wrong: %', sale; end if;
  if (sale->'counter_sale'->>'tendered_amount')::numeric <> 70 then raise exception 'USD tendered wrong: %', sale; end if;
  if (sale->'counter_sale'->>'change_amount')::numeric <> 20 then raise exception 'USD change wrong: %', sale; end if;
  if sale->'counter_sale'->>'currency' <> 'USD' then raise exception 'USD org did not flow base_currency: %', sale; end if;
  if sale->'counter_sale'->>'payment_method' <> 'mixed' then raise exception 'mixed payment_method not surfaced: %', sale; end if;
  if (select currency from public.counter_receipts where organisation_id = org_two) <> 'USD' then
    raise exception 'USD register currency not derived';
  end if;
  select count(*),
         coalesce(sum(amount_tendered) filter (where payment_method = 'cash'), 0),
         coalesce(sum(amount_tendered) filter (where payment_method = 'card'), 0)
    into leg_total, cash_leg, card_leg
    from public.counter_tenders where organisation_id = org_two;
  if leg_total <> 2 or cash_leg <> 50 or card_leg <> 20 then
    raise exception 'USD tender legs wrong: % / % / %', leg_total, cash_leg, card_leg;
  end if;
  if exists (select 1 from public.counter_tenders where organisation_id = org_two and currency <> 'USD') then
    raise exception 'a tender leg was pinned to a hardcoded currency';
  end if;
  receipt_two := (sale->'counter_sale'->>'payment_id')::uuid;
  r_get := public.api_counter_receipt_get(org_two, other_counter, 'counter', receipt_two);
  if (r_get->'receipt'->>'currency') <> 'USD' then raise exception 'USD read wrong currency: %', r_get; end if;
  if (r_get->'receipt'->>'tendered_amount')::numeric <> 70 then raise exception 'USD read tendered wrong: %', r_get; end if;
  perform public.api_counter_receipt_mark_rendered(org_two, other_counter, 'counter', receipt_two, gen_random_uuid());

  raise notice 'SERP-087 probe POSITIVE PASS: reconciliation, duplicate-proof, replay, USD derivation';

  -- ─────────── FAIL-CLOSED NEGATIVES (each leaves zero residue) ───────────
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, counter_person, 'counter',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'cashish',
        'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 200))),
      'counter_sale_payment_method_invalid');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'counter_sale_payment_method_invalid' then raise; end if;
  end;
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, counter_person, 'counter',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'cash', 'tender', jsonb_build_array()),
      'counter_sale_tender_required');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'counter_sale_tender_required' then raise; end if;
  end;
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, counter_person, 'counter',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'cash',
        'tender', jsonb_build_array(jsonb_build_object('method', 'cheque', 'amount_tendered', 200))),
      'counter_sale_tender_method_invalid');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'counter_sale_tender_method_invalid' then raise; end if;
  end;
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, counter_person, 'counter',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'cash',
        'tender', jsonb_build_array(jsonb_build_object('method', 'cash'))),
      'counter_sale_tender_amount_required');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'counter_sale_tender_amount_required' then raise; end if;
  end;
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, counter_person, 'counter',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'cash',
        'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 0))),
      'counter_sale_tender_amount_positive');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'counter_sale_tender_amount_positive' then raise; end if;
  end;
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, counter_person, 'counter',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'mixed',
        'tender', jsonb_build_array(
          jsonb_build_object('method', 'cash', 'amount_tendered', 50),
          jsonb_build_object('method', 'cash', 'amount_tendered', 60))),
      'counter_sale_duplicate_tender_method');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'counter_sale_duplicate_tender_method' then raise; end if;
  end;
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, counter_person, 'counter',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'cash',
        'tender', jsonb_build_array(
          jsonb_build_object('method', 'card', 'amount_tendered', 50),
          jsonb_build_object('method', 'cash', 'amount_tendered', 60))),
      'counter_sale_single_method_requires_single_tender');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'counter_sale_single_method_requires_single_tender' then raise; end if;
  end;
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, counter_person, 'counter',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'cash',
        'tender', jsonb_build_array(jsonb_build_object('method', 'card', 'amount_tendered', 200))),
      'counter_sale_tender_method_mismatch');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'counter_sale_tender_method_mismatch' then raise; end if;
  end;
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, counter_person, 'counter',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'mixed',
        'tender', jsonb_build_array(jsonb_build_object('method', 'card', 'amount_tendered', 200))),
      'counter_sale_mixed_tender_requires_two_methods');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'counter_sale_mixed_tender_requires_two_methods' then raise; end if;
  end;
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, counter_person, 'counter',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'cash',
        'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 99.99))),
      'counter_sale_tender_insufficient');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'counter_sale_tender_insufficient' then raise; end if;
  end;
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, counter_person, 'counter',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'card',
        'tender', jsonb_build_array(jsonb_build_object('method', 'card', 'amount_tendered', 300))),
      'counter_sale_change_exceeds_cash');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'counter_sale_change_exceeds_cash' then raise; end if;
  end;
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, tech_person, 'technician',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'cash',
        'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 200))),
      'acting_seat_not_legal_for_command');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'acting_seat_not_legal_for_command' then raise; end if;
  end;
  begin
    ignored := pg_temp.expect_sale_error(
      org_one, usd_admin, 'owner',
      jsonb_build_object('type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
        'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
        'payment_method', 'cash',
        'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 200))),
      'seat_not_authorized');
    raise exception 'unexpected_sale_acceptance';
  exception when others then
    if sqlerrm !~ 'seat_not_authorized' then raise; end if;
  end;

  -- Atomicity: none of the 13 rejected sales left a register row or tender leg.
  -- Expected totals: 4 receipts (org_one x3, org_two x1) and 5 tender legs
  -- (org_one x3, org_two x2 — the USD sale is a two-method mixed tender).
  select count(*) into reg_count from public.counter_receipts;
  select count(*) into tnd_count from public.counter_tenders;
  if reg_count <> 4 or tnd_count <> 5 then
    raise exception 'negatives polluted the register/legs: receipts %, tenders % (expect 4 / 5)',
      reg_count, tnd_count;
  end if;

  raise notice 'SERP-087 probe NEGATIVE PASS: 13 fail-closed + atomic, zero residue';

  -- ─────────── RECEIPT SURFACE GATES + SCHEMA DUPLICATE-PROOF ───────────
  begin
    ignored := public.api_counter_receipt_get(org_one, tech_person, 'technician', receipt_one);
    raise exception 'unexpected_receipt_acceptance';
  exception when others then
    if sqlerrm !~ 'seat_not_authorized' then raise; end if;
  end;
  begin
    ignored := public.api_counter_receipt_get(org_two, other_counter, 'counter', receipt_one);
    raise exception 'unexpected_receipt_acceptance';
  exception when others then
    if sqlerrm !~ 'receipt_not_found' then raise; end if;
  end;
  begin
    ignored := public.api_counter_receipt_mark_rendered(org_one, counter_person, 'counter', gen_random_uuid());
    raise exception 'unexpected_receipt_acceptance';
  exception when others then
    if sqlerrm !~ 'receipt_not_found' then raise; end if;
  end;
  begin
    ignored := public.api_counter_receipt_mark_rendered(org_one, tech_person, 'technician', receipt_one);
    raise exception 'unexpected_receipt_acceptance';
  exception when others then
    if sqlerrm !~ 'seat_not_authorized' then raise; end if;
  end;

  -- Register FKs tie legs to the sale and keep tenant scoping.
  if (select organisation_id from public.counter_receipts where receipt_id = receipt_one) <> org_one
     or (select organisation_id from public.counter_tenders
          where receipt_id = receipt_one limit 1) <> org_one then
    raise exception 'register rows lost tenant scoping';
  end if;

  -- Schema-level duplicate-proof: a direct duplicate mint is rejected for BOTH
  -- the receipt_id row identity AND the receipt_number uniqueness. But a random
  -- receipt_id would trip the commercial_documents FOREIGN KEY, not the unique
  -- we are proving — so the number-collision probe reuses an existing document
  -- id (sale_one) to let the unique(org, receipt_number) rule fire cleanly.
  perform pg_temp.expect_register_mint_rejected(
    org_one, receipt_one, sale_one, number_one, 'MVR', 900, 0);
  perform pg_temp.expect_register_mint_rejected(
    org_one, sale_one, sale_one, number_one, 'MVR', 900, 0);
  begin
    insert into public.counter_tenders
      (organisation_id, receipt_id, payment_method, amount_tendered,
       currency, tender_order, recorded_by, recorded_seat)
    values
      (org_one, receipt_one, 'cash', 50, 'MVR', 9, counter_person, 'counter');
    raise exception 'DUPLICATE TENDER LEG ACCEPTED';
  exception when unique_violation then
    null;
  end;

  raise notice 'SERP-087 probe GATES PASS: seat/tenant + schema duplicate-proof';

  raise exception using errcode = 'ZX720', message = 'rollback_serp087_probe';
exception when sqlstate 'ZX720' then
  null;
end
$$;

-- Clean rollback: nothing from the probe may survive.
do $$
begin
  if exists (select 1 from public.persons where person_key like '__serp087_%')
     or exists (select 1 from public.products where sku like 'SERP087-%')
     or exists (select 1 from public.counter_receipts)
     or exists (select 1 from public.counter_tenders)
     or exists (select 1 from public.settlement_allocations
                 where organisation_id = '20000000-0000-4000-8000-000000000001'
                   and allocated_by = '00000000-0000-4000-8000-000000000902')
     or (select base_currency from public.organisations
         where id = '10000000-0000-4000-8000-000000000001') <> 'MVR' then
    raise exception 'SERP-087 probe did not roll back cleanly';
  end if;
  raise notice 'SERP-087 probe: clean rollback confirmed';
end
$$;

commit;