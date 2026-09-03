# Starq UI Post-Pilot Polish Wave — Execution Report

**Date:** 31 August 2026
**Branch:** `elder/2026-08-31-wave1-governance`
**Starting SHA:** `ffef3c578a8d8ec7bf06ba79b9be10f6dad363ad`
**Scope:** One Founder-authorized post-Pilot-2 UI polish wave. No business, financial, tenancy, permissions, authentication or dependency changes.

## Pilot verification

| Pilot | Result | Evidence |
|---|---|---|
| Gate A `da6ff3c` | PASS | TypeScript alias change only; no UI or dependency change. |
| Pilot 1 `e424da8` | PASS | Local Settings/About composition only; no shared primitive diff. |
| Pilot 2 `ffef3c5` | PASS | Pilot-local legal dialog has dialog semantics, Escape, focus trap and focus restoration; no shared modal/UI change or dependency churn. |

**Starq UI Stack V1:** CONFIRMED. `web/src/theme.css` and the rendered runtime are the permanent visual execution baseline. Starq UI — Material 3 Expressive remains the identity; shadcn is a quality benchmark, not a runtime or style import.

## Founder amendment and navigation clarification

The sidebar clarification superseded the earlier horizontal module-navigation recommendation before that work landed.

| Surface | Current pattern | Semantic type | Proposed canonical pattern | Shared/local | Callers | Responsive rule | Risk |
|---|---|---|---|---|---|---|---|
| Settings | Nested sidebar children | Application navigation | Nested sidebar submenu | Shared shell pattern | Settings children | Drawer on compact, fixed sidebar on desktop | Low |
| Chart of Accounts | Horizontal persistent sections | Persistent module destination | `/accounts?tab=` nested sidebar children | Shared shell pattern | 5 destinations | Sidebar/drawer; labels wrap/truncate safely | Medium, presentation only |
| Reports | Horizontal persistent sections | Persistent module destination | `/reports?tab=` nested sidebar children | Shared shell pattern | 6 destinations | Sidebar/drawer; no cramped content row | Medium, presentation only |
| Invoices | Horizontal persistent sections | Persistent module destination | `/invoices?tab=` nested sidebar children | Shared shell pattern | 3 destinations | Sidebar/drawer; no duplicate tab row | Medium, presentation only |
| Roles & Permissions | Local role pills | Entity/mode selection | Local radiogroup selector | Local | Role profiles | Horizontal scroll remains available for long role names | Low |
| Book/entity/date selectors | Local selects | Filter/segmentation | Local controls | Local | Reports and related views | Existing wrap behavior retained | Low |

The generalized sidebar behavior provides clear parent/child hierarchy, active parent and child state, child icons, focus-visible state, keyboard-native links, compact drawer behavior, and URL-backed deep links that survive refresh.

## Executed

1. Reworked the Dashboard Welcome Card into four independently responsive regions: greeting, open operating context, attention summary, and quick actions. It preserves one outer card, supports multiple books and long names, and stacks cleanly on narrow layouts.
2. Generalized Settings-style nested navigation in `AppShell` for persistent Accounts, Reports, and Invoices destinations. Each child links directly to a `?tab=` deep link.
3. Replaced view-local state initialization in Accounts, Reports, and Invoices with validated URL-derived section state. This changes presentation/navigation only; calculation, posting, settlement, tax and workflow semantics are untouched.
4. Kept Roles & Permissions page-local as a keyboard-operable radio-style entity selector rather than incorrectly converting it to application navigation.
5. Strengthened Settings child navigation with active-page semantics, focus-visible state, stronger rail/active treatment and consistent indentation.
6. Updated the visible About stack declaration and expanded Copy System Information with the canonical runtime, ownership, forms/tables, package, alias, headless, registry and publication facts.
7. Updated affected tests from superseded content-tab clicks to route/deep-link assertions.

## Deliberately deferred

- No additional persistent-navigation surfaces were converted without a confirmed destination taxonomy.
- No shared `components/ui/*` primitive was modified; the temporary module-navigation primitive was removed when the Founder clarified sidebar doctrine.
- No global token, colour, font or brand redesign.
- No dependency, Radix, Base UI, shadcn, registry, form/table framework or public-repository work.
- Authenticated browser route smoke could not run because the local browser correctly stopped at the existing Google Auth Gate; no sign-in action was attempted. Component integration tests exercised the authenticated view states instead.

## Validation

| Check | Result |
|---|---|
| `npm run lint` | PASS |
| `npm test -- --run --reporter=dot` | PASS — 82 files, 297 passed, 1 skipped |
| `npm run build` | PASS |
| Targeted changed-surface suite | PASS — 6 files, 34 tests; follow-up deep-link suite 3 files, 8 tests |
| Deep-link/sidebar smoke | PASS — desktop Reports child links and `aria-current` covered by adaptive viewport test |
| Keyboard/focus | PASS — sidebar links are native links with focus-visible treatment; local Roles selector uses radiogroup semantics and arrow/Home/End navigation |
| Responsive/narrow | PASS — existing compact/desktop adaptive suite plus new persistent Reports sidebar coverage |
| Browser console | No application route console check: local browser reached the existing unauthenticated Auth Gate only |
| Dependencies | PASS — no `package.json` or lockfile diff |

The build still reports pre-existing warnings in `common/Badge.tsx` for duplicate switch cases and the existing large-chunk advisory. Neither was changed in this wave.

## Rollback and commits

The implementation is confined to the application shell, four local screen components, one local Roles selector, and corresponding tests. Rollback is one focused commit; no migration, dependency or business-domain file changed.

**New commit:** `feat(ui): polish persistent module navigation` (final hash recorded in the handoff).
**Pushed:** NO.

## Recommendation

**READY FOR FINAL FREEZE REVIEW** — subject to the independent whole-application review by VS Code / Starq Feasibility, including authenticated browser visual smoke where a valid session is available.
