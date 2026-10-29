begin;

-- STARQ ERP — SERP-460 Accounting-Event / Subledger Abstraction
--
-- PURPOSE:
-- Introduces the first-class, immutable, tenant-scoped accounting_events and
-- accounting_event_lines tables between operational facts (Order-to-Cash,
-- Procure-to-Pay, Cash/Payment) and public.journal_proposals.
--
-- REVISED PER INDEPENDENT REVIEW #14415:
-- H1: Enforce caller tenant access in SECURITY DEFINER function before reads/inserts;
--     revoke EXECUTE from PUBLIC and grant to authenticated/service_role; validate p_created_by.
-- H2: Immutability enforced: prevent direct UPDATE/DELETE via triggers; permit only
--     controlled transition from RECORDED to PROPOSED via internal function.
-- M1: Exact double-entry balance invariant (zero tolerance).
-- L2: Explicit command policies for RLS.

create table if not exists public.accounting_events (
    id uuid primary key default gen_random_uuid(),
    organisation_id uuid not null references public.organisations(id),
    family text not null check (family in ('ORDER_TO_CASH', 'PROCURE_TO_PAY', 'CASH_PAYMENT', 'INVENTORY_GL', 'RECORD_TO_REPORT')),
    event_type text not null,
    source_type text not null,
    source_id uuid not null,
    idempotency_key text not null,
    event_date date not null default current_date,
    currency character(3) not null default 'MVR',
    gross_amount numeric(20, 6) not null check (gross_amount >= 0),
    net_amount numeric(20, 6),
    tax_amount numeric(20, 6),
    status text not null default 'RECORDED' check (status in ('RECORDED', 'PROPOSED', 'POSTED', 'REJECTED')),
    narration text not null,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (organisation_id, idempotency_key),
    unique (organisation_id, id)
);

create table if not exists public.accounting_event_lines (
    id uuid primary key default gen_random_uuid(),
    organisation_id uuid not null references public.organisations(id),
    event_id uuid not null,
    line_no integer not null check (line_no > 0),
    account_code text not null,
    debit numeric(20, 6) not null default 0 check (debit >= 0),
    credit numeric(20, 6) not null default 0 check (credit >= 0),
    narration text,
    unique (organisation_id, event_id, line_no),
    foreign key (organisation_id, event_id)
      references public.accounting_events(organisation_id, id)
      on delete cascade,
    check (debit > 0 or credit > 0),
    check (not (debit > 0 and credit > 0))
);

-- ============================================================================
-- H2: IMMUTABILITY ENFORCEMENT TRIGGERS
-- ============================================================================
-- accounting_event_lines: completely immutable (no updates, no deletes except cascade)
create or replace function public.accounting_event_lines_prevent_mutation()
returns trigger
language plpgsql
as $$
begin
    raise exception 'accounting_event_lines_immutable: modifications to accounting event lines are prohibited';
end;
$$;

drop trigger if exists trg_accounting_event_lines_immutable on public.accounting_event_lines;
create trigger trg_accounting_event_lines_immutable
before update or delete on public.accounting_event_lines
for each row execute function public.accounting_event_lines_prevent_mutation();

-- accounting_events: immutable except status transition RECORDED -> PROPOSED via controlled function
create or replace function public.accounting_events_prevent_mutation()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'DELETE' then
        raise exception 'accounting_events_immutable: deletion of accounting events is prohibited';
    end if;

    if tg_op = 'UPDATE' then
        -- Permit only the status transition from RECORDED to PROPOSED
        if old.status = 'RECORDED' and new.status = 'PROPOSED'
           and old.id = new.id
           and old.organisation_id = new.organisation_id
           and old.family = new.family
           and old.event_type = new.event_type
           and old.source_type = new.source_type
           and old.source_id = new.source_id
           and old.idempotency_key = new.idempotency_key
           and old.gross_amount = new.gross_amount
           and old.event_date = new.event_date then
            return new;
        else
            raise exception 'accounting_events_immutable: direct or payload updates to accounting events are prohibited';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_accounting_events_immutable on public.accounting_events;
create trigger trg_accounting_events_immutable
before update or delete on public.accounting_events
for each row execute function public.accounting_events_prevent_mutation();

-- ============================================================================
-- L2: RLS ENFORCEMENT WITH EXPLICIT COMMAND POLICIES
-- ============================================================================
alter table public.accounting_events enable row level security;
alter table public.accounting_event_lines enable row level security;

-- SELECT policy: tenant isolation
drop policy if exists accounting_events_select on public.accounting_events;
create policy accounting_events_select on public.accounting_events
  for select using (app_private.has_organisation_access(organisation_id));

-- INSERT policy: tenant isolation
drop policy if exists accounting_events_insert on public.accounting_events;
create policy accounting_events_insert on public.accounting_events
  for insert with check (app_private.has_organisation_access(organisation_id));

-- Lines SELECT policy
drop policy if exists accounting_event_lines_select on public.accounting_event_lines;
create policy accounting_event_lines_select on public.accounting_event_lines
  for select using (app_private.has_organisation_access(organisation_id));

-- Lines INSERT policy
drop policy if exists accounting_event_lines_insert on public.accounting_event_lines;
create policy accounting_event_lines_insert on public.accounting_event_lines
  for insert with check (app_private.has_organisation_access(organisation_id));

-- Revoke direct permissions from anon
revoke all on public.accounting_events, public.accounting_event_lines from anon;
grant select, insert on public.accounting_events, public.accounting_event_lines to authenticated, service_role;
revoke update, delete on public.accounting_events, public.accounting_event_lines from authenticated;

