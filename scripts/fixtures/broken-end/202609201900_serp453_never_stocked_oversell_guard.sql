-- Migration: 202609201900_serp453_never_stocked_oversell_guard.sql
-- SERP-453: fix the never-stocked counter-sale oversell defect.
--
-- Defect record: Room #7182 / #7186 (SERP-442 evidence lane, candidate 6466ae1).
-- public.stock_movements_derived_onhand(...) is a GROUP BY aggregate, so a product
-- with no stock_movements rows produces ZERO ROWS rather than a row containing 0.
-- The counter-sale guard read it with SELECT ... INTO, so v_onhand became NULL.
-- COALESCE guards a NULL VALUE, never a missing ROW, so it did not fire.
-- "if v_onhand < v_qty" then evaluated to NULL, which PL/pgSQL treats as not-true,
-- so the oversell guard was skipped entirely: the sale was accepted, issue
-- movements were written, and on-hand went negative.
--
-- Fix: read the aggregate through a scalar subquery so the empty-set case
-- collapses to NULL and COALESCE produces a real 0, plus an explicit IS NULL
-- fail-closed check. Two sites in api_garage_command: the pre-insert guard and
-- the authoritative post-sale on_hand map.
--
-- Scope: two statements inside the existing api_garage_command. No schema change,
-- no new function, no pricing/GST/N11/UI change, no advisory-lock change.
-- The advisory-lock pre-pass and the derived-onhand function itself are untouched
-- and were verified sound for the stocked case.
--
-- Idempotency, tenant/RLS scoping, security definer and search_path are unchanged:
-- this is a CREATE OR REPLACE of the same function body with two reads rewritten.

begin;

