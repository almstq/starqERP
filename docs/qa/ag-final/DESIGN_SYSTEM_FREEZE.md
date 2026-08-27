# DESIGN SYSTEM FREEZE DECLARATION

**Version**: starqERP Design System v1.0-RC1  
**Freeze Date**: 2026-08-27  
**Enforcement Policy**: Strict Token Enforcement  

---

## 1. Freeze Rules

Starting from commit tag `v1.0-rc1`, the starqERP user interface is frozen against arbitrary visual modifications. All future UI development must adhere strictly to the following invariants:

1. **No Raw Color Literals**:
   - Forbidden: Tailwind classes such as `text-blue-600`, `bg-slate-900`, `bg-zinc-100`, `border-gray-300`, or raw `#hex` codes.
   - Required: Use Material 3 semantic variables: `var(--md-sys-color-primary)`, `var(--md-sys-color-surface)`, etc.
2. **Brand Lockup Invariance**:
   - The brand name must strictly render as `starqERP` (lowercase "starq", uppercase "ERP").
   - Brand assets must only be imported from `components/brand/StarqLogo.tsx`.
3. **Responsive Navigation Model**:
   - Viewports `< 1024px` must utilize the Material 3 Bottom Navigation Bar (`NavigationBar`) and top Hamburger Drawer. Never re-introduce a persistent side rail on mobile.
   - Settings sub-navigation belongs inside the main sidebar hierarchy or accessible drawer; never create a secondary in-page sidebar.
4. **Table Containment**:
   - All data tables must wrap with `overflow-x-auto` and specify an explicit `min-w-[780px]` with `whitespace-nowrap` on headers and cells to prevent column collapse.
