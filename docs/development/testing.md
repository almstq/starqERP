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
