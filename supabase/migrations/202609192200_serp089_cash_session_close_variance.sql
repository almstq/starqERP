-- =============================================================================
-- Migration: 202609192200_serp089_cash_session_close_variance.sql
-- SERP-089 (M6-COUNTER) — Cash-session close and variance.
--
-- DEPENDENCIES:
--   - SERP-087 (202609192100): counter_tenders, counter_receipts, tender reconciliation
--   - Currency architecture (commit 0c46cde / SERP-434): functional currency derived
--     from organisations.base_currency, never a hardcoded literal.
--
-- FOUNDER RULING (Room seq 6186):
--   - Record expected cash, counted cash, variance, reason/note, operator, close timestamp.
--   - Auditable (audit_events + outbox).
--   - NO automatic Cash Over/Short journal unless an already-proven accounting path safely
--     supports it; do not broaden scope to build one. This is a self-contained write
--     against the already-proven backend, not a new accounting subsystem.
--
-- ACCEPTANCE CRITERIA:
--   1. Positive evidence proves single attributable close with expected/counted variance.
--   2. Negative tenant, authorization, replay and failure paths fail closed with attributable evidence.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Table: public.counter_cash_sessions
-- -----------------------------------------------------------------------------
create table if not exists public.counter_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  location_id uuid not null,
  session_number text not null,
  currency character(3) not null,
  status text not null default 'closed' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  opened_by uuid not null references public.persons(id),
  opened_seat text not null,
  closed_at timestamptz,
  closed_by uuid references public.persons(id),
  closed_seat text,
  opening_float numeric(20, 6) not null default 0 check (opening_float >= 0),
  cash_sales_amount numeric(20, 6) not null default 0 check (cash_sales_amount >= 0),
  card_sales_amount numeric(20, 6) not null default 0 check (card_sales_amount >= 0),
  transfer_sales_amount numeric(20, 6) not null default 0 check (transfer_sales_amount >= 0),
  total_sales_amount numeric(20, 6) not null default 0 check (total_sales_amount >= 0),
  expected_cash numeric(20, 6) not null default 0 check (expected_cash >= 0),
  counted_cash numeric(20, 6) check (counted_cash is null or counted_cash >= 0),
  variance_amount numeric(20, 6),
  notes text,
  transaction_count integer not null default 0 check (transaction_count >= 0),
  idempotency_key uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, id),
  unique (organisation_id, session_number),
  foreign key (organisation_id, location_id)
    references public.locations(organisation_id, id)
);

create index if not exists counter_cash_sessions_org_loc_status_idx
  on public.counter_cash_sessions(organisation_id, location_id, status);

revoke all on table public.counter_cash_sessions from public, anon, authenticated;
grant select on table public.counter_cash_sessions to service_role;

-- -----------------------------------------------------------------------------
-- 2. Ensure Document Sequence for Cash Sessions (CS-XXXXX)
-- -----------------------------------------------------------------------------
insert into public.document_sequences (organisation_id, sequence_type, prefix, padding)
select id, 'cash_session', 'CS-', 5
  from public.organisations
