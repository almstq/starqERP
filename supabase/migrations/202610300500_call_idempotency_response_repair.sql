-- Repair successful CALL commands whose original handler returned SQL NULL.
-- The existing handler remains the source of mutation behavior; this wrapper
-- only reconstructs and persists its response from the durable event it wrote.
begin;

alter function public.api_garage_command(uuid, uuid, text, uuid, jsonb, uuid)
  rename to api_garage_command_legacy_20260926;

revoke all on function public.api_garage_command_legacy_20260926(uuid, uuid, text, uuid, jsonb, uuid)
  from public, anon, authenticated, service_role;

create function public.api_garage_command(
  target_org uuid,
  target_person uuid,
  target_seat text,
  command_key uuid,
  command jsonb,
  request_identifier uuid
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  response jsonb;
  event_name text := upper(trim(coalesce(command->>'type', command->>'sop', '')));
begin
  response := public.api_garage_command_legacy_20260926(
    target_org, target_person, target_seat, command_key, command, request_identifier
  );

  if event_name = 'CALL'
     and (response is null or (response->>'ok' = 'false' and response->>'state' = 'accepted')) then
    select jsonb_build_object(
      'ok', true,
      'state', 'accepted',
      'event', jsonb_build_object(
        'id', e.id,
        'type', e.event_type,
        'job_id', e.job_id,
        'job_no', j.job_no,
        'customer_name', j.customer_name,
        'vehicle_reg', j.vehicle_reg,
        'phone', j.customer_phone,
        'to_state', e.to_state,
        'fields', e.payload
      )
    )
      into response
      from public.job_events e
      join public.garage_jobs j
        on j.organisation_id = e.organisation_id and j.id = e.job_id
     where e.organisation_id = target_org
       and e.idempotency_key = command_key
       and e.event_type = 'CALL'
     limit 1;

    if response is null then
      raise exception 'call_response_reconstruction_failed';
    end if;

    update public.idempotency_keys
       set response_code = 200, response_body = response
     where organisation_id = target_org and key = command_key;

  end if;

  return response;
end
$$;

revoke all on function public.api_garage_command(uuid, uuid, text, uuid, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.api_garage_command(uuid, uuid, text, uuid, jsonb, uuid)
  to service_role;

commit;
