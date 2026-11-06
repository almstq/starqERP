-- =============================================================================
-- Migration: 202609192359_serp088_counter_return_refund_void.sql
-- SERP-088 (M6-COUNTER) — Controlled return, refund and void.
--
-- Real dependencies: SERP-087 (accepted) and SERP-030 (done).
-- Builds server-authoritative reversals linked to original counter sales:
--   1. Sequence initialization for 'credit_note' and 'counter_return'.
--   2. Register table: public.counter_returns — one row per return/void event,
--      recording original sale, items returned, refund tenders, approval mode,
--      operator and supervisor attribution, and reason.
--   3. Register table: public.counter_refund_tenders — itemized refund legs
--      per payment method (cash, card, transfer, store_credit).
--   4. Stored Procedure: public.api_counter_sale_reversal — atomic execution of
--      void or itemized return with:
--      - Linking to original sale in same tenant (cross-tenant fails closed);
--      - SoD & approval gate per SERP-030: managerial seats have direct authority;
--        counter seat requires supervisor override (manager approver) in segregated
--        capacity, or records honest compensating exception in solo capacity;
--        unauthorized seats fail closed;
--      - Inventory restoration: positive stock_movements ('return') into canonical
--        stock ledger; live on-hand updates immediately;
--      - Financial consequence: settled credit_note in commercial_documents and
--        refund tenders in counter_refund_tenders;
--      - Concurrency: advisory transaction lock on original sale prevents race/double-return;
--      - Validation: cannot void already-voided/partially-returned sale; return qty
--        cannot exceed sold qty minus prior returns; refund cannot exceed sale net;
--      - Idempotency: replaying command_key returns stored return record;
--      - Auditing: attributable audit_events and transactional outbox event;
--      - Currency: derived from organisations.base_currency (commit 0c46cde).
--   5. Read-only recovery RPCs: api_counter_return_get, api_counter_return_list.
--   6. Cash session update: api_counter_session_current and api_counter_session_close
--      reconcile cash refunds against cash sales so expected cash remains exact.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Sequences for Credit Notes and Counter Returns
-- -----------------------------------------------------------------------------
create or replace function app_private.ensure_return_sequences(p_org uuid)
returns void language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
begin
  insert into public.document_sequences (organisation_id, sequence_type, prefix, padding)
  values
    (p_org, 'credit_note', 'CRN-', 5),
    (p_org, 'counter_return', 'RET-', 5)
  on conflict (organisation_id, sequence_type) do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Register Table: public.counter_returns
-- -----------------------------------------------------------------------------
create table if not exists public.counter_returns (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  return_number text not null,
  original_sale_id uuid not null,
  credit_note_id uuid not null,
  location_id uuid not null references public.locations(id),
  reversal_type text not null check (reversal_type in ('return', 'void', 'refund')),
  currency character(3) not null,
  subtotal numeric(20, 6) not null default 0 check (subtotal >= 0),
  tax_total numeric(20, 6) not null default 0 check (tax_total >= 0),
  total_refund_amount numeric(20, 6) not null check (total_refund_amount >= 0),
  items jsonb not null default '[]'::jsonb,
  refund_tenders jsonb not null default '[]'::jsonb,
  reason text not null check (length(trim(reason)) >= 3),
  approval_mode text not null check (approval_mode in ('manager_seat', 'solo_capacity', 'supervisor_override')),
  approver_person_id uuid references public.persons(id),
  approver_seat text,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.persons(id),
  created_seat text not null,
  unique (organisation_id, id),
  unique (organisation_id, idempotency_key),
  unique (organisation_id, return_number),
  foreign key (organisation_id, original_sale_id)
    references public.commercial_documents(organisation_id, id),
  foreign key (organisation_id, credit_note_id)
    references public.commercial_documents(organisation_id, id)
);

create table if not exists public.counter_refund_tenders (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  return_id uuid not null references public.counter_returns(id) on delete cascade,
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer', 'store_credit')),
  amount numeric(20, 6) not null check (amount > 0),
  currency character(3) not null,
  recorded_by uuid not null references public.persons(id),
  recorded_seat text not null,
  created_at timestamptz not null default now(),
  unique (organisation_id, id),
  unique (organisation_id, return_id, payment_method)
);

revoke all on table public.counter_returns from public, anon, authenticated;
grant select, insert on table public.counter_returns to service_role;

