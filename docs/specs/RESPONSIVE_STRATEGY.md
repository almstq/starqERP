# STARQ ERP — Mobile & Multi-Surface Responsive Architecture Specification
**Task:** SERP-170 (Architectural Specification)  
**Status:** Approved Standard  
**Date:** 25 August 2026  
**Reference:** Memo §27–29, DEC-067, DEC-068

---

## 1. Executive Summary & Design Principles

STARQ ERP is a commercial operational system designed for both desk-bound administrative controllers and mobile counter/bay technicians across Maldives SMEs. 

### Core Rules:
1. **Never Shrink Desktop Rows to Illegible Micro-Text:** On viewport widths `< 768px`, dense multi-column tabular data transforms into structured mobile **Action Cards**.
2. **Never Render Multi-Column Kanban Stacks Vertically:** On mobile, multi-column board views transform into **Stage Selector Rails + Active Stage Swipeable Feeds**.
3. **Touch Targets Exceed 44px:** All tap targets, action buttons, and modal dismiss triggers adhere to minimum 44×44px hit-areas.
4. **Zero Horizontal Layout Bleed:** No root horizontal scroll on standard viewport widths (360px–1920px).

---

## 2. Breakpoint Grid & Viewport Hierarchy

| Breakpoint Tag | Minimum Width | Target Device Class | Primary Layout Mode |
|---|---|---|---|
| **`xs` / `sm`** | `0px – 639px` | Mobile (iPhone, Android Handhelds) | Single-column card stack, sticky bottom action bar, drawer sheets. |
| **`md`** | `640px – 1023px` | Tablet / Counter POS Display | Collapsible icon rail, 2-column card grid, compact tables. |
| **`lg` / `xl`** | `1024px – 1439px` | Laptop & Desk Workstation | Full persistent sidebar, multi-column tables, full Kanban boards. |
| **`2xl`** | `1440px+` | Wide Desktop & Workshop Monitor | Multi-pane split views, real-time bay oversight dashboards. |

---

## 3. Surface-by-Surface Transformation Specifications

### 3.1 Tables → Action Cards Transform (`< 768px`)
* **Problem:** Desktop tables with 8–12 columns generate illegible horizontal scrolling on phones.
* **Transform Rule:** Below `md` (768px), tabular rows convert into standalone cards with clear visual hierarchy:
  1. **Top Row:** Document Number (`INV-2026-001`) [Left, Bold Mono] + Settlement Status Badge (`PAID` / `DUE`) [Right].
  2. **Middle Row:** Counterparty Name (Customer / Supplier) + Summary Line (e.g. `Toyota Land Cruiser Prado • 3 items`).
  3. **Bottom Row:** Financial Total (`MVR 27,000.00` [Bold Mono]) + Due Date / Timestamp [Muted].
  4. **Actions:** Primary Action button (`View` / `Pay`) spanning full width or thumb-accessible right button.

### 3.2 Kanban Boards → Stage Strip & Feed (`< 1024px`)
* **Problem:** 6–12 vertical Kanban columns stacked vertically or scrolled horizontally create disorientation.
* **Transform Rule:**
  1. **Top Stage Selector Strip:** Horizontal scrollable pill rail showing all stage codes (`CHECK_IN`, `SURFACE_PREP`, `PAINT_BOOTH`, `QC_DETAIL`) with active item count badges.
  2. **Active Stage Feed:** Tapping a stage displays only cards in that stage in a clean vertical feed.
  3. **Swipe Gesture:** Horizontal swipe between stages with smooth carousel transitions.

### 3.3 Dashboard KPIs & Metrics
* **Desktop (`lg`):** 4-column metric cards (`Gross Revenue`, `Expenses`, `Net Margin`, `Active Jobs`).
* **Mobile (`sm`):** 2×2 grid with condensed metric values (`Rf 145.2k` instead of `MVR 145,200.00`). Sparklines remain visible; complex charts convert to single-series bar charts with tap tooltips.

### 3.4 Drawers & Modal Windows
* **Desktop (`md+`):** Centered modal overlays (max-width `2xl` / `3xl`) with backdrop blur.
* **Mobile (`< md`):** Bottom-attached **Sheet Drawers** (`slide-up` animation, 92vh maximum height) with top grab-handle, sticky action buttons at the bottom edge, and momentum scroll body.

### 3.5 Navigation & Chrome
* **Desktop (`md+`):** Persistent left sidebar (`240px` width) displaying full product map (11 modules).
* **Mobile (`< md`):** 
  - Top header (`56px` height) with Starq wordmark, tenant selector, search button, and hamburger trigger.
  - Off-canvas full-height navigation sheet opening from the left.
  - Optional sticky bottom navigation for high-frequency actions (`Dashboard`, `Jobs`, `Intake`, `Scan`).

### 3.6 Financial Statements & Reports
* **Desktop (`lg+`):** Multi-column Ledger Trial Balance with side-by-side Debits and Credits columns.
* **Mobile (`< lg`):** Stacked account list where each account displays Title + Code, and Debits / Credits are displayed with explicit color-coded indicator tags (`DR: MVR 45,000.00` in blue, `CR: MVR 45,000.00` in emerald).

---

## 4. Implementation Boundary & Sequencing

* **Gate Rule (DEC-068 / SERP-170):** This document defines the canonical specification. CSS / component refactoring takes place incrementally across feature modules following core API command wiring.
