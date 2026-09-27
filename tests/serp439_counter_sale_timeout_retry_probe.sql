-- tests/serp439_counter_sale_timeout_retry_probe.sql
-- SERP-439 — executable synthetic DB probe: COUNTER_SALE client-perceived
-- timeout / lost-response retry simulation against disposable PostgreSQL.
--
-- Gap being closed (from SERP-091 adversarial gap #2): SERP-090/091 proved
-- idempotent replay and conflict on the RESPONSE contract (same invoice_id,
-- on-hand unchanged) and proved reversal idempotency. Neither counted the full
-- side-effect SET on a COUNTER_SALE retry.
--
-- Simulation of a client-perceived timeout, not a fault injection:
--   1. First COUNTER_SALE call is executed and COMMITTED. Its response is
--      deliberately discarded by the "client" - it never reaches the caller.
--      That is exactly what a lost/delayed response looks like to a client.
--   2. The client retries the IDENTICAL command with the SAME idempotency key,
--      as a real client would after a timeout.
--   3. We then count EVERY persisted side-effect family, not just the returned
--      invoice id, and assert each count is exactly 1 — not zero, not 2.
--
-- Asserted side-effect families (one row each, exactly):
--   invoice        public.commercial_documents      document_type='sales_invoice'
--   invoice lines  public.commercial_document_lines for that invoice
--   stock issue    public.stock_movements           source_type='COUNTER_SALE'
--   tender         public.counter_tenders
--   receipt        public.counter_receipts
--   audit          public.audit_events              action='erp.counter_sale'
--   outbox         public.transactional_outbox      event_type='COUNTER_SALE'
--   plus: payment document, settlement allocation, idempotency-key row.
--
-- Also asserted: retry with a DIFFERENT payload under the same key fails closed
-- with idempotency_key_conflict, and leaves every count untouched.
--
-- NON-VACUITY: the probe proves it can detect duplication. Section 5 executes a
-- SECOND, genuinely distinct sale (fresh key) and asserts every count rises to
-- exactly 2 — so a green Section 3 means "idempotency suppressed the second
-- set", not "the counting finds nothing".
--
-- Clean rollback: everything runs inside a single transaction that is rolled
-- back at the end, leaving no residue.
--
-- Test authorship only. No production behaviour change. Expected to FAIL if
-- the system is broken — that is the point.

begin;

create or replace function pg_temp.expect_garage_err(
  p_org uuid, p_person uuid, p_seat text, p_key uuid, p_cmd jsonb, p_expected text
) returns void language plpgsql as $$
begin
  perform public.api_garage_command(p_org, p_person, p_seat, p_key, p_cmd, gen_random_uuid());
  raise exception 'EXPECTED ERROR % BUT CALL SUCCEEDED', p_expected;
exception when others then
  if SQLERRM not like '%' || p_expected || '%' then
    raise exception 'EXPECTED ERROR % BUT GOT %', p_expected, SQLERRM;
  end if;
end;
$$;

do $$
declare
  v_org uuid := gen_random_uuid();
  v_loc uuid := gen_random_uuid();
  v_person uuid := gen_random_uuid();

  v_role_counter uuid := gen_random_uuid();
  v_m1 uuid := gen_random_uuid();

  v_prod_1 uuid := gen_random_uuid();
  v_prod_2 uuid := gen_random_uuid();

  v_sale_key uuid := gen_random_uuid();
  v_second_key uuid := gen_random_uuid();

  v_res jsonb;            -- deliberately discarded once, to model a lost response
  v_invoice uuid;
  v_payment uuid;
  v_cmd jsonb;

  v_c_invoice bigint;
  v_c_lines bigint;
  v_c_stock bigint;
  v_c_tender bigint;
  v_c_receipt bigint;
  v_c_audit bigint;
  v_c_outbox bigint;
  v_c_payment bigint;
  v_c_settlement bigint;
  v_c_idem bigint;
  v_onhand numeric;
begin
  -- ───────────────────────────────────────────────────────────────────────────
  -- 1. Setup — minimal org / location / person / seat / product / price / stock
  -- ───────────────────────────────────────────────────────────────────────────
  insert into public.organisations (id, slug, legal_name, base_currency, status)
  values (v_org, 'probe-serp439-mvr', 'SERP-439 MVR Org', 'MVR', 'active');

  insert into public.locations (id, organisation_id, code, name, kind, active)
  values (v_loc, v_org, 'LOC-1', 'Location 1', 'office', true);

  insert into public.persons (id, person_key, display_label, status)
  values (v_person, 'probe:serp439:counter', 'Cashier', 'active');

  insert into public.roles (id, organisation_id, code, name)
  values (v_role_counter, v_org, 'counter', 'Counter Role');

  insert into public.memberships (id, organisation_id, person_id, role_id, status)
  values (v_m1, v_org, v_person, v_role_counter, 'active');

  insert into public.membership_seats (membership_id, seat_code)
  values (v_m1, 'counter');

  insert into public.products (id, organisation_id, sku, name, kind, active, sale_allowed)
  values
    (v_prod_1, v_org, 'PROD-1', 'Product 1', 'stock', true, true),
    (v_prod_2, v_org, 'PROD-2', 'Product 2', 'stock', true, true);

  insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from)
  values
    (v_org, v_prod_1, 'MVR', 50.00, now() - interval '1 day'),
    (v_org, v_prod_2, 'MVR', 100.00, now() - interval '1 day');

  insert into public.tax_registrations (organisation_id, tax_type, registration_status, effective_from)
  values (v_org, 'gst_general', 'registered', '2020-01-01');

  insert into public.stock_movements (
    organisation_id, location_id, product_id, movement_type,
    quantity, unit_cost, source_type, source_id, idempotency_key, occurred_at, recorded_by
  ) values
    (v_org, v_loc, v_prod_1, 'opening', 20, 30.00, 'OPENING_BALANCE', gen_random_uuid(), gen_random_uuid(), now() - interval '2 hours', v_person),
    (v_org, v_loc, v_prod_2, 'opening', 20, 50.00, 'OPENING_BALANCE', gen_random_uuid(), gen_random_uuid(), now() - interval '2 hours', v_person);

  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_1);
  if v_onhand <> 20 then
    raise exception 'SETUP FAILED: initial on-hand should be 20, got %', v_onhand;
  end if;

  -- The exact command the "client" sends, before the response is lost.
  v_cmd := jsonb_build_object(
    'type', 'COUNTER_SALE',
    'location_id', v_loc,
    'tax_mode', 'zero_rated',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 5)),
    'payment_method', 'cash',
    'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 250))
  );

  -- ───────────────────────────────────────────────────────────────────────────
  -- 2. THE TIMEOUT. Call #1 executes and commits. The client never sees the
  --    response, so it is discarded here. This is the simulated lost/delayed
  --    response — the server-side effect is complete, the client knows nothing.
  -- ───────────────────────────────────────────────────────────────────────────
  v_res := public.api_garage_command(v_org, v_person, 'counter', v_sale_key, v_cmd, gen_random_uuid());
  if (v_res->>'ok')::boolean is not true then
    raise exception 'SETUP FAILED: first COUNTER_SALE must succeed, got %', v_res;
  end if;
  v_invoice := (v_res->'counter_sale'->>'invoice_id')::uuid;
  v_payment := (v_res->'counter_sale'->>'payment_id')::uuid;
  v_res := null;  -- RESPONSE LOST. The client has only the idempotency key.

  raise notice 'SERP439: call #1 committed, response discarded to the client';

  -- ───────────────────────────────────────────────────────────────────────────
  -- 3. THE RETRY. Same key, same payload, exactly as a real client retries
  --    after a timeout. Must be served from the idempotency record.
  -- ───────────────────────────────────────────────────────────────────────────
  v_res := public.api_garage_command(v_org, v_person, 'counter', v_sale_key, v_cmd, gen_random_uuid());
  if (v_res->>'ok')::boolean is not true or v_res->>'state' <> 'accepted' then
    raise exception 'TEST 1 FAILED: retry after lost response must succeed as accepted, got %', v_res;
  end if;
  if (v_res->'counter_sale'->>'invoice_id')::uuid <> v_invoice then
    raise exception 'TEST 1 FAILED: retry returned a different invoice_id - the original sale was not replayed';
  end if;

  raise notice 'SERP439: retry returned the original invoice, no new work claimed';

  -- ───────────────────────────────────────────────────────────────────────────
  -- 4. EXACTLY-ONCE SIDE-EFFECT AUDIT. Every persisted family counted, and
  --    each must be exactly 1. Not zero (retry did nothing), not 2 (duplicated).
  -- ───────────────────────────────────────────────────────────────────────────
  select count(*) into v_c_invoice from public.commercial_documents
   where organisation_id = v_org and document_type = 'sales_invoice'
     and metadata->>'counter_sale' = 'true';
  if v_c_invoice <> 1 then
    raise exception 'TEST 2 FAILED: expected exactly 1 counter-sale invoice, got %', v_c_invoice;
  end if;

  select count(*) into v_c_lines from public.commercial_document_lines
   where organisation_id = v_org and document_id = v_invoice;
  if v_c_lines <> 1 then
    raise exception 'TEST 2 FAILED: expected exactly 1 invoice line, got %', v_c_lines;
  end if;

  select count(*) into v_c_stock from public.stock_movements
   where organisation_id = v_org and source_type = 'COUNTER_SALE' and source_id = v_invoice;
  if v_c_stock <> 1 then
    raise exception 'TEST 2 FAILED: expected exactly 1 stock issue movement, got %', v_c_stock;
  end if;

  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_1);
  if v_onhand <> 15 then
    raise exception 'TEST 2 FAILED: on-hand should be 15 (issued once), got %', v_onhand;
  end if;

  select count(*) into v_c_payment from public.commercial_documents
   where organisation_id = v_org and document_type = 'receipt' and id = v_payment;
  if v_c_payment <> 1 then
    raise exception 'TEST 2 FAILED: expected exactly 1 receipt payment document, got %', v_c_payment;
  end if;

  select count(*) into v_c_tender from public.counter_tenders
   where organisation_id = v_org and receipt_id = v_payment;
  if v_c_tender <> 1 then
    raise exception 'TEST 2 FAILED: expected exactly 1 tender leg, got %', v_c_tender;
  end if;

  select count(*) into v_c_receipt from public.counter_receipts
   where organisation_id = v_org and receipt_id = v_payment;
  if v_c_receipt <> 1 then
    raise exception 'TEST 2 FAILED: expected exactly 1 receipt register row, got %', v_c_receipt;
  end if;

  select count(*) into v_c_settlement from public.settlement_allocations
   where organisation_id = v_org and payment_document_id = v_payment
     and settled_document_id = v_invoice;
  if v_c_settlement <> 1 then
    raise exception 'TEST 2 FAILED: expected exactly 1 settlement allocation, got %', v_c_settlement;
  end if;

  select count(*) into v_c_audit from public.audit_events
   where organisation_id = v_org and action = 'erp.counter_sale';
  if v_c_audit <> 1 then
    raise exception 'TEST 2 FAILED: expected exactly 1 audit event, got %', v_c_audit;
  end if;

  select count(*) into v_c_outbox from public.transactional_outbox
   where organisation_id = v_org and event_type = 'COUNTER_SALE';
  if v_c_outbox <> 1 then
    raise exception 'TEST 2 FAILED: expected exactly 1 outbox event, got %', v_c_outbox;
  end if;

  select count(*) into v_c_idem from public.idempotency_keys
   where organisation_id = v_org and key = v_sale_key;
  if v_c_idem <> 1 then
    raise exception 'TEST 2 FAILED: expected exactly 1 idempotency key row, got %', v_c_idem;
  end if;

  raise notice 'SERP439: exactly-once confirmed across invoice/lines/stock/tender/receipt/settlement/audit/outbox';

  -- ───────────────────────────────────────────────────────────────────────────
  -- 5. NON-VACUITY. A genuinely distinct second sale (different key) MUST
  --    raise every count to exactly 2. If this does not hold, the counts in
  --    Section 4 are not measuring what they claim to measure.
  -- ───────────────────────────────────────────────────────────────────────────
  perform public.api_garage_command(
    v_org, v_person, 'counter', v_second_key,
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 5)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 250))
    ),
    gen_random_uuid()
  );

  select count(*) into v_c_invoice from public.commercial_documents
   where organisation_id = v_org and document_type = 'sales_invoice'
     and metadata->>'counter_sale' = 'true';
  if v_c_invoice <> 2 then
    raise exception 'TEST 3 FAILED (probe is vacuous): a distinct second sale must yield 2 invoices, got %', v_c_invoice;
  end if;

  select count(*) into v_c_stock from public.stock_movements
   where organisation_id = v_org and source_type = 'COUNTER_SALE';
  if v_c_stock <> 2 then
    raise exception 'TEST 3 FAILED (probe is vacuous): expected 2 stock issues after two distinct sales, got %', v_c_stock;
  end if;

  select count(*) into v_c_receipt from public.counter_receipts
   where organisation_id = v_org;
  if v_c_receipt <> 2 then
    raise exception 'TEST 3 FAILED (probe is vacuous): expected 2 receipt rows, got %', v_c_receipt;
  end if;

  select count(*) into v_c_outbox from public.transactional_outbox
   where organisation_id = v_org and event_type = 'COUNTER_SALE';
  if v_c_outbox <> 2 then
    raise exception 'TEST 3 FAILED (probe is vacuous): expected 2 outbox events, got %', v_c_outbox;
  end if;

  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_1);
  if v_onhand <> 10 then
    raise exception 'TEST 3 FAILED: on-hand should be 10 after two distinct sales, got %', v_onhand;
  end if;

  raise notice 'SERP439: non-vacuity proven - counters do detect a second distinct sale';

  -- ───────────────────────────────────────────────────────────────────────────
  -- 6. FAIL-CLOSED on a different payload under the same key, and the failure
  --    must not have moved any counter.
  -- ───────────────────────────────────────────────────────────────────────────
  perform pg_temp.expect_garage_err(
    v_org, v_person, 'counter', v_sale_key,
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 2)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 100))
    ),
    'idempotency_key_conflict'
  );

  select count(*) into v_c_invoice from public.commercial_documents
   where organisation_id = v_org and document_type = 'sales_invoice'
     and metadata->>'counter_sale' = 'true';
  if v_c_invoice <> 2 then
    raise exception 'TEST 4 FAILED: a conflicting replay must not mint an invoice, count is %', v_c_invoice;
  end if;

  select count(*) into v_c_stock from public.stock_movements
   where organisation_id = v_org and source_type = 'COUNTER_SALE';
  if v_c_stock <> 2 then
    raise exception 'TEST 4 FAILED: a conflicting replay must not move stock, count is %', v_c_stock;
  end if;

  raise notice 'SERP439: conflicting payload under same key failed closed, counters unmoved';
end
$$;

rollback;
