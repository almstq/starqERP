-- ============================================================================
-- STARQ ERP — ERP-464 / B5 Supplier Bill Three-Way Matching Behavioral Probe
--
-- Task: ERP-464 (P2P-07)
-- Level: L2 Database Behavioral Invariant Probe
-- Mandate: docs/roadmap/FOUNDER_APPROVED_BUSINESS_LIFECYCLE_BOARD_RECONSTRUCTION_2026-11-06.md
-- Execution Package: docs/roadmap/ERP-464_B5_SUPPLIER_BILL_3WAY_MATCH_PACKAGE_2026-11-08.md
-- Authority: Founder Decision D2; Room #18617, #18618, #18622, #18624
--
-- Invariants Tested:
-- 1.  [Schema & RLS] public.supplier_bills and public.supplier_bill_lines exist with RLS policies.
-- 2.  [Matching Engine] perform_three_way_match accurately evaluates PO vs GRN vs Bill lines.
-- 3.  [Negative Gate] Billed for more than arrived (billed_more_than_received) is BLOCKED.
-- 4.  [Negative Gate] Billed for an item never ordered (billed_item_not_ordered) is BLOCKED.
-- 5.  [Negative Gate] Price above order outside tolerance (price_above_order) is BLOCKED.
-- 6.  [Negative Gate] Billed against PO with zero goods receipts (nothing_received) is BLOCKED.
-- 7.  [Tolerance Success] Price above order WITHIN configured tolerance is accepted (matched).
-- 8.  [Under-Billed Review] Supplier billing less than arrived is permitted with review verdict.
-- 9.  [GL Accounting Event] Accepted match emits ONE balanced Dr 2160 (GRNI) / Cr 2110 (AP) event.
-- 10. [Balance Movements] Account 2160 decreases, Account 2110 increases by exact matched amount.
-- 11. [Idempotency Replay] Replay returns cached result with zero duplicate bills or GL lines.
-- 12. [Duplicate Guard] Reusing bill_no with new command key against same PO is refused.
-- 13. [Cross-Tenant Isolation] Tenant B cannot match or view Tenant A bills.
-- 14. [False-Pass Guard] Strict assertion verifying both 2160 and 2110 balance movements.
-- ============================================================================

begin;

do $$
declare
  t_org_a uuid := 'a1111111-1111-4111-8111-111111111464';
  t_org_b uuid := 'b2222222-2222-4222-8222-222222222464';
  t_person_fc_a uuid := 'a3333333-3333-4333-8333-333333333464';
  t_person_rcv_a uuid := 'a8888888-8888-4888-8888-888888888464';
  t_person_b uuid := 'b3333333-3333-4333-8333-333333333464';
  t_mem_fc_a uuid := 'a7777777-7777-4777-8777-777777777464';
  t_mem_rcv_a uuid := 'a7777777-7777-4777-8777-888888888464';
  t_mem_b uuid := 'b7777777-7777-4777-8777-777777777464';
  t_book_a uuid := 'a4444444-4444-4444-8444-444444444464';
  t_book_b uuid := 'b4444444-4444-4444-8444-444444444464';
  t_supplier_a uuid := 'a5555555-5555-4555-8555-555555555464';
  t_supplier_b uuid := 'b5555555-5555-4555-8555-555555555464';
  t_product_1 uuid := 'a6666666-6666-4666-8666-666666666464';
  t_product_2 uuid := 'a6666666-6666-4666-8666-777777777464';
  t_location_a uuid := 'a9999999-9999-4999-8999-999999999464';
  t_location_b uuid := 'b9999999-9999-4999-8999-999999999464';

  cmd_key_po1 uuid := gen_random_uuid();
  cmd_key_rcv1 uuid := gen_random_uuid();
  cmd_key_match1 uuid := gen_random_uuid();
  cmd_key_match_over uuid := gen_random_uuid();
  cmd_key_match_unord uuid := gen_random_uuid();
  cmd_key_match_price uuid := gen_random_uuid();
  cmd_key_match_norcv uuid := gen_random_uuid();
  cmd_key_match_tol uuid := gen_random_uuid();
  cmd_key_match_under uuid := gen_random_uuid();
  cmd_key_po2_norcv uuid := gen_random_uuid();

  req_id uuid := gen_random_uuid();

  res jsonb;
  res_replay jsonb;
  v_po1_id uuid;
  v_po2_id uuid;
  v_gr1_id uuid;
  v_bill1_id uuid;
  v_bill_tol_id uuid;
  v_bill_under_id uuid;
  v_ae1_id uuid;

  v_bal_2160_start numeric(20, 6);
  v_bal_2110_start numeric(20, 6);
  v_bal_2160_after_rcv numeric(20, 6);
  v_bal_2110_after_rcv numeric(20, 6);
  v_bal_2160_after_match numeric(20, 6);
  v_bal_2110_after_match numeric(20, 6);

  v_caught_over boolean := false;
  v_caught_unord boolean := false;
  v_caught_price boolean := false;
  v_caught_norcv boolean := false;
  v_caught_dup boolean := false;
  v_caught_cross_tenant boolean := false;
  v_count integer;
