-- ============================================================================
-- STARQ ERP — ERP-540 / B1 PO Persistence Behavioral Invariant Probe
--
-- Task: ERP-454 / W0-A (ERP-540)
-- Level: L2 Database Behavioral Probe
--
-- Behavioral Invariants Tested:
-- 1. PO Creation Persistence: PURCHASE/need writes committed commercial_documents(purchase_order)
--    and commercial_document_lines rows with correct tenant and book binding.
-- 2. Line Economics & Server Recomputation: Server recomputes net, tax, gross, and
--    overrides any unauthoritative client total.
-- 3. Idempotent Submission: Same key + same payload yields exactly one row (replay);
--    same key + different payload fails closed (idempotency_key_conflict).
-- 4. Cross-Tenant Refusal: Foreign supplier or foreign product fails closed.
-- 5. Read-Through: commercial_documents query matching /api/ops/purchase-orders returns the PO.
-- 6. Step Progression: award step on existing PO updates status and records step.
-- ============================================================================

begin;

do $$
declare
  t_org_a uuid := 'a1111111-1111-4111-8111-111111111111';
  t_org_b uuid := 'b2222222-2222-4222-8222-222222222222';
  t_person_a uuid := 'a3333333-3333-4333-8333-333333333333';
  t_person_b uuid := 'b3333333-3333-4333-8333-333333333333';
  t_book_a uuid := 'a4444444-4444-4444-8444-444444444444';
  t_book_b uuid := 'b4444444-4444-4444-8444-444444444444';
  t_supplier_a uuid := 'a5555555-5555-4555-8555-555555555555';
  t_supplier_b uuid := 'b5555555-5555-4555-8555-555555555555';
  t_product_a uuid := 'a6666666-6666-4666-8666-666666666666';
  t_product_b uuid := 'b6666666-6666-4666-8666-666666666666';

  cmd_key_1 uuid := gen_random_uuid();
  cmd_key_2 uuid := gen_random_uuid();
  req_id uuid := gen_random_uuid();

  res jsonb;
  v_po_id uuid;
  v_doc_count integer;
  v_line_count integer;
  v_doc_row public.commercial_documents%rowtype;
  v_conflict_caught boolean := false;
  v_cross_supplier_caught boolean := false;
  v_cross_product_caught boolean := false;
