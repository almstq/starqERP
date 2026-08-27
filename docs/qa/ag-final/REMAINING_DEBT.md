# REMAINING TECHNICAL & ARCHITECTURAL DEBT

**Date**: 2026-08-27  
**Scope**: Non-blocking items and future roadmap backlog  

---

## 1. Technical Debt Inventory

The following items are documented as architectural debt or optimizations for subsequent release rounds:

### 1. Bundle Splitting & Code Chunking (Round 2)
- **Current State**: Main bundle is ~1.17 MB (303 kB gzip).
- **Remediation Plan**: Introduce dynamic `import()` for secondary view modules (Reports, Audit, Settings tabs) and configure `build.rollupOptions.output.manualChunks`.
- **Priority**: Low / Performance Optimization.

### 2. Full-Text Search Indexing Backend (Round 2)
- **Current State**: Global search modal filters active client-side in-memory entities.
- **Remediation Plan**: Create dedicated PostgreSQL `tsvector` search endpoint in Supabase.
- **Priority**: Medium.

### 3. Automated Playwright E2E Suite (Round 2)
- **Current State**: 144 Vitest component, integration, and simulated DOM tests passing.
- **Remediation Plan**: Configure Playwright browser runner for full multi-page visual regression against live staging environment.
- **Priority**: Medium.

### 4. Real-Time WebSockets / SSE Subscriptions (Round 3)
- **Current State**: Client uses reactive state and explicit refresh triggers.
- **Remediation Plan**: Connect Supabase Realtime channels for live job status and payment notifications.
- **Priority**: Low.
