# Starq UI Post-Pilot Wave — Founder Visual and Interaction Amendment

**Date:** 31 August 2026  
**Status:** FOUNDER-DIRECTED REQUIRED OUTCOMES  
**Applies to:** The next bounded full-application polish wave under Starq UI Stack V1  
**Authority boundary:** Visual, responsive, accessibility and interaction polish only. No business, financial, tenant, auth or workflow-semantic change is authorized.

---

## 1. Direction

The active ERP currently expresses equivalent-looking second-level and third-level navigation differently across domains. The next polish-wave reconnaissance must classify those surfaces by semantics before proposing visual consolidation.

The target is one coherent Starq secondary-navigation language where semantics match, while preserving the appropriate placement and behavior for each context. Do not mechanically relocate controls or style every pill-like surface as the same component.

The executor must distinguish:

- application/sidebar navigation;
- module navigation;
- record/entity mode selection;
- filter/segmentation;
- workflow action.

These categories must not be collapsed merely because their current visual treatments resemble pills or tabs.

## 2. Required reconnaissance surfaces

The caller census must include, at minimum:

- Settings subsection navigation in the left sidebar;
- Roles & Permissions role selector;
- Reports section tabs;
- General Ledger / Chart of Accounts section tabs;
- Invoices / Credit Notes / Settlement tabs;
- every equivalent second-level or third-level navigation surface found across the active ERP.

For every surface, establish canonical rules for:

- active, inactive, hover, focus-visible and disabled states;
- icon and count-badge alignment;
- spacing and visual hierarchy;
- overflow behavior;
- responsive wrapping, scrolling or layout transition;
- keyboard behavior;
- long-label behavior;
- narrow-window behavior.

Horizontal groups must remain legible and robust as viewport width changes. Fixed desktop-only rows that overflow or compress labels illegibly are not acceptable.

## 3. Mandatory pre-mutation evidence

Before implementation, return the following matrix:

`SURFACE | CURRENT PATTERN | SEMANTIC TYPE | PROPOSED CANONICAL PATTERN | SHARED/LOCAL | CALLERS | RESPONSIVE RULE | RISK`

The evidence must explicitly identify:

1. which secondary-navigation surfaces genuinely share semantics and can share one implementation;
2. which surfaces must remain semantically distinct;
3. the proposed dashboard Welcome Card component structure;
4. whether any shared primitive requires modification;
5. the exact caller census before any shared modification.

No shared primitive may be modified until this evidence exists and the shared-primitives rule in the post-pilot mission is satisfied.

## 4. Settings nested navigation

Settings child navigation is useful and must remain logically attached to Settings. It must not be converted into generic content tabs merely for visual consistency.

Treat it as a proper nested application/sidebar navigation component with:

- clear parent/child hierarchy;
- a stronger, unmistakable active-child state;
- predictable indentation;
- consistent icon alignment;
- coherent vertical rhythm;
- keyboard navigation;
- responsive/collapsible behavior;
- no visual confusion with top-level navigation.

## 5. Coherent module-navigation family

Where semantics genuinely match, the horizontal selectors in the following areas should converge on one coherent module-navigation or segmented-tab family:

- Roles & Permissions;
- Reports;
- Chart of Accounts / General Ledger;
- Invoices;
- equivalent screens established by the caller census.

Requirements:

- every item behaves independently;
- the active state is unmistakable;
- hover and focus-visible states are polished;
- icons and badges/counts remain aligned;
- the control is keyboard accessible;
- long labels are supported;
- narrow layouts wrap, scroll, condense or change layout according to observed evidence;
- content never overflows or compresses illegibly;
- financial and business behavior remains unchanged.

The executor must identify the existing shared or local primitive best suited to own the behavior. A shared modification requires an exact caller census, regression evidence and a focused rollback boundary.

## 6. Dashboard Welcome Card

Preserve one outer bordered welcome card matching the current overall card treatment. Internally, separate the composition into four independently responsive regions without creating a stack of heavy bordered cards.

### Region 1 — Greeting

- Dedicated greeting area with its own layout space.
- Use the user's local time of day: `Good morning`, `Good afternoon` or `Good evening`.
- Follow the greeting with the user's preferred/display name.
- The greeting must not collide with book metadata or actions.

### Region 2 — Open books / active operating context

- Place a clearly separated block below the greeting.
- Show the relevant organisation and book/operating-context identity concisely.
- Support one or several available/open books without breaking the card.
- Adapt from wide to narrow layouts and tolerate long organisation/book names.

### Region 3 — Context / attention summary

- Give the attention summary its own independently laid-out region below the book/context area.
- Support no-attention, actionable-item, warning and important-operational-status states.
- Do not hard-code the layout solely for the current empty state.

### Region 4 — Primary actions

- Keep actions such as New Work Order, New Invoice and starqAI within the outer card.
- Give actions a distinct layout region that adapts independently at narrower widths.
- Actions must remain reachable and obvious without forcing greeting or context copy into poor wrapping.

### Composition rules

- Wide screens: use an intelligent multi-column composition where appropriate.
- Medium screens: reflow regions without collisions.
- Narrow screens: use a clean vertical stack.
- Long user, organisation and book names must not break the layout.
- Do not use arbitrary fixed widths.
- Use spacing, typography, grouping, dividers and subtle surface differentiation for internal separation.
- The result should feel composed, spacious and premium, not like boxes inside boxes.

## 7. Stack and scope constraints

These outcomes are part of Starq UI Stack V1 and target the smoothness, spacing discipline, responsiveness and interaction quality of an excellent shadcn application while retaining Starq UI / Material 3 Expressive identity.

Do not:

- copy default shadcn styling;
- add Radix, Base UI, shadcn or another dependency solely for these layouts;
- initialize shadcn or add `components.json`;
- redesign global tokens, colour or typography;
- alter financial/business behavior;
- alter tenant, auth, permission or workflow semantics;
- expand into a global redesign.

Any demonstrated need to cross one of those boundaries is a stop condition requiring a focused Founder decision.

## 8. Required report evidence

The post-pilot polish-wave execution report must include:

- the completed pre-mutation surface matrix;
- semantic grouping decisions and rejected false equivalences;
- the exact caller census;
- the selected ownership level for each pattern;
- Welcome Card structure and responsive behavior;
- executed responsive, keyboard and interaction results;
- before/after evidence for any shared modification;
- relevant lint, tests, production build, route smoke, console, light/dark, narrow-window, zoom and keyboard/focus results;
- confirmation that no business/financial semantics or dependencies changed.

These outcomes are authorized candidates within the already bounded polish wave. They do not authorize a second autonomous wave or broader product redesign.
