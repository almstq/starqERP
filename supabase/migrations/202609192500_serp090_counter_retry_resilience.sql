-- SERP-090: Retry, Timeout & Negative-Authorization Resilience for Counter Operations
--
-- Preserves the strictly server-authoritative transaction model:
--   1. Replay Integrity & Conflict Detection:
--      Reusing an idempotency key with a conflicting payload raises idempotency_key_conflict (409),
--      while replaying with the same payload returns the committed result without duplicate side effects.
--   2. Negative Authorization Resilience:
--      Unauthorized seats fail closed with seat_not_authorized.
--      Cross-tenant requests fail closed with sale_not_found / location_not_found.
--      Segregated capacity returns without supervisor approval fail closed.
--   3. Server-Authoritative Online Gate:
--      Counter POS is strictly online server-authoritative. Offline transactional selling
--      and compensating negative stock balances are strictly prohibited.
--   4. Currency Architecture:
--      Derived dynamically from organisations.base_currency per commit 0c46cde, never hardcoded.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Harden api_counter_sale_reversal: conflict detection on key reuse
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.api_counter_sale_reversal(
  target_org uuid,
  target_person uuid,
  target_seat text,
  command_key uuid,
  command jsonb,
  request_identifier uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, app_private, extensions, pg_temp
as $$
declare
  v_reversal_type text;
  v_reason text;
  v_approval_mode text;
  v_approver_person_id uuid;
  v_approver_seat text;
  v_original_sale_id uuid;
  v_sale record;
  v_org_currency text;
  v_return_id uuid := gen_random_uuid();
  v_ret_no text;
  v_crn_id uuid := gen_random_uuid();
  v_crn_no text;
  v_existing record;
  v_cmd_items jsonb;
  v_cmd_tenders jsonb;
  v_item jsonb;
  v_tender_leg jsonb;
  v_pid uuid;
  v_return_qty numeric;
  v_orig_line record;
  v_prior_returned_qty numeric;
  v_line_no integer := 0;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_total_refund numeric := 0;
  v_line_rows jsonb := '[]'::jsonb;
  v_movements jsonb := '[]'::jsonb;
  v_movement_id uuid;
  v_tmethod text;
  v_tamount numeric;
  v_tender_total numeric := 0;
  v_tender_rows jsonb := '[]'::jsonb;
  v_audit_id uuid := gen_random_uuid();
  v_location_id uuid;
  v_customer_id uuid;
  v_prior_refunded_total numeric := 0;
begin
  -- 1. Active Seat Authorization Gate
  if not app_private.assert_active_seat(target_org, target_person, target_seat) then
    raise exception 'seat_not_authorized';
  end if;

  if target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  -- 2. Command Key Required
  if command_key is null then
    raise exception 'command_key_required';
  end if;

  -- 3. Parse Command Type & Target Sale ID
  v_reversal_type := lower(trim(coalesce(command->>'reversal_type', command->>'type', 'return')));
  if v_reversal_type in ('counter_void', 'void') then
    v_reversal_type := 'void';
  elsif v_reversal_type in ('counter_return', 'return') then
    v_reversal_type := 'return';
  elsif v_reversal_type in ('counter_refund', 'refund') then
    v_reversal_type := 'refund';
  else
    raise exception 'reversal_type_invalid';
  end if;

  v_original_sale_id := nullif(coalesce(command->>'original_sale_id', command->>'sale_id', ''), '')::uuid;
  if v_original_sale_id is null then
    raise exception 'original_sale_id_required';
  end if;

  -- 4. Idempotency Replay & Conflict Check
  select * into v_existing
    from public.counter_returns
   where organisation_id = target_org and idempotency_key = command_key;
  if found then
    -- Detect payload conflict: same key with different sale or reversal type
    if v_existing.original_sale_id <> v_original_sale_id or v_existing.reversal_type <> v_reversal_type then
      raise exception 'idempotency_key_conflict';
    end if;

    return jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'return', jsonb_build_object(
        'id', v_existing.id,
        'return_number', v_existing.return_number,
        'original_sale_id', v_existing.original_sale_id,
        'credit_note_id', v_existing.credit_note_id,
        'reversal_type', v_existing.reversal_type,
        'currency', v_existing.currency,
        'subtotal', v_existing.subtotal,
        'tax_total', v_existing.tax_total,
        'total_refund_amount', v_existing.total_refund_amount,
        'items', v_existing.items,
        'refund_tenders', v_existing.refund_tenders,
        'reason', v_existing.reason,
        'approval_mode', v_existing.approval_mode,
        'approver_person_id', v_existing.approver_person_id,
        'created_at', v_existing.created_at,
        'created_by', v_existing.created_by,
        'created_seat', v_existing.created_seat
      )
    );
  end if;

  v_reason := trim(coalesce(command->>'reason', ''));
  if length(v_reason) < 3 then
    raise exception 'reversal_reason_required';
  end if;

  -- 5. Role & Separation of Duties (SoD) Policy Gate (SERP-030)
  if target_seat in ('owner', 'managing_director', 'director') then
    v_approval_mode := 'manager_seat';
    v_approver_person_id := target_person;
    v_approver_seat := target_seat;
  else
    if command->>'approver_person_id' is not null then
      v_approver_person_id := (command->>'approver_person_id')::uuid;
      select ms.seat_code into v_approver_seat
        from public.memberships m
        join public.membership_seats ms on ms.membership_id = m.id
       where m.organisation_id = target_org
         and m.person_id = v_approver_person_id
         and m.status = 'active'
         and ms.seat_code in ('owner', 'managing_director', 'director')
       limit 1;

      if v_approver_seat is null then
        raise exception 'reversal_approver_unauthorized';
      end if;
      v_approval_mode := 'supervisor_override';
    elsif coalesce(command->>'operating_capacity', '') = 'solo' then
      v_approval_mode := 'solo_capacity';
      v_approver_person_id := target_person;
      v_approver_seat := target_seat;
    else
      raise exception 'reversal_approval_required';
    end if;
  end if;

  -- 6. Original Sale Resolution & Strict Tenant Isolation
  perform pg_advisory_xact_lock(hashtext(target_org::text || v_original_sale_id::text)::bigint);

  select * into v_sale
    from public.commercial_documents
   where organisation_id = target_org and id = v_original_sale_id;
  if not found then
    raise exception 'sale_not_found';
  end if;

  if v_sale.document_type <> 'sales_invoice' or coalesce(v_sale.metadata->>'counter_sale', 'false') <> 'true' then
    raise exception 'sale_not_counter_sale';
  end if;

  select base_currency into v_org_currency
    from public.organisations where id = target_org;
  if v_org_currency is null then
    raise exception 'organisation_not_found';
  end if;

  v_location_id := nullif(coalesce(command->>'location_id', v_sale.metadata->>'location_id', ''), '')::uuid;
  if v_location_id is null then
    raise exception 'location_required';
  end if;

  v_customer_id := v_sale.contact_id;

  -- 7. Line & Quantity Boundary Checks
  if v_reversal_type = 'void' then
    if exists (
      select 1 from public.counter_returns
       where organisation_id = target_org
         and original_sale_id = v_sale.id
         and reversal_type = 'void'
    ) then
      raise exception 'sale_already_voided';
    end if;

    if exists (
      select 1 from public.counter_returns
       where organisation_id = target_org
         and original_sale_id = v_sale.id
    ) then
      raise exception 'cannot_void_partially_returned_sale';
    end if;

    for v_orig_line in
      select * from public.commercial_document_lines
       where organisation_id = target_org and document_id = v_sale.id
       order by line_no asc
    loop
      v_line_no := v_line_no + 1;
      v_subtotal := v_subtotal + v_orig_line.net_amount;
      v_tax_total := v_tax_total + v_orig_line.tax_amount;
      v_total_refund := v_total_refund + v_orig_line.gross_amount;

      v_line_rows := v_line_rows || jsonb_build_array(jsonb_build_object(
        'line_no', v_line_no,
        'product_id', v_orig_line.product_id,
        'description', v_orig_line.description,
        'quantity', v_orig_line.quantity,
        'unit_price', v_orig_line.unit_price,
        'tax_rate', v_orig_line.tax_rate,
        'net_amount', v_orig_line.net_amount,
        'tax_amount', v_orig_line.tax_amount,
        'gross_amount', v_orig_line.gross_amount
      ));
    end loop;
  else
    v_cmd_items := coalesce(command->'items', '[]'::jsonb);
    if jsonb_typeof(v_cmd_items) <> 'array' or jsonb_array_length(v_cmd_items) = 0 then
      raise exception 'reversal_items_required';
    end if;

    for v_item in select elem from jsonb_array_elements(v_cmd_items) as t(elem)
    loop
      v_pid := nullif(coalesce(v_item->>'product_id', ''), '')::uuid;
      if v_pid is null then raise exception 'stock_line_product_not_found'; end if;

      v_return_qty := (v_item->>'quantity')::numeric;
      if v_return_qty is null or v_return_qty <= 0 then
        raise exception 'stock_line_quantity_positive';
      end if;

      select * into v_orig_line
        from public.commercial_document_lines
       where organisation_id = target_org
         and document_id = v_sale.id
         and product_id = v_pid
       limit 1;
      if not found then
        raise exception 'product_not_on_sale';
      end if;

      select coalesce(sum((item->>'quantity')::numeric), 0)
        into v_prior_returned_qty
        from public.counter_returns cr,
             jsonb_array_elements(cr.items) as item
       where cr.organisation_id = target_org
         and cr.original_sale_id = v_sale.id
         and (item->>'product_id')::uuid = v_pid;

      if (v_prior_returned_qty + v_return_qty) > v_orig_line.quantity then
        raise exception using message = 'return_quantity_exceeds_sale',
          detail = format('Cannot return %s of product %s; sold %s, previously returned %s',
                          v_return_qty, v_pid, v_orig_line.quantity, v_prior_returned_qty);
      end if;

      v_line_no := v_line_no + 1;
      declare
        v_line_net numeric := round(v_orig_line.net_amount * (v_return_qty / v_orig_line.quantity), 2);
        v_line_tax numeric := round(v_orig_line.tax_amount * (v_return_qty / v_orig_line.quantity), 2);
        v_line_gross numeric := v_line_net + v_line_tax;
      begin
        v_subtotal := v_subtotal + v_line_net;
        v_tax_total := v_tax_total + v_line_tax;
        v_total_refund := v_total_refund + v_line_gross;

        v_line_rows := v_line_rows || jsonb_build_array(jsonb_build_object(
          'line_no', v_line_no,
          'product_id', v_pid,
          'description', v_orig_line.description,
          'quantity', v_return_qty,
          'unit_price', v_orig_line.unit_price,
          'tax_rate', v_orig_line.tax_rate,
          'net_amount', v_line_net,
          'tax_amount', v_line_tax,
          'gross_amount', v_line_gross
        ));
      end;
    end loop;
  end if;

  select coalesce(sum(cr.total_refund_amount), 0) into v_prior_refunded_total
    from public.counter_returns cr
   where cr.organisation_id = target_org and cr.original_sale_id = v_sale.id;

  if (v_prior_refunded_total + v_total_refund) > v_sale.gross_total then
    raise exception using message = 'refund_amount_exceeds_sale',
      detail = format('Total refund %s would exceed sale gross %s',
                      v_prior_refunded_total + v_total_refund, v_sale.gross_total);
  end if;

  -- 8. Validate & Reconcile Refund Tenders
  v_cmd_tenders := coalesce(command->'refund_tenders', '[]'::jsonb);
  if v_reversal_type = 'void' and jsonb_array_length(v_cmd_tenders) = 0 then
    for v_tender_leg in
      select jsonb_build_object('payment_method', ct.payment_method, 'amount_tendered', ct.amount_tendered)
        from public.counter_tenders ct
        join public.counter_receipts cr on cr.receipt_id = ct.receipt_id
       where cr.organisation_id = target_org and cr.sale_id = v_sale.id
    loop
      v_tmethod := v_tender_leg->>'payment_method';
      v_tamount := (v_tender_leg->>'amount_tendered')::numeric;
      v_tender_total := v_tender_total + v_tamount;
      v_tender_rows := v_tender_rows || jsonb_build_array(jsonb_build_object(
        'method', v_tmethod, 'amount', v_tamount
      ));
    end loop;
  else
    if jsonb_typeof(v_cmd_tenders) <> 'array' or jsonb_array_length(v_cmd_tenders) = 0 then
      raise exception 'reversal_refund_tenders_required';
    end if;

    for v_tender_leg in select elem from jsonb_array_elements(v_cmd_tenders) as t(elem)
    loop
      v_tmethod := lower(trim(coalesce(v_tender_leg->>'method', '')));
      if v_tmethod not in ('cash', 'card', 'transfer', 'store_credit') then
        raise exception 'reversal_refund_method_invalid';
      end if;

      v_tamount := round(((v_tender_leg->>'amount')::numeric), 2);
      if v_tamount is null or v_tamount <= 0 then
        raise exception 'reversal_refund_amount_positive';
      end if;

      v_tender_total := v_tender_total + v_tamount;
      v_tender_rows := v_tender_rows || jsonb_build_array(jsonb_build_object(
        'method', v_tmethod, 'amount', v_tamount
      ));
    end loop;
  end if;

  if v_tender_total <> v_total_refund then
    raise exception using message = 'reversal_refund_mismatch',
      detail = format('Refund tenders sum %s must equal calculated refund total %s',
                      v_tender_total, v_total_refund);
  end if;

  -- 9. Allocate Document Numbers
  perform app_private.ensure_return_sequences(target_org);
  v_crn_no := app_private.allocate_document_no(target_org, 'credit_note');
  v_ret_no := app_private.allocate_document_no(target_org, 'counter_return');

  -- 10. Inventory Mutation: Positive Stock Return Movements
  for v_item in select elem from jsonb_array_elements(v_line_rows) as t(elem)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_return_qty := (v_item->>'quantity')::numeric;
    v_movement_id := gen_random_uuid();

    insert into public.stock_movements
      (id, organisation_id, location_id, product_id, movement_type, quantity,
       source_type, source_id, idempotency_key, occurred_at, recorded_by)
    values
      (v_movement_id, target_org, v_location_id, v_pid,
       'return', v_return_qty,
       case when v_reversal_type = 'void' then 'COUNTER_VOID' else 'COUNTER_RETURN' end,
       v_return_id,
       command_key,
       now(), target_person);

    v_movements := v_movements || jsonb_build_array(jsonb_build_object(
      'movement_id', v_movement_id,
      'product_id', v_pid,
      'movement_type', 'return',
      'quantity', v_return_qty
    ));
  end loop;

  -- 11. Commercial Document Consequence: Settled Credit Note
  insert into public.commercial_documents
    (id, organisation_id, document_type, document_no, contact_id, currency,
     gross_total, allocated_total, unallocated_balance, status, metadata,
     document_date, issued_at, issued_by)
  values
    (v_crn_id, target_org, 'credit_note', v_crn_no, v_customer_id, v_org_currency,
     v_total_refund, v_total_refund, 0, 'settled',
     jsonb_build_object(
       'counter_reversal', true,
       'reversal_type', v_reversal_type,
       'original_sale_id', v_sale.id,
       'original_sale_number', v_sale.document_no,
       'return_id', v_return_id,
       'return_number', v_ret_no,
       'location_id', v_location_id,
       'reason', v_reason,
       'approval_mode', v_approval_mode
     ),
     current_date, now(), target_person);

  insert into public.commercial_document_lines
    (organisation_id, document_id, line_no, product_id, description,
     quantity, unit_price, tax_rate, net_amount, tax_amount, gross_amount)
  select target_org, v_crn_id, (l->>'line_no')::integer, (l->>'product_id')::uuid,
         l->>'description', (l->>'quantity')::numeric, (l->>'unit_price')::numeric,
         (l->>'tax_rate')::numeric, (l->>'net_amount')::numeric,
         (l->>'tax_amount')::numeric, (l->>'gross_amount')::numeric
    from jsonb_array_elements(v_line_rows) as l;

  -- 12. Register Return Record
  insert into public.counter_returns
    (id, organisation_id, return_number, original_sale_id, credit_note_id,
     location_id, reversal_type, currency, subtotal, tax_total, total_refund_amount,
     items, refund_tenders, reason, approval_mode, approver_person_id, approver_seat,
     idempotency_key, created_at, created_by, created_seat)
  values
    (v_return_id, target_org, v_ret_no, v_sale.id, v_crn_id,
     v_location_id, v_reversal_type, v_org_currency, v_subtotal, v_tax_total, v_total_refund,
     v_line_rows, v_tender_rows, v_reason, v_approval_mode, v_approver_person_id, v_approver_seat,
     command_key, now(), target_person, target_seat);

  -- 13. Register Refund Tender Legs
  for v_tender_leg in select elem from jsonb_array_elements(v_tender_rows) as t(elem)
  loop
    insert into public.counter_refund_tenders
      (id, organisation_id, return_id, payment_method, amount, currency, recorded_by, recorded_seat)
    values
      (gen_random_uuid(), target_org, v_return_id,
       v_tender_leg->>'method', (v_tender_leg->>'amount')::numeric, v_org_currency, target_person, target_seat);
  end loop;

  -- 14. Attributable Audit Event
  insert into public.audit_events
    (organisation_id, actor_person_id, acting_seat, action, object_type,
     object_id, request_id, after_state, metadata)
  values
    (target_org, target_person, target_seat,
     case when v_reversal_type = 'void' then 'erp.counter_void' else 'erp.counter_return' end,
     'counter_returns', v_return_id, command_key,
     jsonb_build_object(
       'return_id', v_return_id,
       'return_number', v_ret_no,
       'credit_note_id', v_crn_id,
       'credit_note_number', v_crn_no,
       'original_sale_id', v_sale.id,
       'reversal_type', v_reversal_type,
       'total_refund_amount', v_total_refund,
       'approval_mode', v_approval_mode,
       'approver_person_id', v_approver_person_id
     ),
     jsonb_build_object('idempotency_key', command_key));

  -- 15. Transactional Outbox Event
  perform app_private.append_outbox_event(
    target_org,
    case when v_reversal_type = 'void' then 'COUNTER_VOID' else 'COUNTER_RETURN' end,
    'counter_returns',
    v_return_id::text,
    jsonb_build_object(
      'return_id', v_return_id,
      'return_number', v_ret_no,
      'original_sale_id', v_sale.id,
      'credit_note_id', v_crn_id,
      'credit_note_number', v_crn_no,
      'reversal_type', v_reversal_type,
      'currency', v_org_currency,
      'subtotal', v_subtotal,
      'tax_total', v_tax_total,
      'total_refund_amount', v_total_refund,
      'items', v_line_rows,
      'refund_tenders', v_tender_rows,
      'movements', v_movements,
      'approval_mode', v_approval_mode,
      'reason', v_reason
    ),
    jsonb_build_object('idempotency_key', command_key),
    target_person,
    target_seat
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'return', jsonb_build_object(
      'id', v_return_id,
      'return_number', v_ret_no,
      'original_sale_id', v_sale.id,
      'original_sale_number', v_sale.document_no,
      'credit_note_id', v_crn_id,
      'credit_note_number', v_crn_no,
      'location_id', v_location_id,
      'reversal_type', v_reversal_type,
      'currency', v_org_currency,
      'subtotal', v_subtotal,
      'tax_total', v_tax_total,
      'total_refund_amount', v_total_refund,
      'items', v_line_rows,
      'refund_tenders', v_tender_rows,
      'reason', v_reason,
      'approval_mode', v_approval_mode,
      'approver_person_id', v_approver_person_id,
      'created_at', now(),
      'created_by', target_person,
      'created_seat', target_seat
    )
  );
