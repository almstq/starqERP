<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document REMAINS VALID and is extended, not superseded, by the 28 Sep 2026 course correction.**
>
> Existing test architecture stands. Extended with the process-acceptance requirement: scenario, negative, replay, concurrency, reversal and reconciliation paths. Follow the extension below where it touches StarqERP completion doctrine.
>
> **Current development SSOT:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](../governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
> **Current roadmap:** [`ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`](../roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md)
> **Supersession index:** [`SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md`](../governance/SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md)
>
> **What changed on 28 Sep 2026:** StarqERP development was stopped and the completion model
> was corrected from *complete the remaining modules* to *close the remaining business
> processes*. The five canonical ERP process chains are Order-to-Cash, Procure-to-Pay,
> Inventory-to-GL, Cash-to-Bank and Record-to-Report. This is **convergence, not rewrite** —
> all existing architecture, migrations, tests, evidence and completed tasks remain valid.
> **StarqERP implementation is ON HOLD** pending explicit Founder restart authorization.
>
> **Original content is preserved verbatim below.** Nothing was removed or rewritten.
>
---

# Testing & Verification Guide

starqERP enforces strict continuous verification across unit tests, component regressions, responsive layout tests, and database isolation probes.

---

## 1. Running Frontend Unit & Regression Tests

Frontend tests use [Vitest](https://vitest.dev/) with `@testing-library/react`:

```bash
# Run all 39 test suites (157+ tests)
npm --prefix web test

# Run tests in watch mode
npm --prefix web test -- --watch

# Run a specific test suite
npm --prefix web test authorization_graph_resolution
```

---

## 2. Running Static Typechecks & Linting

```bash
# TypeScript compiler verification
npm --prefix web run lint
```

---

## 3. Running Database Migration Verification Probes

Verify database schema constraints, Row-Level Security policies, and trigger immutability:

```bash
# Verify migrations 0024 (Platform Control Plane) & 0025 (Multi-Book Architecture)
node --test tests/migrations_0024_0025_verification.test.mjs

# Verify command authorization contract integrity
npm test tests/contract/commands_test.ts

# Verify Material 3 responsive design system
node --test tests/ui_responsive_system.test.mjs
```
