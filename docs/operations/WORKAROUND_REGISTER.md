# Workaround register

**Established:** 30 August 2026 (SERP-258) · **Status:** open, reviewed at the Phase 5 exit gate

> **A usability complaint says the system is awkward. A workaround says the system does not do this
> and a human is silently compensating.**
>
> Unrecorded, a workaround stops looking like a gap. Someone keeps a spreadsheet beside the ERP, the
> numbers reconcile *because they are maintaining both*, and the missing feature never surfaces as
> missing — until that person is on leave, or until client #1 has no spreadsheet and no idea one was
> ever needed.

---

## How to use this

**Add a row the moment you do something by hand that the system should have done.** Not at the end
of the week. The annoyance is forgotten once the workaround becomes habit, and the ones that become
habit are the ones costing time every day.

| Field | What goes in it |
|---|---|
| **Gap** | What the system does not do |
| **Manual action** | What a human does instead — concretely, not "handles it" |
| **Time cost** | Rough minutes per occurrence |
| **Frequency** | Per day / week / month |
| **Touches money?** | **YES** if it adjusts, maintains or reconciles a financial figure outside the ledger |
| **Board task** | The SERP id raised for it |
| **Closed by** | Commit hash, when the system does the thing |

### Three rules

1. **Any money-touching workaround is raised as a P0 board task immediately.** Not at review. A
   human maintaining a financial figure outside the ledger *is* a second set of books.
2. **Nothing closes by deleting a row.** A workaround closes when the system does the thing, and the
   row records the commit that made it true.
3. **Zero entries is suspicious, not clean.** An empty register means nobody is recording, not that
   nothing is being worked around. It gets challenged at the exit gate.

---

## A · Operator-reported

*Written by the people doing the work. **Empty is a finding**, not a pass — see rule 3.*

| Gap | Manual action | Time | Freq | Money? | Task | Closed by |
|---|---|---|---|---|---|---|
| *(none recorded yet — the pilot has not run)* | | | | | | |

---

## B · System-derived

*Gaps Elder verified in the code that **will force** a workaround the moment the system is used in
anger. Listed separately because nobody has hit them in practice yet — they are predictions with
evidence, not reports. **An operator hitting one of these should move it to section A with a real
time cost.***

| # | Gap | The workaround it forces | Money? | Evidence |
|---|---|---|---|---|
| B1 | **The ledger lives in browser `localStorage`.** Chart, journals and periods are per-browser | Two people cannot see the same books. One person becomes the only one who posts, or numbers are re-keyed between machines | **YES** | `AccountsView.tsx` keys `starq:chart_of_accounts:v1`, `starq:manual_journals:v1`, `starq:accounting_periods:v1`. Known and deliberate — SERP-155 lane |
| B2 | **Eleven feature views are not mounted on any route** — payroll, manufacturing, job costing, multi-warehouse, consolidated reporting, credit dunning, and others | Every one of those functions is done outside the system entirely. Payroll in particular is a spreadsheet by definition today | **YES** — payroll and consolidated reporting both produce figures | `docs/qa/SERP-234_REACHABILITY_SWEEP_2026-08-30.md`. `node scripts/reachability-sweep.mjs` |
| B3 | **No input GST could be recorded** until 30 Aug | Input tax tracked on paper or in a sheet, then entered at filing time | **YES** | Fixed by SERP-341 — account `1410` added. Kept here because the *workaround* survives until someone migrates the sheet back in |
| B4 | **Tourism GST computed at a hard-coded 16%** until 30 Aug | Returns spanning 1 July 2025 corrected by hand after the system produced them | **YES** | Fixed by SERP-342. Same caveat as B3: any return already filed on the old figure needs checking |
| B5 | **Fabricated TINs reached GST returns** until 30 Aug | An operator either files the invented number or overwrites it every time | **YES** | Fixed by SERP-237. **If any return was filed carrying `1002345GST501` or `1099882GST501`, that is a correction to MIRA, not a code fix** |

**B5 is the one to act on first.** The others are gaps; B5 may already have produced a filed
document containing a fabricated identifier. That is a question for the founder and the accountant,
not for engineering.

---

## C · Closed

*A workaround moves here when the system does the thing. It never simply disappears.*

| Gap | Closed by | Date |
|---|---|---|
| *(none yet)* | | |
