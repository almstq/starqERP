begin;

-- Supplier UPDATE is the mirror of the merged Supplier CREATE spine
-- (202609100052): the same tenant-scoped contacts aggregate, the same
-- idempotency/audit spine, and the same seat matrix. It mutates an existing
-- tenant contact instead of inserting a new one.
--
-- Tenant isolation is structural, not a policy: the UPDATE targets
-- `organisation_id = target_org AND id = :supplier_id AND kind = 'supplier'`.
-- A foreign tenant's UUID therefore simply does not match, and the command
-- raises `supplier_not_found` rather than ever touching another tenant's row.
create or replace function public.api_supplier_update_command(
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
  supplier_id uuid := nullif(trim(command->>'supplier_id'), '')::uuid;
  supplier_name text := nullif(trim(coalesce(command->>'name', '')), '');
  response jsonb;
  before_row public.contacts%rowtype;
  after_row public.contacts%rowtype;
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'director', 'managing_director', 'owner') then
    raise exception 'seat_not_authorized';
  end if;

  select * into existing
    from public.idempotency_keys
   where organisation_id = target_org and key = command_key;
  if found then
    if existing.request_hash <> request_digest or existing.command_type <> 'SUPPLIER_UPDATE' then
      raise exception 'idempotency_key_conflict';
    end if;
    return coalesce(existing.response_body, jsonb_build_object('ok', false, 'state', existing.state));
  end if;

  if supplier_id is null then raise exception 'supplier_id_required'; end if;
  if supplier_name is null then raise exception 'supplier_name_required'; end if;
  if length(supplier_name) > 200 then raise exception 'supplier_name_invalid'; end if;
  if length(coalesce(command->>'email', '')) > 320 then raise exception 'supplier_email_invalid'; end if;
  if length(coalesce(command->>'phone', '')) > 64 then raise exception 'supplier_phone_invalid'; end if;

  insert into public.idempotency_keys
    (organisation_id, key, command_type, request_hash, state, expires_at)
  values
    (target_org, command_key, 'SUPPLIER_UPDATE', request_digest, 'processing', now() + interval '7 days');

  select * into before_row
    from public.contacts
   where organisation_id = target_org
     and id = supplier_id
     and kind = 'supplier';
  if not found then
    raise exception 'supplier_not_found';
  end if;

  update public.contacts
     set display_name = supplier_name,
         phone = nullif(trim(command->>'phone'), ''),
         email = nullif(trim(coalesce(command->>'email', '')), ''),
         metadata = jsonb_build_object(
           'contact_person', nullif(trim(command->>'contact_person'), ''),
           'address', nullif(trim(command->>'address'), ''),
           'island', nullif(trim(command->>'island'), ''),
           'category', nullif(trim(command->>'category'), ''),
           'lead_time_days', greatest(0, coalesce((command->>'lead_time_days')::integer, 7))
         ),
         version = before_row.version + 1,
         updated_at = now()
   where organisation_id = target_org
     and id = supplier_id
     and kind = 'supplier';

  select * into after_row
    from public.contacts
   where organisation_id = target_org
     and id = supplier_id
     and kind = 'supplier';

  response := jsonb_build_object(
    'ok', true,
    'state', 'accepted',
    'supplier', jsonb_build_object(
      'id', after_row.id,
      'name', after_row.display_name,
      'version', after_row.version
    )
  );

  update public.idempotency_keys
     set state = 'accepted', response_code = 200, response_body = response
   where organisation_id = target_org and key = command_key;

  insert into public.audit_events
    (organisation_id, actor_person_id, acting_seat, action, object_type,
     object_id, request_id, before_state, after_state, metadata)
  values
    (target_org, target_person, target_seat, 'erp.supplier.update', 'contact',
     supplier_id, request_identifier,
     jsonb_build_object(
       'name', before_row.display_name,
       'phone', before_row.phone,
       'email', before_row.email,
       'metadata', before_row.metadata,
       'version', before_row.version
     ),
     jsonb_build_object(
       'name', after_row.display_name,
       'phone', after_row.phone,
       'email', after_row.email,
       'metadata', after_row.metadata,
       'version', after_row.version
     ),
     jsonb_build_object('idempotency_key', command_key));

  return response;
end
$$;

revoke all on function public.api_supplier_update_command(uuid, uuid, text, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.api_supplier_update_command(uuid, uuid, text, uuid, jsonb, uuid) to service_role;

commit;