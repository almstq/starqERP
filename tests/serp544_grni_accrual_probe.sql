-- ============================================================================
-- STARQ ERP — ERP-544 / B2a GRNI Accrual Behavioral Invariant Probe
--
-- Task: ERP-454 / W0-C (ERP-544)
-- Level: L2 Database Behavioral Invariant Probe
-- Mandate: docs/roadmap/FOUNDER_APPROVED_BUSINESS_LIFECYCLE_BOARD_RECONSTRUCTION_2026-11-06.md
-- Execution Package: docs/roadmap/ERP-544_B2a_GRNI_EXECUTION_PACKAGE_2026-11-07.md
-- Authority: Founder Decision D2; Room #18513 & #18514
--
-- All 8 L4 Acceptance Criteria & False-Pass Guard Tested:
-- 1. [Criterion 1] 2160 exists on a fresh DB after applyAllMigrations.
-- 2. [Criterion 2] Re-running the seed does not duplicate the account.
-- 3. [Criterion 3] A receipt produces ONE accounting_events row and balanced lines Dr 1310 / Cr 2160.
-- 4. [Criterion 4] 2160 balance equals received-not-invoiced value across MULTIPLE receipts.
-- 5. [Criterion 5] A receipt with zero value or unknown item is refused BEFORE an event is written.
-- 6. [Criterion 6] Cross-tenant receipt cannot post into another tenant's 2160.
-- 7. [Criterion 7] propose_journal_from_accounting_event accepts balanced; rejects unbalanced.
-- 8. [False-Pass Guard] Must assert BOTH lines, their accounts, and that 1310 and 2160 balances move by the EQUAL amount.
-- 9. [Idempotency] Replay of receipt produces zero duplicate accounting events or proposal lines.
-- ============================================================================

begin;

do $$
declare
  t_org_a uuid := 'a1111111-1111-4111-8111-111111111111';
  t_org_b uuid := 'b2222222-2222-4222-8222-222222222222';
  t_person_qm_a uuid := 'a3333333-3333-4333-8333-333333333333';
  t_person_rcv_a uuid := 'a8888888-8888-4888-8888-888888888888';
  t_person_b uuid := 'b3333333-3333-4333-8333-333333333333';
  t_mem_qm_a uuid := 'a7777777-7777-4777-8777-777777777777';
  t_mem_rcv_a uuid := 'a7777777-7777-4777-8777-888888888888';
  t_mem_b uuid := 'b7777777-7777-4777-8777-777777777777';
  t_book_a uuid := 'a4444444-4444-4444-8444-444444444444';
  t_book_b uuid := 'b4444444-4444-4444-8444-444444444444';
  t_supplier_a uuid := 'a5555555-5555-4555-8555-555555555555';
  t_supplier_b uuid := 'b5555555-5555-4555-8555-555555555555';
  t_product_1 uuid := 'a6666666-6666-4666-8666-666666666666';
  t_product_2 uuid := 'a6666666-6666-4666-8666-777777777777';
  t_location_a uuid := 'a9999999-9999-4999-8999-999999999999';
  t_location_b uuid := 'b9999999-9999-4999-8999-999999999999';

  cmd_key_po uuid := gen_random_uuid();
  cmd_key_po_zero uuid := gen_random_uuid();
  cmd_key_rcv1 uuid := gen_random_uuid();
  cmd_key_rcv2 uuid := gen_random_uuid();
  req_id uuid := gen_random_uuid();

  res jsonb;
  res_replay jsonb;
  v_po_id uuid;
  v_po_zero_id uuid;
  v_gr_id_1 uuid;
  v_gr_id_2 uuid;
  v_ae_id_1 uuid;
  v_ae_id_2 uuid;

  v_count integer;
  v_coa_row public.chart_of_accounts%rowtype;
  v_bal_1310_0 numeric(20, 6);
  v_bal_2160_0 numeric(20, 6);
  v_bal_1310_1 numeric(20, 6);
  v_bal_2160_1 numeric(20, 6);
  v_bal_1310_2 numeric(20, 6);
  v_bal_2160_2 numeric(20, 6);
  v_bal_before_replay numeric(20, 6);
  v_delta_1310 numeric(20, 6);
  v_delta_2160 numeric(20, 6);

  v_caught_zero boolean := false;
  v_caught_unknown boolean := false;
  v_caught_cross_tenant boolean := false;
  v_caught_unbalanced boolean := false;
  v_unbal_event_id uuid := gen_random_uuid();
  v_bal_test_event_id uuid := gen_random_uuid();
  v_test_proposal_id uuid;
