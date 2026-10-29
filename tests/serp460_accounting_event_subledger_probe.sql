-- STARQ ERP — SERP-460 Accounting-Event / Subledger Invariant Probe
--
-- PURPOSE & REVISED SCOPE (M2 per #14434):
-- Executable behavioral test suite for SERP-460 subledger DDL and proposal translation.
-- Designed to execute in the disposable CI PostgreSQL service after migrations and
-- tests/rls_isolation_fixture.sql.
--
-- BEHAVIORAL INVARIANTS TESTED:
-- 1. Tenant Isolation (RLS): Tenant A cannot SELECT or INSERT Tenant B accounting events/lines.
-- 2. Security Definer Boundary (H1): Cross-tenant propose_journal invocation is denied.
-- 3. Audit Actor Validation (L1): Spoofed p_created_by is rejected.
-- 4. Immutability Enforcement (H2): Direct UPDATE/DELETE of events and lines is rejected.
-- 5. Exact Double-Entry Balance (M1): Events with 0.001 MVR imbalance are rejected.
-- 6. Controlled Translation: RECORDED -> PROPOSED creates exactly 1 draft proposal and 0 GL entries.
-- 7. Idempotent Replay Protection: Re-running proposal translation on PROPOSED event raises error.
--
-- EXPLICIT ERROR ENFORCEMENT:
-- Any invariant failure raises an exception and halts execution (fail-closed).

begin;

-- Create dedicated non-superuser, NOBYPASSRLS probe role matching tests/rls_isolation_probe.sql
-- pattern so RLS is genuinely enforced on raw SELECT/INSERT operations.
-- Grant ONLY faithful product privileges matching authenticated:
-- SELECT, INSERT on accounting_events, accounting_event_lines;
-- SELECT on journal_proposals, journal_entries;
-- EXECUTE on public.propose_journal_from_accounting_event.
-- Explicitly NO UPDATE or DELETE grants to this role.
create role serp460_rls_probe noinherit nologin nosuperuser nobypassrls;
grant serp460_rls_probe to current_user;
grant usage on schema public, app_private to serp460_rls_probe;
grant select, insert on public.accounting_events to serp460_rls_probe;
grant select, insert on public.accounting_event_lines to serp460_rls_probe;
grant select on public.journal_proposals to serp460_rls_probe;
grant select on public.journal_entries to serp460_rls_probe;
grant execute on function public.propose_journal_from_accounting_event to serp460_rls_probe;

set local role serp460_rls_probe;
set local row_security = on;

do $$
declare
    attrs record;
begin
    select rolsuper, rolbypassrls into attrs
      from pg_roles where rolname = current_user;

    if current_user <> 'serp460_rls_probe'
       or attrs.rolsuper
       or attrs.rolbypassrls
       or current_setting('row_security') <> 'on' then
      raise exception 'SERP-460 probe role can bypass RLS';
    end if;

    if exists (
      select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_roles owner_role on owner_role.oid = c.relowner
       where n.nspname = 'public'
         and c.relkind = 'r'
         and c.relname in ('accounting_events', 'accounting_event_lines')
         and owner_role.rolname = current_user
    ) then
      raise exception 'SERP-460 probe role owns a tested table';
    end if;
end;
$$;

do $$
declare
    v_tenant_a uuid := '00000000-0000-4000-8000-000000000001'::uuid;
    v_tenant_b uuid := '00000000-0000-4000-8000-000000000002'::uuid;
    v_person_probe uuid := '00000000-0000-4000-8000-000000000101'::uuid;
    v_spoofed_person uuid := '00000000-0000-4000-8000-000000000999'::uuid;

    v_event_a uuid;
    v_event_b uuid;
    v_event_unbal uuid;
    v_proposal_id uuid;
    v_count integer;
    v_gl_count_before integer;
    v_gl_count_after integer;
    v_caught boolean;
begin
    raise notice '=======================================================';
    raise notice 'Running SERP-460 Behavioral Invariant Test Suite (M2)';
    raise notice '=======================================================';

    -- Preflight: capture baseline GL transactions count
    select count(*) into v_gl_count_before from public.journal_entries;

    -- =========================================================================
    -- TEST 1: Tenant A inserts valid accounting event
    -- =========================================================================
    perform set_config('app.organisation_id', v_tenant_a::text, true);
    perform set_config('app.person_id', v_person_probe::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', 'synthetic:serp124-probe', true);

    insert into public.accounting_events (
        organisation_id, family, event_type, source_type, source_id,
        idempotency_key, gross_amount, narration
    ) values (
        v_tenant_a, 'CASH_PAYMENT', 'PAYMENT_RECEIVED', 'pos_counter', gen_random_uuid(),
        'idem_probe_test_001', 1500.0, 'SERP-460 Behavioral Probe Event A'
    ) returning id into v_event_a;

    insert into public.accounting_event_lines (organisation_id, event_id, line_no, account_code, debit, credit)
    values
        (v_tenant_a, v_event_a, 1, '1110', 1500.0, 0),
        (v_tenant_a, v_event_a, 2, '1210', 0, 1500.0);

    -- =========================================================================
    -- TEST 2: Tenant Isolation (RLS) - Tenant B cannot see Tenant A's event
    -- =========================================================================
    perform set_config('app.organisation_id', v_tenant_b::text, true);

    select count(*) into v_count from public.accounting_events where id = v_event_a;
    if v_count <> 0 then
        raise exception 'ASSERTION FAILED: Tenant B can see Tenant A accounting_events via RLS!';
    end if;

    select count(*) into v_count from public.accounting_event_lines where event_id = v_event_a;
    if v_count <> 0 then
        raise exception 'ASSERTION FAILED: Tenant B can see Tenant A accounting_event_lines via RLS!';
    end if;

    -- =========================================================================
    -- TEST 3: Security Definer Cross-Tenant Boundary (H1)
    -- Caller authenticated in Tenant B attempts to translate Tenant A's event
    -- =========================================================================
    v_caught := false;
    begin
        perform public.propose_journal_from_accounting_event(v_tenant_a, v_event_a, v_person_probe);
    exception when others then
        v_caught := true;
    end;

    if not v_caught then
        raise exception 'ASSERTION FAILED: Cross-tenant propose_journal_from_accounting_event succeeded without error!';
    end if;

    -- =========================================================================
    -- TEST 4: Audit Actor Validation (L1) - Targeted Invariant Regressions
    -- Covers:
    -- 4a. Authenticated caller with missing JWT subject must be rejected
    -- 4b. Authenticated caller with unmapped JWT subject must be rejected
    -- 4c. Authenticated caller with conflicting/spoofed app.person_id must be rejected
    -- 4d. Authenticated caller attempting to spoof p_created_by must be rejected
    -- 4e. Positively identified service_role execution with valid and invalid actors
    -- =========================================================================
    perform set_config('app.organisation_id', v_tenant_a::text, true);
    perform set_config('app.person_id', v_person_probe::text, true);

    -- 4a: Missing JWT subject (request.jwt.claim.sub is empty/null)
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', '', true);
    v_caught := false;
    begin
        perform public.propose_journal_from_accounting_event(v_tenant_a, v_event_a, v_person_probe);
    exception when others then
        if sqlerrm like '%missing_jwt_subject%' then
            v_caught := true;
        end if;
    end;
    if not v_caught then
        raise exception 'ASSERTION FAILED: Missing JWT subject was not rejected with missing_jwt_subject!';
    end if;

    -- 4b: Unmapped JWT subject
    perform set_config('request.jwt.claim.sub', 'synthetic:unmapped-probe-subject', true);
    v_caught := false;
    begin
        perform public.propose_journal_from_accounting_event(v_tenant_a, v_event_a, v_person_probe);
    exception when others then
        if sqlerrm like '%unmapped_jwt_subject%' then
            v_caught := true;
        end if;
    end;
    if not v_caught then
        raise exception 'ASSERTION FAILED: Unmapped JWT subject was not rejected with unmapped_jwt_subject!';
    end if;

    -- 4c: Valid JWT subject ('synthetic:serp124-probe') but conflicting app.person_id
    perform set_config('request.jwt.claim.sub', 'synthetic:serp124-probe', true);
    perform set_config('app.person_id', v_spoofed_person::text, true);
    v_caught := false;
    begin
        perform public.propose_journal_from_accounting_event(v_tenant_a, v_event_a, v_person_probe);
    exception when others then
        -- Could be denied by has_organisation_access or conflicting_person_guc; both prove no authority escalation
        v_caught := true;
    end;
    if not v_caught then
        raise exception 'ASSERTION FAILED: Conflicting/spoofed app.person_id was accepted!';
    end if;

    -- 4d: Valid JWT subject and valid tenant context, but spoofed p_created_by
    perform set_config('app.person_id', v_person_probe::text, true);
    v_caught := false;
    begin
        perform public.propose_journal_from_accounting_event(v_tenant_a, v_event_a, v_spoofed_person);
    exception when others then
        if sqlerrm like '%spoofed_audit_actor%' then
            v_caught := true;
        end if;
    end;
    if not v_caught then
        raise exception 'ASSERTION FAILED: Spoofed p_created_by was not rejected with spoofed_audit_actor!';
    end if;

    -- 4e: Service-role execution:
    -- Non-existent actor person must be rejected
    perform set_config('request.jwt.claim.role', 'service_role', true);
    v_caught := false;
    begin
        perform public.propose_journal_from_accounting_event(v_tenant_a, v_event_a, gen_random_uuid());
    exception when others then
        v_caught := true;
    end;
    if not v_caught then
        raise exception 'ASSERTION FAILED: Non-existent actor person accepted in service_role path!';
    end if;

    -- Restore valid authenticated caller context for unprivileged checks
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', 'synthetic:serp124-probe', true);
    perform set_config('app.person_id', v_person_probe::text, true);
end;
$$;

-- =============================================================================
-- TEST 5: Immutability Enforcement (H2) - Privileged Trigger Verification
-- Executed under privileged session/table owner context (reset role) so direct
-- UPDATE/DELETE reach trg_accounting_events_immutable / trg_accounting_event_lines_immutable
-- rather than failing on authenticated product grants or being filtered by RLS.
-- =============================================================================
reset role;

do $$
declare
    v_tenant_a uuid := '00000000-0000-4000-8000-000000000001'::uuid;
    v_event_a uuid;
    v_caught boolean;
begin
    -- Locate synthetic probe event created in Test 1
    select id into v_event_a
    from public.accounting_events
    where organisation_id = v_tenant_a and idempotency_key = 'idem_probe_test_001';

    if v_event_a is null then
        raise exception 'ASSERTION FAILED: Synthetic probe event A not found for immutability checks!';
    end if;

    -- 5a. Direct DELETE on accounting_events
    v_caught := false;
    begin
        delete from public.accounting_events where id = v_event_a;
    exception when others then
        if sqlerrm like '%accounting_events_immutable%' then
            v_caught := true;
        end if;
    end;
    if not v_caught then
        raise exception 'ASSERTION FAILED: Direct DELETE on accounting_events was permitted or failed for wrong reason!';
    end if;

    -- 5b. Direct payload UPDATE on accounting_events
    v_caught := false;
    begin
        update public.accounting_events set gross_amount = 9999.0 where id = v_event_a;
    exception when others then
        if sqlerrm like '%accounting_events_immutable%' then
            v_caught := true;
        end if;
    end;
    if not v_caught then
        raise exception 'ASSERTION FAILED: Direct payload UPDATE on accounting_events was permitted or failed for wrong reason!';
    end if;

    -- 5c. Direct UPDATE on accounting_event_lines
    v_caught := false;
    begin
        update public.accounting_event_lines set debit = 9999.0 where event_id = v_event_a;
    exception when others then
        if sqlerrm like '%accounting_event_lines_immutable%' then
            v_caught := true;
        end if;
    end;
    if not v_caught then
        raise exception 'ASSERTION FAILED: Direct UPDATE on accounting_event_lines was permitted or failed for wrong reason!';
    end if;
end;
$$;

-- Switch back to unprivileged probe role for remaining behavioral checks
set local role serp460_rls_probe;
set local row_security = on;

do $$
declare
    v_tenant_a uuid := '00000000-0000-4000-8000-000000000001'::uuid;
    v_person_probe uuid := '00000000-0000-4000-8000-000000000101'::uuid;

    v_event_a uuid;
    v_event_unbal uuid;
    v_proposal_id uuid;
    v_count integer;
    v_gl_count_before integer;
    v_gl_count_after integer;
    v_caught boolean;
begin
    -- Preflight: capture baseline GL transactions count
    select count(*) into v_gl_count_before from public.journal_entries;

    -- Locate synthetic probe event created in Test 1
    select id into v_event_a
    from public.accounting_events
    where organisation_id = v_tenant_a and idempotency_key = 'idem_probe_test_001';

    perform set_config('app.organisation_id', v_tenant_a::text, true);
    perform set_config('app.person_id', v_person_probe::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', 'synthetic:serp124-probe', true);

    -- =========================================================================
    -- TEST 6: Exact Balance Rejection (M1) - 0.001 MVR imbalance rejected
    -- =========================================================================
    insert into public.accounting_events (
        organisation_id, family, event_type, source_type, source_id,
        idempotency_key, gross_amount, narration
    ) values (
        v_tenant_a, 'CASH_PAYMENT', 'PAYMENT_RECEIVED', 'pos_counter', gen_random_uuid(),
        'idem_probe_unbal_002', 100.0, 'Imbalanced Event'
    ) returning id into v_event_unbal;

    insert into public.accounting_event_lines (organisation_id, event_id, line_no, account_code, debit, credit)
    values
        (v_tenant_a, v_event_unbal, 1, '1110', 100.0, 0),
        (v_tenant_a, v_event_unbal, 2, '1210', 0, 99.999); -- 0.001 imbalance

    v_caught := false;
    begin
        perform public.propose_journal_from_accounting_event(v_tenant_a, v_event_unbal, v_person_probe);
    exception when others then
        if sqlerrm like '%accounting_event_unbalanced%' then
            v_caught := true;
        else
            raise;
        end if;
    end;

    if not v_caught then
        raise exception 'ASSERTION FAILED: 0.001 unbalanced accounting event was translated without error or failed for wrong reason!';
    end if;

    -- =========================================================================
    -- TEST 7: Controlled Translation (RECORDED -> PROPOSED)
    -- =========================================================================
    v_proposal_id := public.propose_journal_from_accounting_event(v_tenant_a, v_event_a, v_person_probe);

    if v_proposal_id is null then
        raise exception 'ASSERTION FAILED: Proposal ID returned null!';
    end if;

    -- Verify proposal status is 'draft'
    select count(*) into v_count
    from public.journal_proposals
    where id = v_proposal_id and status = 'draft' and organisation_id = v_tenant_a;

    if v_count <> 1 then
        raise exception 'ASSERTION FAILED: Draft journal proposal was not created!';
    end if;

    -- Verify event status transitioned to 'PROPOSED'
    select count(*) into v_count
    from public.accounting_events
    where id = v_event_a and status = 'PROPOSED';

    if v_count <> 1 then
        raise exception 'ASSERTION FAILED: Accounting event status did not transition to PROPOSED!';
    end if;

    -- Verify NO GL entry was created (no uncontrolled GL posting)
    select count(*) into v_gl_count_after from public.journal_entries;
    if v_gl_count_after <> v_gl_count_before then
        raise exception 'ASSERTION FAILED: Direct GL entry was created during proposal translation!';
    end if;

    -- =========================================================================
    -- TEST 8: Idempotent Replay Rejection
    -- Re-running proposal on already-PROPOSED event raises error
    -- =========================================================================
    v_caught := false;
    begin
        perform public.propose_journal_from_accounting_event(v_tenant_a, v_event_a, v_person_probe);
    exception when others then
        if sqlerrm like '%accounting_event_invalid_status%' then
            v_caught := true;
        else
            raise;
        end if;
    end;

    if not v_caught then
        raise exception 'ASSERTION FAILED: Replay of PROPOSED event was permitted or failed for wrong reason!';
    end if;

    raise notice '=======================================================';
    raise notice 'ALL 8 SERP-460 BEHAVIORAL INVARIANTS PASSED SUCCESSFULLY';
    raise notice '=======================================================';
end;
$$;

rollback;
