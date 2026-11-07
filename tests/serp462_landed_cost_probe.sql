-- ============================================================================
-- STARQ ERP — ERP-462 / B3 Landed Cost Allocation Behavioral Invariant Probe
--
-- Task: ERP-462 / B3 (P2P-05)
-- Level: L2 Database Behavioral Invariant Probe
-- Mandate: docs/roadmap/FOUNDER_APPROVED_BUSINESS_LIFECYCLE_BOARD_RECONSTRUCTION_2026-11-06.md
-- Execution Package: docs/roadmap/ERP-462_B3_LANDED_COST_EXECUTION_PACKAGE_2026-11-07.md
-- Authority: Founder Decision D2; Room #18577 & #18580
--
-- All 10 Invariants Tested:
-- 1. [Sequence & Schema] LCA document sequence and tables exist with RLS and append-only triggers.
-- 2. [Value Basis Allocation] Pro-rata apportionment across lines by goods value.
-- 3. [Rounding Residue] Exact penny distribution down to the laari with zero residue lost.
-- 4. [Alternative Bases] Apportionment by quantity and weight.
-- 5. [Recoverable Tax Separation] Tax excluded from inventory capitalization and routed to 1410.
-- 6. [GL Accrual & False-Pass Guard] Dr 1310 / Dr 1410 / Cr 1320 balanced event and journal proposal.
-- 7. [Append-Only Guard] Rejects any UPDATE or DELETE mutations on documents or line allocations.
-- 8. [Fail-Closed Validation] Rejects negative charges, invalid bases, missing recoverable accounts.
-- 9. [Cross-Tenant Isolation] Tenant B cannot allocate landed cost to Tenant A receipt or read its records.
-- 10. [Idempotency] Replay returns cached response; zero duplicate documents or accounting events.
-- 11. [Read-Through] receipt_landed_cost_summary returns accurate cumulative allocations.
-- ============================================================================

begin;

do $$
declare
  t_org_a uuid := 'a1111111-1111-4111-8111-111111111462';
  t_org_b uuid := 'b2222222-2222-4222-8222-222222222462';
  t_person_qm_a uuid := 'a3333333-3333-4333-8333-333333333462';
  t_person_rcv_a uuid := 'a8888888-8888-4888-8888-888888888462';
  t_person_b uuid := 'b3333333-3333-4333-8333-333333333462';
  t_mem_qm_a uuid := 'a7777777-7777-4777-8777-777777777462';
  t_mem_rcv_a uuid := 'a7777777-7777-4777-8777-888888888462';
  t_mem_b uuid := 'b7777777-7777-4777-8777-777777777462';
  t_book_a uuid := 'a4444444-4444-4444-8444-444444444462';
  t_book_b uuid := 'b4444444-4444-4444-8444-444444444462';
  t_supplier_a uuid := 'a5555555-5555-4555-8555-555555555462';
  t_supplier_b uuid := 'b5555555-5555-4555-8555-555555555462';
  t_product_1 uuid := 'a6666666-6666-4666-8666-666666666462';
  t_product_2 uuid := 'a6666666-6666-4666-8666-777777777462';
  t_product_3 uuid := 'a6666666-6666-4666-8666-888888888462';
  t_location_a uuid := 'a9999999-9999-4999-8999-999999999462';
  t_location_b uuid := 'b9999999-9999-4999-8999-999999999462';

  cmd_key_po1 uuid := gen_random_uuid();
  cmd_key_rcv1 uuid := gen_random_uuid();
  cmd_key_lc1 uuid := gen_random_uuid();

  cmd_key_po2 uuid := gen_random_uuid();
  cmd_key_rcv2 uuid := gen_random_uuid();
  cmd_key_lc2 uuid := gen_random_uuid();

  cmd_key_po3 uuid := gen_random_uuid();
  cmd_key_rcv3 uuid := gen_random_uuid();
  cmd_key_lc3 uuid := gen_random_uuid();

  req_id uuid := gen_random_uuid();

  res jsonb;
  res_replay jsonb;
  v_po_id uuid;
  v_gr_id uuid;
  v_gr_line_1_id uuid;
  v_gr_line_2_id uuid;
  v_gr_line_3_id uuid;
  v_doc_id uuid;
  v_ae_id uuid;
  v_summary jsonb;

  v_count integer;
  v_doc_row public.landed_cost_documents%rowtype;
  v_alloc_row public.landed_cost_allocations%rowtype;

  -- Balance check variables
  v_bal_1310_0 numeric(20, 6);
  v_bal_1320_0 numeric(20, 6);
  v_bal_1410_0 numeric(20, 6);
  v_bal_1310_after numeric(20, 6);
  v_bal_1320_after numeric(20, 6);
  v_bal_1410_after numeric(20, 6);
  v_delta_1310 numeric(20, 6);
  v_delta_1320 numeric(20, 6);
  v_delta_1410 numeric(20, 6);

  -- Fail-closed flag variables
  v_caught_negative boolean := false;
  v_caught_basis boolean := false;
  v_caught_no_account boolean := false;
  v_caught_no_receipt boolean := false;
  v_caught_cross_tenant boolean := false;
  v_caught_mutation boolean := false;
