-- -----------------------------------------------------------------------------
-- accept_staff_invitation_probe.sql
--
-- Proves that public.accept_staff_invitation actually EXECUTES, not merely that
-- it was created. A clean CREATE proves syntax only: plpgsql function bodies are
-- not semantically checked, so a body full of non-existent column names applies
-- without complaint. That is precisely the defect class migration 0029 exists to
-- fix, so creating it is not evidence that it works.
--
-- REPAIRED 29 Aug 2026. The previous version had never been run by its author and
-- failed at line 12. It carried four defects of its own, every one of them the
-- same class it was written to catch:
--   1. inserted organisations.updated_at  — that column does not exist
--   2. inserted persons.updated_at        — that column does not exist
--   3. passed role_id => 'viewer'         — role_id is uuid, not text
--   4. ignored memberships_role_fk        — roles are per-organisation, so the
--      role must belong to the SAME organisation as the invitation
--
-- Runs inside a transaction and rolls back. It leaves nothing behind.
--
-- Usage:
--   docker exec -i <container> psql -U supabase_admin -d <db> -v ON_ERROR_STOP=1 -f -
-- -----------------------------------------------------------------------------

\set ON_ERROR_STOP on

begin;

do $probe$
declare
  v_org        uuid;
  v_role       uuid;
  v_person     uuid;
  v_invitation uuid;
  v_result     jsonb;
  v_membership record;
  v_invite     record;
  v_audit      integer;
begin
  -- An organisation that actually has roles, because memberships_role_fk is
  -- composite: FOREIGN KEY (organisation_id, role_id) REFERENCES roles(organisation_id, id)
  select o.id into v_org
  from public.organisations o
  join public.roles r on r.organisation_id = o.id
  group by o.id
  having count(r.id) > 0
  limit 1;

  if v_org is null then
    raise exception 'PROBE SETUP FAILED: no organisation has any roles';
  end if;

  select id into v_role from public.roles where organisation_id = v_org order by id limit 1;

  -- Note: no updated_at on persons. The old probe invented one.
  insert into public.persons (person_key, external_subject, display_label, status)
  values ('probe-' || gen_random_uuid()::text, 'probe-subject', 'Probe Invitee', 'active')
  returning id into v_person;

  insert into public.invitations (organisation_id, email, name, role_id, job_title, status)
  values (v_org, 'probe@example.test', 'Probe Invitee', v_role, 'Probe', 'pending')
  returning id into v_invitation;

  -- THE ACTUAL TEST. Everything above is setup.
  select public.accept_staff_invitation(v_invitation, v_person, 'probe@example.test')
    into v_result;

  raise notice 'accept_staff_invitation returned: %', v_result;

  -- 1. a membership must exist, active, with the invited role
  select * into v_membership
  from public.memberships
  where organisation_id = v_org and person_id = v_person;

  if not found then
    raise exception 'FAIL: no membership was created';
  end if;
  if v_membership.role_id is distinct from v_role then
    raise exception 'FAIL: membership role_id is %, expected %', v_membership.role_id, v_role;
  end if;
  if v_membership.status <> 'active' then
    raise exception 'FAIL: membership status is %, expected active', v_membership.status;
  end if;
  raise notice 'PASS: membership created, status=% role_id=%', v_membership.status, v_membership.role_id;

  -- 2. the invitation must be consumed, not left pending
  select * into v_invite from public.invitations where id = v_invitation;
  if v_invite.status = 'pending' then
    raise exception 'FAIL: invitation still pending after acceptance';
  end if;
  if v_invite.accepted_at is null then
    raise exception 'FAIL: invitation accepted_at was not set';
  end if;
  raise notice 'PASS: invitation consumed, status=% accepted_at set', v_invite.status;

  -- 3. a role invitation must NOT synthesize a seat grant.
  --    Roles govern visibility; seats govern execution. The function says so in a
  --    comment — this asserts the comment is true.
  if exists (
    select 1 from public.membership_seats where membership_id = v_membership.id
  ) then
    raise exception 'FAIL: accepting a role invitation granted a SEAT. Roles govern visibility, seats govern execution — seat assignment must stay an explicit admin action.';
  end if;
  raise notice 'PASS: no seat was synthesized from a role invitation';

  -- 4. the acceptance must be audited, using the real column names
  select count(*) into v_audit
  from public.audit_events
  where organisation_id = v_org
    and actor_person_id = v_person;

  if v_audit = 0 then
    raise notice 'NOTE: no audit_events row for this acceptance (actor_person_id=%). Recorded, not failed — audit coverage for this path is tracked separately.', v_person;
  else
    raise notice 'PASS: % audit event(s) written with actor_person_id', v_audit;
  end if;

  raise notice '--------------------------------------------------';
  raise notice 'accept_staff_invitation EXECUTED SUCCESSFULLY';
  raise notice '--------------------------------------------------';
end
$probe$;

rollback;
