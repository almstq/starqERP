# Bug Log — Founder live testing, 5 September 2026

**Source:** Ali testing the live production app (starq-erp.vercel.app) on mobile, screenshots shared
directly in chat. Logged by Elder per instruction ("be the bug police, note down all bugs you see now
to attend later") — **not fixed yet**, this is triage only. Confidence level noted per item; some are
confirmed against actual source, others need live reproduction before anyone spends fix time on them.

---

## 1. GST Tax Invoice shows 0.00 GST despite being labelled "8% GST" — CONFIRMED IN CODE, HIGH SEVERITY

**Where:** `web/src/components/invoices/CreateInvoiceModal.tsx:83-84`
**Screenshot:** "Create MIRA GST Tax Invoice" modal, line item Rf 25,000.00, "Maldives GST (8%): Rf 0.00", Total Rf 25,000.00.

```ts
const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
const gstRate = 0;
const gstAmount = 0;
const totalAmount = subtotal;
```

`gstRate` and `gstAmount` are hardcoded to zero — never computed from the actual 8% General GST rate
(`domain/taxRates.ts` already has `resolveTaxRate('gst_general', ...)` for exactly this) — and stored
directly into the created invoice via `createInvoice({ ..., gstRate, gstAmount, ... })`. Every invoice
issued through this modal is understated by the full GST amount. This is a real MIRA compliance defect,
not a display glitch — the wrong number gets persisted into `invoices`, not just shown wrong on screen.
No comment in the code suggests this is a deliberate HOLD; it reads as an unfinished placeholder.
**Highest-priority item in this log.**

---

## 2. "Assigned POS Counter / Store" dropdown overlaps unrelated form fields — CONFIRMED IN SCREENSHOT

**Where:** Create New POS Sale modal, `Assigned POS Counter / Store` select.
**Screenshot:** dropdown options ("Main Studio / Engineering Unit", "Client On-Site / Remote Delivery",
"Development Unit 1", "Project Management Office") render as an overlay that visually sits on top of the
"Project Scope & Deliverables" textarea above it, rather than appearing directly below the select box it
belongs to. Looks like a z-index/positioning defect on the dropdown panel — needs a live repro to find
the exact component and CSS rule, but the visual evidence is unambiguous.

---

## 3. Chart of Accounts submenu content may not update on click — NEEDS LIVE REPRO, code looks correct

**Where:** `/accounts` route, sidebar submenu (Chart of Accounts / General Ledger / Period Lock & Year-End
/ Bank Reconciliation / Multi-Currency & FX), `web/src/app/AppShell.tsx` + `web/src/components/accounts/AccountsView.tsx`.
**Screenshot:** Ali reports this is the *same* submenu-content-not-switching bug previously fixed for
Reports and Invoices, now recurring on Chart of Accounts — clicking "General Ledger" then "Period Lock &
Year-End" in the sidebar, but the visible page content behind the drawer still looks like the Chart of
Accounts summary (57/20/14/3/5/15 account counts) rather than switching.

**Checked directly:** the routing code for `/accounts` looks structurally correct — `AccountsView` reads
`activeTab` straight from `useSearchParams()` (single source of truth, no separate `useState` that could
desync from the URL), sidebar links build `to={`${to}?tab=${sub.id}`}` correctly, and `activeTab` is used
to conditionally render `GeneralLedgerView` / periods / `BankReconciliationView` / etc. I could not find
the same class of bug that must have existed in Reports/Invoices from reading this file alone.

**Two live possibilities, unconfirmed:**
- A genuine repeat of the routing bug in a place this code review didn't reach (e.g. a stale route
  component higher up not re-rendering on search-param-only navigation).
Do NOT reproduce and diagnose without a live browser session on the actual mobile device/viewport this was captured on — desktop
Chrome dev tools may not show it if it's mobile-drawer-transition-specific.

---

## 4. Chart of Accounts list "doesn't scroll all the way down" — NEEDS LIVE REPRO

**Screenshot:** list scrolled to show accounts 5110-6910, annotated "doesn't scroll all the way down."
Migration seed has 57 accounts total; last visible on screen was 6910 (Depreciation Expense), with
higher-numbered expense/tax accounts (per migration: up to 6920 Current Income Tax Expense, plus 1220/2160
inter-book accounts) potentially unreachable if the list container is genuinely clipped.
**No fixed-height scroll container found** in a first pass over `AccountsView.tsx` — the clipping may be
in a parent layout element, a mobile viewport/safe-area issue, or specific to the annotated screenshot's
scroll position rather than a true "cannot scroll further" defect. Needs live reproduction on the same
device/viewport before diagnosing further.

---

## 5. Assign Technicians & Specialists — layout circled without a clear defect stated

**Screenshot:** Create New POS Sale modal, the technician-selection button row circled with an arrow
toward "Target Completion." No accompanying text explained what's wrong here specifically (unlike items
1-4). Logged for completeness — needs the founder to clarify what looked off (overflow, wrong row height,
missing scroll, alignment) before anyone spends time on it.

---

## Triage summary

| # | Item | Confidence | Severity | Next step |
|---|---|---|---|---|
| 1 | GST hardcoded to 0 in CreateInvoiceModal | Confirmed in source | **High — compliance/financial correctness** | Wire to `taxRates.ts`'s `resolveTaxRate`/`taxOnExclusive`, same pattern already used in `miraTgst.ts` |
| 2 | POS Sale counter dropdown overlaps textarea | Confirmed in screenshot | Medium — UX/visual | Live repro to find the exact overlay component |
| 3 | Chart of Accounts submenu content not switching | Unconfirmed — code reads correctly | Medium-High if real — navigation is broken | Live repro on the same mobile viewport before diagnosing |
| 4 | Chart of Accounts list scroll clipping | Unconfirmed | Low-Medium | Live repro |
| 5 | Technician assignment layout | Unclear — no defect stated | Unknown | Ask founder what looked wrong |

None of these are fixed yet. This file is the record; convert to SERP tasks (or fix directly) when
picking this up.
