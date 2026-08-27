# starqERP Platform Realignment

**Status:** Implemented foundation, pending canonical board task registration and live migration approval.

## Architecture

starqERP has two explicit planes:

- **Starq HQ control plane:** tenant identity, plan and subscription state, provisioning state, deployment/schema versions, aggregate usage, onboarding state, and service health metadata.
- **Tenant execution plane:** tenant-scoped commercial and operational records, workflows, users, seats, documents, inventory, and audit events.

A Starq HQ operator is not a tenant superuser. The control plane migration stores only platform metadata and grants access only to a separately authenticated `service_role` boundary. It does not grant `authenticated` access, alter `app_private.current_organisation_id()`, or bypass execution-plane RLS. Cross-tenant business intelligence is deferred and must be aggregate-only and explicitly governed.

## Archetype Model

`web/src/domain/archetypes.ts` is the shared catalog for six initial archetypes:

- General Business
- Automotive / Workshop
- Wholesale / Trading
- Marine / Service
- Construction / Contracting
- Retail

An archetype supplies capabilities, terminology, inventory defaults, document labels, and workflow templates. `provisionArchetypeDefaults()` clones configuration for a tenant and stamps every workflow row with that tenant ID. It does not create an application fork. Tenant identity remains the legal/security/accounting boundary; the archetype is configuration.

Existing garage terminology remains in the legacy automotive proving surface and database names for compatibility. New configuration must use generic primitives and must not assume vehicles, paint, bays, or Club Ignition.

## Provisioning Lifecycle

1. A platform service creates the legal organisation and its business/trading identity.
2. It records the selected archetype, plan, demo flag, and provisioning run mode.
3. It applies clean defaults: modules, workflow templates, document sequence state, seats/roles, tax status, and branding tokens.
4. It marks the tenant ready only after the schema/configuration checks pass.
5. Production provisioning uses `clean_production`; demo/sample data uses a separate `demo_sample` run and organisation.

There is no generic wipe/reset operation. Once operational or financial records exist, a reset is unavailable; an explicitly authorised demo reset must be a separate, audited service operation against a demo organisation.

## Branding and Routing

Tenant branding belongs to persisted tenant configuration and is rendered through approved Material 3 tokens. Logo, legal name, trading name, and slug are tenant data. The intended host model is `<tenant-slug>.starq.mv`; external domains are deferred until routing/TLS automation is ready. Arbitrary CSS is not part of the tenant contract.

## Migration

`202608270024_platform_control_plane.sql` adds the `platform` schema and four metadata tables: `tenant_registry`, `usage_daily`, `operator_principals`, and `provisioning_runs`. The migration contains no tenant-row copying, financial mutation, or RLS bypass. It is forward-only and requires normal protected delivery and live Supabase review before application.

## Evidence and Boundaries

- `web/src/test/platform_archetypes.test.ts` proves two materially different tenant configurations can be produced from one catalog, with tenant-stamped workflows and no catalog mutation.
- No live Supabase cross-tenant adversarial test was run in this change. The migration's service-role grants and existing execution-plane RLS are structural evidence only.
- The canonical board currently contains 264 task records and contains none of `SERP-290`, `SERP-291`, `SERP-292`, or `SERP-293`; these IDs were not invented or marked done.
- The repository still contains legacy fixture/demo data and garage-named compatibility APIs. Removing or migrating those requires separate, evidenced tasks and must not be conflated with this foundation.
