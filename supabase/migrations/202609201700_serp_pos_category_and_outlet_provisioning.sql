begin;

-- =============================================================================
-- Migration: 202609201700_serp_pos_category_and_outlet_provisioning.sql
-- SERP-POS: Category field on products, automatic outlet provisioning for all
--           tenants, and retail catalogue seed for operational POS readiness.
-- =============================================================================

-- 1. Add category column to products table -------------------------------------
alter table public.products add column if not exists category text default 'General';
create index if not exists products_org_category_idx on public.products (organisation_id, category);

-- 2. Ensure every active organisation has at least one active POS outlet ------
insert into public.locations (organisation_id, code, name, kind, active)
select o.id, 'MAIN', coalesce(nullif(o.legal_name, ''), 'Main') || ' POS Counter', 'outlet', true
from public.organisations o
where not exists (
  select 1 from public.locations l where l.organisation_id = o.id and l.active
);

-- Link all newly created or existing unlinked MAIN locations to organisation books
insert into public.book_locations (organisation_id, book_id, location_id, is_primary)
select l.organisation_id, b.id, l.id, true
from public.locations l
join public.books b on b.organisation_id = l.organisation_id
where l.code = 'MAIN' and l.active
on conflict do nothing;

-- 3. Seed operational retail catalogue for Starq Technologies (10000000-0000-4000-8000-000000000001)
do $$
declare
  v_org uuid := '10000000-0000-4000-8000-000000000001';
  v_loc uuid;
  v_prod_id uuid;
  v_now timestamptz := now();
  r record;
begin
  -- Resolve primary location
  select id into v_loc from public.locations where organisation_id = v_org and active order by (code = 'MAIN') desc limit 1;
  if v_loc is null then
    insert into public.locations (organisation_id, code, name, kind, active)
    values (v_org, 'MAIN', 'Starq Retail Counter', 'outlet', true)
    returning id into v_loc;

    insert into public.book_locations (organisation_id, book_id, location_id, is_primary)
    select v_org, b.id, v_loc, true from public.books b where b.organisation_id = v_org on conflict do nothing;
  end if;

  -- Create default retail products if none exist
  for r in
    select * from (values
      ('COLA-330', 'Coca-Cola 330ml Can', 'Beverages', '5449000000996', 15.00, 50),
      ('SPRITE-330', 'Sprite 330ml Can', 'Beverages', '5449000014528', 15.00, 45),
      ('TAZA-500', 'Taza Mineral Water 500ml', 'Beverages', '6291000000111', 7.00, 100),
      ('REDBULL-250', 'Red Bull Energy Drink 250ml', 'Beverages', '9002490100070', 35.00, 30),
      ('LAYS-CLASSIC', 'Lays Classic Potato Chips 50g', 'Snacks', '8901491101837', 22.00, 40),
      ('PRINGLES-SC', 'Pringles Sour Cream & Onion 107g', 'Snacks', '8886467100017', 48.00, 25),
      ('OREO-133', 'Oreo Original Sandwich Cookies 133g', 'Snacks', '7622210000001', 18.00, 35),
      ('BAJIYA-PC', 'Maldivian Fish Bajiya (Fresh)', 'Bakery', '2000000000014', 5.00, 60),
      ('FISHROLL-PC', 'Spicy Fish Roll (Fresh)', 'Bakery', '2000000000021', 6.00, 50),
      ('ALMUDHISH-400', 'Al Mudhish Milk Powder 400g', 'Groceries', '6084000001018', 65.00, 20),
      ('DILMAH-100', 'Dilmah Ceylon Tea Bags 100s', 'Groceries', '9312631100012', 45.00, 25),
      ('RICE-1KG', 'Premium Basmati Rice 1kg', 'Groceries', '8901234567890', 38.00, 30),
      ('PANADOL-10', 'Panadol Extra 500mg 10s', 'Essentials', '5000000000019', 25.00, 40),
      ('DETTOL-100', 'Dettol Original Soap 100g', 'Essentials', '5000000000026', 14.00, 35),
      ('USBC-CABLE', 'Fast USB-C Braided Cable 1m', 'Electronics', '6934177700019', 65.00, 15)
    ) as t(sku, name, category, barcode, price, qty)
  loop
    select id into v_prod_id from public.products where organisation_id = v_org and sku = r.sku;
    if v_prod_id is null then
      insert into public.products (
        organisation_id, sku, name, kind, category, barcode, active, sale_allowed, reorder_threshold
      ) values (
        v_org, r.sku, r.name, 'stock', r.category, r.barcode, true, true, 5
      ) returning id into v_prod_id;

      -- Insert standard approved price
      insert into public.product_prices (
        organisation_id, product_id, currency, amount, valid_from
      ) values (
        v_org, v_prod_id, 'MVR', r.price, v_now
      );

      -- Record initial stock movement (received inventory)
      insert into public.stock_movements (
        organisation_id, location_id, product_id, movement_type, quantity, unit_cost, reference_type, created_at
      ) values (
        v_org, v_loc, v_prod_id, 'receipt', r.qty, r.price * 0.7, 'opening_stock', v_now
      );
    else
      -- Update category and barcode if existing
      update public.products
         set category = r.category, barcode = coalesce(barcode, r.barcode)
       where id = v_prod_id;
    end if;
  end loop;
end $$;

commit;
