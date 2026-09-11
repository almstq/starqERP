begin;

-- Supplier CREATE is deliberately a separate command from CUSTOMER.  It reuses
-- the tenant-scoped contacts aggregate and the existing idempotency/audit spine.
create or replace function public.api_supplier_command(
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
  request_digest text := app_private.canonical_jsonb_sha256(command);
  supplier_id uuid := gen_random_uuid();
  supplier_name text := nullif(trim(coalesce(command->>'name', '')), '');
  response jsonb;
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  select * into existing
    from public.idempotency_keys
   where organisation_id = target_org and key = command_key;
  if found then
    if existing.request_hash <> request_digest or existing.command_type <> 'SUPPLIER' then
      raise exception 'idempotency_key_conflict';
    end if;
    return coalesce(existing.response_body, jsonb_build_object('ok', false, 'state', existing.state));
  end if;

  if supplier_name is null then raise exception 'supplier_name_required'; end if;
  if length(supplier_name) > 200 then raise exception 'supplier_name_invalid'; end if;
  if length(coalesce(command->>'email', '')) > 320 then raise exception 'supplier_email_invalid'; end if;
  if length(coalesce(command->>'phone', '')) > 64 then raise exception 'supplier_phone_invalid'; end if;

  insert into public.idempotency_keys
    (organisation_id, key, command_type, request_hash, state, expires_at)
  values
    (target_org, command_key, 'SUPPLIER', request_digest, 'processing', now() + interval '7 days');

  insert into public.contacts
    (id, organisation_id, kind, display_name, phone, email, metadata)
  values
    (supplier_id, target_org, 'supplier', supplier_name,
     nullif(trim(command->>'phone'), ''),
     nullif(trim(command->>'email'), ''),
     jsonb_build_object(
       'contact_person', nullif(trim(command->>'contact_person'), ''),
       'address', nullif(trim(command->>'address'), ''),
       'island', nullif(trim(command->>'island'), ''),
       'category', nullif(trim(command->>'category'), ''),
       'lead_time_days', greatest(0, coalesce((command->>'lead_time_days')::integer, 7))
     ));

  response := jsonb_build_object(
    'ok', true,
    'state', 'accepted',
    'supplier', jsonb_build_object('id', supplier_id, 'name', supplier_name)
  );

  update public.idempotency_keys
     set state = 'accepted', response_code = 200, response_body = response
   where organisation_id = target_org and key = command_key;

  insert into public.audit_events
    (organisation_id, actor_person_id, acting_seat, action, object_type,
     object_id, request_id, after_state, metadata)
  values
    (target_org, target_person, target_seat, 'erp.supplier', 'contact',
     supplier_id, request_identifier, response,
     jsonb_build_object('idempotency_key', command_key));

  return response;
end
$$;

revoke all on function public.api_supplier_command(uuid, uuid, text, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.api_supplier_command(uuid, uuid, text, uuid, jsonb, uuid) to service_role;

commit;
