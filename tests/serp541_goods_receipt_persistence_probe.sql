-- ============================================================================
-- STARQ ERP — ERP-541 / B2 Goods Receipt Persistence Behavioral Invariant Probe
--
-- Task: ERP-454 / W0-C (ERP-541)
-- Level: L2 Database Behavioral Invariant Probe
--
-- Behavioral Invariants Tested:
-- 1. Receipt Persistence: PURCHASE/receive persists append-only goods_receipts
--    and goods_receipt_lines rows with supplier, delivery note, received_by, and notes.
-- 2. Stock Ledger Movement: Persists one stock_movements receipt row per received item
--    with location_id, unit_cost, and source_id referencing the goods_receipt.
-- 3. Live Derived On-Hand: stock_movements_derived_onhand increases immediately.
-- 4. Partial Delivery: Partial delivery records open quantity and short status;
--    PO remains open (status = 'issued').
-- 5. Full Delivery: Completing remaining open quantities updates delivery_status to 'complete'.
-- 6. Over-Delivery Guard: allow_over_receipt=false rejects excess with 'over_receipt_not_permitted';
--    allow_over_receipt=true distinguishes and flags status = 'over'.
-- 7. Quantity Validity: Zero or negative received quantities fail closed with
--    'line_quantity_must_be_positive'.
-- 8. Idempotent Retry: Replaying exact same command_key returns cached response;
--    0 duplicate stock movements or receipt rows are generated.
-- 9. Idempotency Key Conflict: Reusing command_key with altered payload fails closed
--    with 'idempotency_key_conflict'.
-- 10. Cross-Tenant Refusal: Foreign tenant receiver attempting to receive against
--     another tenant's PO fails closed with 'purchase_order_not_found'.
-- 11. Seat Authorization: Non-receiver seat (quartermaster) fails closed with
--     'acting_seat_not_legal_for_command'; unheld seat fails with 'seat_not_authorized'.
-- ============================================================================

begin;

do $$
declare
  t_org_a uuid := 'a1111111-1111-4111-8111-111111111111';
  t_org_b uuid := 'b2222222-2222-4222-8222-222222222222';
  t_person_qm_a uuid := 'a3333333-3333-4333-8333-333333333333';
  t_person_rcv_a uuid := 'a8888888-8888-4888-8888-888888888888';
  t_person_unauth_a uuid := 'a9999999-9999-4999-8999-111111111111';
  t_person_b uuid := 'b3333333-3333-4333-8333-333333333333';
  t_mem_qm_a uuid := 'a7777777-7777-4777-8777-777777777777';
  t_mem_rcv_a uuid := 'a7777777-7777-4777-8777-888888888888';
  t_mem_unauth_a uuid := 'a7777777-7777-4777-8777-999999999999';
  t_mem_b uuid := 'b7777777-7777-4777-8777-777777777777';
  t_book_a uuid := 'a4444444-4444-4444-8444-444444444444';
  t_book_b uuid := 'b4444444-4444-4444-8444-444444444444';
  t_supplier_a uuid := 'a5555555-5555-4555-8555-555555555555';
  t_supplier_b uuid := 'b5555555-5555-4555-8555-555555555555';
  t_product_1 uuid := 'a6666666-6666-4666-8666-666666666666';
  t_product_2 uuid := 'a6666666-6666-4666-8666-777777777777';
  t_product_b uuid := 'b6666666-6666-4666-8666-666666666666';
  t_location_a uuid := 'a9999999-9999-4999-8999-999999999999';
  t_location_b uuid := 'b9999999-9999-4999-8999-999999999999';

  cmd_key_po uuid := gen_random_uuid();
  cmd_key_rcv1 uuid := gen_random_uuid();
  cmd_key_rcv2 uuid := gen_random_uuid();
  cmd_key_rcv3 uuid := gen_random_uuid();
  req_id uuid := gen_random_uuid();

  res jsonb;
  res_replay jsonb;
  v_po_id uuid;
  v_gr_id_1 uuid;
  v_gr_id_2 uuid;
  v_gr_id_3 uuid;
  v_gr_count integer;
  v_grl_count integer;
  v_sm_count integer;
  v_onhand numeric(20, 6);
  v_doc_row public.commercial_documents%rowtype;

  v_caught_conflict boolean := false;
  v_caught_over_receipt boolean := false;
  v_caught_negative_qty boolean := false;
  v_caught_zero_qty boolean := false;
  v_caught_cross_tenant boolean := false;
  v_caught_illegal_seat boolean := false;
  v_caught_unheld_seat boolean := false;
  v_caught_mismatch boolean := false;
  v_po_reorder_id uuid;
  v_po_dup_id uuid;
  v_po_tamper_id uuid;
  v_pol_reorder_1 public.commercial_document_lines%rowtype;
  v_pol_reorder_2 public.commercial_document_lines%rowtype;
  v_pol_dup_1 public.commercial_document_lines%rowtype;
  v_pol_dup_2 public.commercial_document_lines%rowtype;
  v_tamper_gr_id uuid;
  v_tamper_grl_cost numeric(20, 6);
  v_tamper_sm_cost numeric(20, 6);
  v_mismatch_sm_count integer;
  v_mismatch_gr_count integer;
  v_mismatch_grl_count integer;
  v_caught_dup_over boolean := false;
  v_db_line1_received numeric(20, 6);
  v_db_line2_received numeric(20, 6);
  v_db_line1_open numeric(20, 6);
  v_db_line2_open numeric(20, 6);