revoke all on table public.counter_refund_tenders from public, anon, authenticated;
grant select, insert on table public.counter_refund_tenders to service_role;

-- -----------------------------------------------------------------------------
-- 3. Stored Procedure: api_counter_sale_reversal
-- -----------------------------------------------------------------------------
create or replace function public.api_counter_sale_reversal(
  target_org uuid,
  target_person uuid,
  target_seat text,
  command_key uuid,
  command jsonb,
  request_identifier uuid default null
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  v_org_currency character(3);
  v_existing public.counter_returns%rowtype;
  v_reversal_type text;
  v_original_sale_id uuid;
  v_sale public.commercial_documents%rowtype;
  v_location_id uuid;
  v_reason text;
  v_approval_mode text;
  v_approver_person_id uuid;
  v_approver_seat text;
  v_return_id uuid := gen_random_uuid();
  v_return_no text;
  v_cn_id uuid := gen_random_uuid();
  v_cn_no text;

  -- Items & Lines calculation
  v_cmd_items jsonb;
  v_item jsonb;
  v_orig_line public.commercial_document_lines%rowtype;
  v_pid uuid;
  v_pname text;
  v_return_qty numeric;
  v_prior_returned_qty numeric;
  v_unit_price numeric;
  v_line_rate numeric;
  v_line_net numeric;
  v_line_tax numeric;
  v_line_gross numeric;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_total_refund numeric := 0;
  v_line_rows jsonb := '[]'::jsonb;
  v_line_no integer := 0;
  v_line_key uuid;

  -- Stock movements
  v_movement_id uuid;
  v_movements jsonb := '[]'::jsonb;

  -- Refund Tenders
  v_cmd_tenders jsonb;
  v_tender_leg jsonb;
  v_tmethod text;
  v_tamount numeric;
  v_tender_total numeric := 0;
  v_tender_rows jsonb := '[]'::jsonb;
  v_prior_refunded_total numeric := 0;

  v_outbox_payload jsonb;
begin
  -- 1. Seat Authorization Gate
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  -- 2. Currency derivation (commit 0c46cde)
  select base_currency into v_org_currency
    from public.organisations where id = target_org;
  if v_org_currency is null then
    raise exception 'organisation_not_found';
  end if;

  -- 3. Idempotent Replay Guard
  if command_key is not null then
    select * into v_existing
      from public.counter_returns
     where organisation_id = target_org and idempotency_key = command_key;
    if found then
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
  else
    raise exception 'command_key_required';
  end if;

  -- 4. Parse & Validate Command Type & Reason
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
    -- Counter / stores operator
    if command->>'approver_person_id' is not null then
      v_approver_person_id := (command->>'approver_person_id')::uuid;
      -- Verify approver is active member with managerial seat in same organisation
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
      -- Honest solo capacity compensation per SERP-030
      v_approval_mode := 'solo_capacity';
      v_approver_person_id := target_person;
      v_approver_seat := target_seat;
    else
      -- Segregated capacity without supervisor approval fails closed
      raise exception 'reversal_approval_required';
    end if;
  end if;

  -- 6. Original Sale Resolution & Strict Tenant Isolation
  v_original_sale_id := nullif(coalesce(command->>'original_sale_id', command->>'sale_id', ''), '')::uuid;
  if v_original_sale_id is null then
    raise exception 'original_sale_id_required';
  end if;

  -- Advisory lock on original sale to serialize reversals
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

  -- Location resolution: from command or from original stock movements
  v_location_id := nullif(coalesce(command->>'location_id', ''), '')::uuid;
  if v_location_id is null then
    select location_id into v_location_id
      from public.stock_movements
     where organisation_id = target_org
       and source_type = 'COUNTER_SALE'
       and source_id = v_sale.id
     limit 1;
  end if;
  if v_location_id is null or not exists (
    select 1 from public.locations
     where organisation_id = target_org and id = v_location_id and active
  ) then
    raise exception 'location_not_found';
  end if;

  -- Ensure document sequences exist
  perform app_private.ensure_return_sequences(target_org);

  -- 7. Process Lines based on Reversal Type
  if v_reversal_type = 'void' then
    -- Check if already voided
    if exists (
      select 1 from public.counter_returns
       where organisation_id = target_org
         and original_sale_id = v_sale.id
         and reversal_type = 'void'
    ) then
      raise exception 'sale_already_voided';
    end if;

    -- Check if partially returned
    if exists (
      select 1 from public.counter_returns
       where organisation_id = target_org
         and original_sale_id = v_sale.id
    ) then
      raise exception 'cannot_void_partially_returned_sale';
    end if;

    -- Void returns ALL lines from original sale
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
    -- Itemized Return
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

      -- Check item exists on original sale
      select * into v_orig_line
        from public.commercial_document_lines
       where organisation_id = target_org
         and document_id = v_sale.id
         and product_id = v_pid
       limit 1;
      if not found then
        raise exception 'product_not_on_sale';
      end if;

      -- Check cumulative returned qty against original line qty
      select coalesce(sum((it->>'quantity')::numeric), 0) into v_prior_returned_qty
        from public.counter_returns cr,
             jsonb_array_elements(cr.items) it
       where cr.organisation_id = target_org
         and cr.original_sale_id = v_sale.id
         and (it->>'product_id')::uuid = v_pid;

      if (v_prior_returned_qty + v_return_qty) > v_orig_line.quantity then
        raise exception using message = 'return_quantity_exceeds_sale',
          detail = format('Cannot return %s of product %s; previously returned %s, original quantity %s',
                          v_return_qty, v_pid, v_prior_returned_qty, v_orig_line.quantity);
      end if;

      -- Pro-rata financial amounts
      v_line_no := v_line_no + 1;
      v_unit_price := v_orig_line.unit_price;
      v_line_rate := v_orig_line.tax_rate;
      v_line_net := round(v_orig_line.net_amount * (v_return_qty / v_orig_line.quantity), 2);
      v_line_tax := round(v_orig_line.tax_amount * (v_return_qty / v_orig_line.quantity), 2);
      v_line_gross := v_line_net + v_line_tax;

      v_subtotal := v_subtotal + v_line_net;
      v_tax_total := v_tax_total + v_line_tax;
      v_total_refund := v_total_refund + v_line_gross;

      v_line_rows := v_line_rows || jsonb_build_array(jsonb_build_object(
        'line_no', v_line_no,
        'product_id', v_pid,
        'description', v_orig_line.description,
        'quantity', v_return_qty,
        'unit_price', v_unit_price,
        'tax_rate', v_line_rate,
        'net_amount', v_line_net,
        'tax_amount', v_line_tax,
        'gross_amount', v_line_gross
      ));
    end loop;
  end if;

  v_subtotal := round(v_subtotal, 2);
  v_tax_total := round(v_tax_total, 2);
  v_total_refund := round(v_total_refund, 2);

  -- Check cumulative refund amount does not exceed original sale gross total
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
    -- Automatically mirror original tenders for full void
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

  v_tender_total := round(v_tender_total, 2);
  if v_tender_total <> v_total_refund then
    raise exception using message = 'reversal_refund_mismatch',
      detail = format('Refund tenders sum %s does not match return total %s',
                      v_tender_total, v_total_refund);
  end if;

  -- 9. Insert Stock Movements (Inventory Return)
  for v_item in select elem from jsonb_array_elements(v_line_rows) as t(elem)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_return_qty := (v_item->>'quantity')::numeric;
    v_line_key := md5(command_key::text || ':stock:' || (v_item->>'line_no')::text)::uuid;

    -- Positive quantity on 'return' movement increases on-hand
    insert into public.stock_movements (
      organisation_id, location_id, product_id, movement_type, quantity,
      unit_cost, source_type, source_id, idempotency_key, occurred_at, recorded_by
    ) values (
      target_org, v_location_id, v_pid, 'return', v_return_qty,
      null, case when v_reversal_type = 'void' then 'COUNTER_VOID' else 'COUNTER_RETURN' end,
      v_return_id, v_line_key, now(), target_person
    ) returning id into v_movement_id;

    v_movements := v_movements || jsonb_build_array(jsonb_build_object(
      'movement_id', v_movement_id,
      'product_id', v_pid,
      'movement_type', 'return',
      'quantity', v_return_qty,
      'occurred_at', now()
    ));
  end loop;

  -- 10. Allocate Numbers & Create Credit Note Document
  v_cn_no := app_private.allocate_document_no(target_org, 'credit_note');
  v_return_no := app_private.allocate_document_no(target_org, 'counter_return');

  insert into public.commercial_documents (
    id, organisation_id, document_type, document_no, contact_id, currency,
    gross_total, tax_total, allocated_total, unallocated_balance, status, metadata,
    document_date, issued_at, issued_by
  ) values (
    v_cn_id, target_org, 'credit_note', v_cn_no, v_sale.contact_id, v_org_currency,
    v_total_refund, v_tax_total, v_total_refund, 0, 'settled',
    jsonb_build_object(
      'original_sale_id', v_sale.id,
      'original_sale_number', v_sale.document_no,
      'return_number', v_return_no,
      'reversal_type', v_reversal_type,
      'reason', v_reason,
      'counter_reversal', true
    ),
    current_date, now(), target_person
  );

  insert into public.commercial_document_lines (
    organisation_id, document_id, line_no, product_id, description,
    quantity, unit_price, tax_rate, net_amount, tax_amount, gross_amount
  )
  select target_org, v_cn_id, (l->>'line_no')::integer, (l->>'product_id')::uuid,
         l->>'description', (l->>'quantity')::numeric, (l->>'unit_price')::numeric,
         (l->>'tax_rate')::numeric, (l->>'net_amount')::numeric,
         (l->>'tax_amount')::numeric, (l->>'gross_amount')::numeric
    from jsonb_array_elements(v_line_rows) as l;

  -- 11. Insert Return Register Record & Refund Tenders
  insert into public.counter_returns (
    id, organisation_id, return_number, original_sale_id, credit_note_id,
    location_id, reversal_type, currency, subtotal, tax_total, total_refund_amount,
    items, refund_tenders, reason, approval_mode, approver_person_id, approver_seat,
    idempotency_key, created_at, created_by, created_seat
  ) values (
    v_return_id, target_org, v_return_no, v_sale.id, v_cn_id,
    v_location_id, v_reversal_type, v_org_currency, v_subtotal, v_tax_total, v_total_refund,
    v_line_rows, v_tender_rows, v_reason, v_approval_mode, v_approver_person_id, v_approver_seat,
    command_key, now(), target_person, target_seat
  );

  for v_tender_leg in select elem from jsonb_array_elements(v_tender_rows) as t(elem)
  loop
    insert into public.counter_refund_tenders (
      organisation_id, return_id, payment_method, amount, currency,
      recorded_by, recorded_seat
    ) values (
      target_org, v_return_id, (v_tender_leg->>'method'), (v_tender_leg->>'amount')::numeric,
      v_org_currency, target_person, target_seat
    );
  end loop;

  -- 12. Attributable Audit Event
  insert into public.audit_events (
    organisation_id, actor_person_id, acting_seat, action, object_type,
    object_id, after_state, metadata
  ) values (
    target_org, target_person, target_seat,
    case when v_reversal_type = 'void' then 'erp.counter_void' else 'erp.counter_return' end,
    'counter_return', v_return_id,
    jsonb_build_object(
      'return_id', v_return_id,
      'return_number', v_return_no,
      'original_sale_id', v_sale.id,
      'original_sale_number', v_sale.document_no,
      'credit_note_id', v_cn_id,
      'credit_note_number', v_cn_no,
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
      'approver_seat', v_approver_seat
    ),
    jsonb_build_object(
      'idempotency_key', command_key,
      'sod_disposition', case when v_approval_mode = 'solo_capacity' then 'exception_recorded' else 'allowed_cleanly' end
    )
  );

  -- 13. Transactional Outbox Event
  v_outbox_payload := jsonb_build_object(
    'return_id', v_return_id,
    'return_number', v_return_no,
    'original_sale_id', v_sale.id,
    'original_sale_number', v_sale.document_no,
    'credit_note_id', v_cn_id,
    'credit_note_number', v_cn_no,
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
    'movements', v_movements
  );

  perform app_private.append_outbox_event(
    target_org,
    case when v_reversal_type = 'void' then 'COUNTER_VOID' else 'COUNTER_RETURN' end,
    'commercial_documents',
    v_cn_id::text,
    v_outbox_payload,
    jsonb_build_object('idempotency_key', command_key),
    target_person,
    target_seat
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'return', jsonb_build_object(
      'id', v_return_id,
      'return_number', v_return_no,
      'original_sale_id', v_sale.id,
      'original_sale_number', v_sale.document_no,
      'credit_note_id', v_cn_id,
      'credit_note_number', v_cn_no,
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
    ),
    'movements', v_movements
  );
end;
$$;

alter function public.api_counter_sale_reversal(uuid, uuid, text, uuid, jsonb, uuid)
  set search_path = public, app_private, extensions, pg_temp;

revoke all on function public.api_counter_sale_reversal(uuid, uuid, text, uuid, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.api_counter_sale_reversal(uuid, uuid, text, uuid, jsonb, uuid)
  to service_role;

-- -----------------------------------------------------------------------------
-- 4. Stored Procedure: api_counter_return_get (Read single return record)
-- -----------------------------------------------------------------------------
create or replace function public.api_counter_return_get(
  target_org uuid,
  target_person uuid,
  target_seat text,
  p_return_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  v_ret public.counter_returns%rowtype;
  v_sale public.commercial_documents%rowtype;
  v_cn public.commercial_documents%rowtype;
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  select * into v_ret
    from public.counter_returns
   where organisation_id = target_org and id = p_return_id;
  if not found then
    raise exception 'return_not_found';
  end if;

  select * into v_sale
    from public.commercial_documents
   where organisation_id = target_org and id = v_ret.original_sale_id;

  select * into v_cn
    from public.commercial_documents
   where organisation_id = target_org and id = v_ret.credit_note_id;

  return jsonb_build_object(
    'ok', true,
    'return', jsonb_build_object(
      'id', v_ret.id,
      'return_number', v_ret.return_number,
      'original_sale_id', v_ret.original_sale_id,
      'original_sale_number', v_sale.document_no,
      'credit_note_id', v_ret.credit_note_id,
      'credit_note_number', v_cn.document_no,
      'location_id', v_ret.location_id,
      'reversal_type', v_ret.reversal_type,
      'currency', v_ret.currency,
      'subtotal', v_ret.subtotal,
      'tax_total', v_ret.tax_total,
      'total_refund_amount', v_ret.total_refund_amount,
      'items', v_ret.items,
      'refund_tenders', v_ret.refund_tenders,
      'reason', v_ret.reason,
      'approval_mode', v_ret.approval_mode,
      'approver_person_id', v_ret.approver_person_id,
      'approver_seat', v_ret.approver_seat,
      'created_at', v_ret.created_at,
      'created_by', v_ret.created_by,
      'created_seat', v_ret.created_seat
    )
  );
end;
$$;

alter function public.api_counter_return_get(uuid, uuid, text, uuid)
  set search_path = public, app_private, extensions, pg_temp;

revoke all on function public.api_counter_return_get(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.api_counter_return_get(uuid, uuid, text, uuid)
  to service_role;

-- -----------------------------------------------------------------------------
-- 5. Stored Procedure: api_counter_return_list (Query returns for sale or location)
-- -----------------------------------------------------------------------------
create or replace function public.api_counter_return_list(
  target_org uuid,
  target_person uuid,
  target_seat text,
  p_original_sale_id uuid default null,
  p_location_id uuid default null,
  p_limit integer default 50
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  v_returns jsonb;
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'return_number', r.return_number,
      'original_sale_id', r.original_sale_id,
      'original_sale_number', s.document_no,
      'credit_note_id', r.credit_note_id,
      'credit_note_number', cn.document_no,
      'location_id', r.location_id,
      'reversal_type', r.reversal_type,
      'currency', r.currency,
      'subtotal', r.subtotal,
      'tax_total', r.tax_total,
      'total_refund_amount', r.total_refund_amount,
      'items', r.items,
      'refund_tenders', r.refund_tenders,
      'reason', r.reason,
      'approval_mode', r.approval_mode,
      'created_at', r.created_at,
      'created_by', r.created_by,
      'created_seat', r.created_seat
    ) order by r.created_at desc
  ), '[]'::jsonb)
  into v_returns
  from public.counter_returns r
  join public.commercial_documents s on s.id = r.original_sale_id and s.organisation_id = r.organisation_id
  join public.commercial_documents cn on cn.id = r.credit_note_id and cn.organisation_id = r.organisation_id
  where r.organisation_id = target_org
    and (p_original_sale_id is null or r.original_sale_id = p_original_sale_id)
    and (p_location_id is null or r.location_id = p_location_id)
  limit coalesce(p_limit, 50);

  return jsonb_build_object('ok', true, 'items', v_returns);
end;
$$;

alter function public.api_counter_return_list(uuid, uuid, text, uuid, uuid, integer)
  set search_path = public, app_private, extensions, pg_temp;

revoke all on function public.api_counter_return_list(uuid, uuid, text, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.api_counter_return_list(uuid, uuid, text, uuid, uuid, integer)
  to service_role;

-- -----------------------------------------------------------------------------
-- 6. Cash Session Update: Reconcile Cash Refunds in Session Summary & Close
-- -----------------------------------------------------------------------------
create or replace function public.api_counter_session_current(
  target_org uuid,
  target_person uuid,
  target_seat text,
  p_location_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  v_org_currency character(3);
  v_open public.counter_cash_sessions%rowtype;
  v_window_start timestamptz;
  v_opening_float numeric := 0;
  v_tx_count integer := 0;
  v_cash_sales numeric := 0;
  v_card_sales numeric := 0;
  v_transfer_sales numeric := 0;
  v_cash_refunds numeric := 0;
  v_total_sales numeric := 0;
  v_expected_cash numeric := 0;
begin
  -- Seat authorization
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  -- Location check
  if p_location_id is null or not exists (
    select 1 from public.locations
     where organisation_id = target_org and id = p_location_id and active
  ) then
    raise exception 'location_not_found';
  end if;

  -- Derive currency
  select base_currency into v_org_currency
    from public.organisations where id = target_org;
  if v_org_currency is null then
    raise exception 'organisation_not_found';
  end if;

  -- Check for active open session
  select * into v_open
    from public.counter_cash_sessions
   where organisation_id = target_org and location_id = p_location_id and status = 'open'
   order by opened_at desc
   limit 1;

  if found then
    v_window_start := v_open.opened_at;
    v_opening_float := v_open.opening_float;
  else
    -- Latest closed session or epoch
    select coalesce(max(closed_at), '1970-01-01 00:00:00+00'::timestamptz)
      into v_window_start
      from public.counter_cash_sessions
     where organisation_id = target_org and location_id = p_location_id and status = 'closed';
  end if;

  -- Aggregate sales at location since window_start
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
      and cr.issued_at <= now()
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

  -- Aggregate cash refunds at location since window_start
  select coalesce(sum(crt.amount), 0) into v_cash_refunds
    from public.counter_refund_tenders crt
    join public.counter_returns ret on ret.id = crt.return_id
   where ret.organisation_id = target_org
     and ret.location_id = p_location_id
     and ret.created_at >= v_window_start
     and ret.created_at <= now()
     and crt.payment_method = 'cash';

  v_expected_cash := round(v_opening_float + v_cash_sales - v_cash_refunds, 2);

  return jsonb_build_object(
    'ok', true,
    'has_open_session', (v_open.id is not null),
    'session', jsonb_build_object(
      'id', v_open.id,
      'session_number', v_open.session_number,
      'location_id', p_location_id,
      'status', coalesce(v_open.status, 'unopened'),
      'currency', v_org_currency,
      'opened_at', v_window_start,
      'opened_by', v_open.opened_by,
      'opened_seat', v_open.opened_seat,
      'opening_float', v_opening_float,
      'transaction_count', v_tx_count,
      'cash_sales_amount', v_cash_sales,
      'card_sales_amount', v_card_sales,
      'transfer_sales_amount', v_transfer_sales,
      'cash_refunds_amount', v_cash_refunds,
      'total_sales_amount', v_total_sales,
      'expected_cash', v_expected_cash
    )
  );
end;
$$;

alter function public.api_counter_session_current(uuid, uuid, text, uuid)
  set search_path = public, app_private, extensions, pg_temp;

revoke all on function public.api_counter_session_current(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.api_counter_session_current(uuid, uuid, text, uuid)
  to service_role;

-- Reconcile api_counter_session_close with cash refunds
create or replace function public.api_counter_session_close(
  target_org uuid,
  target_person uuid,
  target_seat text,
  p_location_id uuid,
  p_counted_cash numeric,
  p_notes text default null,
  p_command_key uuid default null,
  p_opening_float numeric default null
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  v_org_currency character(3);
  v_open public.counter_cash_sessions%rowtype;
  v_existing public.counter_cash_sessions%rowtype;
  v_window_start timestamptz;
  v_opening_float numeric := 0;
  v_tx_count integer := 0;
  v_cash_sales numeric := 0;
  v_card_sales numeric := 0;
  v_transfer_sales numeric := 0;
  v_cash_refunds numeric := 0;
  v_total_sales numeric := 0;
  v_expected_cash numeric := 0;
  v_counted_cash numeric;
  v_variance numeric;
  v_session_id uuid;
  v_session_no text;
begin
  -- Seat authorization
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  -- Location check
  if p_location_id is null or not exists (
    select 1 from public.locations
     where organisation_id = target_org and id = p_location_id and active
  ) then
    raise exception 'location_not_found';
  end if;

  v_counted_cash := round(coalesce(p_counted_cash, 0), 2);
  if v_counted_cash < 0 then
    raise exception 'counter_session_counted_negative';
  end if;

  -- Derive currency
  select base_currency into v_org_currency
    from public.organisations where id = target_org;
  if v_org_currency is null then
    raise exception 'organisation_not_found';
  end if;

  -- Replay guard
  if p_command_key is not null then
    select * into v_existing
      from public.counter_cash_sessions
     where organisation_id = target_org and idempotency_key = p_command_key;
    if found then
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

  -- Serialized transaction per location
  perform pg_advisory_xact_lock(hashtext(target_org::text || p_location_id::text)::bigint);

  -- Fetch open session
  select * into v_open
    from public.counter_cash_sessions
   where organisation_id = target_org and location_id = p_location_id and status = 'open'
   order by opened_at desc
   limit 1;

  if not found then
    raise exception 'no_open_session';
  end if;

  v_session_id := v_open.id;
  v_session_no := v_open.session_number;
  v_window_start := v_open.opened_at;
  v_opening_float := v_open.opening_float;

  -- Aggregate sales
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
      and cr.issued_at <= now()
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

  -- Aggregate cash refunds
  select coalesce(sum(crt.amount), 0) into v_cash_refunds
    from public.counter_refund_tenders crt
    join public.counter_returns ret on ret.id = crt.return_id
   where ret.organisation_id = target_org
     and ret.location_id = p_location_id
     and ret.created_at >= v_window_start
     and ret.created_at <= now()
     and crt.payment_method = 'cash';

  v_expected_cash := round(v_opening_float + v_cash_sales - v_cash_refunds, 2);
  v_variance := round(v_counted_cash - v_expected_cash, 2);

  update public.counter_cash_sessions
     set status = 'closed',
         closed_at = now(),
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
         notes = p_notes,
         idempotency_key = coalesce(p_command_key, idempotency_key)
   where organisation_id = target_org and id = v_session_id;

  -- Attributable audit event
  insert into public.audit_events (
    organisation_id, actor_person_id, acting_seat, action, object_type,
    object_id, after_state, metadata
  ) values (
    target_org, target_person, target_seat, 'erp.counter_session_close',
    'counter_cash_session', v_session_id,
    jsonb_build_object(
      'session_id', v_session_id,
      'session_number', v_session_no,
      'location_id', p_location_id,
      'currency', v_org_currency,
      'opening_float', v_opening_float,
      'cash_sales_amount', v_cash_sales,
      'card_sales_amount', v_card_sales,
      'transfer_sales_amount', v_transfer_sales,
      'cash_refunds_amount', v_cash_refunds,
      'total_sales_amount', v_total_sales,
      'expected_cash', v_expected_cash,
      'counted_cash', v_counted_cash,
      'variance_amount', v_variance,
      'notes', p_notes
    ),
    jsonb_build_object('idempotency_key', p_command_key)
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'session', jsonb_build_object(
      'id', v_session_id,
      'session_number', v_session_no,
      'location_id', p_location_id,
      'status', 'closed',
      'currency', v_org_currency,
      'opened_at', v_window_start,
      'opened_by', v_open.opened_by,
      'opened_seat', v_open.opened_seat,
      'closed_at', now(),
      'closed_by', target_person,
      'closed_seat', target_seat,
      'opening_float', v_opening_float,
      'transaction_count', v_tx_count,
      'cash_sales_amount', v_cash_sales,
      'card_sales_amount', v_card_sales,
      'transfer_sales_amount', v_transfer_sales,
      'cash_refunds_amount', v_cash_refunds,
      'total_sales_amount', v_total_sales,
      'expected_cash', v_expected_cash,
      'counted_cash', v_counted_cash,
      'variance_amount', v_variance,
      'notes', p_notes
    )
  );
end;
$$;

alter function public.api_counter_session_close(uuid, uuid, text, uuid, numeric, text, uuid, numeric)
  set search_path = public, app_private, extensions, pg_temp;

revoke all on function public.api_counter_session_close(uuid, uuid, text, uuid, numeric, text, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.api_counter_session_close(uuid, uuid, text, uuid, numeric, text, uuid, numeric)
  to service_role;

commit;