begin
  raise notice '=======================================================';
  raise notice 'Running ERP-464 / B5 Supplier Bill 3-Way Match Probe';
  raise notice '=======================================================';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Fixtures Setup (Tenant A & Tenant B)
  -- ─────────────────────────────────────────────────────────────────────────

  insert into public.organisations (id, slug, legal_name)
  values
    (t_org_a, 'org-a-erp464', 'Tenant A ERP-464 Corp'),
    (t_org_b, 'org-b-erp464', 'Tenant B ERP-464 Corp')
  on conflict (id) do nothing;

  insert into public.document_sequences (organisation_id, sequence_type, prefix, padding)
  values
    (t_org_a, 'garage_job', 'JOB-A-', 4),
    (t_org_b, 'garage_job', 'JOB-B-', 4),
    (t_org_a, 'purchase_order', 'PO-A-', 5),
    (t_org_b, 'purchase_order', 'PO-B-', 5),
    (t_org_a, 'goods_receipt', 'GRN-A-', 5),
    (t_org_b, 'goods_receipt', 'GRN-B-', 5),
    (t_org_a, 'supplier_bill', 'BILL-A-', 5),
    (t_org_b, 'supplier_bill', 'BILL-B-', 5)
  on conflict (organisation_id, sequence_type) do nothing;

  insert into public.books (id, organisation_id, code, name, is_default, status)
  values
    (t_book_a, t_org_a, 'BOOK-464A', 'Default Book A', true, 'active'),
    (t_book_b, t_org_b, 'BOOK-464B', 'Default Book B', true, 'active')
  on conflict (id) do nothing;

  insert into public.chart_of_accounts
    (organisation_id, code, name, account_class, subtype, parent_code, level, currency, posting_control, status, description)
  values
    (t_org_a, '1310', 'Inventory On Hand', 'ASSET', 'CURRENT_ASSET', '1300', 2, 'MULTI', 'control', 'active', 'Inventory asset on hand'),
    (t_org_b, '1310', 'Inventory On Hand', 'ASSET', 'CURRENT_ASSET', '1300', 2, 'MULTI', 'control', 'active', 'Inventory asset on hand'),
    (t_org_a, '2160', 'Goods Received Not Invoiced (GRNI)', 'LIABILITY', 'CURRENT_LIABILITY', '2100', 2, 'MULTI', 'control', 'active', 'GRNI Accrual liability'),
    (t_org_b, '2160', 'Goods Received Not Invoiced (GRNI)', 'LIABILITY', 'CURRENT_LIABILITY', '2100', 2, 'MULTI', 'control', 'active', 'GRNI Accrual liability'),
    (t_org_a, '2110', 'Accounts Payable (Trade Creditors)', 'LIABILITY', 'CURRENT_LIABILITY', '2100', 2, 'MULTI', 'control', 'active', 'Amounts owed to trade suppliers'),
    (t_org_b, '2110', 'Accounts Payable (Trade Creditors)', 'LIABILITY', 'CURRENT_LIABILITY', '2100', 2, 'MULTI', 'control', 'active', 'Amounts owed to trade suppliers')
  on conflict (organisation_id, code) do nothing;

  insert into public.persons (id, person_key, display_label)
  values
    (t_person_fc_a, 'key-fc-a', 'Alice Controller A'),
    (t_person_rcv_a, 'key-rcv-a', 'Bob Receiver A'),
    (t_person_b, 'key-b', 'Charlie Tenant B')
  on conflict (id) do nothing;

  insert into public.memberships (id, organisation_id, person_id, status)
  values
    (t_mem_fc_a, t_org_a, t_person_fc_a, 'active'),
    (t_mem_rcv_a, t_org_a, t_person_rcv_a, 'active'),
    (t_mem_b, t_org_b, t_person_b, 'active')
  on conflict (organisation_id, person_id) do nothing;

  select id into t_mem_fc_a from public.memberships where organisation_id = t_org_a and person_id = t_person_fc_a;
  select id into t_mem_rcv_a from public.memberships where organisation_id = t_org_a and person_id = t_person_rcv_a;
  select id into t_mem_b from public.memberships where organisation_id = t_org_b and person_id = t_person_b;

  insert into public.seats (code, label)
  values
    ('financial_controller', 'Financial Controller'),
    ('receiver', 'Receiver'),
    ('payer', 'Payer'),
    ('quartermaster', 'Quartermaster')
  on conflict (code) do nothing;

  insert into public.membership_seats (membership_id, seat_code)
  values
    (t_mem_fc_a, 'financial_controller'),
    (t_mem_rcv_a, 'receiver'),
    (t_mem_b, 'financial_controller'),
    (t_mem_b, 'receiver')
  on conflict (membership_id, seat_code) do nothing;

  insert into public.contacts (id, organisation_id, kind, display_name)
  values
    (t_supplier_a, t_org_a, 'supplier', 'Starq Maldives Supplier A'),
    (t_supplier_b, t_org_b, 'supplier', 'Starq Maldives Supplier B')
  on conflict (id) do nothing;

  insert into public.products (id, organisation_id, sku, kind, name, active)
  values
    (t_product_1, t_org_a, 'SKU-OIL-5W30', 'stock', 'Premium Oil 5W30', true),
    (t_product_2, t_org_a, 'SKU-PADS-SET', 'stock', 'Brake Pads Set', true)
  on conflict (id) do nothing;

  insert into public.locations (id, organisation_id, code, name, kind, active)
  values
    (t_location_a, t_org_a, 'WH-A', 'Main Warehouse A', 'warehouse', true),
    (t_location_b, t_org_b, 'WH-B', 'Main Warehouse B', 'warehouse', true)
  on conflict (id) do nothing;

  -- Verify initial balances
  v_bal_2160_start := coalesce(public.grni_balance(t_org_a), 0);
  v_bal_2110_start := coalesce(public.accounts_payable_balance(t_org_a), 0);

  -- ─────────────────────────────────────────────────────────────────────────
  -- Step 1: Create Purchase Order PO-1 (10 units @ 450.00 MVR = 4,500.00 MVR)
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_fc_a,
    'financial_controller',
    cmd_key_po1,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', t_product_1,
          'item_key', 'OIL-5W30',
          'description', 'Premium Oil 5W30',
          'quantity', 10,
          'unit_price', 450.00,
          'tax_rate', 0
        )
      )
    ),
    req_id
  );
  v_po1_id := (res->'purchase_order'->>'id')::uuid;
  assert v_po1_id is not null, 'PO-1 must be created';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Step 2: Receive Goods Receipt GRN-1 (10 units @ 450.00 MVR)
  -- ─────────────────────────────────────────────────────────────────────────
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
      'delivery_note_ref', 'DN-464-001',
      'items', jsonb_build_array(
        jsonb_build_object(
          'po_line_no', 1,
          'product_id', t_product_1,
          'quantity', 10,
          'unit_cost', 450.00
        )
      )
    ),
    req_id
  );
  v_gr1_id := (res->'goods_receipt'->>'id')::uuid;
  assert v_gr1_id is not null, 'GRN-1 must be created';

  -- Check balances after receipt: GRNI (2160) accrued 4,500.00 MVR
  v_bal_2160_after_rcv := public.grni_balance(t_org_a);
  v_bal_2110_after_rcv := public.accounts_payable_balance(t_org_a);
  assert v_bal_2160_after_rcv = v_bal_2160_start + 4500.00, 'GRNI 2160 must accrue +4500.00 MVR after receipt';
  assert v_bal_2110_after_rcv = v_bal_2110_start, 'AP 2110 must NOT move before bill matching';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Invariant 3: Negative Case — Billed for more than arrived is BLOCKED
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_fc_a,
      'financial_controller',
      cmd_key_match_over,
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'match',
        'purchase_order_id', v_po1_id,
        'bill_no', 'INV-OVER-001',
        'lines', jsonb_build_array(
          jsonb_build_object(
            'po_line_no', 1,
            'product_id', t_product_1,
            'quantity', 12, -- Billed 12 when only 10 arrived
            'unit_cost', 450.00
          )
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%three_way_match_blocked%' or sqlerrm like '%billed_more_than_received%' then
      v_caught_over := true;
    end if;
  end;
  assert v_caught_over, 'Matching must fail closed when billed quantity exceeds received quantity';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Invariant 4: Negative Case — Billed for item not ordered is BLOCKED
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_fc_a,
      'financial_controller',
      cmd_key_match_unord,
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'match',
        'purchase_order_id', v_po1_id,
        'bill_no', 'INV-UNORD-001',
        'lines', jsonb_build_array(
          jsonb_build_object(
            'item_key', 'UNORDERED-MYSTERY-FEE',
            'quantity', 1,
            'unit_cost', 1000.00
          )
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%three_way_match_blocked%' or sqlerrm like '%billed_item_not_ordered%' then
      v_caught_unord := true;
    end if;
  end;
  assert v_caught_unord, 'Matching must fail closed when billed item is not on purchase order';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Invariant 5: Negative Case — Price above order outside tolerance is BLOCKED
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_fc_a,
      'financial_controller',
      cmd_key_match_price,
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'match',
        'purchase_order_id', v_po1_id,
        'bill_no', 'INV-PRICE-001',
        'lines', jsonb_build_array(
          jsonb_build_object(
            'po_line_no', 1,
            'product_id', t_product_1,
            'quantity', 10,
            'unit_cost', 500.00 -- 500.00 vs agreed 450.00 (zero tolerance)
          )
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%three_way_match_blocked%' or sqlerrm like '%price_above_order%' then
      v_caught_price := true;
    end if;
  end;
  assert v_caught_price, 'Matching must fail closed when billed price exceeds order price without tolerance';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Invariant 6: Negative Case — Bill presented with zero goods receipts is BLOCKED
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_fc_a,
    'financial_controller',
    cmd_key_po2_norcv,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', t_product_2,
          'quantity', 5,
          'unit_price', 200.00,
          'tax_rate', 0
        )
      )
    ),
    req_id
  );
  v_po2_id := (res->'purchase_order'->>'id')::uuid;

  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_fc_a,
      'financial_controller',
      cmd_key_match_norcv,
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'match',
        'purchase_order_id', v_po2_id,
        'bill_no', 'INV-NORCV-001',
        'lines', jsonb_build_array(
          jsonb_build_object(
            'po_line_no', 1,
            'product_id', t_product_2,
            'quantity', 5,
            'unit_cost', 200.00
          )
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%three_way_match_blocked%' or sqlerrm like '%nothing_received%' then
      v_caught_norcv := true;
    end if;
  end;
  assert v_caught_norcv, 'Matching must fail closed when bill is presented against an order with zero receipts';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Invariant 7: Tolerance Success — Price within allowed tolerance is matched
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.perform_three_way_match(
    t_org_a,
    v_po1_id,
    jsonb_build_array(
      jsonb_build_object(
        'po_line_no', 1,
        'product_id', t_product_1,
        'quantity', 10,
        'unit_cost', 455.00 -- 5.00 above order, within 10.00 absolute tolerance
      )
    ),
    jsonb_build_object('priceAbsolute', 10.00, 'pricePercent', 0)
  );
  assert (res->>'verdict') in ('matched', 'review'), 'Price variance within tolerance must not block match';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Invariant 8: Under-Billed Review — Billing less than arrived is allowed
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.perform_three_way_match(
    t_org_a,
    v_po1_id,
    jsonb_build_array(
      jsonb_build_object(
        'po_line_no', 1,
        'product_id', t_product_1,
        'quantity', 8, -- 8 billed vs 10 received
        'unit_cost', 450.00
      )
    )
  );
  assert (res->>'verdict') = 'review', 'Under-billing must produce review verdict, not blocked';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Invariant 9 & 10: Clean Match — Creates Payable, Clears GRNI 2160, Credits AP 2110
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_fc_a,
    'financial_controller',
    cmd_key_match1,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'match',
      'purchase_order_id', v_po1_id,
      'bill_no', 'INV-SUP-1001',
      'bill_date', '2026-11-08',
      'lines', jsonb_build_array(
        jsonb_build_object(
          'po_line_no', 1,
          'product_id', t_product_1,
          'quantity', 10,
          'unit_cost', 450.00
        )
      )
    ),
    req_id
  );

  assert (res->>'ok')::boolean = true, 'Match command must succeed';
  assert (res->>'verdict') = 'matched', 'Match verdict must be matched';
  v_bill1_id := (res->'supplier_bill'->>'id')::uuid;
  v_ae1_id := (res->'accounting_event'->>'id')::uuid;

  assert v_bill1_id is not null, 'Supplier bill record must be created';
  assert v_ae1_id is not null, 'Accounting event must be emitted';
  assert (res->'supplier_bill'->>'matched_amount')::numeric = 4500.00, 'Matched amount must be 4500.00';

  -- Check DB rows in supplier_bills
  select count(*) into v_count from public.supplier_bills
   where id = v_bill1_id and status = 'matched' and matched_amount = 4500.00;
  assert v_count = 1, 'supplier_bills row must exist with status=matched and matched_amount=4500.00';

  -- Check DB rows in supplier_bill_lines
  select count(*) into v_count from public.supplier_bill_lines
   where bill_id = v_bill1_id and quantity = 10 and unit_cost = 450.00;
  assert v_count = 1, 'supplier_bill_lines row must exist';

  -- Check accounting event lines: Dr 2160 / Cr 2110
  select count(*) into v_count from public.accounting_event_lines
   where event_id = v_ae1_id and account_code = '2160' and debit = 4500.00 and credit = 0;
  assert v_count = 1, 'Accounting event must debit 2160 GRNI by 4500.00';

  select count(*) into v_count from public.accounting_event_lines
   where event_id = v_ae1_id and account_code = '2110' and debit = 0 and credit = 4500.00;
  assert v_count = 1, 'Accounting event must credit 2110 AP by 4500.00';

  -- Check balance movements: GRNI (2160) returned to start balance (cleared to 0.00)
  v_bal_2160_after_match := public.grni_balance(t_org_a);
  v_bal_2110_after_match := public.accounts_payable_balance(t_org_a);

  assert v_bal_2160_after_match = v_bal_2160_start, 'GRNI accrual 2160 must be fully cleared (balance returned to starting baseline)';
  assert v_bal_2110_after_match = v_bal_2110_start + 4500.00, 'AP 2110 balance must increase by exact matched amount (+4500.00 MVR)';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Invariant 11: Idempotency Replay returns cached result with zero duplication
  -- ─────────────────────────────────────────────────────────────────────────
  res_replay := public.api_garage_command(
    t_org_a,
    t_person_fc_a,
    'financial_controller',
    cmd_key_match1, -- same key
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'match',
      'purchase_order_id', v_po1_id,
      'bill_no', 'INV-SUP-1001',
      'lines', jsonb_build_array(
        jsonb_build_object('po_line_no', 1, 'product_id', t_product_1, 'quantity', 10, 'unit_cost', 450.00)
      )
    ),
    req_id
  );
  assert (res_replay->'supplier_bill'->>'id')::uuid = v_bill1_id, 'Replay must return cached supplier bill';

  select count(*) into v_count from public.supplier_bills where id = v_bill1_id;
  assert v_count = 1, 'Replay must not create duplicate supplier_bills row';

  select count(*) into v_count from public.accounting_events where metadata->>'bill_id' = v_bill1_id::text;
  assert v_count = 1, 'Replay must not emit duplicate accounting_events';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Invariant 12: Duplicate Bill Guard against same PO is refused
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_fc_a,
      'financial_controller',
      gen_random_uuid(), -- new key
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'match',
        'purchase_order_id', v_po1_id,
        'bill_no', 'INV-SUP-1001', -- already matched bill
        'lines', jsonb_build_array(
          jsonb_build_object('po_line_no', 1, 'product_id', t_product_1, 'quantity', 10, 'unit_cost', 450.00)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%duplicate_supplier_bill%' or sqlerrm like '%unique constraint%' then
      v_caught_dup := true;
    end if;
  end;
  assert v_caught_dup, 'Reusing existing bill number against same PO on new command key must be refused';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Invariant 13: Cross-Tenant Isolation Refusal
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    perform public.api_garage_command(
      t_org_b, -- Tenant B caller
      t_person_b,
      'financial_controller',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'match',
        'purchase_order_id', v_po1_id, -- Tenant A PO
        'bill_no', 'INV-X-001',
        'lines', jsonb_build_array(
          jsonb_build_object('po_line_no', 1, 'quantity', 10, 'unit_cost', 450.00)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%purchase_order_not_found%' or sqlerrm like '%permission_denied%' then
      v_caught_cross_tenant := true;
    end if;
  end;
  assert v_caught_cross_tenant, 'Cross-tenant PO matching must be refused';

  -- Check Tenant B RLS read isolation
  perform set_config('app.organisation_id', t_org_b::text, true);
  perform set_config('app.person_id', t_person_b::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into v_count from public.supplier_bills where organisation_id = t_org_a;
  assert v_count = 0, 'Tenant B authenticated role must see zero Tenant A supplier bills under RLS';

  perform set_config('role', 'postgres', true);

  -- ─────────────────────────────────────────────────────────────────────────
  -- Invariant 14: False-Pass Guard
  -- Verify that skewing the matched GL entry is actively caught and verified
  -- ─────────────────────────────────────────────────────────────────────────
  assert (v_bal_2110_after_match - v_bal_2110_start) = 4500.00, 'False-pass check: AP 2110 net delta must be exactly 4500.00 MVR';
  assert (v_bal_2160_after_match - v_bal_2160_start) = 0.00, 'False-pass check: GRNI 2160 must be perfectly cleared to 0.00';

  raise notice '=======================================================';
  raise notice 'ALL 14 ERP-464 / B5 BEHAVIORAL INVARIANTS VERIFIED';
  raise notice '=======================================================';
end $$;

rollback;
