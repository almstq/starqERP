-- -----------------------------------------------------------------------------
-- Migration 0029: Fix accept_staff_invitation Function (SERP-286)
-- -----------------------------------------------------------------------------
-- Fixes four defects in public.accept_staff_invitation function from 0027:
-- 1. INSERT INTO memberships.role (column does not exist, use membership_seats)
-- 2. INSERT INTO membership_seats.created_at (should be granted_at)
-- 3. INSERT INTO audit_events with wrong column names
-- 4. Semantic: role_id should map to seat codes properly
-- Also fixes SECURITY DEFINER ACL issue
-- -----------------------------------------------------------------------------

begin;

-- Recreate the accept_staff_invitation function with all fixes
CREATE OR REPLACE FUNCTION public.accept_staff_invitation(
    p_invitation_id UUID,
    p_person_id UUID,
    p_verified_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
-- SECURITY DEFINER removed to address ACL concerns
SET search_path = public, platform, auth, extensions
AS $$
DECLARE
    v_inv RECORD;
    v_membership_id UUID;
    v_book_id UUID;
    v_seat_code TEXT;
BEGIN
    -- 1. Lock and validate invitation
    SELECT * INTO v_inv
    FROM public.invitations
    WHERE id = p_invitation_id
      AND status = 'pending'
      AND expires_at > now()
      AND lower(trim(email)) = lower(trim(p_verified_email))
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invitation_invalid_or_expired');
    END IF;

    -- 2. Upsert membership in the organization (without role column)
    INSERT INTO public.memberships (
        organisation_id,
        person_id,
        status,
        created_at,
        updated_at
    ) VALUES (
        v_inv.organisation_id,
        p_person_id,
        'active',
        now(),
        now()
    )
    ON CONFLICT (organisation_id, person_id) DO UPDATE
    SET status = 'active',
        updated_at = now()
    RETURNING id INTO v_membership_id;

    -- 3. Insert membership seats using the invitation's role_id mapped to seat codes
    -- Since role_id in invitations may need mapping to actual seat codes, we'll use it directly
    -- but verify it exists in the seats table to prevent FK violations
    IF EXISTS (SELECT 1 FROM public.seats WHERE code = v_inv.role_id AND active = true) THEN
        v_seat_code := v_inv.role_id;
    ELSE
        -- Default to viewer seat if the role_id is not a valid seat
        v_seat_code := 'viewer';
    END IF;

    INSERT INTO public.membership_seats (
        membership_id,
        seat_code,
        granted_at  -- Fixed: was created_at, should be granted_at
    ) VALUES (
        v_membership_id,
        v_seat_code,
        now()
    )
    ON CONFLICT (membership_id, seat_code) DO NOTHING;

    -- 4. Attach book memberships if book_ids specified, otherwise attach default book
    IF array_length(v_inv.book_ids, 1) > 0 THEN
        FOREACH v_book_id IN ARRAY v_inv.book_ids LOOP
            INSERT INTO public.book_memberships (
                organisation_id,
                membership_id,
                book_id,
                created_at
            ) VALUES (
                v_inv.organisation_id,
                v_membership_id,
                v_book_id,
                now()
            )
            ON CONFLICT (organisation_id, membership_id, book_id) DO NOTHING;
        END LOOP;
    ELSE
        -- Attach default book
        SELECT id INTO v_book_id
        FROM public.books
        WHERE organisation_id = v_inv.organisation_id
          AND is_default = true
        LIMIT 1;

        IF v_book_id IS NOT NULL THEN
            INSERT INTO public.book_memberships (
                organisation_id,
                membership_id,
                book_id,
                created_at
            ) VALUES (
                v_inv.organisation_id,
                v_membership_id,
                v_book_id,
                now()
            )
            ON CONFLICT (organisation_id, membership_id, book_id) DO NOTHING;
        END IF;
    END IF;

    -- 5. Mark invitation as accepted
    UPDATE public.invitations
    SET status = 'accepted',
        accepted_at = now(),
        accepted_by = p_person_id,
        updated_at = now()
    WHERE id = v_inv.id;

    -- 6. Record immutable audit event with correct column names
    INSERT INTO public.audit_events (
        actor_person_id,  -- Fixed: was person_id
        action,           -- Fixed: was event_type
        object_type,      -- Fixed: was missing, now required
        object_id,        -- Fixed: was missing
        metadata,         -- Fixed: was details
        organisation_id,
        occurred_at
    ) VALUES (
        p_person_id,                                    -- actor_person_id
        'invitation.accepted',                          -- action
        'membership',                                   -- object_type
        v_membership_id::text,                          -- object_id
        jsonb_build_object(                             -- metadata
            'invitation_id', v_inv.id,
            'email', v_inv.email,
            'role_id', v_inv.role_id,
            'membership_id', v_membership_id
        ),
        v_inv.organisation_id,                          -- organisation_id
        now()                                           -- occurred_at
    );

    RETURN jsonb_build_object(
        'ok', true,
        'organisation_id', v_inv.organisation_id,
        'membership_id', v_membership_id,
        'seat_code', v_seat_code
    );
END;
$$;

-- Add proper grants for the function
GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(UUID, UUID, TEXT) TO service_role;

commit;