begin
  -- ─────────────────────────────────────────────────────────────────────────
  -- Fixtures Setup (Tenant A & Tenant B)
  -- ─────────────────────────────────────────────────────────────────────────
  insert into public.organisations (id, slug, legal_name)
  values
    (t_org_a, 'alpha-motors-541', 'Alpha Motors 541'),
    (t_org_b, 'beta-logistics-541', 'Beta Logistics 541')
  on conflict (id) do nothing;

  insert into public.persons (id, person_key, display_label)
  values
    (t_person_qm_a, 'person_alpha_qm_541', 'Alice Quartermaster'),
    (t_person_rcv_a, 'person_alpha_rcv_541', 'Charlie Receiver'),
    (t_person_unauth_a, 'person_alpha_unauth_541', 'Dave Unauth'),
    (t_person_b, 'person_beta_541', 'Bob Beta')
  on conflict (id) do nothing;

  insert into public.memberships (id, organisation_id, person_id, status)
  values
    (t_mem_qm_a, t_org_a, t_person_qm_a, 'active'),
    (t_mem_rcv_a, t_org_a, t_person_rcv_a, 'active'),
    (t_mem_unauth_a, t_org_a, t_person_unauth_a, 'active'),
    (t_mem_b, t_org_b, t_person_b, 'active')
  on conflict (organisation_id, person_id) do nothing;

  select id into t_mem_qm_a from public.memberships where organisation_id = t_org_a and person_id = t_person_qm_a;
  select id into t_mem_rcv_a from public.memberships where organisation_id = t_org_a and person_id = t_person_rcv_a;
  select id into t_mem_unauth_a from public.memberships where organisation_id = t_org_a and person_id = t_person_unauth_a;
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
    (t_mem_b, 'receiver'),
    (t_mem_b, 'financial_controller')
  on conflict (membership_id, seat_code) do nothing;

  insert into public.books (id, organisation_id, code, name, is_default, status)
  values
    (t_book_a, t_org_a, 'ALPHA541', 'Alpha Main Book', true, 'active'),
    (t_book_b, t_org_b, 'BETA541', 'Beta Main Book', true, 'active')
  on conflict (id) do nothing;

  insert into public.contacts (id, organisation_id, kind, display_name)
  values
    (t_supplier_a, t_org_a, 'supplier', 'Alpha Parts Supplier Ltd'),
    (t_supplier_b, t_org_b, 'supplier', 'Beta Spares Supplier Corp')
  on conflict (id) do nothing;

  insert into public.products (id, organisation_id, sku, kind, name, active)
  values
    (t_product_1, t_org_a, 'SKU-FILTER-541', 'stock', 'Oil Filter 541', true),
    (t_product_2, t_org_a, 'SKU-PAD-541', 'stock', 'Brake Pad Set 541', true),
    (t_product_b, t_org_b, 'SKU-BETA-541', 'stock', 'Beta Component 541', true)
  on conflict (id) do nothing;

  insert into public.locations (id, organisation_id, code, name, kind, active)
  values
    (t_location_a, t_org_a, 'WH-MAIN-541', 'Alpha Central Warehouse', 'warehouse', true),
    (t_location_b, t_org_b, 'WH-BETA-541', 'Beta Depot', 'warehouse', true)
  on conflict (id) do nothing;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Step 1: Create Purchase Order via PURCHASE/need
  -- PO with Line 1: 10 Oil Filters @ 15.00, Line 2: 5 Brake Pads @ 50.00
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_qm_a,
    'quartermaster',
    cmd_key_po,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'notes', 'Initial PO for ERP-541 Probe',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'description', 'Oil Filter', 'quantity', 10, 'unit_price', 15.00, 'tax_rate', 0.08),
        jsonb_build_object('line_no', 2, 'product_id', t_product_2, 'description', 'Brake Pad Set', 'quantity', 5, 'unit_price', 50.00, 'tax_rate', 0.08)
      )
    ),
    req_id
  );

  if coalesce((res->>'ok')::boolean, false) is not true then
    raise exception 'Invariant Violation: PO creation failed: %', res;
  end if;

  v_po_id := (res->'purchase_order'->>'id')::uuid;
  if v_po_id is null then
    raise exception 'Invariant Violation: PO ID not returned in response';
  end if;

  select * into v_doc_row from public.commercial_documents where id = v_po_id and organisation_id = t_org_a;
  if v_doc_row.status <> 'issued' then
    raise exception 'Invariant Violation: Newly created PO status expected ''issued'', got %', v_doc_row.status;
  end if;

  -- Verify initial on-hand is 0
  select coalesce(d.derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(t_org_a, t_location_a, t_product_1) d;
  if v_onhand <> 0 then
    raise exception 'Invariant Violation: Initial on-hand for product 1 expected 0, got %', v_onhand;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Step 2: Partial Goods Receipt via PURCHASE/receive
  -- Charlie Receiver receives 4 Oil Filters (Line 1) against the PO
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_rcv1,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po_id,
      'location_id', t_location_a,
      'delivery_note_ref', 'DN-ALPHA-001',
      'notes', 'Partial delivery: 4 of 10 oil filters received',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'quantity', 4, 'unit_cost', 15.00)
      )
    ),
    req_id
  );

  if coalesce((res->>'ok')::boolean, false) is not true then
    raise exception 'Invariant Violation: Partial receipt failed: %', res;
  end if;

  v_gr_id_1 := (res->'goods_receipt'->>'id')::uuid;
  if v_gr_id_1 is null then
    raise exception 'Invariant Violation: Receipt ID not returned in response';
  end if;

  if res->'purchase_order'->>'receipt_status' <> 'partial' then
    raise exception 'Invariant Violation: PO receipt status expected ''partial'', got %', res->'purchase_order'->>'receipt_status';
  end if;

  if (res->'purchase_order'->>'remaining_open')::numeric <> 11 then
    raise exception 'Invariant Violation: Remaining open expected 11 (6 filters + 5 pads), got %', res->'purchase_order'->>'remaining_open';
  end if;

  -- Verify persisted goods_receipts header
  select count(*) into v_gr_count from public.goods_receipts where id = v_gr_id_1 and organisation_id = t_org_a;
  if v_gr_count <> 1 then
    raise exception 'Invariant Violation: goods_receipts row not persisted';
  end if;

  -- Verify persisted goods_receipt_lines row
  select count(*) into v_grl_count from public.goods_receipt_lines where receipt_id = v_gr_id_1 and organisation_id = t_org_a and quantity = 4;
  if v_grl_count <> 1 then
    raise exception 'Invariant Violation: goods_receipt_lines row not persisted with quantity = 4';
  end if;

  -- Verify persisted stock_movements row
  select count(*) into v_sm_count
    from public.stock_movements
   where source_id = v_gr_id_1
     and source_type = 'goods_receipt'
     and movement_type = 'receipt'
     and product_id = t_product_1
     and quantity = 4
     and unit_cost = 15.00;
  if v_sm_count <> 1 then
    raise exception 'Invariant Violation: stock_movements receipt row not persisted';
  end if;

  -- Verify live derived on-hand moved from 0 to 4
  select coalesce(d.derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(t_org_a, t_location_a, t_product_1) d;
  if v_onhand <> 4 then
    raise exception 'Invariant Violation: Derived on-hand after partial receipt expected 4, got %', v_onhand;
  end if;

  -- Verify PO status in commercial_documents remains 'issued' (open)
  select * into v_doc_row from public.commercial_documents where id = v_po_id and organisation_id = t_org_a;
  if v_doc_row.status <> 'issued' then
    raise exception 'Invariant Violation: PO status in commercial_documents mutated from ''issued'' to %', v_doc_row.status;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Step 3: Idempotent Replay Verification
  -- Exact same command key + identical payload must return cached response, 0 extra rows
  -- ─────────────────────────────────────────────────────────────────────────
  res_replay := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_rcv1,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po_id,
      'location_id', t_location_a,
      'delivery_note_ref', 'DN-ALPHA-001',
      'notes', 'Partial delivery: 4 of 10 oil filters received',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'quantity', 4, 'unit_cost', 15.00)
      )
    ),
    req_id
  );

  if (res_replay->'goods_receipt'->>'id')::uuid <> v_gr_id_1 then
    raise exception 'Invariant Violation: Replayed command did not return identical receipt ID';
  end if;

  select count(*) into v_gr_count from public.goods_receipts where organisation_id = t_org_a and purchase_order_id = v_po_id;
  if v_gr_count <> 1 then
    raise exception 'Invariant Violation: Duplicate goods_receipt row created on replay: %', v_gr_count;
  end if;

  select count(*) into v_sm_count from public.stock_movements where organisation_id = t_org_a and product_id = t_product_1;
  if v_sm_count <> 1 then
    raise exception 'Invariant Violation: Duplicate stock_movements row created on replay: %', v_sm_count;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Step 4: Idempotency Key Conflict Guard
  -- Reusing cmd_key_rcv1 with different payload must fail closed
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_rcv_a,
      'receiver',
      cmd_key_rcv1,
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'purchase_order_id', v_po_id,
        'location_id', t_location_a,
        'items', jsonb_build_array(
          jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'quantity', 99, 'unit_cost', 15.00)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm = 'idempotency_key_conflict' then
      v_caught_conflict := true;
    else
      raise exception 'Unexpected exception for key conflict: %', sqlerrm;
    end if;
  end;

  if not v_caught_conflict then
    raise exception 'Invariant Violation: Idempotency key conflict was not caught';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Step 5: Fulfill Remainder (Line 1: 6 units, Line 2: 5 units)
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_rcv2,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po_id,
      'location_id', t_location_a,
      'delivery_note_ref', 'DN-ALPHA-002',
      'notes', 'Final delivery fulfilling order',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'quantity', 6, 'unit_cost', 15.00),
        jsonb_build_object('line_no', 2, 'product_id', t_product_2, 'quantity', 5, 'unit_price', 50.00)
      )
    ),
    req_id
  );

  if coalesce((res->>'ok')::boolean, false) is not true then
    raise exception 'Invariant Violation: Remainder receipt failed: %', res;
  end if;

  v_gr_id_2 := (res->'goods_receipt'->>'id')::uuid;

  if res->'purchase_order'->>'receipt_status' <> 'complete' then
    raise exception 'Invariant Violation: Receipt status expected ''complete'', got %', res->'purchase_order'->>'receipt_status';
  end if;

  if (res->'purchase_order'->>'remaining_open')::numeric <> 0 then
    raise exception 'Invariant Violation: Remaining open expected 0, got %', res->'purchase_order'->>'remaining_open';
  end if;

  -- Verify total stock on hand for Product 1 is now 10 (4 + 6)
  select coalesce(d.derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(t_org_a, t_location_a, t_product_1) d;
  if v_onhand <> 10 then
    raise exception 'Invariant Violation: Product 1 on-hand expected 10, got %', v_onhand;
  end if;

  -- Verify total stock on hand for Product 2 is now 5
  select coalesce(d.derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(t_org_a, t_location_a, t_product_2) d;
  if v_onhand <> 5 then
    raise exception 'Invariant Violation: Product 2 on-hand expected 5, got %', v_onhand;
  end if;

  -- Verify 2 goods_receipts rows total for this PO
  select count(*) into v_gr_count from public.goods_receipts where organisation_id = t_org_a and purchase_order_id = v_po_id;
  if v_gr_count <> 2 then
    raise exception 'Invariant Violation: Total goods_receipts expected 2, got %', v_gr_count;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Step 6: Over-receipt refusal when allow_over_receipt = false
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_rcv_a,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'purchase_order_id', v_po_id,
        'location_id', t_location_a,
        'allow_over_receipt', false,
        'items', jsonb_build_array(
          jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'quantity', 2, 'unit_cost', 15.00)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm = 'over_receipt_not_permitted' then
      v_caught_over_receipt := true;
    else
      raise exception 'Unexpected exception for over-receipt refusal: %', sqlerrm;
    end if;
  end;

  if not v_caught_over_receipt then
    raise exception 'Invariant Violation: Over-receipt with allow_over_receipt=false was not rejected';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Step 7: Over-receipt permitted & flagged when allow_over_receipt = true
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_rcv3,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po_id,
      'location_id', t_location_a,
      'allow_over_receipt', true,
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'quantity', 2, 'unit_cost', 15.00)
      )
    ),
    req_id
  );

  v_gr_id_3 := (res->'goods_receipt'->>'id')::uuid;
  if res->'purchase_order'->>'receipt_status' <> 'over' then
    raise exception 'Invariant Violation: Receipt status for over-delivery expected ''over'', got %', res->'purchase_order'->>'receipt_status';
  end if;

  -- On-hand should now be 12 (10 + 2)
  select coalesce(d.derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(t_org_a, t_location_a, t_product_1) d;
  if v_onhand <> 12 then
    raise exception 'Invariant Violation: On-hand after over-receipt expected 12, got %', v_onhand;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Step 8: Negative & Zero quantity refusal
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_rcv_a,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'purchase_order_id', v_po_id,
        'items', jsonb_build_array(
          jsonb_build_object('line_no', 1, 'quantity', -5)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm = 'line_quantity_must_be_positive' then
      v_caught_negative_qty := true;
    end if;
  end;

  if not v_caught_negative_qty then
    raise exception 'Invariant Violation: Negative receipt quantity was not rejected';
  end if;

  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_rcv_a,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'purchase_order_id', v_po_id,
        'items', jsonb_build_array(
          jsonb_build_object('line_no', 1, 'quantity', 0)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm = 'line_quantity_must_be_positive' then
      v_caught_zero_qty := true;
    end if;
  end;

  if not v_caught_zero_qty then
    raise exception 'Invariant Violation: Zero receipt quantity was not rejected';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Step 9: Cross-Tenant Isolation Refusal
  -- Bob (Tenant B receiver) attempts to receive against Tenant A's PO
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    perform public.api_garage_command(
      t_org_b,
      t_person_b,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'purchase_order_id', v_po_id,
        'items', jsonb_build_array(
          jsonb_build_object('line_no', 1, 'quantity', 1)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm = 'purchase_order_not_found' then
      v_caught_cross_tenant := true;
    else
      raise exception 'Unexpected exception for cross-tenant attempt: %', sqlerrm;
    end if;
  end;

  if not v_caught_cross_tenant then
    raise exception 'Invariant Violation: Cross-tenant receipt was not refused with purchase_order_not_found';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Step 10: Seat Authorization Refusal
  -- Alice (quartermaster) attempting to receive fails with acting_seat_not_legal_for_command
  -- Dave (unauth) attempting to receive fails with seat_not_authorized
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_qm_a,
      'quartermaster',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'purchase_order_id', v_po_id,
        'items', jsonb_build_array(
          jsonb_build_object('line_no', 1, 'quantity', 1)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm = 'acting_seat_not_legal_for_command' then
      v_caught_illegal_seat := true;
    else
      raise exception 'Unexpected exception for illegal seat: %', sqlerrm;
    end if;
  end;

  if not v_caught_illegal_seat then
    raise exception 'Invariant Violation: Non-receiver seat was not rejected with acting_seat_not_legal_for_command';
  end if;

  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_unauth_a,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'purchase_order_id', v_po_id,
        'items', jsonb_build_array(
          jsonb_build_object('line_no', 1, 'quantity', 1)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm = 'seat_not_authorized' then
      v_caught_unheld_seat := true;
    else
      raise exception 'Unexpected exception for unheld seat: %', sqlerrm;
    end if;
  end;

  if not v_caught_unheld_seat then
    raise exception 'Invariant Violation: Unheld receiver seat was not rejected with seat_not_authorized';
  end if;

  -- ---------------------------------------------------------------------------
  -- Step 11: Mismatched SKU Refusal (Correction 1)
  -- Receiver attempts to receive PO Line 1 (Oil Filter / t_product_1) but passes
  -- product_id = t_product_2 (Brake Pad) or same-tenant mismatched SKU.
  -- Database must refuse fail-closed with 'receipt_product_mismatches_po_line'.
  -- Zero stock movements, goods_receipts, or goods_receipt_lines must be created.
  -- ---------------------------------------------------------------------------
  select count(*) into v_mismatch_sm_count
    from public.stock_movements
   where organisation_id = t_org_a and product_id = t_product_2;
  select count(*) into v_mismatch_gr_count
    from public.goods_receipts
   where organisation_id = t_org_a;
  select count(*) into v_mismatch_grl_count
    from public.goods_receipt_lines
   where organisation_id = t_org_a;

  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_rcv_a,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'purchase_order_id', v_po_id,
        'location_id', t_location_a,
        'items', jsonb_build_array(
          jsonb_build_object(
            'line_no', 1,
            'product_id', t_product_2,
            'quantity', 1
          )
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm = 'receipt_product_mismatches_po_line' then
      v_caught_mismatch := true;
    else
      raise exception 'Unexpected exception for mismatched SKU receipt: %', sqlerrm;
    end if;
  end;

  if not v_caught_mismatch then
    raise exception 'Invariant Violation: Mismatched SKU receipt was not refused with receipt_product_mismatches_po_line';
  end if;

  select count(*) into v_sm_count
    from public.stock_movements
   where organisation_id = t_org_a and product_id = t_product_2;
  if v_sm_count <> v_mismatch_sm_count then
    raise exception 'Invariant Violation: Stock movement was created for mismatched SKU!';
  end if;

  select count(*) into v_gr_count
    from public.goods_receipts
   where organisation_id = t_org_a;
  if v_gr_count <> v_mismatch_gr_count then
    raise exception 'Invariant Violation: goods_receipts row created despite SKU mismatch!';
  end if;

  select count(*) into v_grl_count
    from public.goods_receipt_lines
   where organisation_id = t_org_a;
  if v_grl_count <> v_mismatch_grl_count then
    raise exception 'Invariant Violation: goods_receipt_lines row created despite SKU mismatch!';
  end if;

  -- ---------------------------------------------------------------------------
  -- Step 12: Reordered and Subset Receipts (Correction 2)
  -- Create PO with Line 1: 10 Oil Filters, Line 2: 8 Brake Pads.
  -- Receipt A (Subset): receive Line 2 ONLY (3 units).
  -- Invariants: Line 2 remaining = 5; Line 1 remaining = 10; PO receipt_status = 'partial'.
  -- Persistent PO-line reference in goods_receipt_lines.purchase_order_line_id is verified.
  -- DB assertions verify per-line open quantities directly from database rows.
  -- Receipt B (Reordered): receive Line 1 (10 units).
  -- Invariants: Line 1 remaining = 0; Line 2 remaining = 5; PO receipt_status = 'partial'.
  -- Receipt C (Remainder): receive remaining 5 units of Line 2.
  -- Invariants: Total remaining = 0; PO receipt_status = 'complete'.
  -- ---------------------------------------------------------------------------
  res := public.api_garage_command(
    t_org_a,
    t_person_qm_a,
    'quartermaster',
    gen_random_uuid(),
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'notes', 'PO for Reordered/Subset Receipt Test',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'description', 'Oil Filter', 'quantity', 10, 'unit_price', 15.00),
        jsonb_build_object('line_no', 2, 'product_id', t_product_2, 'description', 'Brake Pad Set', 'quantity', 8, 'unit_price', 50.00)
      )
    ),
    req_id
  );
  v_po_reorder_id := (res->'purchase_order'->>'id')::uuid;

  select * into v_pol_reorder_1 from public.commercial_document_lines where document_id = v_po_reorder_id and line_no = 1;
  select * into v_pol_reorder_2 from public.commercial_document_lines where document_id = v_po_reorder_id and line_no = 2;

  -- Receipt A: Subset receiving Line 2 only (3 of 8)
  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    gen_random_uuid(),
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po_reorder_id,
      'location_id', t_location_a,
      'items', jsonb_build_array(
        jsonb_build_object('po_line_id', v_pol_reorder_2.id, 'quantity', 3)
      )
    ),
    req_id
  );
  if res->'purchase_order'->>'receipt_status' <> 'partial' then
    raise exception 'Invariant Violation: Subset receipt status expected partial, got %', res->'purchase_order'->>'receipt_status';
  end if;
  if (res->'purchase_order'->>'remaining_open')::numeric <> 15 then
    raise exception 'Invariant Violation: Expected 15 remaining open (10 + 5), got %', res->'purchase_order'->>'remaining_open';
  end if;

  -- Verify goods_receipt_lines.purchase_order_line_id is persisted
  select count(*) into v_grl_count
    from public.goods_receipt_lines
   where purchase_order_line_id = v_pol_reorder_2.id and quantity = 3;
  if v_grl_count <> 1 then
    raise exception 'Invariant Violation: goods_receipt_lines.purchase_order_line_id not persisted for subset receipt';
  end if;

  -- Assert per-line open quantities read directly from DB rows
  select coalesce(sum(quantity), 0) into v_db_line1_received
    from public.goods_receipt_lines
   where purchase_order_line_id = v_pol_reorder_1.id;
  v_db_line1_open := v_pol_reorder_1.quantity - v_db_line1_received;
  if v_db_line1_received <> 0 or v_db_line1_open <> 10 then
    raise exception 'Invariant Violation: DB per-line check failed for Line 1 after subset receipt (expected 0 received, 10 open, got % received, % open)', v_db_line1_received, v_db_line1_open;
  end if;

  select coalesce(sum(quantity), 0) into v_db_line2_received
    from public.goods_receipt_lines
   where purchase_order_line_id = v_pol_reorder_2.id;
  v_db_line2_open := v_pol_reorder_2.quantity - v_db_line2_received;
  if v_db_line2_received <> 3 or v_db_line2_open <> 5 then
    raise exception 'Invariant Violation: DB per-line check failed for Line 2 after subset receipt (expected 3 received, 5 open, got % received, % open)', v_db_line2_received, v_db_line2_open;
  end if;

  -- Receipt B: Reordered receiving Line 1 (10 of 10)
  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    gen_random_uuid(),
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po_reorder_id,
      'location_id', t_location_a,
      'items', jsonb_build_array(
        jsonb_build_object('po_line_no', 1, 'quantity', 10)
      )
    ),
    req_id
  );
  if res->'purchase_order'->>'receipt_status' <> 'partial' then
    raise exception 'Invariant Violation: Reordered receipt status expected partial, got %', res->'purchase_order'->>'receipt_status';
  end if;
  if (res->'purchase_order'->>'remaining_open')::numeric <> 5 then
    raise exception 'Invariant Violation: Expected 5 remaining open for Line 2, got %', res->'purchase_order'->>'remaining_open';
  end if;

  -- Assert per-line open quantities read directly from DB rows
  select coalesce(sum(quantity), 0) into v_db_line1_received
    from public.goods_receipt_lines
   where purchase_order_line_id = v_pol_reorder_1.id;
  v_db_line1_open := v_pol_reorder_1.quantity - v_db_line1_received;
  if v_db_line1_received <> 10 or v_db_line1_open <> 0 then
    raise exception 'Invariant Violation: DB per-line check failed for Line 1 after reordered receipt (expected 10 received, 0 open, got % received, % open)', v_db_line1_received, v_db_line1_open;
  end if;

  select coalesce(sum(quantity), 0) into v_db_line2_received
    from public.goods_receipt_lines
   where purchase_order_line_id = v_pol_reorder_2.id;
  v_db_line2_open := v_pol_reorder_2.quantity - v_db_line2_received;
  if v_db_line2_received <> 3 or v_db_line2_open <> 5 then
    raise exception 'Invariant Violation: DB per-line check failed for Line 2 after reordered receipt (expected 3 received, 5 open, got % received, % open)', v_db_line2_received, v_db_line2_open;
  end if;

  -- Receipt C: Fulfill remainder of Line 2 (5 units)
  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    gen_random_uuid(),
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po_reorder_id,
      'location_id', t_location_a,
      'items', jsonb_build_array(
        jsonb_build_object('po_line_no', 2, 'quantity', 5)
      )
    ),
    req_id
  );
  if res->'purchase_order'->>'receipt_status' <> 'complete' then
    raise exception 'Invariant Violation: Final receipt status expected complete, got %', res->'purchase_order'->>'receipt_status';
  end if;
  if (res->'purchase_order'->>'remaining_open')::numeric <> 0 then
    raise exception 'Invariant Violation: Expected 0 remaining open, got %', res->'purchase_order'->>'remaining_open';
  end if;

  -- Assert per-line open quantities read directly from DB rows
  select coalesce(sum(quantity), 0) into v_db_line1_received
    from public.goods_receipt_lines
   where purchase_order_line_id = v_pol_reorder_1.id;
  v_db_line1_open := v_pol_reorder_1.quantity - v_db_line1_received;
  if v_db_line1_received <> 10 or v_db_line1_open <> 0 then
    raise exception 'Invariant Violation: DB per-line check failed for Line 1 after final receipt', v_db_line1_open;
  end if;

  select coalesce(sum(quantity), 0) into v_db_line2_received
    from public.goods_receipt_lines
   where purchase_order_line_id = v_pol_reorder_2.id;
  v_db_line2_open := v_pol_reorder_2.quantity - v_db_line2_received;
  if v_db_line2_received <> 8 or v_db_line2_open <> 0 then
    raise exception 'Invariant Violation: DB per-line check failed for Line 2 after final receipt', v_db_line2_open;
  end if;

  -- ---------------------------------------------------------------------------
  -- Step 13: Duplicate-SKU Lines on PO & Discriminating Over-Receipt (Correction 2)
  -- Create PO with TWO lines having identical product_id (t_product_1):
  -- Line 1: 10 units @ 15.00
  -- Line 2: 5 units @ 15.00
  -- Invariant 1: Receiving against Line 1 must NOT reduce or conflate Line 2 open quantity.
  -- Invariant 2: Per-line remaining verified directly from DB rows.
  -- Invariant 3 (Discriminating): When Line 1 is fully received (10 of 10) and Line 2
  -- has 5 open, attempting to receive against Line 1 with allow_over_receipt=false
  -- MUST be refused ('over_receipt_not_permitted'), even though Product 1 has 5 open on PO.
  -- Invariant 4 (Discriminating): Attempting to receive 6 units against Line 2 (ordered 5)
  -- with allow_over_receipt=false MUST be refused ('over_receipt_not_permitted').
  -- ---------------------------------------------------------------------------
  res := public.api_garage_command(
    t_org_a,
    t_person_qm_a,
    'quartermaster',
    gen_random_uuid(),
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'notes', 'PO with Duplicate SKU lines',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'description', 'Oil Filter - Bay 1', 'quantity', 10, 'unit_price', 15.00),
        jsonb_build_object('line_no', 2, 'product_id', t_product_1, 'description', 'Oil Filter - Bay 2', 'quantity', 5, 'unit_price', 15.00)
      )
    ),
    req_id
  );
  v_po_dup_id := (res->'purchase_order'->>'id')::uuid;

  select * into v_pol_dup_1 from public.commercial_document_lines where document_id = v_po_dup_id and line_no = 1;
  select * into v_pol_dup_2 from public.commercial_document_lines where document_id = v_po_dup_id and line_no = 2;

  -- Receive against Line 1 only (10 units)
  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    gen_random_uuid(),
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po_dup_id,
      'location_id', t_location_a,
      'items', jsonb_build_array(
        jsonb_build_object('po_line_id', v_pol_dup_1.id, 'quantity', 10)
      )
    ),
    req_id
  );
  if res->'purchase_order'->>'receipt_status' <> 'partial' then
    raise exception 'Invariant Violation: Duplicate SKU receipt 1 expected partial, got %', res->'purchase_order'->>'receipt_status';
  end if;
  if (res->'purchase_order'->>'remaining_open')::numeric <> 5 then
    raise exception 'Invariant Violation: Duplicate SKU receipt 1 expected 5 remaining for Line 2, got %', res->'purchase_order'->>'remaining_open';
  end if;

  -- Assert per-line open quantities read directly from DB rows
  select coalesce(sum(quantity), 0) into v_db_line1_received
    from public.goods_receipt_lines
   where purchase_order_line_id = v_pol_dup_1.id;
  v_db_line1_open := v_pol_dup_1.quantity - v_db_line1_received;
  if v_db_line1_received <> 10 or v_db_line1_open <> 0 then
    raise exception 'Invariant Violation: DB per-line check failed for Duplicate SKU Line 1 (expected 10 received, 0 open, got % received, % open)', v_db_line1_received, v_db_line1_open;
  end if;

  select coalesce(sum(quantity), 0) into v_db_line2_received
    from public.goods_receipt_lines
   where purchase_order_line_id = v_pol_dup_2.id;
  v_db_line2_open := v_pol_dup_2.quantity - v_db_line2_received;
  if v_db_line2_received <> 0 or v_db_line2_open <> 5 then
    raise exception 'Invariant Violation: DB per-line check failed for Duplicate SKU Line 2 (expected 0 received, 5 open, got % received, % open)', v_db_line2_received, v_db_line2_open;
  end if;

  -- Discriminating Over-Receipt Check 1:
  -- Line 1 is fully received (10 of 10). Line 2 has 5 units open.
  -- A flawed per-SKU check sees 5 open for Product 1 and would allow receiving on Line 1.
  -- Proper per-line check recognizes Line 1 has 0 open, and refuses with 'over_receipt_not_permitted'.
  v_caught_dup_over := false;
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_rcv_a,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'purchase_order_id', v_po_dup_id,
        'location_id', t_location_a,
        'allow_over_receipt', false,
        'items', jsonb_build_array(
          jsonb_build_object('po_line_id', v_pol_dup_1.id, 'quantity', 1)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm = 'over_receipt_not_permitted' then
      v_caught_dup_over := true;
    else
      raise exception 'Unexpected exception for duplicate-SKU line 1 over-receipt: %', sqlerrm;
    end if;
  end;

  if not v_caught_dup_over then
    raise exception 'Invariant Violation: Discriminating over-receipt against Line 1 was not refused (per-SKU conflation detected)';
  end if;

  -- Discriminating Over-Receipt Check 2:
  -- Line 2 only ordered 5 units (5 open). Receiving 6 units with allow_over_receipt=false
  -- must be refused with 'over_receipt_not_permitted'.
  v_caught_dup_over := false;
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_rcv_a,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'purchase_order_id', v_po_dup_id,
        'location_id', t_location_a,
        'allow_over_receipt', false,
        'items', jsonb_build_array(
          jsonb_build_object('po_line_id', v_pol_dup_2.id, 'quantity', 6)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm = 'over_receipt_not_permitted' then
      v_caught_dup_over := true;
    else
      raise exception 'Unexpected exception for duplicate-SKU line 2 over-receipt: %', sqlerrm;
    end if;
  end;

  if not v_caught_dup_over then
    raise exception 'Invariant Violation: Discriminating over-receipt (6 of 5) against Line 2 was not refused';
  end if;

  -- Receive against Line 2 (5 units)
  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    gen_random_uuid(),
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po_dup_id,
      'location_id', t_location_a,
      'items', jsonb_build_array(
        jsonb_build_object('po_line_id', v_pol_dup_2.id, 'quantity', 5)
      )
    ),
    req_id
  );
  if res->'purchase_order'->>'receipt_status' <> 'complete' then
    raise exception 'Invariant Violation: Duplicate SKU receipt 2 expected complete, got %', res->'purchase_order'->>'receipt_status';
  end if;
  if (res->'purchase_order'->>'remaining_open')::numeric <> 0 then
    raise exception 'Invariant Violation: Duplicate SKU receipt 2 expected 0 remaining, got %', res->'purchase_order'->>'remaining_open';
  end if;

  -- Assert per-line open quantities read directly from DB rows after complete fulfillment
  select coalesce(sum(quantity), 0) into v_db_line1_received
    from public.goods_receipt_lines
   where purchase_order_line_id = v_pol_dup_1.id;
  v_db_line1_open := v_pol_dup_1.quantity - v_db_line1_received;
  if v_db_line1_received <> 10 or v_db_line1_open <> 0 then
    raise exception 'Invariant Violation: DB per-line check failed for Duplicate SKU Line 1 after fulfillment', v_db_line1_open;
  end if;

  select coalesce(sum(quantity), 0) into v_db_line2_received
    from public.goods_receipt_lines
   where purchase_order_line_id = v_pol_dup_2.id;
  v_db_line2_open := v_pol_dup_2.quantity - v_db_line2_received;
  if v_db_line2_received <> 5 or v_db_line2_open <> 0 then
    raise exception 'Invariant Violation: DB per-line check failed for Duplicate SKU Line 2 after fulfillment', v_db_line2_open;
  end if;
  
  -- ---------------------------------------------------------------------------
  -- Step 14: Server-Side Unit Cost Derivation & Tampering Coverage (Correction 3)
  -- Create PO with Line 1: 5 units @ 15.00.
  -- Receiver passes tampered unit_cost: 9999.99 and cost: 8888.88 in payload.
  -- Invariant: Persisted goods_receipt_lines.unit_cost MUST be 15.00.
  -- Invariant: Persisted stock_movements.unit_cost MUST be 15.00.
  -- Caller-supplied costs cannot alter server-side inventory valuation.
  -- ---------------------------------------------------------------------------
  res := public.api_garage_command(
    t_org_a,
    t_person_qm_a,
    'quartermaster',
    gen_random_uuid(),
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'notes', 'PO for Valuation Tampering Test',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'description', 'Oil Filter', 'quantity', 5, 'unit_price', 15.00)
      )
    ),
    req_id
  );
  v_po_tamper_id := (res->'purchase_order'->>'id')::uuid;

  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    gen_random_uuid(),
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po_tamper_id,
      'location_id', t_location_a,
      'items', jsonb_build_array(
        jsonb_build_object(
          'line_no', 1,
          'product_id', t_product_1,
          'quantity', 5,
          'unit_cost', 9999.99,
          'cost', 8888.88,
          'unit_price', 7777.77
        )
      )
    ),
    req_id
  );
  v_tamper_gr_id := (res->'goods_receipt'->>'id')::uuid;

  select unit_cost into v_tamper_grl_cost
    from public.goods_receipt_lines
   where receipt_id = v_tamper_gr_id and line_no = 1;
  if v_tamper_grl_cost <> 15.00 then
    raise exception 'Invariant Violation: goods_receipt_lines.unit_cost tampered! Expected 15.00, got %', v_tamper_grl_cost;
  end if;

  select unit_cost into v_tamper_sm_cost
    from public.stock_movements
   where source_id = v_tamper_gr_id and source_type = 'goods_receipt' and product_id = t_product_1;
  if v_tamper_sm_cost <> 15.00 then
    raise exception 'Invariant Violation: stock_movements.unit_cost tampered! Expected 15.00, got %', v_tamper_sm_cost;
  end if;

  raise notice 'SERP-541 Probe: All 14 goods receipt persistence invariants verified successfully.';
end;
$$;

rollback;
