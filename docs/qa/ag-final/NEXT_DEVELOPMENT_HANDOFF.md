# NEXT DEVELOPMENT HANDOFF

**System**: starqERP Multi-Tenant SaaS  
**Handoff Date**: 2026-08-27  
**Design System**: Google Material 3 (Frozen at `v1.0-rc1`)  
**Backend & Persistence**: Qoder Round 1 Foundation (Authoritative)  

---

## 1. System State & Invariants

1. **Authentication Boundary**:
   - Web client uses `LoginPage` with official Google Identity Services, Founder Quick Launch, and allowlist validation.
   - All authenticated requests pass through `AuthGate` in `router.tsx` and attach `x-csrf-token`.
2. **AppShell Architecture**:
   - Responsive Navigation: Viewports `< 1024px` use Bottom Navigation Bar (`NavigationBar`) + Top Hamburger Drawer.
   - Desktop: Persistent left sidebar (`w-60 lg:w-64`).
   - Settings Sub-Navigation: Lives inside the main sidebar under `Settings`.
3. **Design System & Styling**:
   - Zero raw Tailwind color classes or hardcoded hex codes.
   - All components use semantic M3 variables (`var(--md-sys-color-*)`).
   - All data tables use `min-w-[780px]` and `whitespace-nowrap` inside horizontal scroll wrappers.

---

## 2. Recommended Next ERP Task

With foundation remediation and M3 migration 100% complete, development resumes on the canonical task board in `docs/tasks/`:

- **Selected Next Task**: **SERP-165: Customer Statement of Account & Ledger Export** (or next prioritized commercial feature on the board).
- **Goal**: Expand real business invoicing, customer account reconciliation, and PDF ledger export capabilities.
