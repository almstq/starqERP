# Archive & Code Retirement Convention (SERP-233)

> **Governing Principles**: Rule 2 (Never destroy; archive with rationale) & DEC-077 (Clean Developer Experience & Client Readiness).

---

## 1. The Core Architectural Reconciliation

The project blueprint establishes two seemingly opposing rules:
1. **Rule 2**: Never destroy code or assets without preserving a recoverable record.
2. **Phase 11 Cleanliness**: The active repository must contain only live product code, current tests, active migrations, and current documentation.

These rules do not conflict when executed according to the three-tier preservation convention:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THREE-TIER PRESERVATION MODEL                         │
├────────────────────────────────┬────────────────────────────────────────────┤
│ 1. External Archive            │ Retired files move to `_recyclebin/` or    │
│    (`_recyclebin/`)            │ `_archive/` outside the active repository  │
│                                │ with an explicit manifest and rationale.   │
├────────────────────────────────┼────────────────────────────────────────────┤
│ 2. Ordinary Git Deletion       │ Git records removal from the working tree  │
│    (Standard Commit)           │ via a standard commit (`git rm`).          │
├────────────────────────────────┼────────────────────────────────────────────┤
│ 3. Immutable History           │ Git commit history is NEVER rewritten;     │
│    (No History Rewriting)      │ all prior states remain fully checkable.   │
└────────────────────────────────┴────────────────────────────────────────────┘
```

---

## 2. Classification Criteria

Before any code or asset is considered for retirement, it must be classified into one of the following categories:

| Category | Definition | Action |
|---|---|---|
| **Active Runtime** | Core command handlers, routing, state, statutory math, API endpoints | Preserved in working tree |
| **Active Test / Tooling** | Deno tests, Vitest suites, migration linters, security & audit probes | Preserved in working tree |
| **Current Docs** | Task reports (`docs/tasks/`), architecture guides, SOPs, decisions | Preserved in working tree |
| **Historical Reference** | In-tree notes pointing to external records | Preserved |
| **Obsolete / Superseded** | Dead layouts, replaced modals, unused design canvas mockups | Archived to `_recyclebin/` and removed from tree |
| **Uncertain** | Code paths whose role is unproven or potentially active | Left untouched; never deleted |

---

## 3. SERP-233 Initial Retirement Manifest (2026-08-27)

The following items were retired and archived to `_recyclebin/starqERP-phase11-archive-2026-08-27/`:

1. **Pre-Route Layout Components** (`_recyclebin/components_layout/`):
   - `Header.tsx`, `Sidebar.tsx`: Replaced by `web/src/app/AppShell.tsx` (routes-as-map architecture).
2. **Superseded Web Components** (`web/src/components/`):
   - `jobs/JobDetailModal.tsx`: Superseded by routed view `jobs/JobDetailView.tsx`.
   - `customers/CustomerDetailDrawer.tsx`: Superseded by routed view `customers/CustomerDetailView.tsx`.
   - `purchasing/PODetailModal.tsx`: Superseded by routed view `purchasing/PODetailView.tsx`.
   - `common/PendingApprovalBanner.tsx`: Superseded by server-authoritative session state in `AppShell.tsx`.
   - `common/StatCard.tsx`: Superseded by inline metric cards in `DashboardView.tsx`.
3. **Exploratory Visual Mockups** (`brand/explore/`):
   - `starqerp-brand-directions.html` (2.2 MB), `canvas.json` (1.7 MB), `Ground.dc.html`, `Logomark.dc.html`, `Main.dc.html`, `Type.dc.html`: Early design explorations. Canonical brand guidelines and asset packages are preserved in `brand/v1.0/starqERP_brand_kit/`.
