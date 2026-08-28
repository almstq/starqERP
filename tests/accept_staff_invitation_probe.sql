-- -----------------------------------------------------------------------------
-- accept_staff_invitation_probe.sql
-- Test probe for the accept_staff_invitation function fix
-- -----------------------------------------------------------------------------

-- Test setup: Create a test organisation, person, and invitation
BEGIN;

-- Create a test organisation
INSERT INTO public.organisations (id, slug, legal_name, status, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001'::uuid, 'test-org', 'Test Organisation', 'active', now(), now());

-- Create a test person
INSERT INTO public.persons (id, person_key, external_subject, display_label, status, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'test-person-key', 'test-external-sub', 'Test Person', 'active', now(), now());

-- Create a test invitation
INSERT INTO public.invitations (
  id, organisation_id, email, name, role_id, job_title, phone, book_ids, location_ids,
  token, status, invited_by, expires_at, created_at, updated_at
) VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'test@example.com',
  'Test Invitee',
  'viewer',  -- role_id that should map to a seat
  'Tester',
  '+1234567890',
  '{}',
  '{}',
  'testtoken123456789abcdef',
  'pending',
  '11111111-1111-1111-1111-111111111111'::uuid,
  now() + interval '7 days',
  now(),
  now()
);

-- Test 1: Verify the function can be called without error
DO $$
DECLARE
  result JSONB;
BEGIN
  -- Call the accept_staff_invitation function
  SELECT * INTO result FROM public.accept_staff_invitation(
    '22222222-2222-2222-2222-222222222222'::uuid,  -- invitation_id
    '11111111-1111-1111-1111-111111111111'::uuid,  -- person_id
    'test@example.com'  -- verified_email
  );

  -- Check if the result is OK
  IF result->>'ok' != 'true' THEN
    RAISE EXCEPTION 'accept_staff_invitation failed: %', result;
  END IF;

  RAISE NOTICE '✓ Test 1 PASSED: Function executed successfully';
END $$;

-- Test 2: Verify membership was created
DO $$
DECLARE
  membership_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO membership_count
  FROM public.memberships
  WHERE person_id = '11111111-1111-1111-1111-111111111111'::uuid
    AND organisation_id = '00000000-0000-0000-0000-000000000001'::uuid;

  IF membership_count != 1 THEN
    RAISE EXCEPTION 'Expected 1 membership, found %', membership_count;
  END IF;

  RAISE NOTICE '✓ Test 2 PASSED: Membership created correctly';
END $$;

-- Test 3: Verify membership seat was created
DO $$
DECLARE
  seat_count INTEGER;
BEGIN
  -- Get the membership ID first
  SELECT COUNT(*) INTO seat_count
  FROM public.membership_seats ms
  JOIN public.memberships m ON ms.membership_id = m.id
  WHERE m.person_id = '11111111-1111-1111-1111-111111111111'::uuid
    AND m.organisation_id = '00000000-0000-0000-0000-000000000001'::uuid;

  IF seat_count != 1 THEN
    RAISE EXCEPTION 'Expected 1 membership seat, found %', seat_count;
  END IF;

  RAISE NOTICE '✓ Test 3 PASSED: Membership seat created correctly';
END $$;

-- Test 4: Verify audit event was created with correct columns
DO $$
DECLARE
  audit_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO audit_count
  FROM public.audit_events
  WHERE actor_person_id = '11111111-1111-1111-1111-111111111111'::uuid
    AND action = 'invitation.accepted';

  IF audit_count != 1 THEN
    RAISE EXCEPTION 'Expected 1 audit event with correct columns, found %', audit_count;
  END IF;

  RAISE NOTICE '✓ Test 4 PASSED: Audit event created with correct columns';
END $$;

-- Test 5: Verify invitation status was updated to 'accepted'
DO $$
DECLARE
  invitation_status TEXT;
BEGIN
  SELECT status INTO invitation_status
  FROM public.invitations
  WHERE id = '22222222-2222-2222-2222-222222222222'::uuid;

  IF invitation_status != 'accepted' THEN
    RAISE EXCEPTION 'Expected invitation status to be "accepted", found "%"', invitation_status;
  END IF;

  RAISE NOTICE '✓ Test 5 PASSED: Invitation status updated to accepted';
END $$;

-- Test 6: Verify that an invalid invitation token is rejected
DO $$
DECLARE
  result JSONB;
BEGIN
  -- Try to accept with wrong email (should fail)
  SELECT * INTO result FROM public.accept_staff_invitation(
    '22222222-2222-2222-2222-222222222222'::uuid,  -- same invitation
    '11111111-1111-1111-1111-111111111111'::uuid,  -- same person
    'wrong@example.com'  -- WRONG email
  );

  -- Should return an error
  IF result->>'ok' != 'false' THEN
    RAISE EXCEPTION 'Expected function to fail with wrong email, but it succeeded: %', result;
  END IF;

  RAISE NOTICE '✓ Test 6 PASSED: Wrong email correctly rejected';
END $$;

-- Clean up: Rollback everything
ROLLBACK;

RAISE NOTICE '✓ ALL TESTS PASSED: accept_staff_invitation function works correctly!';