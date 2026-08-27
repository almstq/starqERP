# REMAINING TECHNICAL & ARCHITECTURAL DEBT

**Date**: 2026-08-27  
**Scope**: Technical debt, pending migrations, and live verification boundaries  

---

## 1. Platform & Infrastructure Debt

### 1. PR #10 CI Resolution & Merge
- **Current State**: PR #10 (`feat/platform-realignment`, commit `eb609ed`) is open with failing backend/governance CI checks.
- **Action Required**: Resolve CI governance failures, pass all checks, and complete merge to `main`.
- **Priority**: Immediate.

### 2. Live Supabase Migration 0024 Application
- **Current State**: `202608270024_platform_control_plane.sql` is authored and committed, but **not yet applied live** to the Seoul Supabase PostgreSQL instance.
- **Action Required**: Apply migration via Supabase deployment pipeline and verify platform schema tables.
- **Priority**: High.

### 3. Live Adversarial Cross-Tenant RLS Proof
- **Current State**: Archetype isolation is structurally proven via Vitest unit tests (`platform_archetypes.test.ts`), but live multi-tenant adversarial isolation has not been tested against Supabase.
- **Action Required**: Run live multi-org cross-tenant query probes with non-bypass roles.
- **Priority**: High.

### 4. Legacy Garage Nomenclature & Compatibility APIs
- **Current State**: Legacy table names and automotive API routes remain in place for backward compatibility.
- **Action Required**: Progressively abstract automotive-specific naming to generic domain entities across future rounds.
- **Priority**: Medium.

---

## 2. Performance & Frontend Backlog

### 1. Bundle Splitting & Code Chunking
- **Current State**: Production bundle is ~1.17 MB (303 kB gzip).
- **Remediation Plan**: Introduce dynamic `import()` for secondary view modules (Reports, Audit, Settings tabs) and configure `build.rollupOptions.output.manualChunks`.
- **Priority**: Low / Performance Optimization.

### 2. Full-Text Search Indexing Backend
- **Current State**: Global search modal filters active client-side in-memory entities.
- **Remediation Plan**: Create dedicated PostgreSQL `tsvector` search endpoint in Supabase.
- **Priority**: Medium.

### 3. Automated Playwright E2E Suite
- **Current State**: 146 Vitest component, integration, and simulated DOM tests passing.
- **Remediation Plan**: Configure Playwright browser runner for full multi-page visual regression against live staging environment.
- **Priority**: Medium.