-- ============================================================================
-- H1 & L1: CONTROLLED PROPOSAL TRANSLATION FUNCTION
-- ============================================================================
create or replace function public.propose_journal_from_accounting_event(
    p_organisation_id uuid,
    p_event_id uuid,
    p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
    v_event record;
    v_proposal_id uuid;
    v_total_debit numeric(20, 6) := 0;
    v_total_credit numeric(20, 6) := 0;
    v_caller_role text := current_user;
    v_trusted_person uuid;
    v_jwt_sub text;
    v_guc_person uuid;
begin
    -- H1 Tenant Isolation Check: verify caller has explicit access to target organisation
    if not app_private.has_organisation_access(p_organisation_id) then
        raise exception 'access_denied: caller does not have access to organisation %', p_organisation_id;
    end if;

    -- L1 Audit Actor Validation:
    -- In SECURITY DEFINER context:
    -- 1. Positively identified trusted service/internal execution (service_role):
    --    Allowed to pass an explicit p_created_by, which must resolve to an active person in public.persons.
    -- 2. Authenticated callers:
    --    Derive authenticated caller identity ONLY from trusted JWT subject:
    --    request.jwt.claim.sub -> public.persons.external_subject.
    --    Fail closed if JWT subject is absent or unmapped.
    --    Mutable app.person_id GUC is NEVER used as an authority; if present, it is checked
    --    strictly for consistency and must match the trusted person.
    --    p_created_by must equal the verified person identity.
    -- 3. Ambiguous or anonymous callers: reject fail-closed.
    v_caller_role := coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        nullif(current_setting('role', true), ''),
        session_user
    );

    if v_caller_role = 'service_role' then
        -- Trusted internal service_role path:
        if p_created_by is null then
            raise exception 'invalid_audit_actor: p_created_by is required for service_role execution';
        end if;
        if not exists (select 1 from public.persons where id = p_created_by and status = 'active') then
            raise exception 'invalid_audit_actor: service_role actor person % does not exist or is inactive', p_created_by;
        end if;
    else
        -- Authenticated caller path: derive identity SOLELY from JWT subject -> external_subject
        v_jwt_sub := nullif(current_setting('request.jwt.claim.sub', true), '');
        if v_jwt_sub is null then
            raise exception 'invalid_audit_actor: missing_jwt_subject';
        end if;

        select id into v_trusted_person
        from public.persons
        where external_subject = v_jwt_sub
          and status = 'active';

        if v_trusted_person is null then
            raise exception 'invalid_audit_actor: unmapped_jwt_subject';
        end if;

        -- Mutable app.person_id check: if set, it must match trusted person (never used as authority)
        v_guc_person := app_private.current_person_id();
        if v_guc_person is not null and v_guc_person <> v_trusted_person then
            raise exception 'invalid_audit_actor: conflicting_person_guc';
        end if;

        if p_created_by is null or p_created_by <> v_trusted_person then
            raise exception 'invalid_audit_actor: spoofed_audit_actor';
        end if;
    end if;

    -- 1. Fetch accounting event
    select * into v_event
    from public.accounting_events
    where organisation_id = p_organisation_id
      and id = p_event_id
    for update;

    if not found then
        raise exception 'accounting_event_not_found: %', p_event_id;
    end if;

    if v_event.status <> 'RECORDED' then
        raise exception 'accounting_event_invalid_status: % (expected RECORDED)', v_event.status;
    end if;

    -- 2. Verify double-entry balance across lines with exact zero tolerance (M1)
    select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into v_total_debit, v_total_credit
    from public.accounting_event_lines
    where organisation_id = p_organisation_id
      and event_id = p_event_id;

    if v_total_debit <> v_total_credit then
        raise exception 'accounting_event_unbalanced: debit=%, credit=%', v_total_debit, v_total_credit;
    end if;

    -- 3. Create journal proposal in 'draft' status
    insert into public.journal_proposals (
        organisation_id,
        source_type,
        source_id,
        status,
        narration,
        transaction_date,
        currency,
        created_by
    ) values (
        p_organisation_id,
        'accounting_event:' || lower(v_event.event_type),
        v_event.id,
        'draft',
        v_event.narration,
        v_event.event_date,
        v_event.currency,
        p_created_by
    )
    returning id into v_proposal_id;

    -- 4. Insert lines into public.journal_proposal_lines
    -- Signed amounts: Debit = positive, Credit = negative
    insert into public.journal_proposal_lines (
        organisation_id,
        proposal_id,
        line_no,
        account_code,
        amount
    )
    select
        organisation_id,
        v_proposal_id,
        line_no,
        account_code,
        case when debit > 0 then debit else -credit end
    from public.accounting_event_lines
    where organisation_id = p_organisation_id
      and event_id = p_event_id
    order by line_no;

    -- 5. Advance event status to PROPOSED (permitted by trg_accounting_events_immutable)
    update public.accounting_events
    set status = 'PROPOSED'
    where organisation_id = p_organisation_id
      and id = p_event_id;

    return v_proposal_id;
end;
$$;

-- H1 Privilege Hardening: revoke execute from public, grant only to service_role / authenticated
revoke all on function public.propose_journal_from_accounting_event(uuid, uuid, uuid) from public, anon;
grant execute on function public.propose_journal_from_accounting_event(uuid, uuid, uuid) to authenticated, service_role;

commit;
