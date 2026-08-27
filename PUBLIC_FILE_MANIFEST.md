# starqERP — Public File Manifest (KEEP PUBLIC)
**Classification**: SAFE FOR PUBLIC RELEASE (AFTER SANITIZATION)  
**Total Target Public Files**: ~165 files  

---

## 1. Application Source Code

### Web Application (`web/src/`)
- `web/src/main.tsx` — Application entry point
- `web/src/index.css`, `web/src/theme.css` — Material 3 Design Token Styling
- `web/src/vite-env.d.ts` — Type definitions
- `web/src/types/erp.ts` — Domain TypeScript interfaces
- `web/src/domain/archetypes.ts` — Business archetypes definitions
- `web/src/lib/bookkeeping.ts` — Double-entry arithmetic logic
- `web/src/app/AppShell.tsx` — Two-plane adaptive Material 3 application shell
- `web/src/app/LoginPage.tsx` — Sanitized zero-trust Google authentication surface
- `web/src/app/router.tsx` — Route table
- `web/src/context/AuthContext.tsx` — Session state provider
- `web/src/context/ERPContext.tsx` — Workspace and domain state provider
- `web/src/context/ThemeContext.tsx` — M3 Light/Dark/High-Contrast theme manager
- `web/src/services/apiGateway.ts` — Typed RPC and REST gateway
- `web/src/services/auth.ts` — Authentication contract and session services
- `web/src/services/telemetry.ts` — Audit and error telemetry client
- `web/src/components/**` — All modular UI views and components (Dashboard, Jobs, Invoices, Inventory, Customers, Suppliers, Purchasing, Payments, Expenses, Reports, Settings, Platform HQ Console, UI Design System Primitives).

### Backend Edge Functions & Shared Contracts (`supabase/functions/`, `contracts/`)
- `contracts/commands.ts` — Canonical authorization and intent command contract (SSOT)
- `contracts/tenant_import_pipeline.ts` — Standardized tenant data schema (with sanitized demo fixtures)
- `supabase/functions/starq-api/index.ts` — Edge API gateway router and session boundary
- `supabase/functions/_shared/commands.ts` — Generated mirror of canonical contract

---

## 2. Database Schema & Safe Migrations (`supabase/migrations/`)
- `202608200001_initial_schema.sql` — Core ERP schema
- `202608200002_rls_policies.sql` — Row Level Security isolation policies
- `202608200003_audit_triggers.sql` — Immutable append-only audit triggers
- `202608200004_job_order_workflows.sql` — Workflow engine schema
- `202608200005_stock_and_inventory.sql` — Stock balance and valuation logic
- `202608200006_commercial_documents.sql` — Invoice & bill numbering and journals
- `202608200007_garage_api_self_test.sql` — API verification procedures
- `202608200008_session_authority.sql` — Session verification RPCs
- `202608210009_seat_vocabulary.sql` — Standardized 12-seat governance model
- `202608210010_purchase_seat_matrix.sql` — Segregation of duties matrix
- `202608220011_wire_purchase_seat_matrix.sql` — Purchasing authorization logic
- `202608250012_settlement_allocations.sql` — Payment allocation engine
- `202608250013_workflow_stages.sql` — Configurable workflow stages
- `202608250014_idempotency_replay.sql` — Idempotency key tracking
- `202608250015_roles_as_data.sql` — Custom roles & permissions
- `202608250016_sod_exceptions.sql` — Segregation of duties overrides
- `202608250017_tax_regimes_and_periods.sql` — Maldives MIRA GST compliance tables
- `202608250018_bank_accounts_entities.sql` — Multi-entity bank accounts
- `202608250019_job_customer_vehicle_phone.sql` — Contact relationship enhancements
- `202608250020_revision_missing_endpoints.sql` — Extended API routines
- `202608260021_synthetic_tenant_uuid_transition.sql` — Deterministic tenant UUID schema
- `202608260022_transactional_outbox_and_audit.sql` — Outbox & audit event spine
- `202608270023_round1_foundation_remediation.sql` — Performance and trigger hardening
- `202608270024_platform_control_plane.sql` — Starq HQ control plane schema
- `202608270025_books_and_operating_activities.sql` — Multi-book operating activities architecture

---

## 3. Public Verification Test Suites (`web/src/test/`, `tests/`)
- `web/src/test/*.test.tsx`, `web/src/test/*.test.ts` — All 39 test suites (157 unit/component tests)
- `tests/migrations_0024_0025_verification.test.mjs` — Live migration schema verification
- `tests/ui_responsive_system.test.mjs` — M3 adaptive viewport test
- `tests/contract/commands_test.ts` — Command authorization contract tests
- `tests/adversarial_tenant_isolation_probe.sql` — RLS security probe
- `tests/document_numbering_probe.sql` — Document concurrency probe
- `tests/tax_regimes_probe.sql` — GST period allocation probe

---

## 4. Public Documentation Layer (`docs/`)
- `docs/architecture/overview.md` — Technical architecture and domain model
- `docs/architecture/multi-tenancy.md` — 5-tier tenant, legal entity, and multi-book hierarchy
- `docs/architecture/accounting-model.md` — Double-entry ledger and Maldives MIRA GST tax engine
- `docs/architecture/control-plane.md` — Starq HQ SaaS control plane architecture
- `docs/development/local-setup.md` — Local setup with Vite and Supabase CLI
- `docs/development/testing.md` — Running Vitest, probe SQL, and contract tests
- `docs/development/migrations.md` — Database migration workflow
- `docs/security/security-model.md` — Zero-trust access, MFA, and HMAC sessions
- `docs/security/tenant-isolation.md` — RLS and composite tenant safety
- `docs/roadmap/public-roadmap.md` — 4-Gate (G1–G4) capability roadmap

---

## 5. Repository Governance Files
- `README.md` — Public developer README
- `LICENSE` — Explicit commercial / source-available license
- `SECURITY.md` — Security vulnerability reporting policy
- `CONTRIBUTING.md` — Guidelines for code contribution and review
- `.gitignore` — Node, Vite, Supabase, and environment exclusions
- `web/.env.example` — Sanitized placeholder environment template
- `.github/workflows/ci.yml` — Automated CI pipeline for tests and linting