create or replace function public.api_garage_command(
  target_org uuid,
  target_person uuid,
  target_seat text,
  command_key uuid,
  command jsonb,
  request_identifier uuid
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  existing public.idempotency_keys%rowtype;
  event_name text := upper(trim(coalesce(command->>'type', command->>'sop', '')));
  scm_step text := lower(trim(coalesce(command->>'scm_step', command->>'action', '')));
  target_job public.garage_jobs%rowtype;
  target_job_id uuid;
  target_job_no text;
  next_state text;
  is_valid_trans boolean;
  dyn_err text;
  event_payload jsonb;
  event_id uuid := gen_random_uuid();
  response jsonb;
  request_digest text := app_private.canonical_jsonb_sha256(command);
  c_name text;
  v_reg text;
  c_phone text;

  -- SERP-167 variables
  v_doc_id uuid;
  v_doc_no text;
  v_amount numeric;
  v_gst numeric;
  v_subtotal numeric;
  v_contact_id uuid;
  v_role_id uuid;
  v_member_id uuid;
  v_stage_id uuid;
  v_template_id uuid;
  v_payment_id uuid;
  v_invoice_id uuid;
  v_balance numeric;
  v_action text;
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat) then
    raise exception 'seat_not_authorized';
  end if;

  if event_name not in (
    'CALL', 'BOOKING', 'INTAKE', 'ESTIMATE', 'AUTHORISATION',
    'JOB_CARD', 'PARTS_PROCUREMENT', 'PURCHASE', 'WORK', 'QC',
    'HANDOVER', 'INVOICE_PAYMENT', 'CLOSE',
    'INVOICE', 'EXPENSE', 'CUSTOMER', 'TENANT_CONFIG', 'TENANT_ONBOARD',
    'WORKFLOW', 'MEMBER_INVITE', 'MEMBER_AUTHORIZE', 'MEMBER_SUSPEND',
    'MEMBER_ROLE_UPDATE', 'ROLE', 'COUNTER_SALE', 'PAY_SUPPLIER'
  ) then
    raise exception 'unsupported_command';
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Seat authorization matrix check
  -- ─────────────────────────────────────────────────────────────────────────
  if event_name = 'PURCHASE' then
    if scm_step not in ('need', 'quote', 'award', 'receive', 'match', 'pay') then
      raise exception 'unsupported_purchase_step';
    end if;
    if not app_private.purchase_step_seat_is_legal(scm_step, target_seat) then
      raise exception 'acting_seat_not_legal_for_command';
    end if;
  elsif event_name in ('CALL', 'BOOKING', 'INTAKE', 'ESTIMATE', 'AUTHORISATION',
                       'JOB_CARD', 'HANDOVER', 'CLOSE') then
    if target_seat <> 'counter' then
      raise exception 'acting_seat_not_legal_for_command';
    end if;
  elsif event_name = 'INVOICE_PAYMENT' then
    if target_seat not in ('counter', 'financial_controller', 'director', 'managing_director', 'owner') then
      raise exception 'acting_seat_not_legal_for_command';
    end if;
  elsif event_name in ('PARTS_PROCUREMENT', 'WORK') then
    if target_seat <> 'technician' then
      raise exception 'acting_seat_not_legal_for_command';
    end if;
  elsif event_name = 'QC' then
    if target_seat <> 'qc_signer' then
      raise exception 'acting_seat_not_legal_for_command';
    end if;
  elsif event_name in ('INVOICE', 'EXPENSE') then
    if target_seat not in ('counter', 'financial_controller', 'director', 'managing_director', 'owner') then
      raise exception 'acting_seat_not_legal_for_command';
    end if;
  elsif event_name = 'CUSTOMER' then
    if target_seat not in ('counter', 'director', 'managing_director', 'owner') then
      raise exception 'acting_seat_not_legal_for_command';
    end if;
  elsif event_name = 'COUNTER_SALE' then
    if target_seat not in ('counter', 'director', 'managing_director', 'owner') then
      raise exception 'acting_seat_not_legal_for_command';
    end if;
  elsif event_name = 'PAY_SUPPLIER' then
    if target_seat not in ('payer', 'financial_controller', 'director', 'managing_director', 'owner') then
      raise exception 'acting_seat_not_legal_for_command';
    end if;
  elsif event_name in ('TENANT_CONFIG', 'TENANT_ONBOARD', 'WORKFLOW',
                       'MEMBER_INVITE', 'MEMBER_AUTHORIZE', 'MEMBER_SUSPEND',
                       'MEMBER_ROLE_UPDATE', 'ROLE') then
    if target_seat not in ('owner', 'director', 'managing_director') then
      raise exception 'acting_seat_not_legal_for_command';
    end if;
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Idempotency Claim First
  -- ─────────────────────────────────────────────────────────────────────────
  begin
    insert into public.idempotency_keys
      (organisation_id, key, command_type, request_hash, state, expires_at)
    values
      (target_org, command_key, event_name, request_digest, 'processing', now() + interval '7 days');
  exception when unique_violation then
    select * into existing
      from public.idempotency_keys
     where organisation_id = target_org and key = command_key;

    if not found then
      raise exception 'idempotency_replay_missing';
    end if;
    if existing.request_hash <> request_digest or existing.command_type <> event_name then
      raise exception 'idempotency_key_conflict';
    end if;
    return coalesce(
      existing.response_body,
      jsonb_build_object('ok', false, 'state', existing.state)
    );
  end;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Command Handlers
  -- ─────────────────────────────────────────────────────────────────────────

  if event_name = 'CALL' then
    c_name := nullif(left(trim(coalesce(command->>'customer_name', command->>'customer', '')), 200), '');
    v_reg := nullif(left(trim(coalesce(command->>'vehicle_reg', command->>'vehicle', '')), 100), '');
    c_phone := nullif(left(trim(coalesce(command->>'phone', command->>'customer_phone', '')), 50), '');

    if c_name is null or v_reg is null or coalesce((command->>'consent')::boolean, false) is not true then
      raise exception 'call_requires_customer_vehicle_and_consent';
    end if;

    target_job_id := gen_random_uuid();
    target_job_no := app_private.allocate_document_no(target_org, 'garage_job');
    insert into public.garage_jobs
      (id, organisation_id, job_no, state, summary, customer_name, vehicle_reg, customer_phone)
    values
      (target_job_id, target_org, target_job_no, 'call',
       left(c_name || ' - ' || v_reg, 500),
       c_name, v_reg, c_phone);
    next_state := 'call';

  elsif event_name = 'INVOICE' then
    v_doc_id := gen_random_uuid();
    v_doc_no := app_private.allocate_document_no(target_org, 'sales_invoice');
    v_amount := coalesce((command->>'total_amount')::numeric, (command->>'amount')::numeric, 0);
    v_gst := coalesce((command->>'gst_amount')::numeric, 0);
    v_subtotal := coalesce((command->>'subtotal')::numeric, v_amount - v_gst);

    insert into public.commercial_documents
      (id, organisation_id, document_type, document_no, contact_id,
       gross_total, allocated_total, unallocated_balance, status, metadata,
       document_date, due_date, issued_at, issued_by)
    values
      (v_doc_id, target_org, 'sales_invoice', v_doc_no,
       nullif(command->>'customer_id', '')::uuid,
       v_amount, 0, v_amount, 'issued',
       jsonb_build_object(
         'subtotal', v_subtotal,
         'gst_amount', v_gst,
         'notes', command->>'notes',
         'items', command->'items',
         'linked_job_id', command->>'job_id',
         'customer_name', command->>'customer_name',
         'bank_details', command->>'bank_details'
       ),
       coalesce((command->>'date')::date, current_date),
       coalesce((command->>'due_date')::date, current_date + 14),
       now(), target_person);

    -- If linked to a job, transition job state
    target_job_id := nullif(command->>'job_id', '')::uuid;
    if target_job_id is not null then
      update public.garage_jobs
         set state = 'invoice_payment', version = version + 1
       where organisation_id = target_org and id = target_job_id;
    end if;

    event_payload := jsonb_build_object(
      'invoice_id', v_doc_id,
      'invoice_number', v_doc_no,
      'total_amount', v_amount,
      'subtotal', v_subtotal,
      'gst_amount', v_gst
    );
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'invoice', event_payload);

  elsif event_name = 'EXPENSE' then
    v_doc_id := gen_random_uuid();
    v_doc_no := app_private.allocate_document_no(target_org, 'direct_expense');
    v_amount := coalesce((command->>'amount')::numeric, 0);

    insert into public.commercial_documents
      (id, organisation_id, document_type, document_no,
       gross_total, allocated_total, unallocated_balance, status, metadata,
       document_date, issued_at, issued_by)
    values
      (v_doc_id, target_org, 'direct_expense', v_doc_no,
       v_amount, v_amount, 0, 'posted',
       jsonb_build_object(
         'payee', command->>'payee',
         'category', command->>'category',
         'payment_method', command->>'payment_method',
         'notes', command->>'notes',
         'date', coalesce(command->>'date', now()::text)
       ),
       coalesce((command->>'date')::date, current_date),
       now(), target_person);

    event_payload := jsonb_build_object(
      'expense_id', v_doc_id,
      'expense_number', v_doc_no,
      'amount', v_amount,
      'payee', command->>'payee',
      'category', command->>'category'
    );
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'expense', event_payload);

  elsif event_name = 'CUSTOMER' then
    v_contact_id := gen_random_uuid();
    c_name := nullif(trim(coalesce(command->>'name', command->>'customer_name', '')), '');
    c_phone := nullif(trim(coalesce(command->>'phone', '')), '');

    if c_name is null then
      raise exception 'customer_name_required';
    end if;

    insert into public.contacts
      (id, organisation_id, kind, display_name, phone, email, metadata)
    values
      (v_contact_id, target_org, 'customer', c_name, c_phone,
       nullif(command->>'email', ''),
       jsonb_build_object('island', command->>'island', 'notes', command->>'notes',
                          'type', command->>'type', 'vehicles', command->'vehicles',
                          'price_list_id', nullif(trim(coalesce(command->>'price_list_id', '')), '')));

    event_payload := jsonb_build_object(
      'customer_id', v_contact_id,
      'name', c_name,
      'phone', c_phone,
      'island', command->>'island'
    );
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'customer', event_payload);

  elsif event_name in ('TENANT_CONFIG', 'TENANT_ONBOARD') then
    update public.organisations
       set name = coalesce(nullif(trim(command->>'name'), ''), name)
     where id = target_org;

    event_payload := jsonb_build_object(
      'organisation_id', target_org,
      'updated_fields', command
    );
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'tenant', event_payload);

  -- ─────────────────────────────────────────────────────────────────────────
  -- WORKFLOW: Wire to real workflow_templates / workflow_stages tables
  -- ─────────────────────────────────────────────────────────────────────────
  elsif event_name = 'WORKFLOW' then
    v_action := lower(trim(coalesce(command->>'action', '')));

    if v_action = 'create_stage' then
      -- Find or create template
      v_template_id := nullif(command->>'template_id', '')::uuid;
      if v_template_id is null then
        -- Use default garage_job template
        select id into v_template_id from public.workflow_templates
         where organisation_id = target_org and workflow_code = 'garage_job'
         limit 1;
      end if;

      if v_template_id is null then
        raise exception 'workflow_template_not_found';
      end if;

      v_stage_id := gen_random_uuid();
      insert into public.workflow_stages
        (id, organisation_id, workflow_template_id, stage_code, stage_name,
         stage_order, command_name, required_seat, allowed_from_stages,
         is_initial, is_terminal, active)
      values
        (v_stage_id, target_org, v_template_id,
         coalesce(command->>'stage_code', 'stage_' || v_stage_id::text),
         coalesce(command->>'stage_name', 'Custom Stage'),
         coalesce((command->>'stage_order')::integer, 99),
         command->>'command_name',
         coalesce(command->>'required_seat', 'counter'),
         coalesce((command->'allowed_from_stages')::text[], '{}'),
         coalesce((command->>'is_initial')::boolean, false),
         coalesce((command->>'is_terminal')::boolean, false),
         true);

      event_payload := jsonb_build_object('stage_id', v_stage_id, 'action', 'created');

    elsif v_action = 'update_stage' then
      v_stage_id := nullif(command->>'stage_id', '')::uuid;
      if v_stage_id is null then
        raise exception 'stage_id_required';
      end if;

      update public.workflow_stages
         set stage_name = coalesce(nullif(command->>'stage_name', ''), stage_name),
             stage_order = coalesce((command->>'stage_order')::integer, stage_order),
             command_name = coalesce(nullif(command->>'command_name', ''), command_name),
             required_seat = coalesce(nullif(command->>'required_seat', ''), required_seat),
             allowed_from_stages = coalesce((command->'allowed_from_stages')::text[], allowed_from_stages),
             is_initial = coalesce((command->>'is_initial')::boolean, is_initial),
             is_terminal = coalesce((command->>'is_terminal')::boolean, is_terminal),
             active = coalesce((command->>'active')::boolean, active)
       where organisation_id = target_org and id = v_stage_id;

      event_payload := jsonb_build_object('stage_id', v_stage_id, 'action', 'updated');

    elsif v_action = 'delete_stage' then
      v_stage_id := nullif(command->>'stage_id', '')::uuid;
      if v_stage_id is null then
        raise exception 'stage_id_required';
      end if;

      update public.workflow_stages
         set active = false
       where organisation_id = target_org and id = v_stage_id;

      event_payload := jsonb_build_object('stage_id', v_stage_id, 'action', 'deleted');

    else
      raise exception 'workflow_action_required';
    end if;

    response := jsonb_build_object('ok', true, 'state', 'accepted', 'workflow', event_payload);

  -- ─────────────────────────────────────────────────────────────────────────
  -- MEMBER commands: Wire to real memberships / persons tables
  -- ─────────────────────────────────────────────────────────────────────────
  elsif event_name = 'MEMBER_INVITE' then
    -- Create or find person
    declare
      v_person_key text := 'invite:' || coalesce(command->>'email', gen_random_uuid()::text);
      v_person_id uuid;
    begin
      insert into public.persons (person_key, display_label, status)
      values (v_person_key, coalesce(command->>'name', command->>'email', 'Invitee'), 'active')
      on conflict (person_key) do update set display_label = excluded.display_label
      returning id into v_person_id;

      -- Create membership in pending status
      insert into public.memberships (organisation_id, person_id, status, role_id)
      values (target_org, v_person_id, 'pending',
              nullif(command->>'role_id', '')::uuid)
      returning id into v_member_id;

      -- Grant initial seat if specified
      if command->>'seat' is not null then
        insert into public.membership_seats (membership_id, seat_code)
        values (v_member_id, command->>'seat');
      end if;

      event_payload := jsonb_build_object(
        'membership_id', v_member_id,
        'person_id', v_person_id,
        'email', command->>'email',
        'name', command->>'name',
        'status', 'pending'
      );
      response := jsonb_build_object('ok', true, 'state', 'accepted', 'membership', event_payload);
    end;

  elsif event_name = 'MEMBER_AUTHORIZE' then
    v_member_id := nullif(command->>'membership_id', '')::uuid;
    if v_member_id is null then
      -- Try to find by person_id
      declare
        v_person_id uuid := nullif(command->>'person_id', '')::uuid;
      begin
        if v_person_id is not null then
          select id into v_member_id from public.memberships
           where organisation_id = target_org and person_id = v_person_id
           limit 1;
        end if;
      end;
    end if;

    if v_member_id is null then
      raise exception 'membership_not_found';
    end if;

    update public.memberships
       set status = 'active',
           role_id = coalesce(nullif(command->>'role_id', '')::uuid, role_id)
     where organisation_id = target_org and id = v_member_id;

    -- Grant seat if specified
    if command->>'seat' is not null then
      insert into public.membership_seats (membership_id, seat_code)
      values (v_member_id, command->>'seat')
      on conflict (membership_id, seat_code) do update
         set revoked_at = null
       where membership_seats.revoked_at is not null;
    end if;

    event_payload := jsonb_build_object(
      'membership_id', v_member_id,
      'action', 'authorized',
      'role_id', command->>'role_id'
    );
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'membership', event_payload);

  elsif event_name = 'MEMBER_SUSPEND' then
    v_member_id := nullif(command->>'membership_id', '')::uuid;
    if v_member_id is null then
      raise exception 'membership_not_found';
    end if;

    update public.memberships
       set status = 'suspended'
     where organisation_id = target_org and id = v_member_id;

    -- Revoke all seats
    update public.membership_seats
       set revoked_at = now()
     where membership_id = v_member_id and revoked_at is null;

    event_payload := jsonb_build_object(
      'membership_id', v_member_id,
      'action', 'suspended'
    );
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'membership', event_payload);

  elsif event_name = 'MEMBER_ROLE_UPDATE' then
    v_member_id := nullif(command->>'membership_id', '')::uuid;
    v_role_id := nullif(command->>'role_id', '')::uuid;

    if v_member_id is null or v_role_id is null then
      raise exception 'membership_id_and_role_id_required';
    end if;

    update public.memberships
       set role_id = v_role_id
     where organisation_id = target_org and id = v_member_id;

    event_payload := jsonb_build_object(
      'membership_id', v_member_id,
      'role_id', v_role_id,
      'action', 'role_updated'
    );
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'membership', event_payload);

  -- ─────────────────────────────────────────────────────────────────────────
  -- ROLE: Wire to real roles / role_permissions tables
  -- ─────────────────────────────────────────────────────────────────────────
  elsif event_name = 'ROLE' then
    v_action := lower(trim(coalesce(command->>'action', 'create')));

    if v_action = 'create' then
      v_role_id := gen_random_uuid();
      insert into public.roles (id, organisation_id, code, name, description, is_system)
      values (v_role_id, target_org,
              coalesce(command->>'code', 'custom_' || v_role_id::text),
              coalesce(command->>'name', 'Custom Role'),
              command->>'description',
              false);

      -- Insert permissions if provided
      if command->'permissions' is not null then
        insert into public.role_permissions (organisation_id, role_id, module, action, granted)
        select target_org, v_role_id,
               perm->>'module',
               perm->>'action',
               coalesce((perm->>'granted')::boolean, true)
          from jsonb_array_elements(command->'permissions') as perm;
      end if;

      event_payload := jsonb_build_object('role_id', v_role_id, 'action', 'created');

    elsif v_action = 'update' then
      v_role_id := nullif(command->>'role_id', '')::uuid;
      if v_role_id is null then
        raise exception 'role_id_required';
      end if;

      update public.roles
         set name = coalesce(nullif(command->>'name', ''), name),
             description = coalesce(command->>'description', description)
       where organisation_id = target_org and id = v_role_id;

      -- Replace permissions if provided
      if command->'permissions' is not null then
        delete from public.role_permissions
         where organisation_id = target_org and role_id = v_role_id;

        insert into public.role_permissions (organisation_id, role_id, module, action, granted)
        select target_org, v_role_id,
               perm->>'module',
               perm->>'action',
               coalesce((perm->>'granted')::boolean, true)
          from jsonb_array_elements(command->'permissions') as perm;
      end if;

      event_payload := jsonb_build_object('role_id', v_role_id, 'action', 'updated');

    elsif v_action = 'delete' then
      v_role_id := nullif(command->>'role_id', '')::uuid;
      if v_role_id is null then
        raise exception 'role_id_required';
      end if;

      -- Prevent deletion of system roles
      if exists (select 1 from public.roles where id = v_role_id and is_system = true) then
        raise exception 'cannot_delete_system_role';
      end if;

      delete from public.role_permissions
       where organisation_id = target_org and role_id = v_role_id;
      delete from public.roles
       where organisation_id = target_org and id = v_role_id;

      event_payload := jsonb_build_object('role_id', v_role_id, 'action', 'deleted');

    else
      raise exception 'role_action_required';
    end if;

    response := jsonb_build_object('ok', true, 'state', 'accepted', 'role', event_payload);

  -- ─────────────────────────────────────────────────────────────────────────
  -- INVOICE_PAYMENT: Settlement allocation with balance validation
  -- ─────────────────────────────────────────────────────────────────────────
  elsif event_name = 'INVOICE_PAYMENT' then
    v_invoice_id := nullif(command->>'invoice_id', '')::uuid;
    v_amount := coalesce((command->>'amount')::numeric, 0);

    if v_invoice_id is null then
      raise exception 'invoice_id_required';
    end if;
    if v_amount <= 0 then
      raise exception 'payment_amount_must_be_positive';
    end if;

    -- Validate invoice exists and get balance
    select unallocated_balance into v_balance
      from public.commercial_documents
     where organisation_id = target_org and id = v_invoice_id
       and document_type = 'sales_invoice'
       for update;

    if not found then
      raise exception 'invoice_not_found';
    end if;
    if v_amount > v_balance then
      raise exception using message = 'overpayment_rejected',
        detail = format('Payment %s exceeds balance %s', v_amount, v_balance);
    end if;

    -- Create payment document
    v_payment_id := gen_random_uuid();
    v_doc_no := app_private.allocate_document_no(target_org, 'receipt');

    insert into public.commercial_documents
      (id, organisation_id, document_type, document_no, contact_id,
       gross_total, allocated_total, unallocated_balance, status, metadata,
       document_date, issued_at, issued_by)
    values
      (v_payment_id, target_org, 'receipt', v_doc_no,
       nullif(command->>'customer_id', '')::uuid,
       v_amount, v_amount, 0, 'issued',
       jsonb_build_object(
         'method', command->>'method',
         'reference', command->>'reference',
         'bank_account', command->>'bank_account',
         'notes', command->>'notes',
         'invoice_id', v_invoice_id
       ),
       current_date, now(), target_person);

    -- Create settlement allocation
    insert into public.settlement_allocations
      (organisation_id, payment_document_id, settled_document_id,
       allocated_amount, currency, allocated_by)
    values
      (target_org, v_payment_id, v_invoice_id, v_amount, 'MVR', target_person);

    -- Update invoice allocated_total and unallocated_balance
    update public.commercial_documents
       set allocated_total = allocated_total + v_amount,
           unallocated_balance = unallocated_balance - v_amount,
           status = case when (unallocated_balance - v_amount) <= 0 then 'settled' else status end,
           version = version + 1
     where organisation_id = target_org and id = v_invoice_id;

    -- If invoice fully paid, update linked job status
    if (select unallocated_balance from public.commercial_documents
         where organisation_id = target_org and id = v_invoice_id) <= 0 then
      target_job_id := (select (metadata->>'linked_job_id')::uuid
                          from public.commercial_documents
                         where organisation_id = target_org and id = v_invoice_id);
      if target_job_id is not null then
        update public.garage_jobs
           set state = 'invoice_payment', version = version + 1
         where organisation_id = target_org and id = target_job_id
           and state <> 'invoice_payment';
      end if;
    end if;

    event_payload := jsonb_build_object(
      'payment_id', v_payment_id,
      'payment_number', v_doc_no,
      'invoice_id', v_invoice_id,
      'amount', v_amount,
      'remaining_balance', (select unallocated_balance from public.commercial_documents
                             where organisation_id = target_org and id = v_invoice_id)
    );
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'payment', event_payload);

  -- ─────────────────────────────────────────────────────────────────────────
  -- COUNTER_SALE: Atomic invoice + payment + stock issue + settlement
  -- M2 (SERP-M2-ATOMIC-CHECKOUT): server-side pricing/tax from the price
  -- registry, real commercial_document_lines rows, one issue movement per
  -- line, oversell guard inside the same transaction. Client-submitted totals
  -- are never trusted — every line is priced from price_lists and the document
  -- totals are the sum of the resolved lines.
  -- ─────────────────────────────────────────────────────────────────────────
  elsif event_name = 'COUNTER_SALE' then
    declare
      v_location_id uuid;
      v_customer_id uuid;
      v_price_list_code text;
      v_price_list_id uuid;
      v_pl_discount numeric := 0;
      v_tax_mode text := lower(trim(coalesce(command->>'tax_mode', 'exclusive')));
      v_line jsonb;
      v_line_no integer := 0;
      v_line_key uuid;
      v_pid uuid;
      v_pname text;
      v_pkind text;
      v_qty numeric;
      v_resolved_price numeric;
      v_unit_price numeric;
      v_line_amount numeric;
      v_line_net numeric;
      v_line_tax numeric;
      v_line_gross numeric;
      v_line_rate numeric;
      v_onhand numeric;
      v_movement_id uuid;
      v_tax_row record;
      v_movements jsonb := '[]'::jsonb;
      v_onhand_map jsonb := '{}'::jsonb;
      v_line_rows jsonb := '[]'::jsonb;
      v_org_currency character(3);
      -- SERP-087 tender/receipt state
      v_receipt_no text;
      v_payment_method text;
      v_tender jsonb;
      v_tender_leg jsonb;
      v_tmethod text;
      v_tamount numeric;
      v_tender_order integer := 0;
      v_tender_total numeric := 0;
      v_cash_total numeric := 0;
      v_method_count integer;
      v_tender_rows jsonb := '[]'::jsonb;
      v_tender_change numeric := 0;
    begin
      -- Functional currency for this sale: the org's configured base_currency,
      -- never a literal. MVR is the Maldivian default, not a platform constant
      -- (SERP-434 currency architecture correction, commit 0c46cde; Room seq 6167).
      select base_currency into v_org_currency
        from public.organisations where id = target_org;
      if v_org_currency is null then raise exception 'organisation_not_found'; end if;

      -- Sequences must exist for this branch to allocate document numbers.
      insert into public.document_sequences (organisation_id, sequence_type, prefix, padding)
      values
        (target_org, 'sales_invoice', 'SI-', 5),
        (target_org, 'receipt', 'RCT-', 5)
      on conflict (organisation_id, sequence_type) do nothing;

      -- Location is mandatory: stock issue needs a concrete sale location.
      if btrim(coalesce(command->>'location_id', '')) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'stock_location_required';
      end if;
      v_location_id := nullif(command->>'location_id', '')::uuid;
      if not exists (select 1 from public.locations
                      where organisation_id = target_org and id = v_location_id and active) then
        raise exception 'location_not_found';
      end if;

      if v_tax_mode not in ('inclusive', 'exclusive', 'zero_rated', 'exempt') then
        raise exception 'counter_sale_tax_mode_invalid';
      end if;
      if jsonb_typeof(coalesce(command->'items', '[]'::jsonb)) <> 'array'
         or jsonb_array_length(coalesce(command->'items', '[]'::jsonb)) = 0 then
        raise exception 'stock_lines_required';
      end if;

      -- SERP-087: tender is server-authoritative. The client only declares what
      -- the customer handed over; the server validates the method mix and
      -- computes change. No client-supplied total, subtotal or change survives
      -- this gate, and every failure below is atomic with the whole sale.
      v_payment_method := lower(trim(coalesce(command->>'payment_method', '')));
      if v_payment_method not in ('cash', 'card', 'transfer', 'mixed') then
        raise exception 'counter_sale_payment_method_invalid';
      end if;
      v_tender := coalesce(command->'tender', '[]'::jsonb);
      if jsonb_typeof(v_tender) <> 'array' or jsonb_array_length(v_tender) = 0 then
        raise exception 'counter_sale_tender_required';
      end if;
      for v_tender_leg in select elem from jsonb_array_elements(v_tender) as t(elem)
      loop
        v_tmethod := lower(trim(coalesce(v_tender_leg->>'method', '')));
        if v_tmethod not in ('cash', 'card', 'transfer') then
          raise exception 'counter_sale_tender_method_invalid';
        end if;
        if (v_tender_leg->>'amount_tendered') is null then
          raise exception 'counter_sale_tender_amount_required';
        end if;
        v_tamount := round(((v_tender_leg->>'amount_tendered')::numeric), 2);
        if v_tamount <= 0 then
          raise exception 'counter_sale_tender_amount_positive';
        end if;
        v_tender_order := v_tender_order + 1;
        if v_tmethod = 'cash' then
          v_cash_total := v_cash_total + v_tamount;
        end if;
        v_tender_total := v_tender_total + v_tamount;
        v_tender_rows := v_tender_rows || jsonb_build_array(jsonb_build_object(
          'method', v_tmethod, 'amount_tendered', v_tamount, 'order', v_tender_order));
      end loop;
      select count(*) into v_method_count
        from (select distinct lower(trim((e->>'method')::text))
                from jsonb_array_elements(v_tender_rows) as t(e)) s;
      if v_method_count <> jsonb_array_length(v_tender_rows) then
        raise exception 'counter_sale_duplicate_tender_method';
      end if;
      if v_payment_method = 'mixed' then
        if v_method_count < 2 then
          raise exception 'counter_sale_mixed_tender_requires_two_methods';
        end if;
      else
        if jsonb_array_length(v_tender_rows) <> 1 then
          raise exception 'counter_sale_single_method_requires_single_tender';
        end if;
        if lower(trim((v_tender_rows -> 0 ->> 'method')::text)) <> v_payment_method then
          raise exception 'counter_sale_tender_method_mismatch';
        end if;
      end if;

      -- Concurrency: acquire ALL advisory locks BEFORE processing any line, in a
      -- canonical deterministic order — distinct product_ids ascending. Inline
      -- per-line locking in caller order is a classic deadlock: two concurrent
      -- multi-line sales sharing the same two products in opposite order would
      -- acquire locks in opposite sequence and each wait on the other forever.
      -- Sorting makes every transaction request the same lock order, so the
      -- second simply blocks until the first commits. Locks are
      -- transaction-scoped (pg_advisory_xact_lock), held until commit/rollback,
      -- so the oversell guard's derived_onhand read and the ledger INSERT can
      -- never run against a peer's stale, in-flight image.
      for v_pid in
        select distinct (elem->>'product_id')::uuid as pid
          from jsonb_array_elements(command->'items') as t(elem)
         where (elem->>'product_id') is not null
         order by pid asc
      loop
        perform pg_advisory_xact_lock(
          hashtext(target_org::text || v_location_id::text || v_pid::text)::bigint
        );
      end loop;

      -- Resolve the customer's bound price list. contacts.metadata.price_list_id
      -- stores the registry CODE (retail/wholesale/...); resolve to the active
      -- registry row. An unbound customer falls back to base product_prices only
      -- (no override, no list discount).
      v_customer_id := nullif(coalesce(command->>'customer_id', ''), '')::uuid;
      if v_customer_id is not null then
        select nullif(btrim(coalesce(c.metadata->>'price_list_id', '')), '') into v_price_list_code
          from public.contacts c
         where c.organisation_id = target_org and c.id = v_customer_id and c.kind = 'customer';
        if v_price_list_code is not null then
          select pl.id, pl.discount_percent into v_price_list_id, v_pl_discount
            from public.price_lists pl
           where pl.organisation_id = target_org
             and pl.code = lower(v_price_list_code)
             and pl.active
           limit 1;
          if v_price_list_id is null then
            raise exception 'stock_line_price_list_not_found';
          end if;
        end if;
      end if;

      v_doc_id := gen_random_uuid();
      v_doc_no := app_private.allocate_document_no(target_org, 'sales_invoice');
      v_payment_id := gen_random_uuid();
      v_amount := 0;
      v_gst := 0;
      v_subtotal := 0;

      for v_line in select elem from jsonb_array_elements(command->'items') as t(elem)
      loop
        v_line_no := v_line_no + 1;
        v_line_key := md5(command_key::text || ':' || v_line_no::text)::uuid;

        v_pid := nullif(coalesce(v_line->>'product_id', ''), '')::uuid;
        select kind, name into v_pkind, v_pname
          from public.products
         where organisation_id = target_org and id = v_pid and active;
        if v_pkind is null then raise exception 'stock_line_product_not_found'; end if;
        if v_pkind = 'service' then raise exception 'stock_line_product_not_inventoried'; end if;

        if v_line->>'quantity' is null then raise exception 'stock_line_quantity_required'; end if;
        v_qty := (v_line->>'quantity')::numeric;
        if v_qty <= 0 then raise exception 'stock_line_quantity_positive'; end if;

        -- Server-side unit price: price-list override, else current base price,
        -- then the list's discount_percent. Client never supplies price/totals.
        v_resolved_price := null;
        if v_price_list_id is not null then
          select o.unit_price into v_resolved_price
            from public.price_list_item_overrides o
           where o.organisation_id = target_org
             and o.price_list_id = v_price_list_id
             and o.product_id = v_pid;
        end if;
        if v_resolved_price is null then
          select pp.amount into v_resolved_price
            from public.product_prices pp
           where pp.organisation_id = target_org
             and pp.product_id = v_pid
             and pp.currency = v_org_currency
             and now() >= pp.valid_from
             and (pp.valid_to is null or now() <= pp.valid_to)
           order by pp.valid_from desc
           limit 1;
        end if;
        if v_resolved_price is null then raise exception 'stock_line_no_price'; end if;
        if v_pl_discount > 0 then
          v_resolved_price := round(v_resolved_price * (1 - v_pl_discount / 100), 6);
        end if;
        v_unit_price := v_resolved_price;

        -- Line tax resolved server-side through the authoritative evaluator.
        v_line_amount := round(v_unit_price * v_qty, 2);
        select * into v_tax_row from app_private.calculate_line_tax(
          target_org, 'gst_general', current_date, v_tax_mode, v_line_amount);
        v_line_rate := coalesce(v_tax_row.tax_rate, 0);
        if v_tax_mode = 'inclusive' then
          v_line_gross := v_line_amount;
          v_line_net := coalesce(v_tax_row.base_amount, v_line_amount - coalesce(v_tax_row.tax_amount, 0));
          v_line_tax := coalesce(v_tax_row.tax_amount, 0);
        else
          v_line_net := v_line_amount;
          v_line_tax := coalesce(v_tax_row.tax_amount, 0);
          v_line_gross := coalesce(v_tax_row.gross_amount, v_line_net + v_line_tax);
        end if;

        v_subtotal := v_subtotal + v_line_net;
        v_gst := v_gst + v_line_tax;
        v_amount := v_amount + v_line_gross;

        v_line_rows := v_line_rows || jsonb_build_array(jsonb_build_object(
          'line_no', v_line_no, 'product_id', v_pid, 'description', v_pname,
          'quantity', v_qty, 'unit_price', v_unit_price, 'tax_rate', v_line_rate,
          'net_amount', v_line_net, 'tax_amount', v_line_tax, 'gross_amount', v_line_gross));

        -- Oversell guard: live derived on-hand inside this transaction. Earlier
        -- lines' issues are already written, so the SUM already reflects them.
        -- Concurrency: the advisory lock for this product+location is ALREADY
        -- held — acquired in the canonical pre-pass above, sorted by product_id,
        -- before any line was processed. The second concurrent transaction
        -- blocked there, so this read reflects its committed state; the guard
        -- can never race (proven bug: concurrent SELECT-then-INSERT drove on-hand
        -- NEGATIVE; the Elder's forced-2s-overlap repro and lock-serialization
        -- proof both confirmed the inline lock fixed it — this pre-pass keeps
        -- that coverage while ordering every txn identically to avoid deadlock).
        -- SERP-453: derived on-hand is a GROUP BY aggregate and returns ZERO ROWS
        -- for a never-stocked product, not a row of zero. SELECT INTO therefore left
        -- v_onhand NULL, and "NULL < v_qty" is NULL, which PL/pgSQL treats as
        -- not-true, so the guard was skipped and the line sold at zero stock.
        -- A scalar subquery collapses the empty-set case to NULL, and COALESCE
        -- then yields a real 0. The explicit IS NULL check keeps the guard
        -- fail-closed if the aggregate shape ever changes again.
        select coalesce((
          select d.derived_quantity
            from public.stock_movements_derived_onhand(target_org, v_location_id, v_pid) d
        ), 0) into v_onhand;
        if v_onhand is null or v_onhand < v_qty then
          raise exception 'stock_line_insufficient_on_hand';
        end if;

        -- One issue movement per line; negative quantity reduces on-hand.
        insert into public.stock_movements
          (organisation_id, location_id, product_id, movement_type, quantity,
           unit_cost, source_type, source_id, idempotency_key, occurred_at, recorded_by)
        values
          (target_org, v_location_id, v_pid, 'issue', -v_qty,
           null, 'COUNTER_SALE', v_doc_id, v_line_key, now(), target_person)
        returning id into v_movement_id;
        v_movements := v_movements || jsonb_build_array(jsonb_build_object(
          'movement_id', v_movement_id, 'product_id', v_pid,
          'movement_type', 'issue', 'quantity', -v_qty, 'occurred_at', now()));
      end loop;

      -- Authoritative on-hand AFTER this sale, per product.
      for v_pid in
        select distinct (l->>'product_id')::uuid
          from jsonb_array_elements(command->'items') as l
      loop
        -- SERP-453: same empty-set collapse as the guard above, so the
        -- authoritative post-sale on-hand map reports 0 rather than NULL.
        select coalesce((
          select d.derived_quantity
            from public.stock_movements_derived_onhand(target_org, v_location_id, v_pid) d
        ), 0) into v_onhand;
        v_onhand_map := v_onhand_map || jsonb_build_object(v_pid::text, v_onhand);
      end loop;

      -- SERP-087: reconcile tender against the SERVER-computed total. Change is
      -- refunded in cash only, so an overpayment must be covered by cash legs —
      -- a card/transfer overpayment cannot be handed back as cash.
      v_tender_total := round(v_tender_total, 2);
      if v_tender_total < v_amount then
        raise exception using message = 'counter_sale_tender_insufficient',
          detail = format('Tendered %s is less than the server total %s', v_tender_total, v_amount);
      end if;
      v_tender_change := round(v_tender_total - v_amount, 2);
      if v_tender_change > 0 and v_tender_change > v_cash_total then
        raise exception using message = 'counter_sale_change_exceeds_cash',
          detail = format('Change %s exceeds cash tendered %s; card or transfer overpayment cannot be refunded as cash',
                          v_tender_change, v_cash_total);
      end if;

      -- Invoice with server-computed totals, paid in full by the same
      -- transaction's receipt. Insert DIRECTLY as 'settled' — the
      -- commercial_documents_issued_immutable trigger (202608200003) rejects ANY
      -- later UPDATE of an issued/settled document, so there must be no
      -- issued→settled transition to perform afterwards.
      insert into public.commercial_documents
        (id, organisation_id, document_type, document_no, contact_id, currency,
         gross_total, tax_total, allocated_total, unallocated_balance, status, metadata,
         document_date, issued_at, issued_by)
      values
        (v_doc_id, target_org, 'sales_invoice', v_doc_no, v_customer_id, v_org_currency,
         v_amount, v_gst, v_amount, 0, 'settled',
         jsonb_build_object('items', command->'items', 'lines', v_line_rows,
                            'counter_sale', true, 'price_list_code', v_price_list_code),
         current_date, now(), target_person);

      insert into public.commercial_document_lines
        (organisation_id, document_id, line_no, product_id, description,
         quantity, unit_price, tax_rate, net_amount, tax_amount, gross_amount)
      select target_org, v_doc_id, (l->>'line_no')::integer, (l->>'product_id')::uuid,
             l->>'description', (l->>'quantity')::numeric, (l->>'unit_price')::numeric,
             (l->>'tax_rate')::numeric, (l->>'net_amount')::numeric,
             (l->>'tax_amount')::numeric, (l->>'gross_amount')::numeric
        from jsonb_array_elements(v_line_rows) as l;

      -- Create payment (fully allocated)
      declare
        v_pay_no text := app_private.allocate_document_no(target_org, 'receipt');
      begin
        insert into public.commercial_documents
          (id, organisation_id, document_type, document_no, contact_id, currency,
           gross_total, allocated_total, unallocated_balance, status, metadata,
           document_date, issued_at, issued_by)
        values
          (v_payment_id, target_org, 'receipt', v_pay_no, v_customer_id, v_org_currency,
           v_amount, v_amount, 0, 'issued',
           jsonb_build_object('method', v_payment_method, 'tender', v_tender_rows,
                              'change_amount', v_tender_change, 'counter_sale', true),
           current_date, now(), target_person);
        v_receipt_no := v_pay_no;

        -- Settlement allocation
        insert into public.settlement_allocations
          (organisation_id, payment_document_id, settled_document_id,
           allocated_amount, currency, allocated_by)
        values
          (target_org, v_payment_id, v_doc_id, v_amount, v_org_currency, target_person);

        -- SERP-087: tender legs — the authoritative record of what was handed
        -- over. One row per payment method, enforced by the collection loop.
        for v_tender_leg in select elem from jsonb_array_elements(v_tender_rows) as t(elem)
        loop
          insert into public.counter_tenders
            (organisation_id, receipt_id, payment_method, amount_tendered,
             currency, tender_order, recorded_by, recorded_seat)
          values
            (target_org, v_payment_id, lower(trim(coalesce(v_tender_leg->>'method', ''))),
             (v_tender_leg->>'amount_tendered')::numeric, v_org_currency,
             (v_tender_leg->>'order')::integer, target_person, target_seat);
        end loop;

        -- SERP-087: receipt register — the financial consequence record. ONE
        -- row per sale; later renders only count prints (duplicate-proof:
        -- re-rendering never mints a second financial record or number).
        insert into public.counter_receipts
          (organisation_id, receipt_id, sale_id, receipt_number,
           currency, tendered_amount, change_amount, renders,
           issued_at, issued_by, issued_seat)
        values
          (target_org, v_payment_id, v_doc_id, v_pay_no,
           v_org_currency, v_tender_total, v_tender_change, 0,
           now(), target_person, target_seat);
      end;

      -- Outbox/event seam for a future Hoadha projection (Hoadha NOT implemented).
      perform app_private.append_outbox_event(
        target_org,
        'COUNTER_SALE',
        'commercial_documents',
        v_doc_id::text,
        jsonb_build_object('invoice_id', v_doc_id, 'invoice_number', v_doc_no,
                           'payment_id', v_payment_id, 'location_id', v_location_id,
                           'subtotal', v_subtotal, 'tax_total', v_gst,
                           'total_amount', v_amount, 'lines', v_line_rows,
                           'tender', v_tender_rows, 'tendered_amount', v_tender_total,
                           'change_amount', v_tender_change, 'receipt_number', v_receipt_no,
                           'movements', v_movements, 'on_hand', v_onhand_map),
        jsonb_build_object('idempotency_key', command_key),
        target_person,
        target_seat);

      event_payload := jsonb_build_object(
        'invoice_id', v_doc_id,
        'invoice_number', v_doc_no,
        'payment_id', v_payment_id,
        'receipt_number', v_receipt_no,
        'location_id', v_location_id,
        'currency', v_org_currency,
        'subtotal', v_subtotal,
        'tax_total', v_gst,
        'total_amount', v_amount,
        'payment_method', v_payment_method,
        'tender', v_tender_rows,
        'tendered_amount', v_tender_total,
        'change_amount', v_tender_change,
        'lines', v_line_rows,
        'movements', v_movements,
        'on_hand', v_onhand_map
      );
      response := jsonb_build_object('ok', true, 'state', 'accepted', 'counter_sale', event_payload);
    end;

  -- ─────────────────────────────────────────────────────────────────────────
  -- PAY_SUPPLIER: Payment against purchase order
  -- ─────────────────────────────────────────────────────────────────────────
  elsif event_name = 'PAY_SUPPLIER' then
    v_invoice_id := nullif(command->>'purchase_order_id', '')::uuid;
    v_amount := coalesce((command->>'amount')::numeric, 0);

    if v_invoice_id is null then
      raise exception 'purchase_order_id_required';
    end if;
    if v_amount <= 0 then
      raise exception 'payment_amount_must_be_positive';
    end if;

    -- Validate PO exists and get balance
    select unallocated_balance into v_balance
      from public.commercial_documents
     where organisation_id = target_org and id = v_invoice_id
       and document_type = 'purchase_order'
       for update;

    if not found then
      raise exception 'purchase_order_not_found';
    end if;
    if v_amount > v_balance then
      raise exception using message = 'overpayment_rejected',
        detail = format('Payment %s exceeds PO balance %s', v_amount, v_balance);
    end if;

    -- Create payment document
    v_payment_id := gen_random_uuid();
    v_doc_no := app_private.allocate_document_no(target_org, 'payment');

    insert into public.commercial_documents
      (id, organisation_id, document_type, document_no, contact_id,
       gross_total, allocated_total, unallocated_balance, status, metadata,
       document_date, issued_at, issued_by)
    values
      (v_payment_id, target_org, 'payment', v_doc_no,
       nullif(command->>'supplier_id', '')::uuid,
       v_amount, v_amount, 0, 'issued',
       jsonb_build_object(
         'method', command->>'method',
         'reference', command->>'reference',
         'purchase_order_id', v_invoice_id
       ),
       current_date, now(), target_person);

    -- Settlement allocation
    insert into public.settlement_allocations
      (organisation_id, payment_document_id, settled_document_id,
       allocated_amount, currency, allocated_by)
    values
      (target_org, v_payment_id, v_invoice_id, v_amount, 'MVR', target_person);

    -- Update PO balance
    update public.commercial_documents
       set allocated_total = allocated_total + v_amount,
           unallocated_balance = unallocated_balance - v_amount,
           status = case when (unallocated_balance - v_amount) <= 0 then 'settled' else status end,
           version = version + 1
     where organisation_id = target_org and id = v_invoice_id;

    event_payload := jsonb_build_object(
      'payment_id', v_payment_id,
      'payment_number', v_doc_no,
      'purchase_order_id', v_invoice_id,
      'amount', v_amount,
      'remaining_balance', (select unallocated_balance from public.commercial_documents
                             where organisation_id = target_org and id = v_invoice_id)
    );
    response := jsonb_build_object('ok', true, 'state', 'accepted', 'supplier_payment', event_payload);

  else
    -- Standard garage job command handling
    target_job_id := nullif(command->>'job_id', '')::uuid;
    if target_job_id is null and nullif(trim(command->>'job_no'), '') is not null then
      select id into target_job_id from public.garage_jobs
       where organisation_id = target_org and job_no = trim(command->>'job_no');
    end if;
    if target_job_id is null then
      raise exception 'job_required';
    end if;
    select * into target_job from public.garage_jobs
     where organisation_id = target_org and id = target_job_id for update;
    if not found then
      raise exception 'job_not_found';
    end if;
    target_job_no := target_job.job_no;
    c_name := target_job.customer_name;
    v_reg := target_job.vehicle_reg;
    c_phone := target_job.customer_phone;

    if event_name = 'PURCHASE' then
      next_state := target_job.state;
    else
      select v.next_state, v.is_valid, v.err_msg
        into next_state, is_valid_trans, dyn_err
        from app_private.validate_workflow_transition(target_org, 'garage_job', target_job.state, event_name) v;

      if not coalesce(is_valid_trans, false) then
        raise exception 'illegal_state_transition';
      end if;
    end if;

    event_payload := jsonb_strip_nulls(jsonb_build_object(
      'summary', nullif(left(trim(coalesce(command->>'summary', '')), 500), ''),
      'customer_name', coalesce(c_name, nullif(left(trim(coalesce(command->>'customer_name', command->>'customer', '')), 200), '')),
      'phone', coalesce(c_phone, nullif(left(trim(coalesce(command->>'phone', command->>'customer_phone', '')), 50), '')),
      'customer_phone', coalesce(c_phone, nullif(left(trim(coalesce(command->>'phone', command->>'customer_phone', '')), 50), '')),
      'vehicle_reg', coalesce(v_reg, nullif(left(trim(coalesce(command->>'vehicle_reg', command->>'vehicle', '')), 100), '')),
      'scm_step', nullif(scm_step, ''),
      'item', nullif(left(trim(coalesce(command->>'item', command->>'description', '')), 300), ''),
      'qty', nullif(command->>'qty', ''),
      'amount', nullif(coalesce(command->>'amount', command->>'cost', ''), '')
    ));

    insert into public.job_events
      (id, organisation_id, job_id, event_type, from_state, to_state,
       actor_person_id, acting_seat, idempotency_key, payload)
    values
      (event_id, target_org, target_job_id, event_name,
       case when event_name = 'CALL' then null else target_job.state end,
       next_state, target_person, target_seat, command_key, event_payload);

    if event_name <> 'PURCHASE' and event_name <> 'CALL' then
      update public.garage_jobs
         set state = next_state,
             version = version + 1,
             closed_at = case when next_state = 'closed' then now() else closed_at end
       where organisation_id = target_org and id = target_job_id;
    end if;

    response := jsonb_build_object(
      'ok', true,
      'state', 'accepted',
      'event', jsonb_build_object(
        'id', event_id,
        'type', event_name,
        'job_id', target_job_id,
        'job_no', target_job_no,
        'customer_name', c_name,
        'vehicle_reg', v_reg,
        'phone', c_phone,
        'to_state', next_state,
        'fields', event_payload
      )
    );
  end if;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Common: Update idempotency, write audit event
  -- ─────────────────────────────────────────────────────────────────────────
  update public.idempotency_keys
     set state = 'accepted', response_code = 200, response_body = response
   where organisation_id = target_org and key = command_key;

  insert into public.audit_events
    (organisation_id, actor_person_id, acting_seat, action, object_type,
     object_id, request_id, after_state, metadata)
  values
    (target_org, target_person, target_seat, 'erp.' || lower(event_name),
     'commercial_command', event_id, request_identifier, response,
     jsonb_build_object('idempotency_key', command_key));

  return response;
end
$$;

commit;
