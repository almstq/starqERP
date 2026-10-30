begin;

create table if not exists public.organisation_configs (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  tin_number text not null default '',
  gst_status text not null default 'not_registered' check (gst_status in ('registered', 'not_registered', 'pending', 'suspended', 'cancelled')),
  gst_rate numeric(6, 3) not null default 8 check (gst_rate >= 0 and gst_rate <= 100),
  bml_account text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  island text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.persons(id)
);

alter table public.organisation_configs enable row level security;
create policy organisation_configs_tenant on public.organisation_configs
  for all using (app_private.has_organisation_access(organisation_id))
  with check (app_private.has_organisation_access(organisation_id));
revoke all on public.organisation_configs from public, anon;
grant select, insert, update on public.organisation_configs to authenticated;
grant all on public.organisation_configs to service_role;

commit;
