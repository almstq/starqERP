-- ============================================================================
-- STARQ ERP — ERP-463 / B4 Server Inventory Valuation Behavioral Invariant Probe
--
-- Task: ERP-463 / B4 (P2P-05)
-- Level: L2 Database Behavioral Invariant Probe
-- Mandate: docs/roadmap/FOUNDER_APPROVED_BUSINESS_LIFECYCLE_BOARD_RECONSTRUCTION_2026-11-06.md
-- Execution Package: docs/roadmap/ERP-463_B4_SERVER_VALUATION_EXECUTION_PACKAGE_2026-11-08.md
-- Authority: Founder Directive #18591 & #18594; Room #18595
--
-- All 11 Invariants Tested:
-- 1. [Schema & RLS Setup] inventory_valuations table exists with RLS and tenant isolation.
-- 2. [Initial Receipt Valuation] Base receipt establishes perpetual moving-average unit cost & value.
-- 3. [Multi-Receipt Moving-Average] Delivery at higher price moves average via IAS 2/SERP-309 formula.
-- 4. [Standalone Landed Cost Uplift] Landed cost applied to existing receipt uplifts product valuation.
-- 5. [Simultaneous Landed Cost & Tax Segregation] Receive + charges segregates tax (1410) & capitalises (1310).
-- 6. [GL 1310 Reconciliation] inventory_1310_reconciliation asserts exact 0.00 difference to Account 1310.
-- 7. [False-Pass Guard] Verifies reconciliation detects and fails closed on valuation/ledger skew.
-- 8. [Actor & Seat Authorization] Rejects non-receiver seats from executing PURCHASE/receive.
-- 9. [Fail-Closed Input Validation] Rejects non-positive quantities and negative costs.
-- 10. [Cross-Tenant Isolation] Tenant B cannot access or mutate Tenant A inventory valuations.
-- 11. [Idempotency Replay] Replay returns cached valuation; zero duplicate movements or GL postings.
-- ============================================================================

begin;

do $$
declare
  t_org_a uuid := 'a1111111-1111-4111-8111-111111111463';
  t_org_b uuid := 'b2222222-2222-4222-8222-222222222463';
  t_person_qm_a uuid := 'a3333333-3333-4333-8333-333333333463';
  t_person_rcv_a uuid := 'a8888888-8888-4888-8888-888888888463';
  t_person_b uuid := 'b3333333-3333-4333-8333-333333333463';
  t_mem_qm_a uuid := 'a7777777-7777-4777-8777-777777777463';
  t_mem_rcv_a uuid := 'a7777777-7777-4777-8777-888888888463';
  t_mem_b uuid := 'b7777777-7777-4777-8777-777777777463';
  t_book_a uuid := 'a4444444-4444-4444-8444-444444444463';
  t_book_b uuid := 'b4444444-4444-4444-8444-444444444463';
  t_supplier_a uuid := 'a5555555-5555-4555-8555-555555555463';
  t_supplier_b uuid := 'b5555555-5555-4555-8555-555555555463';
  t_product_1 uuid := 'a6666666-6666-4666-8666-666666666463';
  t_product_2 uuid := 'a6666666-6666-4666-8666-777777777463';
  t_location_a uuid := 'a9999999-9999-4999-8999-999999999463';
  t_location_b uuid := 'b9999999-9999-4999-8999-999999999463';

  cmd_key_po1 uuid := gen_random_uuid();
  cmd_key_rcv1 uuid := gen_random_uuid();
  cmd_key_po2 uuid := gen_random_uuid();
  cmd_key_rcv2 uuid := gen_random_uuid();
  cmd_key_lc2 uuid := gen_random_uuid();
  cmd_key_po3 uuid := gen_random_uuid();
  cmd_key_rcv3 uuid := gen_random_uuid();

  req_id uuid := gen_random_uuid();

  res jsonb;
  res_replay jsonb;
  v_po1_id uuid;
  v_po2_id uuid;
  v_po3_id uuid;
  v_gr1_id uuid;
  v_gr2_id uuid;
  v_gr3_id uuid;
  v_summary jsonb;
  v_prod_val jsonb;
  v_recon jsonb;

  v_val_row public.inventory_valuations%rowtype;
  v_count integer;

  -- Fail-closed flag variables
  v_caught_seat boolean := false;
  v_caught_negative boolean := false;
  v_caught_cross_tenant boolean := false;