on conflict (organisation_id, sequence_type) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Stored Procedure: api_counter_session_open
-- -----------------------------------------------------------------------------
create or replace function public.api_counter_session_open(
  target_org uuid,
  target_person uuid,
  target_seat text,
  p_location_id uuid,
  p_opening_float numeric default 0,
  p_command_key uuid default null
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  v_org_currency character(3);
  v_session_id uuid;
  v_session_no text;
  v_existing public.counter_cash_sessions%rowtype;
  v_float numeric;
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

  v_float := round(coalesce(p_opening_float, 0), 2);
  if v_float < 0 then
    raise exception 'counter_session_float_negative';
  end if;

  -- Derive currency from organisations.base_currency (commit 0c46cde)
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
          'opening_float', v_existing.opening_float
        )
      );
    end if;
  end if;

  -- Concurrency serialize per org + location
  perform pg_advisory_xact_lock(
    hashtext('counter_session_open_' || target_org::text || p_location_id::text)::bigint
  );

  -- Only one open session allowed per location at a time
  if exists (
    select 1 from public.counter_cash_sessions
     where organisation_id = target_org and location_id = p_location_id and status = 'open'
  ) then
    raise exception 'counter_session_already_open';
  end if;

  -- Sequence seeding
  insert into public.document_sequences (organisation_id, sequence_type, prefix, padding)
  values (target_org, 'cash_session', 'CS-', 5)
  on conflict (organisation_id, sequence_type) do nothing;

  v_session_id := gen_random_uuid();
  v_session_no := app_private.allocate_document_no(target_org, 'cash_session');

  insert into public.counter_cash_sessions (
    id, organisation_id, location_id, session_number, currency,
    status, opened_at, opened_by, opened_seat, opening_float,
    idempotency_key
  ) values (
    v_session_id, target_org, p_location_id, v_session_no, v_org_currency,
    'open', now(), target_person, target_seat, v_float,
    p_command_key
  );

  insert into public.audit_events (
    organisation_id, actor_person_id, acting_seat, action, object_type,
    object_id, after_state, metadata
  ) values (
    target_org, target_person, target_seat, 'erp.counter_session_open',
    'counter_cash_session', v_session_id,
    jsonb_build_object(
      'session_id', v_session_id,
      'session_number', v_session_no,
      'location_id', p_location_id,
      'opening_float', v_float,
      'currency', v_org_currency,
      'status', 'open'
    ),
    jsonb_build_object('idempotency_key', p_command_key)
  );

  return jsonb_build_object(
    'ok', true,
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

alter function public.api_counter_session_open(uuid, uuid, text, uuid, numeric, uuid)
  set search_path = public, app_private, extensions, pg_temp;

revoke all on function public.api_counter_session_open(uuid, uuid, text, uuid, numeric, uuid)
  from public, anon, authenticated;
grant execute on function public.api_counter_session_open(uuid, uuid, text, uuid, numeric, uuid)
  to service_role;

-- -----------------------------------------------------------------------------
-- 4. Stored Procedure: api_counter_session_current (Read active session summary)
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

  v_expected_cash := round(v_opening_float + v_cash_sales, 2);

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
      'cash_sales_amount', round(v_cash_sales, 2),
      'card_sales_amount', round(v_card_sales, 2),
      'transfer_sales_amount', round(v_transfer_sales, 2),
      'total_sales_amount', round(v_total_sales, 2),
      'expected_cash', v_expected_cash,
      'transaction_count', v_tx_count
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

-- -----------------------------------------------------------------------------
-- 5. Stored Procedure: api_counter_session_close (Till close & variance recording)
-- -----------------------------------------------------------------------------
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
  v_session_id uuid;
  v_session_no text;
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
  v_expected_cash numeric := 0;
  v_counted_cash numeric;
  v_variance numeric := 0;
  v_clean_notes text;
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

  -- Counted cash validation
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'counter_session_counted_cash_invalid';
  end if;
  v_counted_cash := round(p_counted_cash, 2);
  v_clean_notes := nullif(trim(coalesce(p_notes, '')), '');

  -- Derive currency from organisations.base_currency (commit 0c46cde)
  select base_currency into v_org_currency
    from public.organisations where id = target_org;
  if v_org_currency is null then
    raise exception 'organisation_not_found';
  end if;

  -- Replay guard: return existing closed session if idempotency key matches
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
          'cash_sales_amount', v_existing.cash_sales_amount,
          'card_sales_amount', v_existing.card_sales_amount,
          'transfer_sales_amount', v_existing.transfer_sales_amount,
          'total_sales_amount', v_existing.total_sales_amount,
          'expected_cash', v_existing.expected_cash,
          'counted_cash', v_existing.counted_cash,
          'variance_amount', v_existing.variance_amount,
          'notes', v_existing.notes,
          'transaction_count', v_existing.transaction_count
        )
      );
    end if;
  end if;

  -- Concurrency serialize close per location
  perform pg_advisory_xact_lock(
    hashtext('counter_session_close_' || target_org::text || p_location_id::text)::bigint
  );

  -- Check for active open session
  select * into v_open
    from public.counter_cash_sessions
   where organisation_id = target_org and location_id = p_location_id and status = 'open'
   order by opened_at desc
   limit 1
   for update;

  if not found then
    raise exception 'no_open_session';
  end if;

  v_session_id := v_open.id;
  v_session_no := v_open.session_number;
  v_window_start := v_open.opened_at;
  v_opened_by := v_open.opened_by;
  v_opened_seat := v_open.opened_seat;
  v_opening_float := v_open.opening_float;

  -- Server-authoritative aggregation: cash tenders net of change, card/transfer breakdown
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

  v_cash_sales := round(coalesce(v_cash_sales, 0), 2);
  v_card_sales := round(coalesce(v_card_sales, 0), 2);
  v_transfer_sales := round(coalesce(v_transfer_sales, 0), 2);
  v_total_sales := round(coalesce(v_total_sales, 0), 2);

  v_expected_cash := round(v_opening_float + v_cash_sales, 2);
  v_variance := round(v_counted_cash - v_expected_cash, 2);

  -- Write closed session
  update public.counter_cash_sessions
     set status = 'closed',
         closed_at = v_closed_at,
         closed_by = target_person,
         closed_seat = target_seat,
         cash_sales_amount = v_cash_sales,
         card_sales_amount = v_card_sales,
         transfer_sales_amount = v_transfer_sales,
         total_sales_amount = v_total_sales,
         expected_cash = v_expected_cash,
         counted_cash = v_counted_cash,
         variance_amount = v_variance,
         notes = v_clean_notes,
         transaction_count = v_tx_count,
         idempotency_key = coalesce(p_command_key, idempotency_key),
         updated_at = now()
   where id = v_session_id;

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
      'total_sales_amount', v_total_sales,
      'expected_cash', v_expected_cash,
      'counted_cash', v_counted_cash,
      'variance_amount', v_variance,
      'transaction_count', v_tx_count,
      'status', 'closed',
      'notes', v_clean_notes
    ),
    jsonb_build_object(
      'closed_at', v_closed_at,
      'closed_by', target_person,
      'closed_seat', target_seat,
      'idempotency_key', p_command_key
    )
  );

  -- Outbox event for eventual consistency / projection seams
  perform app_private.append_outbox_event(
    target_org,
    'COUNTER_SESSION_CLOSE',
    'counter_cash_sessions',
    v_session_id::text,
    jsonb_build_object(
      'session_id', v_session_id,
      'session_number', v_session_no,
      'location_id', p_location_id,
      'currency', v_org_currency,
      'expected_cash', v_expected_cash,
      'counted_cash', v_counted_cash,
      'variance_amount', v_variance,
      'notes', v_clean_notes
    ),
    jsonb_build_object('idempotency_key', p_command_key),
    target_person,
    target_seat
  );

  return jsonb_build_object(
    'ok', true,
    'session', jsonb_build_object(
      'id', v_session_id,
      'session_number', v_session_no,
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
      'cash_sales_amount', v_cash_sales,
      'card_sales_amount', v_card_sales,
      'transfer_sales_amount', v_transfer_sales,
      'total_sales_amount', v_total_sales,
      'expected_cash', v_expected_cash,
      'counted_cash', v_counted_cash,
      'variance_amount', v_variance,
      'notes', v_clean_notes,
      'transaction_count', v_tx_count
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

-- -----------------------------------------------------------------------------
-- 6. Stored Procedure: api_counter_session_get (Read single session)
-- -----------------------------------------------------------------------------
create or replace function public.api_counter_session_get(
  target_org uuid,
  target_person uuid,
  target_seat text,
  p_session_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  v_session public.counter_cash_sessions%rowtype;
begin
  -- Seat authorization
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  select * into v_session
    from public.counter_cash_sessions
   where organisation_id = target_org and id = p_session_id;

  if not found then
    raise exception 'counter_session_not_found';
  end if;

  return jsonb_build_object(
    'ok', true,
    'session', jsonb_build_object(
      'id', v_session.id,
      'session_number', v_session.session_number,
      'location_id', v_session.location_id,
      'status', v_session.status,
      'currency', v_session.currency,
      'opened_at', v_session.opened_at,
      'opened_by', v_session.opened_by,
      'opened_seat', v_session.opened_seat,
      'closed_at', v_session.closed_at,
      'closed_by', v_session.closed_by,
      'closed_seat', v_session.closed_seat,
      'opening_float', v_session.opening_float,
      'cash_sales_amount', v_session.cash_sales_amount,
      'card_sales_amount', v_session.card_sales_amount,
      'transfer_sales_amount', v_session.transfer_sales_amount,
      'total_sales_amount', v_session.total_sales_amount,
      'expected_cash', v_session.expected_cash,
      'counted_cash', v_session.counted_cash,
      'variance_amount', v_session.variance_amount,
      'notes', v_session.notes,
      'transaction_count', v_session.transaction_count
    )
  );
end;
$$;

alter function public.api_counter_session_get(uuid, uuid, text, uuid)
  set search_path = public, app_private, extensions, pg_temp;

revoke all on function public.api_counter_session_get(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.api_counter_session_get(uuid, uuid, text, uuid)
  to service_role;

-- -----------------------------------------------------------------------------
-- 7. Stored Procedure: api_counter_session_list (List sessions for location)
-- -----------------------------------------------------------------------------
create or replace function public.api_counter_session_list(
  target_org uuid,
  target_person uuid,
  target_seat text,
  p_location_id uuid default null,
  p_limit integer default 20
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  v_rows jsonb;
begin
  -- Seat authorization
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id,
           'session_number', s.session_number,
           'location_id', s.location_id,
           'status', s.status,
           'currency', s.currency,
           'opened_at', s.opened_at,
           'closed_at', s.closed_at,
           'opening_float', s.opening_float,
           'expected_cash', s.expected_cash,
           'counted_cash', s.counted_cash,
           'variance_amount', s.variance_amount,
           'notes', s.notes,
           'transaction_count', s.transaction_count
         ) order by s.created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select *
        from public.counter_cash_sessions
       where organisation_id = target_org
         and (p_location_id is null or location_id = p_location_id)
       order by created_at desc
       limit greatest(1, least(coalesce(p_limit, 20), 100))
    ) s;

  return jsonb_build_object('ok', true, 'sessions', v_rows);
end;
$$;

alter function public.api_counter_session_list(uuid, uuid, text, uuid, integer)
  set search_path = public, app_private, extensions, pg_temp;

revoke all on function public.api_counter_session_list(uuid, uuid, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.api_counter_session_list(uuid, uuid, text, uuid, integer)
  to service_role;

commit;