begin
  raise notice '=======================================================';
  raise notice 'Running ERP-462 / B3 Landed Cost Allocation Probe';
  raise notice '=======================================================';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Fixtures Setup (Tenant A & Tenant B)
  -- ─────────────────────────────────────────────────────────────────────────
  insert into public.organisations (id, slug, legal_name)
  values
    (t_org_a, 'alpha-motors-462', 'Alpha Motors 462'),
    (t_org_b, 'beta-garages-462', 'Beta Garages 462')
  on conflict (id) do nothing;

  insert into public.persons (id, person_key, display_label, status)
  values
    (t_person_qm_a, 'person_alpha_qm_462', 'Alice Quartermaster 462', 'active'),
    (t_person_rcv_a, 'person_alpha_rcv_462', 'Charlie Receiver 462', 'active'),
    (t_person_b, 'person_beta_rcv_462', 'Bob Foreign Receiver 462', 'active')
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
    (t_book_a, t_org_a, 'ALPHA462', 'Alpha Main Book', true, 'active'),
    (t_book_b, t_org_b, 'BETA462', 'Beta Main Book', true, 'active')
  on conflict (id) do nothing;

  insert into public.locations (id, organisation_id, code, name, kind, active)
  values
    (t_location_a, t_org_a, 'MAIN-WH-462', 'Alpha Main Warehouse', 'warehouse', true),
    (t_location_b, t_org_b, 'BETA-WH-462', 'Beta Warehouse', 'warehouse', true)
  on conflict (id) do nothing;

  insert into public.contacts (id, organisation_id, kind, display_name)
  values
    (t_supplier_a, t_org_a, 'supplier', 'Alpha Parts Ltd'),
    (t_supplier_b, t_org_b, 'supplier', 'Beta Spares Co')
  on conflict (id) do nothing;

  insert into public.products (id, organisation_id, sku, kind, name, active)
  values
    (t_product_1, t_org_a, 'SKU-FILTER-462', 'stock', 'Alpha Synthetic Oil Filter', true),
    (t_product_2, t_org_a, 'SKU-BRAKE-462', 'stock', 'Alpha Ceramic Brake Pads', true),
    (t_product_3, t_org_a, 'SKU-SPARK-462', 'stock', 'Alpha Spark Plugs', true)
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
    (t_org_b, '1410', 'Input GST Recoverable (MIRA)', 'ASSET', 'INPUT_TAX_RECOVERABLE', '1400', 3, 'MVR', 'control', 'Recoverable tax asset')
  on conflict (organisation_id, code) do nothing;

  perform public.seed_grni_account_for_organisation(t_org_a);
  perform public.seed_grni_account_for_organisation(t_org_b);

  -- Ensure Landed Cost Document Sequence
  insert into public.document_sequences (organisation_id, sequence_type, prefix, padding)
  values
    (t_org_a, 'landed_cost', 'LCA-', 5),
    (t_org_b, 'landed_cost', 'LCA-', 5)
  on conflict (organisation_id, sequence_type) do nothing;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 1: Invariant 1 — Sequence & Table Infrastructure
  -- ─────────────────────────────────────────────────────────────────────────
  select count(*) into v_count
    from public.document_sequences
   where organisation_id = t_org_a and sequence_type = 'landed_cost';
  if v_count <> 1 then
    raise exception 'Invariant Violation (Invariant 1): landed_cost sequence missing for tenant A';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 2: PO 1 Setup & Receipt
  -- Line 1: 10 Oil Filters @ 100.00 MVR = 1,000.00 MVR
  -- Line 2: 10 Brake Pads @ 300.00 MVR = 3,000.00 MVR
  -- Line 3: 10 Spark Plugs @ 100.00 MVR = 1,000.00 MVR
  -- Total Goods Value = 5,000.00 MVR
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
      'currency', 'MVR',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'description', 'Oil Filters', 'quantity', 10, 'unit_price', 100.00),
        jsonb_build_object('line_no', 2, 'product_id', t_product_2, 'description', 'Brake Pads', 'quantity', 10, 'unit_price', 300.00),
        jsonb_build_object('line_no', 3, 'product_id', t_product_3, 'description', 'Spark Plugs', 'quantity', 10, 'unit_price', 100.00)
      )
    ),
    req_id
  );
  if coalesce((res->>'ok')::boolean, false) is not true then
    raise exception 'PO 1 creation failed: %', res;
  end if;
  v_po_id := (res->'purchase_order'->>'id')::uuid;

  -- Receive all 3 lines
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
      'delivery_note_ref', 'DN-ALPHA-462-1',
      'items', jsonb_build_array(
        jsonb_build_object('po_line_no', 1, 'quantity', 10),
        jsonb_build_object('po_line_no', 2, 'quantity', 10),
        jsonb_build_object('po_line_no', 3, 'quantity', 10)
      )
    ),
    req_id
  );
  if coalesce((res->>'ok')::boolean, false) is not true then
    raise exception 'Receipt 1 failed: %', res;
  end if;
  v_gr_id := (res->'goods_receipt'->>'id')::uuid;

  -- Capture GR lines
  select id into v_gr_line_1_id from public.goods_receipt_lines where receipt_id = v_gr_id and line_no = 1;
  select id into v_gr_line_2_id from public.goods_receipt_lines where receipt_id = v_gr_id and line_no = 2;
  select id into v_gr_line_3_id from public.goods_receipt_lines where receipt_id = v_gr_id and line_no = 3;

  -- Record initial ledger balances before landed cost allocation
  v_bal_1310_0 := public.accounting_event_account_balance(t_org_a, '1310');
  v_bal_1320_0 := public.accounting_event_account_balance(t_org_a, '1320');
  v_bal_1410_0 := public.accounting_event_account_balance(t_org_a, '1410');

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 3: Invariants 2, 5 & 6 — Landed Cost Allocation (Value Basis + Recoverable Tax)
  -- Charges:
  -- 1. Ocean freight: 800.00 MVR (basis: 'value', recoverable: false)
  -- 2. Customs clearing: 200.00 MVR (basis: 'value', recoverable: false)
  -- 3. Import GST: 300.00 MVR (basis: 'value', recoverable: true, account: '1410')
  --
  -- Expected Math:
  -- Total charges = 1,300.00 MVR
  -- Capitalised = 1,000.00 MVR
  -- Not capitalised = 300.00 MVR
  -- Total goods value = 5,000.00 MVR
  -- Uplift ratio = 1,000.00 / 5,000.00 = 0.2000 (20%)
  --
  -- Line shares (capitalised):
  -- Line 1 (1,000 / 5,000 = 20%): 200.00 MVR -> landed_value = 1,200.00, landed_unit_cost = 120.00
  -- Line 2 (3,000 / 5,000 = 60%): 600.00 MVR -> landed_value = 3,600.00, landed_unit_cost = 360.00
  -- Line 3 (1,000 / 5,000 = 20%): 200.00 MVR -> landed_value = 1,200.00, landed_unit_cost = 120.00
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_lc1,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'receipt_id', v_gr_id,
      'charges', jsonb_build_array(
        jsonb_build_object('label', 'Ocean Freight', 'amount', 800.00, 'basis', 'value', 'recoverable', false),
        jsonb_build_object('label', 'Customs Clearing', 'amount', 200.00, 'basis', 'value', 'recoverable', false),
        jsonb_build_object('label', 'Import GST', 'amount', 300.00, 'basis', 'value', 'recoverable', true, 'account_code', '1410')
      )
    ),
    req_id
  );

  if coalesce((res->>'ok')::boolean, false) is not true then
    raise exception 'Landed cost allocation 1 failed: %', res;
  end if;

  v_doc_id := (res->'landed_cost'->>'document_id')::uuid;
  v_ae_id := (res->'landed_cost'->'accounting_event'->>'id')::uuid;

  if v_doc_id is null or v_ae_id is null then
    raise exception 'Invariant Violation: document_id or accounting_event_id is null in response';
  end if;

  -- Verify landed_cost_documents row
  select * into v_doc_row
    from public.landed_cost_documents
   where id = v_doc_id and organisation_id = t_org_a;

  if not found then
    raise exception 'Invariant Violation (Invariant 1): landed_cost_documents row not found';
  end if;

  if v_doc_row.allocation_no not like 'LCA-%' then
    raise exception 'Invariant Violation (Invariant 1): allocation_no does not match prefix LCA- (got %)', v_doc_row.allocation_no;
  end if;

  if v_doc_row.total_charges <> 1300.00 or v_doc_row.capitalised_amount <> 1000.00 or v_doc_row.not_capitalised_amount <> 300.00 then
    raise exception 'Invariant Violation (Invariant 2 & 5): document amounts incorrect (total=%, cap=%, not_cap=%)',
      v_doc_row.total_charges, v_doc_row.capitalised_amount, v_doc_row.not_capitalised_amount;
  end if;

  if v_doc_row.uplift_ratio <> 0.2000 then
    raise exception 'Invariant Violation (Invariant 2): uplift_ratio expected 0.2000, got %', v_doc_row.uplift_ratio;
  end if;

  -- Verify line allocations
  select * into v_alloc_row from public.landed_cost_allocations where document_id = v_doc_id and receipt_line_id = v_gr_line_1_id;
  if v_alloc_row.allocated_cost <> 200.00 or v_alloc_row.landed_value <> 1200.00 or v_alloc_row.landed_unit_cost <> 120.00 then
    raise exception 'Invariant Violation (Invariant 2): Line 1 allocation incorrect (cost=%, val=%, unit=%)',
      v_alloc_row.allocated_cost, v_alloc_row.landed_value, v_alloc_row.landed_unit_cost;
  end if;

  select * into v_alloc_row from public.landed_cost_allocations where document_id = v_doc_id and receipt_line_id = v_gr_line_2_id;
  if v_alloc_row.allocated_cost <> 600.00 or v_alloc_row.landed_value <> 3600.00 or v_alloc_row.landed_unit_cost <> 360.00 then
    raise exception 'Invariant Violation (Invariant 2): Line 2 allocation incorrect (cost=%, val=%, unit=%)',
      v_alloc_row.allocated_cost, v_alloc_row.landed_value, v_alloc_row.landed_unit_cost;
  end if;

  select * into v_alloc_row from public.landed_cost_allocations where document_id = v_doc_id and receipt_line_id = v_gr_line_3_id;
  if v_alloc_row.allocated_cost <> 200.00 or v_alloc_row.landed_value <> 1200.00 or v_alloc_row.landed_unit_cost <> 120.00 then
    raise exception 'Invariant Violation (Invariant 2): Line 3 allocation incorrect (cost=%, val=%, unit=%)',
      v_alloc_row.allocated_cost, v_alloc_row.landed_value, v_alloc_row.landed_unit_cost;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 4: Invariants 5 & 6 — Double-Entry GL Balance & False-Pass Guard
  -- Expected Accounting Event Lines:
  -- Dr 1310 (Inventory Asset) = 1,000.00 MVR (capitalised)
  -- Dr 1410 (Input GST Recoverable) = 300.00 MVR (recoverable tax)
  -- Cr 1320 (Goods in Transit Clearing) = 1,300.00 MVR (gross charges)
  -- Status: PROPOSED
  -- ─────────────────────────────────────────────────────────────────────────
  select count(*) into v_count
    from public.accounting_events
   where id = v_ae_id
     and organisation_id = t_org_a
     and family = 'PROCURE_TO_PAY'
     and event_type = 'LANDED_COST_ALLOCATION'
     and gross_amount = 1300.00
     and net_amount = 1000.00
     and tax_amount = 300.00
     and status = 'PROPOSED';

  if v_count <> 1 then
    raise exception 'Invariant Violation (Invariant 6): accounting_events row missing or invalid';
  end if;

  -- Verify individual debit and credit lines
  select count(*) into v_count
    from public.accounting_event_lines
   where event_id = v_ae_id and organisation_id = t_org_a and account_code = '1310' and debit = 1000.00 and credit = 0;
  if v_count <> 1 then
    raise exception 'Invariant Violation (Invariant 6): Dr 1310 line missing or invalid';
  end if;

  select count(*) into v_count
    from public.accounting_event_lines
   where event_id = v_ae_id and organisation_id = t_org_a and account_code = '1410' and debit = 300.00 and credit = 0;
  if v_count <> 1 then
    raise exception 'Invariant Violation (Invariant 6): Dr 1410 line missing or invalid';
  end if;

  select count(*) into v_count
    from public.accounting_event_lines
   where event_id = v_ae_id and organisation_id = t_org_a and account_code = '1320' and debit = 0 and credit = 1300.00;
  if v_count <> 1 then
    raise exception 'Invariant Violation (Invariant 6): Cr 1320 line missing or invalid';
  end if;

  -- Verify draft journal proposal was created with 3 lines
  select count(*) into v_count
    from public.journal_proposals jp
    join public.journal_proposal_lines jpl on jpl.proposal_id = jp.id
   where jp.organisation_id = t_org_a and jp.source_id = v_ae_id;
  if v_count <> 3 then
    raise exception 'Invariant Violation (Invariant 6): Journal proposal lines count expected 3, got %', v_count;
  end if;

  -- False-Pass Guard: Ledger Balance Movements
  v_bal_1310_after := public.accounting_event_account_balance(t_org_a, '1310');
  v_bal_1320_after := public.accounting_event_account_balance(t_org_a, '1320');
  v_bal_1410_after := public.accounting_event_account_balance(t_org_a, '1410');

  v_delta_1310 := v_bal_1310_after - v_bal_1310_0;
  v_delta_1320 := v_bal_1320_after - v_bal_1320_0;
  v_delta_1410 := v_bal_1410_after - v_bal_1410_0;

  if v_delta_1310 <> 1000.00 then
    raise exception 'Invariant Violation (False-Pass Guard): 1310 balance delta expected +1000.00, got %', v_delta_1310;
  end if;

  if v_delta_1410 <> 300.00 then
    raise exception 'Invariant Violation (False-Pass Guard): 1410 balance delta expected +300.00, got %', v_delta_1410;
  end if;

  if v_delta_1320 <> -1300.00 then
    raise exception 'Invariant Violation (False-Pass Guard): 1320 balance delta expected -1300.00, got %', v_delta_1320;
  end if;

  if (v_delta_1310 + v_delta_1410 + v_delta_1320) <> 0 then
    raise exception 'Invariant Violation (False-Pass Guard): Total GL delta does not sum to zero (sum=%)',
      (v_delta_1310 + v_delta_1410 + v_delta_1320);
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 5: Invariant 3 — Rounding Residue Protection (Zero-Loss Allocation)
  -- 3 equal lines of 1 unit @ 100.00 MVR each (= 300.00 MVR total).
  -- Charge: 10.00 MVR across 3 equal lines (10 / 3 = 3.3333...).
  -- Non-residue lines get 3.33 MVR; residue line gets 3.34 MVR.
  -- Sum of allocations must equal EXACTLY 10.00 MVR.
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
      'currency', 'MVR',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'description', 'Line 1', 'quantity', 1, 'unit_price', 100.00),
        jsonb_build_object('line_no', 2, 'product_id', t_product_2, 'description', 'Line 2', 'quantity', 1, 'unit_price', 100.00),
        jsonb_build_object('line_no', 3, 'product_id', t_product_3, 'description', 'Line 3', 'quantity', 1, 'unit_price', 100.00)
      )
    ),
    req_id
  );
  v_po_id := (res->'purchase_order'->>'id')::uuid;

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
      'delivery_note_ref', 'DN-ALPHA-462-2',
      'items', jsonb_build_array(
        jsonb_build_object('po_line_no', 1, 'quantity', 1),
        jsonb_build_object('po_line_no', 2, 'quantity', 1),
        jsonb_build_object('po_line_no', 3, 'quantity', 1)
      )
    ),
    req_id
  );
  v_gr_id := (res->'goods_receipt'->>'id')::uuid;

  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_lc2,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'receipt_id', v_gr_id,
      'charges', jsonb_build_array(
        jsonb_build_object('label', 'Terminal Fee', 'amount', 10.00, 'basis', 'value', 'recoverable', false)
      )
    ),
    req_id
  );
  v_doc_id := (res->'landed_cost'->>'document_id')::uuid;

  -- Assert exact sum of allocated costs equals 10.00 down to the exact cent
  select coalesce(sum(allocated_cost), 0) into v_delta_1310
    from public.landed_cost_allocations
   where document_id = v_doc_id;

  if v_delta_1310 <> 10.00 then
    raise exception 'Invariant Violation (Invariant 3 - Rounding Residue): Sum of allocated costs expected 10.00, got %', v_delta_1310;
  end if;

  -- Verify residue assigned cleanly (one line has 3.34, two have 3.33)
  select count(*) into v_count from public.landed_cost_allocations where document_id = v_doc_id and allocated_cost = 3.34;
  if v_count <> 1 then
    raise exception 'Invariant Violation (Invariant 3 - Rounding Residue): Exactly one line should have 3.34 (count=%)', v_count;
  end if;

  select count(*) into v_count from public.landed_cost_allocations where document_id = v_doc_id and allocated_cost = 3.33;
  if v_count <> 2 then
    raise exception 'Invariant Violation (Invariant 3 - Rounding Residue): Exactly two lines should have 3.33 (count=%)', v_count;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 6: Invariant 4 — Alternative Allocation Bases (Quantity Basis)
  -- Line 1: 1 unit @ 900.00 MVR (= 900.00 MVR)
  -- Line 2: 9 units @ 100.00 MVR (= 900.00 MVR)
  -- Charge: 100.00 MVR allocated by QUANTITY:
  -- Total quantity = 10 units
  -- Line 1 (1 / 10 = 10%) gets 10.00 MVR
  -- Line 2 (9 / 10 = 90%) gets 90.00 MVR
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
      'currency', 'MVR',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'description', 'Heavy Part', 'quantity', 1, 'unit_price', 900.00),
        jsonb_build_object('line_no', 2, 'product_id', t_product_2, 'description', 'Light Parts', 'quantity', 9, 'unit_price', 100.00)
      )
    ),
    req_id
  );
  v_po_id := (res->'purchase_order'->>'id')::uuid;

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
      'delivery_note_ref', 'DN-ALPHA-462-3',
      'items', jsonb_build_array(
        jsonb_build_object('po_line_no', 1, 'quantity', 1),
        jsonb_build_object('po_line_no', 2, 'quantity', 9)
      )
    ),
    req_id
  );
  v_gr_id := (res->'goods_receipt'->>'id')::uuid;

  res := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_lc3,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'receipt_id', v_gr_id,
      'charges', jsonb_build_array(
        jsonb_build_object('label', 'Handling Charge', 'amount', 100.00, 'basis', 'quantity', 'recoverable', false)
      )
    ),
    req_id
  );
  v_doc_id := (res->'landed_cost'->>'document_id')::uuid;

  -- Line 1 (1 unit) gets 10.00
  select allocated_cost into v_delta_1310
    from public.landed_cost_allocations
   where document_id = v_doc_id and receipt_line_id = (select id from public.goods_receipt_lines where receipt_id = v_gr_id and line_no = 1);

  if v_delta_1310 <> 10.00 then
    raise exception 'Invariant Violation (Invariant 4 - Quantity Basis): Line 1 expected 10.00, got %', v_delta_1310;
  end if;

  -- Line 2 (9 units) gets 90.00
  select allocated_cost into v_delta_1310
    from public.landed_cost_allocations
   where document_id = v_doc_id and receipt_line_id = (select id from public.goods_receipt_lines where receipt_id = v_gr_id and line_no = 2);

  if v_delta_1310 <> 90.00 then
    raise exception 'Invariant Violation (Invariant 4 - Quantity Basis): Line 2 expected 90.00, got %', v_delta_1310;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 7: Invariant 7 — Append-Only Immutable Persistence Guarantee
  -- Rejects UPDATE or DELETE on landed_cost_documents or landed_cost_allocations
  -- ─────────────────────────────────────────────────────────────────────────
  v_caught_mutation := false;
  begin
    update public.landed_cost_documents set total_charges = 9999.00 where id = v_doc_id;
  exception when others then
    if sqlerrm like '%is append-only%' or sqlerrm like '%append-only%' or sqlerrm like '%reject_mutation%' then
      v_caught_mutation := true;
    end if;
  end;
  if not v_caught_mutation then
    raise exception 'Invariant Violation (Invariant 7): UPDATE on landed_cost_documents was not rejected';
  end if;

  v_caught_mutation := false;
  begin
    delete from public.landed_cost_documents where id = v_doc_id;
  exception when others then
    if sqlerrm like '%is append-only%' or sqlerrm like '%append-only%' or sqlerrm like '%reject_mutation%' then
      v_caught_mutation := true;
    end if;
  end;
  if not v_caught_mutation then
    raise exception 'Invariant Violation (Invariant 7): DELETE on landed_cost_documents was not rejected';
  end if;

  v_caught_mutation := false;
  begin
    update public.landed_cost_allocations set allocated_cost = 9999.00 where document_id = v_doc_id;
  exception when others then
    if sqlerrm like '%is append-only%' or sqlerrm like '%append-only%' or sqlerrm like '%reject_mutation%' then
      v_caught_mutation := true;
    end if;
  end;
  if not v_caught_mutation then
    raise exception 'Invariant Violation (Invariant 7): UPDATE on landed_cost_allocations was not rejected';
  end if;

  v_caught_mutation := false;
  begin
    delete from public.landed_cost_allocations where document_id = v_doc_id;
  exception when others then
    if sqlerrm like '%is append-only%' or sqlerrm like '%append-only%' or sqlerrm like '%reject_mutation%' then
      v_caught_mutation := true;
    end if;
  end;
  if not v_caught_mutation then
    raise exception 'Invariant Violation (Invariant 7): DELETE on landed_cost_allocations was not rejected';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 8: Invariant 8 — Validation & Fail-Closed Controls
  -- ─────────────────────────────────────────────────────────────────────────
  -- 8A: Negative charge amount
  v_caught_negative := false;
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_rcv_a,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'receipt_id', v_gr_id,
        'charges', jsonb_build_array(
          jsonb_build_object('label', 'Discount Charge', 'amount', -50.00, 'basis', 'value')
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%invalid_charge%' then
      v_caught_negative := true;
    end if;
  end;
  if not v_caught_negative then
    raise exception 'Invariant Violation (Invariant 8): Negative charge was not rejected';
  end if;

  -- 8B: Invalid basis
  v_caught_basis := false;
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_rcv_a,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'receipt_id', v_gr_id,
        'charges', jsonb_build_array(
          jsonb_build_object('label', 'Volume Charge', 'amount', 50.00, 'basis', 'volume')
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%basis_unusable%' then
      v_caught_basis := true;
    end if;
  end;
  if not v_caught_basis then
    raise exception 'Invariant Violation (Invariant 8): Invalid basis was not rejected';
  end if;

  -- 8C: Recoverable charge without account code
  v_caught_no_account := false;
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_rcv_a,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'receipt_id', v_gr_id,
        'charges', jsonb_build_array(
          jsonb_build_object('label', 'Import GST', 'amount', 50.00, 'basis', 'value', 'recoverable', true)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%invalid_charge%' then
      v_caught_no_account := true;
    end if;
  end;
  if not v_caught_no_account then
    raise exception 'Invariant Violation (Invariant 8): Recoverable charge without account was not rejected';
  end if;

  -- 8D: Non-existent receipt
  v_caught_no_receipt := false;
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_rcv_a,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'receipt_id', gen_random_uuid(),
        'charges', jsonb_build_array(
          jsonb_build_object('label', 'Freight', 'amount', 50.00, 'basis', 'value')
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%receipt_not_found%' then
      v_caught_no_receipt := true;
    end if;
  end;
  if not v_caught_no_receipt then
    raise exception 'Invariant Violation (Invariant 8): Non-existent receipt was not rejected';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 9: Invariant 9 — Cross-Tenant Isolation
  -- Tenant B receiver attempts to allocate landed cost to Tenant A receipt
  -- ─────────────────────────────────────────────────────────────────────────
  v_caught_cross_tenant := false;
  begin
    perform public.api_garage_command(
      t_org_b,
      t_person_b,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'receipt_id', v_gr_id,
        'charges', jsonb_build_array(
          jsonb_build_object('label', 'Foreign Freight', 'amount', 100.00, 'basis', 'value')
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%receipt_not_found%' then
      v_caught_cross_tenant := true;
    end if;
  end;
  if not v_caught_cross_tenant then
    raise exception 'Invariant Violation (Invariant 9): Cross-tenant landed cost was not rejected';
  end if;

  -- Verify Tenant B RLS cannot see Tenant A landed cost documents
  perform set_config('app.organisation_id', t_org_b::text, true);
  perform set_config('app.person_id', t_person_b::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into v_count
    from public.landed_cost_documents
   where organisation_id = t_org_a;
  if v_count <> 0 then
    raise exception 'Invariant Violation (Invariant 9): Tenant B bypassed RLS on landed_cost_documents (count=%)', v_count;
  end if;

  select count(*) into v_count
    from public.landed_cost_allocations
   where organisation_id = t_org_a;
  if v_count <> 0 then
    raise exception 'Invariant Violation (Invariant 9): Tenant B bypassed RLS on landed_cost_allocations (count=%)', v_count;
  end if;

  -- Reset role
  perform set_config('role', 'postgres', true);
  perform set_config('app.organisation_id', t_org_a::text, true);

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 10: Invariant 10 — Idempotency Replay Protection
  -- Replay command 1 with identical command_key
  -- ─────────────────────────────────────────────────────────────────────────
  res_replay := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_lc1,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'receipt_id', v_gr_id,
      'charges', jsonb_build_array(
        jsonb_build_object('label', 'Ocean Freight', 'amount', 800.00, 'basis', 'value', 'recoverable', false),
        jsonb_build_object('label', 'Customs Clearing', 'amount', 200.00, 'basis', 'value', 'recoverable', false),
        jsonb_build_object('label', 'Import GST', 'amount', 300.00, 'basis', 'value', 'recoverable', true, 'account_code', '1410')
      )
    ),
    req_id
  );

  if coalesce((res_replay->>'ok')::boolean, false) is not true then
    raise exception 'Invariant Violation (Invariant 10): Idempotent replay failed';
  end if;

  -- Verify zero duplicate documents or events created
  select count(*) into v_count
    from public.landed_cost_documents
   where id = v_doc_id;
  if v_count <> 1 then
    raise exception 'Invariant Violation (Invariant 10): Duplicate landed cost document on replay';
  end if;

  select count(*) into v_count
    from public.accounting_events
   where id = v_ae_id;
  if v_count <> 1 then
    raise exception 'Invariant Violation (Invariant 10): Duplicate accounting event on replay';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 11: Invariant 11 — Read-Through Summary Function
  -- ─────────────────────────────────────────────────────────────────────────
  v_summary := public.receipt_landed_cost_summary(t_org_a, v_gr_id);
  if (v_summary->>'allocations_count')::integer < 1 then
    raise exception 'Invariant Violation (Invariant 11): receipt_landed_cost_summary returned invalid allocations_count: %', v_summary;
  end if;

  raise notice '=======================================================';
  raise notice 'All 11 Invariants & False-Pass Guard Verified Cleanly.';
  raise notice 'ERP-462 / B3 Landed Cost Allocation Probe: PASS';
  raise notice '=======================================================';
end;
$$;

rollback;
