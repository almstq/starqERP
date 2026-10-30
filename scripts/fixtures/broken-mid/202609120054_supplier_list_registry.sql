begin;

-- Supplier GET/list is the read mirror of the merged Supplier CREATE/UPDATE
-- spine (202609100052 / 202609110053). The original supplier list endpoint
-- queried the contacts aggregate directly through PostgREST with no seat gate;
-- this migration introduces api_supplier_registry, a security-definer read
-- RPC that enforces the same seat matrix as the supplier write spine
-- (counter, director, managing_director, owner) and stays strictly
-- tenant-scoped by target_org. Read-only: it never writes, never mutates.
create or replace function public.api_supplier_registry(
  target_org uuid,
  target_person uuid,
  target_seat text
) returns jsonb language plpgsql security definer
set search_path = public, app_private, extensions, pg_temp as $$
declare
  result jsonb;
begin
  if not app_private.assert_active_seat(target_org, target_person, target_seat)
     or target_seat not in ('counter', 'director', 'managing_director', 'owner') then
    raise exception 'supplier_seat_not_authorized';
  end if;

  select jsonb_build_object(
    'ok', true,
    'suppliers', coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb)
  ) into result
    from public.contacts c
   where c.organisation_id = target_org
     and c.kind = 'supplier'
     and c.status = 'active';
  return result;
end
$$;

revoke all on function public.api_supplier_registry(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.api_supplier_registry(uuid, uuid, text) to service_role;

commit;