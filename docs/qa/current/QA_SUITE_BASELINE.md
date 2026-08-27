# Current QA & Test Suite Baseline

**Authoritative Baseline as of 27 August 2026**

---

### Test Suite Execution

```bash
# Run complete test suite (40 test files / 161 tests)
npm --prefix web test

# Run TypeScript typecheck
npm --prefix web run lint

# Run Vite production build check
npm --prefix web run build
```

---

### Test Suite Overview (161 Passing Tests)

1. **Auth & Identity Boundary**:
   - `auth_boundary_realignment.test.ts` — Boundary authorization, CSRF validation, Google token claims, session lifetime.
   - `cross_device_onboarding_and_provisioning.test.ts` — Server-side application intake, review queue, atomic provisioning, tenant isolation.
   - `starq_hq_control_plane.test.ts` — Platform entitlement vs tenant role segregation, two-plane shell switching.
   - `tenant_role_authorization_truth.test.ts` — Tenant super_admin has zero platform entitlement.
2. **Domain Operations & Command Pipeline**:
   - `garage_dispatch.test.ts` — Idempotent command processing, state machine transitions.
   - `commercial_finance.test.ts` — Invoicing, receipts, payment allocation, tax calculation.
   - `inventory_valuation.test.ts` — Stock movements, multi-location quantities.
3. **Multi-Tenancy & Book Segregation**:
   - `multi_book_ledger.test.ts` — Multi-book accounting segregation within same legal entity.
   - `tenant_isolation_rls.test.ts` — Cross-tenant isolation boundaries.