begin
  raise notice '=======================================================';
  raise notice 'Running ERP-544 / B2a GRNI Accrual Behavioral Probe';
  raise notice '=======================================================';

  -- ─────────────────────────────────────────────────────────────────────────
  -- Fixtures Setup (Tenant A & Tenant B)
  -- ─────────────────────────────────────────────────────────────────────────
  insert into public.organisations (id, slug, legal_name)
  values
    (t_org_a, 'alpha-motors-544', 'Alpha Motors 544'),
    (t_org_b, 'beta-garages-544', 'Beta Garages 544')
  on conflict (id) do nothing;

  insert into public.persons (id, person_key, display_label)
  values
    (t_person_qm_a, 'person_alpha_qm_544', 'Alice Quartermaster'),
    (t_person_rcv_a, 'person_alpha_rcv_544', 'Charlie Receiver'),
    (t_person_b, 'person_beta_rcv_544', 'Bob Foreign Receiver')
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
    (t_book_a, t_org_a, 'ALPHA544', 'Alpha Main Book', true, 'active'),
    (t_book_b, t_org_b, 'BETA544', 'Beta Main Book', true, 'active')
  on conflict (id) do nothing;

  insert into public.locations (id, organisation_id, code, name, kind, active)
  values
    (t_location_a, t_org_a, 'MAIN-WH-544', 'Alpha Main Warehouse', 'warehouse', true),
    (t_location_b, t_org_b, 'BETA-WH-544', 'Beta Warehouse', 'warehouse', true)
  on conflict (id) do nothing;

  insert into public.contacts (id, organisation_id, kind, display_name)
  values
    (t_supplier_a, t_org_a, 'supplier', 'Alpha Parts Ltd'),
    (t_supplier_b, t_org_b, 'supplier', 'Beta Spares Co')
  on conflict (id) do nothing;

  insert into public.products (id, organisation_id, sku, kind, name, active)
  values
    (t_product_1, t_org_a, 'SKU-OIL-FIL-544', 'stock', 'Alpha Synthetic Oil Filter', true),
    (t_product_2, t_org_a, 'SKU-BRK-PAD-544', 'stock', 'Alpha Ceramic Brake Pads', true)
  on conflict (id) do nothing;

  -- Ensure 1310 exists in chart_of_accounts for test tenants
  insert into public.chart_of_accounts (
    organisation_id, code, name, account_class, subtype, parent_code, level, currency, posting_control, description
  ) values
    (t_org_a, '1310', 'Stock on Hand (Inventory)', 'ASSET', 'INVENTORY', '1300', 3, 'MVR', 'control', 'Inventory stock asset'),
    (t_org_b, '1310', 'Stock on Hand (Inventory)', 'ASSET', 'INVENTORY', '1300', 3, 'MVR', 'control', 'Inventory stock asset')
  on conflict (organisation_id, code) do nothing;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 1: Acceptance Criteria 1 & 2 — CoA 2160 Seed & Idempotency
  -- ─────────────────────────────────────────────────────────────────────────
  -- Criterion 1: 2160 exists after applyAllMigrations on seeded organisations
  select count(*) into v_count
    from public.chart_of_accounts
   where code = '2160';

  if v_count < 1 then
    raise exception 'Invariant Violation (Criterion 1): 2160 does not exist in chart_of_accounts after migrations';
  end if;

  -- Seed 2160 for Tenant A and Tenant B via seed_grni_account_for_organisation
  perform public.seed_grni_account_for_organisation(t_org_a);
  perform public.seed_grni_account_for_organisation(t_org_b);

  select count(*) into v_count
    from public.chart_of_accounts
   where organisation_id = t_org_a and code = '2160';

  if v_count <> 1 then
    raise exception 'Invariant Violation (Criterion 1): 2160 does not exist in chart_of_accounts for Tenant A (count=%)', v_count;
  end if;

  select * into v_coa_row
    from public.chart_of_accounts
   where organisation_id = t_org_a and code = '2160';

  if v_coa_row.account_class <> 'LIABILITY' or v_coa_row.posting_control <> 'control' then
    raise exception 'Invariant Violation (Criterion 1): 2160 attributes mismatch (class=%, posting_control=%)',
      v_coa_row.account_class, v_coa_row.posting_control;
  end if;

  -- Test Idempotent re-run (Criterion 2): re-running the seed must NOT duplicate or corrupt 2160
  perform public.seed_grni_account_for_organisation(t_org_a);

  select count(*) into v_count
    from public.chart_of_accounts
   where organisation_id = t_org_a and code = '2160';

  if v_count <> 1 then
    raise exception 'Invariant Violation (Criterion 2): Re-running seed duplicated 2160 (count=%)', v_count;
  end if;

  -- Record initial balances
  v_bal_1310_0 := public.accounting_event_account_balance(t_org_a, '1310');
  v_bal_2160_0 := public.grni_balance(t_org_a);

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 2: PO Setup via PURCHASE/need
  -- PO 1: 10 Oil Filters @ 15.00 MVR (Line 1) + 5 Brake Pads @ 20.00 MVR (Line 2)
  -- Total PO value = 150.00 + 100.00 = 250.00 MVR
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
      'currency', 'MVR',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'description', 'Oil Filters', 'quantity', 10, 'unit_price', 15.00),
        jsonb_build_object('line_no', 2, 'product_id', t_product_2, 'description', 'Brake Pads', 'quantity', 5, 'unit_price', 20.00)
      )
    ),
    req_id
  );

  if coalesce((res->>'ok')::boolean, false) is not true then
    raise exception 'PO creation failed: %', res;
  end if;

  v_po_id := (res->'purchase_order'->>'id')::uuid;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 3: Acceptance Criterion 5 — Refusal of Zero Value or Unknown Item Before Event Emission
  -- ─────────────────────────────────────────────────────────────────────────
  -- 3A: Attempt to receive an unknown PO line (po_line_no = 999)
  v_caught_unknown := false;
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
          jsonb_build_object('po_line_no', 999, 'quantity', 2)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%purchase_order_line_not_found%' or sqlerrm like '%receipt_product_mismatches_po_line%' then
      v_caught_unknown := true;
    end if;
  end;

  if not v_caught_unknown then
    raise exception 'Invariant Violation (Criterion 5): Unknown PO line was not refused';
  end if;

  -- 3B: Create a zero-value PO and verify zero-value receipt is refused BEFORE event emission
  res := public.api_garage_command(
    t_org_a,
    t_person_qm_a,
    'quartermaster',
    cmd_key_po_zero,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'currency', 'MVR',
      'items', jsonb_build_array(
        jsonb_build_object('line_no', 1, 'product_id', t_product_1, 'description', 'Free Samples', 'quantity', 5, 'unit_price', 0.00)
      )
    ),
    req_id
  );
  v_po_zero_id := (res->'purchase_order'->>'id')::uuid;

  v_caught_zero := false;
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_rcv_a,
      'receiver',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'receive',
        'purchase_order_id', v_po_zero_id,
        'location_id', t_location_a,
        'items', jsonb_build_array(
          jsonb_build_object('po_line_no', 1, 'quantity', 2)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%receipt_value_must_be_positive%' then
      v_caught_zero := true;
    end if;
  end;

  if not v_caught_zero then
    raise exception 'Invariant Violation (Criterion 5): Zero-value receipt was not refused';
  end if;

  -- Verify 0 accounting events were emitted for the zero-value PO
  select count(*) into v_count
    from public.accounting_events
   where organisation_id = t_org_a
     and metadata->>'purchase_order_id' = v_po_zero_id::text;
  if v_count <> 0 then
    raise exception 'Invariant Violation (Criterion 5): Accounting event was emitted for refused zero-value receipt (count=%)', v_count;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 4: Acceptance Criterion 3 & False-Pass Guard — Partial Receipt GL Accrual
  -- Receive 4 Oil Filters @ 15.00 MVR (= 60.00 MVR)
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
      'delivery_note_ref', 'DN-ALPHA-101',
      'items', jsonb_build_array(
        jsonb_build_object('po_line_no', 1, 'quantity', 4)
      )
    ),
    req_id
  );

  if coalesce((res->>'ok')::boolean, false) is not true then
    raise exception 'Partial receipt failed: %', res;
  end if;

  v_gr_id_1 := (res->'goods_receipt'->>'id')::uuid;
  v_ae_id_1 := (res->'accounting_event'->>'id')::uuid;

  if v_ae_id_1 is null then
    raise exception 'Invariant Violation (Criterion 3): accounting_event ID not returned in response';
  end if;

  -- Verify exactly ONE accounting_events row persisted
  select count(*) into v_count
    from public.accounting_events
   where id = v_ae_id_1
     and organisation_id = t_org_a
     and source_type = 'goods_receipt'
     and source_id = v_gr_id_1
     and gross_amount = 60.00
     and status = 'PROPOSED';
  if v_count <> 1 then
    raise exception 'Invariant Violation (Criterion 3): accounting_events row not persisted with status PROPOSED and gross_amount 60.00';
  end if;

  -- Verify balanced lines: Dr 1310 / Cr 2160
  select count(*) into v_count
    from public.accounting_event_lines
   where event_id = v_ae_id_1
     and organisation_id = t_org_a
     and account_code = '1310'
     and debit = 60.00
     and credit = 0;
  if v_count <> 1 then
    raise exception 'Invariant Violation (Criterion 3): Debit 1310 line not found with amount 60.00';
  end if;

  select count(*) into v_count
    from public.accounting_event_lines
   where event_id = v_ae_id_1
     and organisation_id = t_org_a
     and account_code = '2160'
     and debit = 0
     and credit = 60.00;
  if v_count <> 1 then
    raise exception 'Invariant Violation (Criterion 3): Credit 2160 line not found with amount 60.00';
  end if;

  -- Verify draft journal proposal was created
  select count(*) into v_count
    from public.journal_proposals jp
    join public.journal_proposal_lines jpl on jpl.proposal_id = jp.id
   where jp.organisation_id = t_org_a
     and jp.source_id = v_ae_id_1;
  if v_count <> 2 then
    raise exception 'Invariant Violation (Criterion 3): Draft journal proposal does not contain exactly 2 lines (count=%)', v_count;
  end if;

  -- Check False-Pass Guard on Receipt 1:
  -- Assert BOTH lines, accounts, and that 1310 and 2160 balances move by the EQUAL amount
  v_bal_1310_1 := public.accounting_event_account_balance(t_org_a, '1310');
  v_bal_2160_1 := public.grni_balance(t_org_a);

  v_delta_1310 := v_bal_1310_1 - v_bal_1310_0;
  v_delta_2160 := v_bal_2160_1 - v_bal_2160_0;

  if v_delta_1310 <> 60.00 then
    raise exception 'Invariant Violation (False-Pass Guard): 1310 balance delta expected 60.00, got %', v_delta_1310;
  end if;

  if v_delta_2160 <> 60.00 then
    raise exception 'Invariant Violation (False-Pass Guard): 2160 balance delta expected 60.00, got %', v_delta_2160;
  end if;

  if v_delta_1310 <> v_delta_2160 then
    raise exception 'Invariant Violation (False-Pass Guard): 1310 delta (%) does not equal 2160 delta (%)', v_delta_1310, v_delta_2160;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 5: Acceptance Criterion 4 — Multiple Receipts Cumulative 2160 Balance
  -- Second receipt: complete the PO (remaining 6 Filters @ 15 = 90, 5 Pads @ 20 = 100 -> Total 190.00)
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
      'delivery_note_ref', 'DN-ALPHA-102',
      'items', jsonb_build_array(
        jsonb_build_object('po_line_no', 1, 'quantity', 6),
        jsonb_build_object('po_line_no', 2, 'quantity', 5)
      )
    ),
    req_id
  );

  if coalesce((res->>'ok')::boolean, false) is not true then
    raise exception 'Second receipt failed: %', res;
  end if;

  v_gr_id_2 := (res->'goods_receipt'->>'id')::uuid;
  v_ae_id_2 := (res->'accounting_event'->>'id')::uuid;

  if (res->'accounting_event'->>'gross_amount')::numeric <> 190.00 then
    raise exception 'Invariant Violation (Criterion 4): Second receipt gross_amount expected 190.00, got %',
      res->'accounting_event'->>'gross_amount';
  end if;

  -- Check False-Pass Guard on Receipt 2
  v_bal_1310_2 := public.accounting_event_account_balance(t_org_a, '1310');
  v_bal_2160_2 := public.grni_balance(t_org_a);

  v_delta_1310 := v_bal_1310_2 - v_bal_1310_1;
  v_delta_2160 := v_bal_2160_2 - v_bal_2160_1;

  if v_delta_1310 <> 190.00 or v_delta_2160 <> 190.00 or v_delta_1310 <> v_delta_2160 then
    raise exception 'Invariant Violation (False-Pass Guard): Receipt 2 balance movement invalid (delta_1310=%, delta_2160=%)',
      v_delta_1310, v_delta_2160;
  end if;

  -- Cumulative Criterion 4: across multiple receipts, 2160 balance equals total received-not-invoiced (60 + 190 = 250.00 MVR)
  if (v_bal_2160_2 - v_bal_2160_0) <> 250.00 then
    raise exception 'Invariant Violation (Criterion 4): Cumulative 2160 balance expected 250.00, got %',
      (v_bal_2160_2 - v_bal_2160_0);
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 6: Acceptance Criterion 6 — Cross-Tenant Isolation
  -- Tenant B receiver attempts to receive against Tenant A's PO
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
        'purchase_order_id', v_po_id,
        'location_id', t_location_b,
        'items', jsonb_build_array(
          jsonb_build_object('po_line_no', 1, 'quantity', 1)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%purchase_order_not_found%' then
      v_caught_cross_tenant := true;
    end if;
  end;

  if not v_caught_cross_tenant then
    raise exception 'Invariant Violation (Criterion 6): Cross-tenant receipt was not refused';
  end if;

  -- Assert Tenant A and Tenant B balances are unaffected
  if public.grni_balance(t_org_b) <> 0 then
    raise exception 'Invariant Violation (Criterion 6): Tenant B GRNI balance moved unexpectedly';
  end if;
  if public.grni_balance(t_org_a) <> v_bal_2160_2 then
    raise exception 'Invariant Violation (Criterion 6): Tenant A GRNI balance altered by cross-tenant attempt';
  end if;

  -- Test propose_journal_from_accounting_event cross-tenant refusal
  perform set_config('app.organisation_id', t_org_b::text, true);
  perform set_config('app.person_id', t_person_b::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  v_caught_cross_tenant := false;
  begin
    perform public.propose_journal_from_accounting_event(t_org_a, v_ae_id_1, t_person_b);
  exception when others then
    if sqlerrm like '%access_denied%' then
      v_caught_cross_tenant := true;
    end if;
  end;

  if not v_caught_cross_tenant then
    raise exception 'Invariant Violation (Criterion 6): Cross-tenant propose_journal was not rejected with access_denied';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 7: Acceptance Criterion 7 — propose_journal_from_accounting_event Validation
  -- Unbalanced event must be rejected; balanced event must be accepted
  -- ─────────────────────────────────────────────────────────────────────────
  perform set_config('app.organisation_id', t_org_a::text, true);
  perform set_config('app.person_id', t_person_rcv_a::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  insert into public.accounting_events (
    id, organisation_id, family, event_type, source_type, source_id,
    idempotency_key, event_date, gross_amount, narration
  ) values (
    v_unbal_event_id, t_org_a, 'PROCURE_TO_PAY', 'TEST_UNBALANCED', 'test', gen_random_uuid(),
    'idem_unbal_test', current_date, 100.0, 'Unbalanced Test Event'
  );

  insert into public.accounting_event_lines (
    id, organisation_id, event_id, line_no, account_code, debit, credit
  ) values
    (gen_random_uuid(), t_org_a, v_unbal_event_id, 1, '1310', 100.0, 0),
    (gen_random_uuid(), t_org_a, v_unbal_event_id, 2, '2160', 0, 80.0);

  v_caught_unbalanced := false;
  begin
    perform public.propose_journal_from_accounting_event(t_org_a, v_unbal_event_id, t_person_rcv_a);
  exception when others then
    if sqlerrm like '%accounting_event_unbalanced%' then
      v_caught_unbalanced := true;
    end if;
  end;

  if not v_caught_unbalanced then
    raise exception 'Invariant Violation (Criterion 7): Unbalanced accounting event was not rejected';
  end if;

  -- Balanced variant test
  insert into public.accounting_events (
    id, organisation_id, family, event_type, source_type, source_id,
    idempotency_key, event_date, gross_amount, narration
  ) values (
    v_bal_test_event_id, t_org_a, 'PROCURE_TO_PAY', 'TEST_BALANCED', 'test', gen_random_uuid(),
    'idem_bal_test', current_date, 100.0, 'Balanced Test Event'
  );

  insert into public.accounting_event_lines (
    id, organisation_id, event_id, line_no, account_code, debit, credit
  ) values
    (gen_random_uuid(), t_org_a, v_bal_test_event_id, 1, '1310', 100.0, 0),
    (gen_random_uuid(), t_org_a, v_bal_test_event_id, 2, '2160', 0, 100.0);

  v_test_proposal_id := public.propose_journal_from_accounting_event(t_org_a, v_bal_test_event_id, t_person_rcv_a);
  if v_test_proposal_id is null then
    raise exception 'Invariant Violation (Criterion 7): Balanced test proposal failed to return proposal ID';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 8: Idempotency Replay Protection
  -- Replay Receipt 2 with identical command_key
  -- ─────────────────────────────────────────────────────────────────────────
  v_bal_before_replay := public.grni_balance(t_org_a);

  res_replay := public.api_garage_command(
    t_org_a,
    t_person_rcv_a,
    'receiver',
    cmd_key_rcv2,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'receive',
      'purchase_order_id', v_po_id,
      'location_id', t_location_a,
      'delivery_note_ref', 'DN-ALPHA-102',
      'items', jsonb_build_array(
        jsonb_build_object('po_line_no', 1, 'quantity', 6),
        jsonb_build_object('po_line_no', 2, 'quantity', 5)
      )
    ),
    req_id
  );

  if coalesce((res_replay->>'ok')::boolean, false) is not true then
    raise exception 'Idempotent replay failed';
  end if;

  -- Verify zero duplicate accounting events or lines created
  select count(*) into v_count
    from public.accounting_events
   where organisation_id = t_org_a
     and source_id = v_gr_id_2;
  if v_count <> 1 then
    raise exception 'Invariant Violation (Idempotency): Duplicate accounting_events created on replay (count=%)', v_count;
  end if;

  -- Verify 2160 balance remained exact
  if public.grni_balance(t_org_a) <> v_bal_before_replay then
    raise exception 'Invariant Violation (Idempotency): Balance altered on idempotent replay (before=%, after=%)',
      v_bal_before_replay, public.grni_balance(t_org_a);
  end if;

  raise notice '=======================================================';
  raise notice 'All 8 Invariants & False-Pass Guard Verified Cleanly.';
  raise notice 'ERP-544 / B2a GRNI Accrual Probe: PASS';
  raise notice '=======================================================';
end;
$$;

rollback;