end;
$$;

revoke all on function public.api_counter_sale_reversal(uuid, uuid, text, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.api_counter_sale_reversal(uuid, uuid, text, uuid, jsonb, uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Harden api_counter_session_open: conflict detection on key reuse
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.api_counter_session_open(
  target_org uuid,
  target_person uuid,
  target_seat text,
  p_location_id uuid,
  p_opening_float numeric default 0,
  p_command_key uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, app_private, extensions, pg_temp
as $$
declare
  v_session_id uuid := gen_random_uuid();
  v_session_no text;
  v_org_currency text;
  v_existing record;
  v_float numeric;
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  if p_location_id is null or not exists (
    select 1 from public.locations
     where organisation_id = target_org and id = p_location_id and active
  ) then
    raise exception 'location_not_found';
  end if;

  v_float := round(coalesce(p_opening_float, 0), 2);
  if v_float < 0 then
    raise exception 'counter_session_float_negative';
  end if;

  select base_currency into v_org_currency
    from public.organisations where id = target_org;
  if v_org_currency is null then
    raise exception 'organisation_not_found';
  end if;

  -- Replay guard & Conflict Check
  if p_command_key is not null then
    select * into v_existing
      from public.counter_cash_sessions
     where organisation_id = target_org and idempotency_key = p_command_key;
    if found then
      if v_existing.location_id <> p_location_id then
        raise exception 'idempotency_key_conflict';
      end if;

      return jsonb_build_object(
        'ok', true,
        'idempotent_replay', true,
        'session', jsonb_build_object(
          'id', v_existing.id,
          'session_number', v_existing.session_number,
          'location_id', v_existing.location_id,
          'status', v_existing.status,
          'currency', v_existing.currency,
          'opened_at', v_existing.opened_at,
          'opened_by', v_existing.opened_by,
          'opened_seat', v_existing.opened_seat,
          'opening_float', v_existing.opening_float
        )
      );
    end if;
  end if;

  if exists (
    select 1 from public.counter_cash_sessions
     where organisation_id = target_org
       and location_id = p_location_id
       and status = 'open'
  ) then
    raise exception 'counter_session_already_open';
  end if;

  -- Sequence seeding
  insert into public.document_sequences (organisation_id, sequence_type, prefix, padding)
  values (target_org, 'cash_session', 'CS-', 5)
  on conflict (organisation_id, sequence_type) do nothing;

  v_session_no := app_private.allocate_document_no(target_org, 'cash_session');

  insert into public.counter_cash_sessions
    (id, organisation_id, session_number, location_id, status, currency,
     opened_at, opened_by, opened_seat, opening_float, idempotency_key)
  values
    (v_session_id, target_org, v_session_no, p_location_id, 'open', v_org_currency,
     now(), target_person, target_seat, v_float, p_command_key);

  insert into public.audit_events
    (organisation_id, actor_person_id, acting_seat, action, object_type,
     object_id, request_id, after_state, metadata)
  values
    (target_org, target_person, target_seat, 'erp.counter_session_open',
     'counter_cash_sessions', v_session_id, p_command_key,
     jsonb_build_object('status', 'open', 'opening_float', v_float, 'location_id', p_location_id),
     jsonb_build_object('idempotency_key', p_command_key));

  return jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'session', jsonb_build_object(
      'id', v_session_id,
      'session_number', v_session_no,
      'location_id', p_location_id,
      'status', 'open',
      'currency', v_org_currency,
      'opened_at', now(),
      'opened_by', target_person,
      'opened_seat', target_seat,
      'opening_float', v_float
    )
  );
end;
$$;

revoke all on function public.api_counter_session_open(uuid, uuid, text, uuid, numeric, uuid) from public, anon, authenticated;
grant execute on function public.api_counter_session_open(uuid, uuid, text, uuid, numeric, uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Harden api_counter_session_close: conflict detection on key reuse
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.api_counter_session_close(
  target_org uuid,
  target_person uuid,
  target_seat text,
  p_location_id uuid,
  p_counted_cash numeric,
  p_notes text default null,
  p_command_key uuid default null,
  p_opening_float numeric default null
) returns jsonb
language plpgsql
security definer
set search_path = public, app_private, extensions, pg_temp
as $$
declare
  v_open record;
  v_existing record;
  v_org_currency text;
  v_window_start timestamptz;
  v_closed_at timestamptz := now();
  v_opened_by uuid;
  v_opened_seat text;
  v_opening_float numeric := 0;
  v_tx_count integer := 0;
  v_cash_sales numeric := 0;
  v_card_sales numeric := 0;
  v_transfer_sales numeric := 0;
  v_total_sales numeric := 0;
  v_cash_refunds numeric := 0;
  v_expected_cash numeric := 0;
  v_counted_cash numeric;
  v_variance numeric := 0;
  v_clean_notes text;
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  if p_location_id is null or not exists (
    select 1 from public.locations
     where organisation_id = target_org and id = p_location_id and active
  ) then
    raise exception 'location_not_found';
  end if;

  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'counter_session_counted_cash_invalid';
  end if;
  v_counted_cash := round(p_counted_cash, 2);
  v_clean_notes := nullif(trim(coalesce(p_notes, '')), '');

  select base_currency into v_org_currency
    from public.organisations where id = target_org;
  if v_org_currency is null then
    raise exception 'organisation_not_found';
  end if;

  -- Replay guard & Conflict Check
  if p_command_key is not null then
    select * into v_existing
      from public.counter_cash_sessions
     where organisation_id = target_org and idempotency_key = p_command_key;
    if found then
      if v_existing.location_id <> p_location_id then
        raise exception 'idempotency_key_conflict';
      end if;

      return jsonb_build_object(
        'ok', true,
        'idempotent_replay', true,
        'session', jsonb_build_object(
          'id', v_existing.id,
          'session_number', v_existing.session_number,
          'location_id', v_existing.location_id,
          'status', v_existing.status,
          'currency', v_existing.currency,
          'opened_at', v_existing.opened_at,
          'opened_by', v_existing.opened_by,
          'closed_at', v_existing.closed_at,
          'closed_by', v_existing.closed_by,
          'closed_seat', v_existing.closed_seat,
          'opening_float', v_existing.opening_float,
          'transaction_count', v_existing.transaction_count,
          'cash_sales_amount', v_existing.cash_sales_amount,
          'card_sales_amount', v_existing.card_sales_amount,
          'transfer_sales_amount', v_existing.transfer_sales_amount,
          'total_sales_amount', v_existing.total_sales_amount,
          'expected_cash', v_existing.expected_cash,
          'counted_cash', v_existing.counted_cash,
          'variance_amount', v_existing.variance_amount,
          'notes', v_existing.notes
        )
      );
    end if;
  end if;

  -- Strictly require an active open session
  select * into v_open
    from public.counter_cash_sessions
   where organisation_id = target_org and location_id = p_location_id and status = 'open'
   order by opened_at desc limit 1;

  if not found then
    raise exception 'no_open_session';
  end if;

  v_window_start := v_open.opened_at;
  v_opened_by := v_open.opened_by;
  v_opened_seat := v_open.opened_seat;
  v_opening_float := v_open.opening_float;

  with receipt_summary as (
    select
      cr.receipt_id,
      cr.sale_id,
      cr.tendered_amount,
      cr.change_amount,
      coalesce(sum(case when ct.payment_method = 'cash' then ct.amount_tendered else 0 end), 0) as cash_tendered,
      coalesce(sum(case when ct.payment_method = 'card' then ct.amount_tendered else 0 end), 0) as card_tendered,
      coalesce(sum(case when ct.payment_method = 'transfer' then ct.amount_tendered else 0 end), 0) as transfer_tendered
    from public.counter_receipts cr
    join public.counter_tenders ct
      on ct.organisation_id = cr.organisation_id
     and ct.receipt_id = cr.receipt_id
    where cr.organisation_id = target_org
      and cr.issued_at >= v_window_start
      and cr.issued_at <= v_closed_at
      and exists (
        select 1 from public.stock_movements sm
         where sm.organisation_id = cr.organisation_id
           and sm.source_type = 'COUNTER_SALE'
           and sm.source_id = cr.sale_id
           and sm.location_id = p_location_id
      )
    group by cr.receipt_id, cr.sale_id, cr.tendered_amount, cr.change_amount
  )
  select
    coalesce(count(*), 0),
    coalesce(sum(cash_tendered - change_amount), 0),
    coalesce(sum(card_tendered), 0),
    coalesce(sum(transfer_tendered), 0),
    coalesce(sum(tendered_amount - change_amount), 0)
  into
    v_tx_count,
    v_cash_sales,
    v_card_sales,
    v_transfer_sales,
    v_total_sales
  from receipt_summary;

  select coalesce(sum(crt.amount), 0)
    into v_cash_refunds
    from public.counter_refund_tenders crt
    join public.counter_returns cr on cr.id = crt.return_id
   where cr.organisation_id = target_org
     and cr.location_id = p_location_id
     and crt.payment_method = 'cash'
     and cr.created_at >= v_window_start
     and cr.created_at <= v_closed_at;

  v_expected_cash := round(v_opening_float + v_cash_sales - v_cash_refunds, 2);
  v_variance := round(v_counted_cash - v_expected_cash, 2);

  update public.counter_cash_sessions
     set status = 'closed',
         closed_at = v_closed_at,
         closed_by = target_person,
         closed_seat = target_seat,
         transaction_count = v_tx_count,
         cash_sales_amount = v_cash_sales,
         card_sales_amount = v_card_sales,
         transfer_sales_amount = v_transfer_sales,
         total_sales_amount = v_total_sales,
         expected_cash = v_expected_cash,
         counted_cash = v_counted_cash,
         variance_amount = v_variance,
         notes = v_clean_notes,
         idempotency_key = coalesce(p_command_key, idempotency_key)
   where id = v_open.id;

  insert into public.audit_events
    (organisation_id, actor_person_id, acting_seat, action, object_type,
     object_id, request_id, after_state, metadata)
  values
    (target_org, target_person, target_seat, 'erp.counter_session_close',
     'counter_cash_sessions', v_open.id, p_command_key,
     jsonb_build_object(
       'status', 'closed',
       'session_number', v_open.session_number,
       'location_id', p_location_id,
       'expected_cash', v_expected_cash,
       'counted_cash', v_counted_cash,
       'variance_amount', v_variance,
       'transaction_count', v_tx_count
     ),
     jsonb_build_object('idempotency_key', p_command_key));

  return jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'session', jsonb_build_object(
      'id', v_open.id,
      'session_number', v_open.session_number,
      'location_id', p_location_id,
      'status', 'closed',
      'currency', v_org_currency,
      'opened_at', v_window_start,
      'opened_by', v_opened_by,
      'opened_seat', v_opened_seat,
      'closed_at', v_closed_at,
      'closed_by', target_person,
      'closed_seat', target_seat,
      'opening_float', v_opening_float,
      'transaction_count', v_tx_count,
      'cash_sales_amount', v_cash_sales,
      'card_sales_amount', v_card_sales,
      'transfer_sales_amount', v_transfer_sales,
      'total_sales_amount', v_total_sales,
      'expected_cash', v_expected_cash,
      'counted_cash', v_counted_cash,
      'variance_amount', v_variance,
      'notes', v_clean_notes
    )
  );
end;
$$;

revoke all on function public.api_counter_session_close(uuid, uuid, text, uuid, numeric, text, uuid, numeric) from public, anon, authenticated;
grant execute on function public.api_counter_session_close(uuid, uuid, text, uuid, numeric, text, uuid, numeric) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Server-Authoritative Resilience Status RPC
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.api_counter_resilience_status(
  target_org uuid,
  target_person uuid,
  target_seat text,
  p_location_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, app_private, extensions, pg_temp
as $$
declare
  v_org_currency text;
  v_session_id uuid := null;
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat) then
    raise exception 'seat_not_authorized';
  end if;

  if target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  select base_currency into v_org_currency
    from public.organisations
   where id = target_org;
  if v_org_currency is null then
    raise exception 'organisation_not_found';
  end if;

  if p_location_id is not null then
    if not exists (
      select 1 from public.locations
       where organisation_id = target_org and id = p_location_id and active
    ) then
      raise exception 'location_not_found';
    end if;

    select id into v_session_id
      from public.counter_cash_sessions
     where organisation_id = target_org
       and location_id = p_location_id
       and status = 'open'
     order by opened_at desc
     limit 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'server_authoritative', true,
    'offline_trading_prohibited', true,
    'compensating_negative_stock_prohibited', true,
    'currency', v_org_currency,
    'location_id', p_location_id,
    'has_open_session', (v_session_id is not null),
    'session_id', v_session_id
  );
end;
$$;

revoke all on function public.api_counter_resilience_status(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.api_counter_resilience_status(uuid, uuid, text, uuid) to service_role;
