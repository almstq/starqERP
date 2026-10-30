-- Migration: 202609200030_serp_pos_stock_movements_derived_onhand.sql
-- Corrective dependency migration: reconstructs public.stock_movements_derived_onhand
-- required by standalone POS acceptance chain (SERP-085 through 091, SERP-438, starq-api).

begin;

create or replace function public.stock_movements_derived_onhand(
  p_organisation_id uuid,
  p_location_id uuid default null,
  p_product_id uuid default null
)
returns table (
  organisation_id uuid,
  location_id uuid,
  product_id uuid,
  derived_quantity numeric(20,6),
  movement_types text[]
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    sm.organisation_id,
    sm.location_id,
    sm.product_id,
    sum(sm.quantity) as derived_quantity,
    array_agg(distinct sm.movement_type) as movement_types
  from public.stock_movements sm
  where sm.organisation_id = p_organisation_id
    and (p_location_id is null or sm.location_id = p_location_id)
    and (p_product_id is null or sm.product_id = p_product_id)
  group by sm.organisation_id, sm.location_id, sm.product_id;
$$;

comment on function public.stock_movements_derived_onhand(uuid, uuid, uuid) is
  'LIVE DERIVED ON-HAND — transaction-consistent query over public.stock_movements ledger. '
  'Canonical dependency for POS counter catalogue, oversell validation, and low-stock signal.';

revoke all on function public.stock_movements_derived_onhand(uuid, uuid, uuid) from public, anon;
grant execute on function public.stock_movements_derived_onhand(uuid, uuid, uuid) to authenticated, service_role;

commit;
