# Starq HQ Platform Control Plane

The Starq HQ Control Plane is the multi-tenant SaaS operational console used by Starq Technologies to govern, provision, bill, and monitor ERP tenant organizations.

---

## 1. Physical & Logical Isolation

The Control Plane lives in a dedicated PostgreSQL schema (`platform`) isolated from the tenant execution schema (`public`):
- `platform.tenant_registry` — Master tenant registry, domain mapping, subscription tier, and onboarding status.
- `platform.operator_principals` — Whitelist of authorized platform operators and required MFA policies.
- `platform.provisioning_runs` — Automated provisioning logs, blueprint configuration, and seed backfill history.
- `platform.usage_daily` — Daily telemetry capturing active seats, storage utilization, and transaction volume.

Access to the `platform` schema is revoked from all public and authenticated client roles, and granted strictly to `service_role`.

---

## 2. Platform Navigation Modules

When an authorized operator signs in and activates the platform plane (`activePlane === 'platform'`), the application shell renders the dedicated Starq HQ control console:

1. **Overview**: Key platform performance indicators, active tenant counts, MRR metrics, and system telemetry.
2. **Applications**: Incoming business registration applications, document verification, and approval queue.
3. **Tenants / Customers**: Tenant fleet management, suspension, and domain bindings.
4. **Provisioning**: Automated blueprint execution for new tenant workspaces.
5. **Subscriptions & Plans**: Subscription tier management, seat quotas, and plan features.
6. **Billing**: Invoicing and payment reconciliation for SaaS fees.
7. **Usage & Health**: System latency, database query performance, and active user concurrency.
8. **Support & Operations**: Support tickets, audit log inspection, and operational assistance.
9. **Platform Audit & Security**: Cross-tenant security incident telemetry and access audits.
10. **Platform Settings**: Cluster origins, OAuth policy, and platform configuration.