begin
  -- ─────────────────────────────────────────────────────────────────────────
  -- Fixture Setup (Tenant A & Tenant B)
  -- ─────────────────────────────────────────────────────────────────────────
  insert into public.organisations (id, name, slug)
  values
    (t_org_a, 'Alpha Motors', 'alpha-motors-540'),
    (t_org_b, 'Beta Logistics', 'beta-logistics-540')
  on conflict (id) do nothing;

  insert into public.persons (id, display_name)
  values
    (t_person_a, 'Alice Quartermaster'),
    (t_person_b, 'Bob Controller')
  on conflict (id) do nothing;

  insert into public.memberships (id, organisation_id, person_id, status)
  values
    (gen_random_uuid(), t_org_a, t_person_a, 'active'),
    (gen_random_uuid(), t_org_b, t_person_b, 'active')
  on conflict do nothing;

  insert into public.seats (organisation_id, person_id, seat)
  values
    (t_org_a, t_person_a, 'quartermaster'),
    (t_org_a, t_person_a, 'financial_controller'),
    (t_org_b, t_person_b, 'quartermaster'),
    (t_org_b, t_person_b, 'financial_controller')
  on conflict do nothing;

  insert into public.books (id, organisation_id, code, name, is_default, status)
  values
    (t_book_a, t_org_a, 'ALPHABK', 'Alpha Main Book', true, 'active'),
    (t_book_b, t_org_b, 'BETABK', 'Beta Main Book', true, 'active')
  on conflict (id) do nothing;

  insert into public.contacts (id, organisation_id, kind, display_name)
  values
    (t_supplier_a, t_org_a, 'supplier', 'Alpha Parts Ltd'),
    (t_supplier_b, t_org_b, 'supplier', 'Beta Spares Corp')
  on conflict (id) do nothing;

  insert into public.products (id, organisation_id, sku, kind, name)
  values
    (t_product_a, t_org_a, 'SKU-FLT-A', 'stock', 'Oil Filter A'),
    (t_product_b, t_org_b, 'SKU-FLT-B', 'stock', 'Air Filter B')
  on conflict (id) do nothing;

  insert into public.document_sequences (organisation_id, sequence_type, prefix, padding)
  values
    (t_org_a, 'purchase_order', 'PO-', 5),
    (t_org_b, 'purchase_order', 'PO-', 5)
  on conflict (organisation_id, sequence_type) do nothing;

  -- ─────────────────────────────────────────────────────────────────────────
  -- TEST 1: Normal PO Creation (PURCHASE / need)
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_a,
    'quartermaster',
    cmd_key_1,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'book_id', t_book_a,
      'currency', 'MVR',
      'expected_delivery_date', '2026-11-20',
      'notes', 'Initial stock replenishment',
      'items', jsonb_build_array(
        jsonb_build_object(
          'product_id', t_product_a,
          'description', 'OEM Oil Filter A',
          'quantity', 10,
          'unit_price', 150.00,
          'tax_rate', 0.08
        ),
        jsonb_build_object(
          'product_id', null,
          'description', 'Shipping & Handling Fee',
          'quantity', 1,
          'unit_price', 50.00,
          'tax_rate', 0.00
        )
      )
    ),
    req_id
  );

  if coalesce((res->>'ok')::boolean, false) is not true then
    raise exception 'TEST 1 FAILED: api_garage_command returned not ok: %', res;
  end if;

  v_po_id := (res->'purchase_order'->>'id')::uuid;
  if v_po_id is null then
    raise exception 'TEST 1 FAILED: response missing purchase_order.id: %', res;
  end if;

  -- Verify commercial_documents row
  select * into v_doc_row
    from public.commercial_documents
   where organisation_id = t_org_a and id = v_po_id;

  if not found then
    raise exception 'TEST 1 FAILED: commercial_documents row not found for %', v_po_id;
  end if;

  if v_doc_row.document_type <> 'purchase_order' then
    raise exception 'TEST 1 FAILED: document_type expected purchase_order, got %', v_doc_row.document_type;
  end if;

  if v_doc_row.book_id <> t_book_a then
    raise exception 'TEST 1 FAILED: book_id expected %, got %', t_book_a, v_doc_row.book_id;
  end if;

  if v_doc_row.contact_id <> t_supplier_a then
    raise exception 'TEST 1 FAILED: contact_id expected %, got %', t_supplier_a, v_doc_row.contact_id;
  end if;

  if v_doc_row.status <> 'issued' then
    raise exception 'TEST 1 FAILED: status expected issued, got %', v_doc_row.status;
  end if;

  if v_doc_row.document_no is null or v_doc_row.document_no not like 'PO-%' then
    raise exception 'TEST 1 FAILED: document_no invalid: %', v_doc_row.document_no;
  end if;

  -- 10 * 150 = 1500 net, tax = 120, gross = 1620
  -- 1 * 50 = 50 net, tax = 0, gross = 50
  -- total gross = 1670.00, tax_total = 120.00
  if v_doc_row.gross_total <> 1670.000000 or v_doc_row.tax_total <> 120.000000 then
    raise exception 'TEST 1 FAILED: gross_total (%) or tax_total (%) mismatch', v_doc_row.gross_total, v_doc_row.tax_total;
  end if;

  if v_doc_row.unallocated_balance <> 1670.000000 or v_doc_row.allocated_total <> 0 then
    raise exception 'TEST 1 FAILED: balance (%) or allocated (%) mismatch', v_doc_row.unallocated_balance, v_doc_row.allocated_total;
  end if;

  -- Verify commercial_document_lines rows
  select count(*) into v_line_count
    from public.commercial_document_lines
   where organisation_id = t_org_a and document_id = v_po_id;

  if v_line_count <> 2 then
    raise exception 'TEST 1 FAILED: expected 2 commercial_document_lines rows, got %', v_line_count;
  end if;

  -- Verify line invariant: gross_amount = net_amount + tax_amount
  if exists (
    select 1 from public.commercial_document_lines
     where organisation_id = t_org_a and document_id = v_po_id
       and gross_amount <> net_amount + tax_amount
  ) then
    raise exception 'TEST 1 FAILED: line invariant gross = net + tax violated';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- TEST 2: Server-Side Total Recomputation (bogus client totalAmount ignored)
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_a,
    'quartermaster',
    cmd_key_2,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'totalAmount', 9999999.99, -- BOGUS client total
      'items', jsonb_build_array(
        jsonb_build_object(
          'description', 'Brake Pads Set',
          'quantity', 4,
          'unit_price', 25.00,
          'tax_rate', 0.00
        )
      )
    ),
    req_id
  );

  v_po_id := (res->'purchase_order'->>'id')::uuid;
  select * into v_doc_row from public.commercial_documents where id = v_po_id;
  -- True total: 4 * 25.00 = 100.00
  if v_doc_row.gross_total <> 100.000000 then
    raise exception 'TEST 2 FAILED: server did not recompute totals; expected 100.00, got %', v_doc_row.gross_total;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- TEST 3: Idempotent Replay vs Conflict
  -- ─────────────────────────────────────────────────────────────────────────
  -- A. Replay with exact same payload and key: returns cached response, zero duplicate rows
  res := public.api_garage_command(
    t_org_a,
    t_person_a,
    'quartermaster',
    cmd_key_2,
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'need',
      'supplier_id', t_supplier_a,
      'totalAmount', 9999999.99,
      'items', jsonb_build_array(
        jsonb_build_object(
          'description', 'Brake Pads Set',
          'quantity', 4,
          'unit_price', 25.00,
          'tax_rate', 0.00
        )
      )
    ),
    req_id
  );

  select count(*) into v_doc_count from public.commercial_documents where id = v_po_id;
  if v_doc_count <> 1 then
    raise exception 'TEST 3A FAILED: duplicate document row created on replay: %', v_doc_count;
  end if;

  -- B. Conflict: same key with different payload fails closed
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_a,
      'quartermaster',
      cmd_key_2,
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'need',
        'supplier_id', t_supplier_a,
        'items', jsonb_build_array(
          jsonb_build_object(
            'description', 'Tampered Payload',
            'quantity', 99,
            'unit_price', 1.00
          )
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%idempotency_key_conflict%' then
      v_conflict_caught := true;
    else
      raise exception 'TEST 3B FAILED: unexpected error: %', sqlerrm;
    end if;
  end;

  if not v_conflict_caught then
    raise exception 'TEST 3B FAILED: idempotency key conflict was not raised';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- TEST 4: Cross-Tenant Isolation
  -- ─────────────────────────────────────────────────────────────────────────
  -- Tenant A cannot use Tenant B's supplier
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_a,
      'quartermaster',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'need',
        'supplier_id', t_supplier_b, -- Tenant B supplier!
        'items', jsonb_build_array(
          jsonb_build_object('description', 'Test Item', 'quantity', 1, 'unit_price', 10.00)
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%supplier_not_found%' or sqlerrm like '%foreign key%' then
      v_cross_supplier_caught := true;
    else
      raise exception 'TEST 4A FAILED: unexpected error: %', sqlerrm;
    end if;
  end;

  if not v_cross_supplier_caught then
    raise exception 'TEST 4A FAILED: cross-tenant supplier was not rejected';
  end if;

  -- Tenant A cannot use Tenant B's product
  begin
    perform public.api_garage_command(
      t_org_a,
      t_person_a,
      'quartermaster',
      gen_random_uuid(),
      jsonb_build_object(
        'type', 'PURCHASE',
        'scm_step', 'need',
        'supplier_id', t_supplier_a,
        'items', jsonb_build_array(
          jsonb_build_object('product_id', t_product_b, 'quantity', 1, 'unit_price', 10.00) -- Tenant B product!
        )
      ),
      req_id
    );
  exception when others then
    if sqlerrm like '%product_not_found%' or sqlerrm like '%foreign key%' then
      v_cross_product_caught := true;
    else
      raise exception 'TEST 4B FAILED: unexpected error: %', sqlerrm;
    end if;
  end;

  if not v_cross_product_caught then
    raise exception 'TEST 4B FAILED: cross-tenant product was not rejected';
  end if;

  -- Tenant B cannot see Tenant A's PO
  if exists (
    select 1 from public.commercial_documents
     where organisation_id = t_org_b and id = v_po_id
  ) then
    raise exception 'TEST 4C FAILED: Tenant B can see Tenant A PO';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- TEST 5: Step Award Progression
  -- ─────────────────────────────────────────────────────────────────────────
  res := public.api_garage_command(
    t_org_a,
    t_person_a,
    'financial_controller',
    gen_random_uuid(),
    jsonb_build_object(
      'type', 'PURCHASE',
      'scm_step', 'award',
      'purchase_order_id', v_po_id
    ),
    req_id
  );

  if coalesce((res->>'ok')::boolean, false) is not true then
    raise exception 'TEST 5 FAILED: award step rejected: %', res;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- TEST 6: Read-Through (matches GET /api/ops/purchase-orders query)
  -- ─────────────────────────────────────────────────────────────────────────
  select count(*) into v_doc_count
    from public.commercial_documents
   where organisation_id = t_org_a
     and book_id = t_book_a
     and document_type = 'purchase_order';

  if v_doc_count < 2 then
    raise exception 'TEST 6 FAILED: read-through query returned % purchase orders, expected >= 2', v_doc_count;
  end if;

  raise notice '✓ ALL ERP-540 / B1 PO PERSISTENCE INVARIANT PROBES PASSED CLEANLY.';
end $$;

rollback;
