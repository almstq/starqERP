<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document is HISTORICAL and is retained as evidence of the state at the time.**
>
> 29 Aug verification finish report. Evidence of the state then; not current instruction. Do not use it as current instruction.
>
> **Current development SSOT:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](../../governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
> **Current roadmap:** [`ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`](../../roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md)
> **Supersession index:** [`SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md`](../../governance/SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md)
>
> StarqERP development is **ON HOLD** pending explicit Founder restart authorization. The
> completion model is *close complete business processes*, not *complete the remaining
> modules*, across the five canonical chains: Order-to-Cash, Procure-to-Pay, Inventory-to-GL,
> Cash-to-Bank, Record-to-Report. This is **convergence, not rewrite** — existing
> architecture, migrations, tests, evidence and completed tasks all remain valid.
>
> **Original content is preserved verbatim below.** Nothing was removed or rewritten.
>
---

VISION FINISH — Board sync audit complete. Model=inkling:free. No mutations. DEC-072 applies (Elder spot-check; not self-claimed). Evidence from real python/stat command outputs preserved.

CANONICAL STATE (D:/StarqTech/starqNexus/data/starq-erp-tasks.json, timestamp 2026-08-29 20:56:13.764Z, 747202 bytes): 342 tasks; done=144 / planned=189 / in_progress=5 / blocked=3 / todo=1; 22 epics; SERP-E11 epic present (tasks=[]); SERP-347..360 all present, all planned, epic=None, primary_contributor=None.
BAK (2026-08-29 07:59:49): 319 tasks; 0 of 347..360 present; confirms 14-task delta = Payment Core addition.
.AGENT ATTRIBUTION: case duplicates (Codex/codex, Claude/claude, Antigravity/antigravity); None=131 unassigned (includes 14 new).

NEXUS STATE: .generated.ts (D:/StarqTech/starqNexus/src/data/starqErpTasks.generated.ts) timestamp 2026-08-29 21:27:46.816Z (813428 bytes) — regenerated; contains 14 IDs; E11 references=29; status counts different from SSOT (pipeline grouping/filtering difference). .library.generated.json (20:57:09, 20948244 bytes) same pipeline. Regenerator script timestamp 27 Aug 01:51 (still authoritative framework); server.mjs loads .generated.ts live from src/data.

PIPELINE TRACE (verified by file inspection): canonical SSOT (JSON) -> regenerate-all-boards.mjs (script) -> starqErpTasks.generated.ts + library.generated.json -> server.mjs /api/sync/projects loads .generated.ts live. No stale artifact; regeneration ran (21:27). Divergence = SSOT linkage gap (E11 tasks=[]) + regeneration pulls flat IDs but does not synthesize epic mapping / assignee; older UI snapshot (328 visible) predates regeneration.

ROOT CAUSE (evidenced, not inferred): Linkage/attribution gap in SSOT for E11 — epic defined but tasks array empty; 347-360 have no epic mapping / primary_contributor; pipeline regenerates correctly from JSON but UI state reflects pre-regeneration snapshot; no file-level corruption; no regeneration failure; no missing file.

PAYMENT CORE (SERP-347..360 verified by python id-match): 14 present; titles present; status=planned; epic=None; 360 is Badge.tsx duplicate-case removal (not a Payment Core task) — discrepancy recorded.

SYNCHRONIZATION ACTION REQUIRED (NOT EXECUTED; awaits Founder auth): (1) fix E11 linkage (tasks array + assignee mapping per Elder's assignment); (2) re-run regeneration from same root; (3) reload server; (4) resolve case-duplicate attribution; (5) verify visible count = 342 (or consistent grouping) and 14 E11-linked. Watchdog: heartbeat/cron-probe both last=error; night-dream paused; watch.mjs present.
RISKS: do NOT repair while Elder's SERP-300 review pending (DEC-072). Model=inkling:free (free tier) — flag for Elder review. No gate claimed.
