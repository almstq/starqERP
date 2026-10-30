-- The current CALL handler persists its job but leaves `response` unset.
-- Inject the canonical response into that branch so both the initial request
-- and idempotent replay return the same persisted success payload. Apply this
-- forward-only patch to the installed function definition without copying its
-- full command implementation into another migration.
begin;

do $migration$
declare
  function_definition text;
  call_marker constant text := $marker$next_state := 'call';$marker$;
  call_response constant text := $response$
next_state := 'call';
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
        'fields', jsonb_build_object(
          'customer_name', c_name,
          'vehicle_reg', v_reg,
          'phone', c_phone
        )
      )
    );$response$;
begin
  select pg_get_functiondef(
    'public.api_garage_command(uuid, uuid, text, uuid, jsonb, uuid)'::regprocedure
  ) into function_definition;

  if function_definition is null
     or strpos(function_definition, call_marker) = 0
     or (length(function_definition) - length(replace(function_definition, call_marker, ''))) <> length(call_marker) then
    raise exception 'call_response_repair_marker_not_unique';
  end if;

  function_definition := replace(function_definition, call_marker, call_response);
  execute function_definition;
end
$migration$;

commit;
