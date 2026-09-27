-- =============================================================================
-- SPOS-008: ATOMIC CHECKOUT & REPRINT RESILIENCE PROBE
--
-- PROVES:
--   1. Atomic Checkout: Sale/lines/tender/inventory/receipt succeed together or not at all.
--   2. Atomic Rollback: Incomplete or failed sales leave zero database residue.
--   3. Append-Only Inventory: Stock issues occur exactly once per sale line.
--   4. Duplicate-Proof Reprinting: api_counter_receipt_mark_rendered increments
--      render count on the authoritative receipt without creating extra documents,
--      tenders, or inventory movements.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: SETUP TEST TENANT, OUTLET, OPERATOR & CATALOGUE
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid := '80000000-0000-4000-8000-000000000001'::uuid;
  v_loc uuid := '80000000-0000-4000-8000-000000000010'::uuid;
  v_person uuid := '80000000-0000-4000-8000-000000000020'::uuid;
  v_role uuid := '80000000-0000-4000-8000-000000000021'::uuid;
  v_member uuid := '80000000-0000-4000-8000-000000000022'::uuid;
  v_prod uuid := '80000000-0000-4000-8000-000000000030'::uuid;
  v_onhand numeric;
BEGIN
  -- 1. Organisation
  INSERT INTO public.organisations (id, slug, legal_name, base_currency, status)
  VALUES (v_org, 'probe-spos008-mvr', 'SPOS-008 Test Store', 'MVR', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Location (Outlet)
  INSERT INTO public.locations (id, organisation_id, code, name, kind, active)
  VALUES (v_loc, v_org, 'POS-OUTLET', 'Main Counter Outlet', 'office', true)
  ON CONFLICT (id) DO NOTHING;

  -- 3. Person, Role, Membership & Active Seat
  INSERT INTO public.persons (id, person_key, display_label, status)
  VALUES (v_person, 'probe:spos008:cashier', 'SPOS-008 Cashier', 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.roles (id, organisation_id, code, name)
  VALUES (v_role, v_org, 'counter', 'Counter Role')
  ON CONFLICT (organisation_id, code) DO NOTHING;

  INSERT INTO public.memberships (id, organisation_id, person_id, role_id, status)
  VALUES (v_member, v_org, v_person, v_role, 'active')
  ON CONFLICT (organisation_id, person_id) DO NOTHING;

  INSERT INTO public.membership_seats (membership_id, seat_code)
  VALUES (v_member, 'counter')
  ON CONFLICT DO NOTHING;

  -- 4. Tax registration
  INSERT INTO public.tax_registrations (organisation_id, tax_type, registration_status, effective_from)
  VALUES (v_org, 'gst_general', 'registered', '2020-01-01')
  ON CONFLICT DO NOTHING;

  -- 5. Product with price and initial stock
  INSERT INTO public.products (
    id, organisation_id, sku, name, kind, active, sale_allowed, tax_classification
  ) VALUES (
    v_prod, v_org, 'SKU-SPOS8-COKE', 'Coca Cola 330ml Can', 'stock', true, true, 'zero_rated'
  ) ON CONFLICT (id) DO NOTHING;

  -- Product price: 20.00 MVR
  INSERT INTO public.product_prices (organisation_id, product_id, currency, amount, valid_from)
  VALUES (v_org, v_prod, 'MVR', 20.00, now() - interval '1 day');

  -- Initial Stock: 25 units
  INSERT INTO public.stock_movements (
    organisation_id, location_id, product_id, movement_type,
    quantity, unit_cost, source_type, source_id, idempotency_key, occurred_at, recorded_by
  ) VALUES (
    v_org, v_loc, v_prod, 'opening',
    25, 12.00, 'OPENING_BALANCE', gen_random_uuid(), gen_random_uuid(), now() - interval '2 hours', v_person
  );

  SELECT coalesce(derived_quantity, 0) INTO v_onhand
    FROM public.stock_movements_derived_onhand(v_org, v_loc, v_prod);
  IF v_onhand <> 25 THEN
    RAISE EXCEPTION 'SETUP FAILED: initial on-hand should be 25, got %', v_onhand;
  END IF;
END;
$$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: PROVE ATOMIC ROLLBACK ON TRANSACTION ABORT
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

DO $$
DECLARE
  v_org uuid := '80000000-0000-4000-8000-000000000001'::uuid;
  v_loc uuid := '80000000-0000-4000-8000-000000000010'::uuid;
  v_person uuid := '80000000-0000-4000-8000-000000000020'::uuid;
  v_prod uuid := '80000000-0000-4000-8000-000000000030'::uuid;
  v_abort_key uuid := '80000000-0000-4000-8000-000000000102'::uuid;
  v_res jsonb;
BEGIN
  -- Perform sale in this transaction that will be deliberately rolled back
  v_res := public.api_garage_command(
    v_org, v_person, 'counter', v_abort_key,
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 5)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 100.00))
    ),
    gen_random_uuid()
  );
  IF (v_res->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Pre-rollback sale failed: %', v_res;
  END IF;
END;
$$;

-- Deliberate transaction abort (simulates client/network crash or failure prior to commit)
ROLLBACK;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: PROVE ZERO RESIDUE AFTER ROLLBACK
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

DO $$
DECLARE
  v_org uuid := '80000000-0000-4000-8000-000000000001'::uuid;
  v_loc uuid := '80000000-0000-4000-8000-000000000010'::uuid;
  v_prod uuid := '80000000-0000-4000-8000-000000000030'::uuid;
  v_abort_key uuid := '80000000-0000-4000-8000-000000000102'::uuid;
  v_doc_count integer;
  v_tender_count integer;
  v_receipt_count integer;
  v_onhand numeric;
  v_key_count integer;
BEGIN
  SELECT count(*) INTO v_doc_count FROM public.commercial_documents WHERE organisation_id = v_org;
  IF v_doc_count <> 0 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: commercial document leaked after rollback: %', v_doc_count;
  END IF;

  SELECT count(*) INTO v_tender_count FROM public.counter_tenders WHERE organisation_id = v_org;
  IF v_tender_count <> 0 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: tender row leaked after rollback: %', v_tender_count;
  END IF;

  SELECT count(*) INTO v_receipt_count FROM public.counter_receipts WHERE organisation_id = v_org;
  IF v_receipt_count <> 0 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: receipt row leaked after rollback: %', v_receipt_count;
  END IF;

  SELECT count(*) INTO v_key_count FROM public.idempotency_keys WHERE key = v_abort_key;
  IF v_key_count <> 0 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: idempotency key leaked after rollback: %', v_key_count;
  END IF;

  -- Stock must be completely unaffected: exactly 25
  SELECT coalesce(derived_quantity, 0) INTO v_onhand
    FROM public.stock_movements_derived_onhand(v_org, v_loc, v_prod);
  IF v_onhand <> 25 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: stock mutated by rolled-back transaction: %', v_onhand;
  END IF;

  RAISE NOTICE 'STEP 3 PASS: Zero database residue confirmed after rollback.';
END;
$$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: PROVE ATOMIC COMMIT (COMMITTED SALE)
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

DO $$
DECLARE
  v_org uuid := '80000000-0000-4000-8000-000000000001'::uuid;
  v_loc uuid := '80000000-0000-4000-8000-000000000010'::uuid;
  v_person uuid := '80000000-0000-4000-8000-000000000020'::uuid;
  v_prod uuid := '80000000-0000-4000-8000-000000000030'::uuid;
  v_sale_key uuid := '80000000-0000-4000-8000-000000000103'::uuid;
  v_res jsonb;
BEGIN
  -- Sale of 3 units (3 * 20 = 60.00 MVR), cash tendered 100.00 MVR (change 40.00 MVR)
  v_res := public.api_garage_command(
    v_org, v_person, 'counter', v_sale_key,
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 3)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 100.00))
    ),
    gen_random_uuid()
  );

  IF (v_res->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'STEP 4 FAILED: sale command rejected %', v_res;
  END IF;
END;
$$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: PROVE COMMITTED INVARIANTS (INVENTORY & RECEIPT DURABILITY)
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

DO $$
DECLARE
  v_org uuid := '80000000-0000-4000-8000-000000000001'::uuid;
  v_loc uuid := '80000000-0000-4000-8000-000000000010'::uuid;
  v_prod uuid := '80000000-0000-4000-8000-000000000030'::uuid;
  v_invoice record;
  v_receipt record;
  v_tenders_count integer;
  v_movements_count integer;
  v_onhand numeric;
BEGIN
  -- Commercial Document
  SELECT * INTO v_invoice FROM public.commercial_documents
   WHERE organisation_id = v_org AND document_type = 'sales_invoice';
  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'ASSERTION FAILED [5.1]: commercial document not found';
  END IF;
  IF v_invoice.gross_total <> 60.00 THEN
    RAISE EXCEPTION 'ASSERTION FAILED [5.1]: invoice gross_total should be 60.00, got %', v_invoice.gross_total;
  END IF;

  -- Tender
  SELECT count(*) INTO v_tenders_count FROM public.counter_tenders WHERE organisation_id = v_org;
  IF v_tenders_count <> 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED [5.2]: expected exactly 1 tender row, got %', v_tenders_count;
  END IF;

  -- Receipt
  SELECT * INTO v_receipt FROM public.counter_receipts WHERE organisation_id = v_org;
  IF v_receipt.id IS NULL THEN
    RAISE EXCEPTION 'ASSERTION FAILED [5.3]: counter receipt not found';
  END IF;
  IF v_receipt.renders <> 0 THEN
    RAISE EXCEPTION 'ASSERTION FAILED [5.3]: initial receipt renders should be 0, got %', v_receipt.renders;
  END IF;

  -- Append-only Inventory Movement: exactly 1 sale issue
  SELECT count(*) INTO v_movements_count FROM public.stock_movements
   WHERE organisation_id = v_org AND source_type = 'COUNTER_SALE';
  IF v_movements_count <> 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED [5.4]: expected exactly 1 sale_issue stock movement, got %', v_movements_count;
  END IF;

  -- Derived on-hand: 25 - 3 = 22
  SELECT coalesce(derived_quantity, 0) INTO v_onhand
    FROM public.stock_movements_derived_onhand(v_org, v_loc, v_prod);
  IF v_onhand <> 22 THEN
    RAISE EXCEPTION 'ASSERTION FAILED [5.5]: derived on-hand should be 22, got %', v_onhand;
  END IF;

  RAISE NOTICE 'STEP 5 PASS: Atomic commit & append-only inventory issue confirmed.';
END;
$$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: PROVE DUPLICATE-PROOF REPRINT (SPOS-008 INVARIANT)
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

DO $$
DECLARE
  v_org uuid := '80000000-0000-4000-8000-000000000001'::uuid;
  v_loc uuid := '80000000-0000-4000-8000-000000000010'::uuid;
  v_person uuid := '80000000-0000-4000-8000-000000000020'::uuid;
  v_prod uuid := '80000000-0000-4000-8000-000000000030'::uuid;
  v_receipt record;
  v_reprint_res jsonb;
  v_docs_count integer;
  v_movements_count integer;
  v_audit_count integer;
  v_onhand numeric;
BEGIN
  SELECT * INTO v_receipt FROM public.counter_receipts WHERE organisation_id = v_org;

  -- Execute duplicate reprint mark rendered
  v_reprint_res := public.api_counter_receipt_mark_rendered(
    v_org, v_person, 'counter', v_receipt.receipt_id, gen_random_uuid()
  );

  IF (v_reprint_res->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'STEP 6 FAILED: api_counter_receipt_mark_rendered failed %', v_reprint_res;
  END IF;
  IF (v_reprint_res->>'renders')::integer <> 1 THEN
    RAISE EXCEPTION 'STEP 6 FAILED: renders should be incremented to 1, got %', v_reprint_res->>'renders';
  END IF;

  -- Invariant: Zero extra documents created (still exactly 2: sales_invoice and receipt payment document)
  SELECT count(*) INTO v_docs_count FROM public.commercial_documents WHERE organisation_id = v_org;
  IF v_docs_count <> 2 THEN
    RAISE EXCEPTION 'ASSERTION FAILED [6.1]: reprint must not create extra commercial documents: %', v_docs_count;
  END IF;

  -- Invariant: Zero extra stock movements created (still exactly 1 sale issue)
  SELECT count(*) INTO v_movements_count FROM public.stock_movements
   WHERE organisation_id = v_org AND source_type = 'COUNTER_SALE';
  IF v_movements_count <> 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED [6.2]: reprint must not duplicate stock movements: %', v_movements_count;
  END IF;

  -- Invariant: On-hand stock is strictly unchanged (still 22)
  SELECT coalesce(derived_quantity, 0) INTO v_onhand
    FROM public.stock_movements_derived_onhand(v_org, v_loc, v_prod);
  IF v_onhand <> 22 THEN
    RAISE EXCEPTION 'ASSERTION FAILED [6.3]: stock mutated during reprint: %', v_onhand;
  END IF;

  -- Invariant: Audit event logged for duplicate reprint
  SELECT count(*) INTO v_audit_count FROM public.audit_events
   WHERE organisation_id = v_org AND action = 'erp.counter_receipt_render';
  IF v_audit_count < 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED [6.4]: audit event missing for receipt render: %', v_audit_count;
  END IF;

  RAISE NOTICE 'STEP 6 PASS: SPOS-008 duplicate reprint invariant fully verified.';
END;
$$;

COMMIT;

-- =============================================================================
-- PROBE COMPLETE: ALL SPOS-008 INVARIANTS PASSED
-- =============================================================================