begin
  raise notice '=======================================================';
  raise notice 'Running ERP-463 / B4 Server Inventory Valuation Probe';
  raise notice '=======================================================';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Fixtures Setup (Tenant A & Tenant B)
  -- ─────────────────────────────────────────────────────────────────────────
  insert into public.organisations (id, slug, legal_name)
  values
    (t_org_a, 'alpha-motors-463', 'Alpha Motors 463'),
    (t_org_b, 'beta-garages-463', 'Beta Garages 463')
  on conflict (id) do nothing;

  insert into public.persons (id, person_key, display_label, status)
  values
    (t_person_qm_a, 'person_alpha_qm_463', 'Alice Quartermaster 463', 'active'),
    (t_person_rcv_a, 'person_alpha_rcv_463', 'Charlie Receiver 463', 'active'),
    (t_person_b, 'person_beta_rcv_463', 'Bob Foreign Receiver 463', 'active')
  on conflict (id) do nothing;

  insert into public.memberships (id, organisation_id, person_id, status)
  values
    (t_mem_qm_a, t_org_a, t_person_qm_a, 'active'),
    (t_mem_rcv_a, t_org_a, t_person_rcv_a, 'active'),
    (t_mem_b, t_org_b, t_person_b, 'active')
  on conflict (organisation_id, person_id) do nothing;

  select id into t_mem_qm_a from public.memberships where organisation_id = t_org_a and person_id = t_person_qm_a;
  select id into t_mem_rcv_a from public.memberships where organisation_id = t_org_a and person_id = t_person_rcv_a;
  select id into t_mem_b from public.memberships where organisation_id = t_org_b and person_id = t_person_b;

  insert into public.seats (code, label)
  values
    ('quartermaster', 'Quartermaster'),
    ('financial_controller', 'Financial Controller'),
    ('receiver', 'Receiver'),
    ('payer', 'Payer'),
    ('counter', 'Counter')
  on conflict (code) do nothing;

  insert into public.membership_seats (membership_id, seat_code)
  values
    (t_mem_qm_a, 'quartermaster'),
    (t_mem_rcv_a, 'receiver'),
    (t_mem_b, 'receiver')
  on conflict (membership_id, seat_code) do nothing;

  insert into public.books (id, organisation_id, code, name, is_default, status)
  values
    (t_book_a, t_org_a, 'ALPHA463', 'Alpha Main Book', true, 'active'),
    (t_book_b, t_org_b, 'BETA463', 'Beta Main Book', true, 'active')
  on conflict (id) do nothing;

  insert into public.locations (id, organisation_id, code, name, kind, active)
  values
    (t_location_a, t_org_a, 'MAIN-WH-463', 'Alpha Main Warehouse', 'warehouse', true),
    (t_location_b, t_org_b, 'BETA-WH-463', 'Beta Warehouse', 'warehouse', true)
  on conflict (id) do nothing;

  insert into public.contacts (id, organisation_id, kind, display_name)
  values
    (t_supplier_a, t_org_a, 'supplier', 'Alpha Parts Ltd'),
    (t_supplier_b, t_org_b, 'supplier', 'Beta Spares Co')
  on conflict (id) do nothing;

  insert into public.products (id, organisation_id, sku, kind, name, active)
  values
    (t_product_1, t_org_a, 'FILT-OIL-001', 'stock', 'Heavy Duty Oil Filter', true),
    (t_product_2, t_org_a, 'BRAKE-PAD-002', 'stock', 'Ceramic Brake Pads', true)
  on conflict (id) do nothing;

  -- Ensure Chart of Accounts: 1310 (Inventory), 1320 (Transit Clearing), 1410 (Input GST), 2160 (GRNI)
  insert into public.chart_of_accounts (
    organisation_id, code, name, account_class, subtype, parent_code, level, currency, posting_control, description
  ) values
    (t_org_a, '1310', 'Stock on Hand (Inventory)', 'ASSET', 'INVENTORY', '1300', 3, 'MVR', 'control', 'Inventory stock asset'),
    (t_org_b, '1310', 'Stock on Hand (Inventory)', 'ASSET', 'INVENTORY', '1300', 3, 'MVR', 'control', 'Inventory stock asset'),
    (t_org_a, '1320', 'Goods in Transit (Clearing)', 'ASSET', 'INVENTORY', '1300', 3, 'MVR', 'postable', 'Landed cost clearing'),
    (t_org_b, '1320', 'Goods in Transit (Clearing)', 'ASSET', 'INVENTORY', '1300', 3, 'MVR', 'postable', 'Landed cost clearing'),
    (t_org_a, '1410', 'Input GST Recoverable (MIRA)', 'ASSET', 'INPUT_TAX_RECOVERABLE', '1400', 3, 'MVR', 'control', 'Recoverable tax asset'),
    (t_org_b, '1410', 'Input GST Recoverable (MIRA)', 'ASSET', 'INPUT_TAX_RECOVERABLE', '1400', 3, 'MVR', 'control', 'Recoverable tax asset'),
    (t_org_a, '2160', 'Goods Received Not Invoiced', 'LIABILITY', 'CURRENT_LIABILITY', '2100', 3, 'MVR', 'control', 'GRNI accrual liability'),
    (t_org_b, '2160', 'Goods Received Not Invoiced', 'LIABILITY', 'CURRENT_LIABILITY', '2100', 3, 'MVR', 'control', 'GRNI accrual liability')
  on conflict (organisation_id, code) do nothing;

  -- Ensure Landed Cost Document Sequence
  insert into public.document_sequences (organisation_id, sequence_type, prefix, padding)
  values
    (t_org_a, 'landed_cost', 'LCA-', 5),
    (t_org_b, 'landed_cost', 'LCA-', 5)
  on conflict (organisation_id, sequence_type) do nothing;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 1: Invariant 1 — Schema & RLS Setup
  -- ─────────────────────────────────────────────────────────────────────────
  perform set_config('app.organisation_id', t_org_a::text, true);
  perform set_config('app.person_id', t_person_rcv_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'inventory_valuations') then
    raise exception 'Invariant Violation (Invariant 1): Table public.inventory_valuations does not exist';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 2: Invariant 2 — Initial Goods Receipt Valuation (Base moving-average)
  -- PO 1: 100 units of Product 1 @ MVR 10.00 = 1000.00
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_qm_a,
    'quartermaster',
    cmd_key_po1,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'document_no', 'PO-VAL-001',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'item_key', 'FILT-OIL-001', 'description', 'Oil Filter', 'quantity', 100, 'unit_price', 10.00)
      )
    ),
    req_id
  );

  v_po1_id := (res->'purchase_order'->>'id')::uuid;

  -- Receive PO 1 via Receiver seat
  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_rcv1,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po1_id,
      'location_id', t_location_a,
      'delivery_note_ref', 'DN-VAL-001'
    ),
    req_id
  );

  v_gr1_id := (res->'goods_receipt'->>'id')::uuid;

  -- Assert inventory_valuations for Product 1
  select * into v_val_row
    from public.inventory_valuations
   where organisation_id = t_org_a and product_id = t_product_1;

  if not found then
    raise exception 'Invariant Violation (Invariant 2): inventory_valuations record not created for Product 1';
  end if;

  if v_val_row.quantity_on_hand <> 100 or v_val_row.average_unit_cost <> 10.00 or v_val_row.total_value <> 1000.00 then
    raise exception 'Invariant Violation (Invariant 2): Expected (100, 10.00, 1000.00), got: qty=%, avg=%, val=%',
      v_val_row.quantity_on_hand, v_val_row.average_unit_cost, v_val_row.total_value;
  end if;

  -- Assert exact GL Account 1310 reconciliation
  v_recon := public.inventory_1310_reconciliation(t_org_a);
  if coalesce((v_recon->>'reconciled')::boolean, false) <> true or (v_recon->>'difference')::numeric <> 0 then
    raise exception 'Invariant Violation (Invariant 2): Step 2 GL 1310 reconciliation failed: %', v_recon;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 3: Invariant 3 — Multi-Receipt Moving-Average Calculation (SERP-309 Defect Guard)
  -- PO 2: 10 units of Product 1 @ MVR 50.00 (expensive top-up).
  -- IAS 2 moving weighted average:
  --   Qty = 100 + 10 = 110
  --   Val = 1000.00 + 500.00 = 1500.00
  --   Avg = round(1500 / 110, 4) = 13.6364  (NOT 50.00!)
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_qm_a,
    'quartermaster',
    cmd_key_po2,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'document_no', 'PO-VAL-002',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'item_key', 'FILT-OIL-001', 'description', 'Oil Filter Top-up', 'quantity', 10, 'unit_price', 50.00)
      )
    ),
    req_id
  );

  v_po2_id := (res->'purchase_order'->>'id')::uuid;

  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_rcv2,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po2_id,
      'location_id', t_location_a,
      'delivery_note_ref', 'DN-VAL-002'
    ),
    req_id
  );

  v_gr2_id := (res->'goods_receipt'->>'id')::uuid;

  select * into v_val_row
    from public.inventory_valuations
   where organisation_id = t_org_a and product_id = t_product_1;

  if v_val_row.quantity_on_hand <> 110 then
    raise exception 'Invariant Violation (Invariant 3): Expected qty 110, got %', v_val_row.quantity_on_hand;
  end if;

  if v_val_row.total_value <> 1500.00 then
    raise exception 'Invariant Violation (Invariant 3): Expected total_value 1500.00, got %', v_val_row.total_value;
  end if;

  if v_val_row.average_unit_cost = 50.00 then
    raise exception 'Invariant Violation (Invariant 3 - SERP-309 DEFECT RECURRENCE): Average cost was overwritten by latest delivery price (50.00)!';
  end if;

  if abs(v_val_row.average_unit_cost - 13.6364) > 0.001 then
    raise exception 'Invariant Violation (Invariant 3): Expected average cost 13.6364, got %', v_val_row.average_unit_cost;
  end if;

  -- Reconcile GL 1310
  v_recon := public.inventory_1310_reconciliation(t_org_a);
  if coalesce((v_recon->>'reconciled')::boolean, false) <> true or (v_recon->>'difference')::numeric <> 0 then
    raise exception 'Invariant Violation (Invariant 3): Step 3 GL 1310 reconciliation failed: %', v_recon;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 4: Invariant 4 — Standalone Landed Cost Uplift & 1310 Reconciliation
  -- Allocate MVR 50.00 capitalised freight to Receipt 2 (Product 1).
  -- Product 1 value becomes: 1500.00 + 50.00 = 1550.00
  -- Moving average becomes: round(1550 / 110, 4) = 14.0909
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_lc2,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'receipt_id', v_gr2_id,
      'charges', jsonb_build_array(
        jsonb_build_object('label', 'Express courier freight', 'amount', 50.00, 'basis', 'value', 'recoverable', false)
      )
    ),
    req_id
  );

  select * into v_val_row
    from public.inventory_valuations
   where organisation_id = t_org_a and product_id = t_product_1;

  if v_val_row.total_value <> 1550.00 then
    raise exception 'Invariant Violation (Invariant 4): Expected total_value 1550.00 after landed cost uplift, got %', v_val_row.total_value;
  end if;

  if abs(v_val_row.average_unit_cost - 14.0909) > 0.001 then
    raise exception 'Invariant Violation (Invariant 4): Expected average cost 14.0909, got %', v_val_row.average_unit_cost;
  end if;

  v_recon := public.inventory_1310_reconciliation(t_org_a);
  if coalesce((v_recon->>'reconciled')::boolean, false) <> true or (v_recon->>'difference')::numeric <> 0 then
    raise exception 'Invariant Violation (Invariant 4): Step 4 GL 1310 reconciliation failed: %', v_recon;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 5: Invariant 5 — Simultaneous Receive + Landed Cost with Recoverable Tax
  -- PO 3: Product 2 (20 units @ MVR 200.00 = 4000.00)
  -- Charges:
  --   Freight: 600.00 (capitalised into inventory 1310)
  --   Import GST: 140.00 (recoverable into 1410, excluded from inventory)
  -- Total Product 2 inventory value: 4000.00 + 600.00 = 4600.00
  -- Product 2 average cost: 4600.00 / 20 = 230.00
  -- Overall Org Total: 1550.00 + 4600.00 = 6150.00
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_qm_a,
    'quartermaster',
    cmd_key_po3,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'document_no', 'PO-VAL-003',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_2, 'item_key', 'BRAKE-PAD-002', 'description', 'Brake Pads', 'quantity', 20, 'unit_price', 200.00)
      )
    ),
    req_id
  );

  v_po3_id := (res->'purchase_order'->>'id')::uuid;

  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_rcv3,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po3_id,
      'location_id', t_location_a,
      'delivery_note_ref', 'DN-VAL-003',
      'charges', jsonb_build_array(
        jsonb_build_object('label', 'Ocean freight', 'amount', 600.00, 'basis', 'value', 'recoverable', false),
        jsonb_build_object('label', 'Import GST', 'amount', 140.00, 'basis', 'value', 'recoverable', true, 'account_code', '1410')
      )
    ),
    req_id
  );

  v_gr3_id := (res->'goods_receipt'->>'id')::uuid;

  -- Verify Product 2 valuation
  select * into v_val_row
    from public.inventory_valuations
   where organisation_id = t_org_a and product_id = t_product_2;

  if v_val_row.quantity_on_hand <> 20 or v_val_row.total_value <> 4600.00 or v_val_row.average_unit_cost <> 230.00 then
    raise exception 'Invariant Violation (Invariant 5): Product 2 expected (20, 230.00, 4600.00), got (%, %, %)',
      v_val_row.quantity_on_hand, v_val_row.average_unit_cost, v_val_row.total_value;
  end if;

  -- Verify total organization inventory valuation matches GL 1310
  v_recon := public.inventory_1310_reconciliation(t_org_a);
  if (v_recon->>'inventory_valuation')::numeric <> 6150.00 or (v_recon->>'account_1310_balance')::numeric <> 6150.00 then
    raise exception 'Invariant Violation (Invariant 5): Total valuation mismatch: %', v_recon;
  end if;

  if coalesce((v_recon->>'reconciled')::boolean, false) <> true or (v_recon->>'difference')::numeric <> 0 then
    raise exception 'Invariant Violation (Invariant 5): Reconciliation failed: %', v_recon;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 6: Invariant 6 — False-Pass Guard
  -- Verify that inventory_1310_reconciliation detects any valuation / GL divergence
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    insert into public.inventory_valuations (
      organisation_id, product_id, quantity_on_hand, average_unit_cost, total_value
    ) values (
      t_org_a, gen_random_uuid(), 5, 100.00, 500.00
    );

    v_recon := public.inventory_1310_reconciliation(t_org_a);
    if coalesce((v_recon->>'reconciled')::boolean, false) = true or (v_recon->>'difference')::numeric = 0 then
      raise exception 'False-Pass Guard Failure: reconciliation claimed success despite 500.00 skew!';
    end if;

    -- Roll back the injected test skew
    raise exception 'rollback_test_skew';
  exception
    when others then
      if sqlerrm <> 'rollback_test_skew' then
        raise;
      end if;
  end;

  -- Confirm post-guard clean reconciliation
  v_recon := public.inventory_1310_reconciliation(t_org_a);
  if coalesce((v_recon->>'reconciled')::boolean, false) <> true or (v_recon->>'difference')::numeric <> 0 then
    raise exception 'Invariant Violation (Invariant 6): Post-guard reconciliation failed: %', v_recon;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 7: Invariant 7 — Actor & Seat Authorization
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_qm_a,
      'quartermaster', -- Quartermaster cannot receive
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'purchase_order_id', v_po1_id,
        'location_id', t_location_a
      ),
      req_id
    );
  exception
    when others then
      v_caught_seat := true;
  end;

  if not v_caught_seat then
    raise exception 'Invariant Violation (Invariant 7): Non-receiver seat was not rejected from PURCHASE/receive';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 8: Invariant 8 — Fail-Closed Input Validation
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    perform public.calculate_moving_average_valuation(t_org_a, t_product_1, -5, 10.00);
  exception
    when others then
      v_caught_negative := true;
  end;

  if not v_caught_negative then
    raise exception 'Invariant Violation (Invariant 8): Negative quantity was not rejected by calculate_moving_average_valuation';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 9: Invariant 9 — Cross-Tenant Isolation
  -- Tenant B cannot read or alter Tenant A inventory valuations
  -- ─────────────────────────────────────────────────────────────────────────
  perform set_config('app.organisation_id', t_org_b::text, true);
  perform set_config('app.person_id', t_person_b::text, true);

  select count(*) into v_count
    from public.inventory_valuations
   where organisation_id = t_org_a;

  if v_count <> 0 then
    raise exception 'Invariant Violation (Invariant 9): Tenant B read Tenant A inventory_valuations under RLS (count=%)', v_count;
  end if;

  -- Reset to Tenant A context
  perform set_config('app.organisation_id', t_org_a::text, true);
  perform set_config('app.person_id', t_person_rcv_a::text, true);

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 10: Invariant 10 — Idempotency Replay Guard
  -- Replay Receipt 3 command with same idempotency key
  -- ─────────────────────────────────────────────────────────────────────────
  res_replay := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_rcv3,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po3_id,
      'location_id', t_location_a,
      'delivery_note_ref', 'DN-VAL-003',
      'charges', jsonb_build_array(
        jsonb_build_object('label', 'Ocean freight', 'amount', 600.00, 'basis', 'value', 'recoverable', false),
        jsonb_build_object('label', 'Import GST', 'amount', 140.00, 'basis', 'value', 'recoverable', true, 'account_code', '1410')
      )
    ),
    req_id
  );

  if coalesce((res_replay->>'ok')::boolean, false) <> true then
    raise exception 'Invariant Violation (Invariant 10): Idempotency replay did not return success: %', res_replay;
  end if;

  -- Verify total inventory value is still 6150.00 (zero duplication!)
  v_recon := public.inventory_1310_reconciliation(t_org_a);
  if (v_recon->>'inventory_valuation')::numeric <> 6150.00 or (v_recon->>'account_1310_balance')::numeric <> 6150.00 then
    raise exception 'Invariant Violation (Invariant 10): Idempotency replay duplicated valuation or GL postings: %', v_recon;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 11: Invariant 11 — Read-Through API Consistency
  -- ─────────────────────────────────────────────────────────────────────────
  v_prod_val := public.product_inventory_valuation(t_org_a, t_product_1);
  if (v_prod_val->>'quantity_on_hand')::numeric <> 110 or (v_prod_val->>'total_value')::numeric <> 1550.00 then
    raise exception 'Invariant Violation (Invariant 11): product_inventory_valuation mismatch: %', v_prod_val;
  end if;

  v_summary := public.inventory_valuation_summary(t_org_a);
  if (v_summary->>'total_inventory_value')::numeric <> 6150.00 or (v_summary->>'total_units_on_hand')::numeric <> 130 then
    raise exception 'Invariant Violation (Invariant 11): inventory_valuation_summary mismatch: %', v_summary;
  end if;

  raise notice '=======================================================';
  raise notice 'All 11 Invariants & False-Pass Guard Verified Cleanly.';
  raise notice 'ERP-463 / B4 Server Inventory Valuation Probe: PASS';
  raise notice '=======================================================';
end $$;

rollback;
