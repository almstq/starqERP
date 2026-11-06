<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document is SUPERSEDED and is retained as history only.**
>
> 31 Aug board-correction mission. It corrects board hygiene; it does not correct the development completion model, which DEC-100 now governs. Do not use it to plan, implement, review or decide current StarqERP work.
>
> **Current development SSOT:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
> **Current roadmap:** [`ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`](../roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md)
> **Supersession index:** [`SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md`](SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md)
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

# starqERP Project Board Correction Mission — V5–V7 checkpoint

**Date:** 31 August 2026  
**Scope:** Continuation of the accepted V1–V4 board-correction mission. No board mutation was made in V5–V7.

## V5 — PASS: topology and contradiction preservation

- Canonical SSOT has 70 `final_phase` assignments, all valid `P0`–`P9`: P0 1, P1 8, P2 14, P3 12, P4 7, P5 14, P6 3, P7 2, P8 3, P9 6.
- All 363 tasks shared with the pre-Bible backup retain their historical `phase` byte-for-byte; none was blanked. The 19 new final-stretch tasks use `phase: "Final stretch"` plus additive `final_phase`.
- The competing `Phase N —`, `Phase N -`, and `Stage N -` values are intentionally preserved historical vocabulary, not topology corruption.
- P5 is retained as the continuous security lane; P6 is retained as the continuous independent-acceptance lane.
- The known SERP-268, SERP-340/SERP-391, SERP-300/SERP-379, fabricated-TIN, reachability-ratchet, and OrganisationSetupModal contradictions remain visibly recorded. No closed task was reopened.

## V6 — PASS: Nexus derived state

Executed read-only checks in `starqNexus`:

- `npm run check:store` — PASS; one canonical `00_STARQ_HQ/decisions.json` store.
- `npm run check:board` — PASS; all 15 derived boards match source, including `starq-erp-tasks.json` at 146/382.
- `PUBLIC_BUILD=1 npm run check:tier` — PASS; no Tier 1 data in generated public bundle.
- No stale 363-task projection was found in Nexus derived board data; occurrences are task ID `SERP-363`, not a board total.

## V7 — live roster

| Agent / authority | Available now? | Live evidence | Best lane | Restriction |
|---|---|---|---|---|
| Founder | Yes | Active Founder direction in this task | policy, irreversible actions, merge/release authority | does not substitute for independent implementation evidence |
| Codex | Yes | current task active; local agent roster contains only `/root` | bounded recon and governance | must not self-accept consequential gates |
| Elder | No | Founder-confirmed offline until 4 September 2026 | none until return | may not accept Elder-authored gates |
| Vision | Not confirmed | no active local runtime; prior verification handoff only | none until live confirmation | reviewer must not author reviewed work |
| Alfred | Not confirmed | no active local runtime | none until live confirmation | reviewer must not author reviewed work |
| VS Code agent | Not confirmed | no active local runtime or current credit signal | none until live confirmation | independent-only where assigned |

## Proven correction candidates — no mutation made

1. **V4 canonical dependency drift — SERP-226.** Expected: a `next` task does not depend on `planned` SERP-221 unless an explicit canonical waiver exists. Actual: `next` with `depends_on: SERP-221`; DEC-099 pulls the work forward but does not state a dependency waiver. Required mutation would change the dependency or status. **Founder decision required.**
2. **V4 canonical dependency drift — SERP-380.** Expected: a `next` task does not depend on in-progress SERP-234 unless an explicit canonical waiver exists. Actual: `next` with `depends_on: SERP-234`; DEC-102/DEC-113 resolve disposition, not dependency. Required mutation would change the dependency or status. **Founder decision required.**
3. **V1 Git/push state.** `93d4bcc` and `dcd7f03` were accepted as locally present but unpushed. This is a Git publication state, not a canonical-board correction. No automatic push is implied by an existing decision.
4. **V1 Nexus WC2026 residue — resolved by Founder authorization.** Founder ruled WC2026 an obsolete personal project unrelated to the Nexus control plane or the final stretch. The entire Nexus-owned WC2026 surface, its cache generator, and its dedicated GitHub Actions workflow were removed in `starqNexus` commit `d6210cb7ed908d347aefb59557975ce8e51e8c4f`, pushed to `nexus/orgspace`. `public/wc2026/data/live-state.json` is absent; no active in-repository generator, route, import, or build hook remains. The separate external `D:\!starq\worldcup2026` project and ignored library-index historical records were deliberately preserved as outside the Nexus-owned removal boundary.
5. **Documentation observations.** The 51-versus-70 phase count and Bible's dated pre-reconciliation 363-task snapshot are historical/documentation observations, not SSOT or derived-projection corrections.

## Completion boundary

V5 and V6 are PASS. The V1 WC2026 provenance item is resolved as Founder-authorized cleanup. The two V4 dependency contradictions were subsequently resolved by Founder rulings DEC-115 and DEC-116.

## P0 final closure — 31 August 2026

- **SERP-226:** DEC-115 waives planned SERP-221 as its pre-work dependency only. SERP-226 remains `next`; SERP-221 remains `planned`, valid, and uncompleted. The former dependency and waiver are retained in SERP-226 notes.
- **SERP-380:** DEC-116 waives in-progress SERP-234 as its pre-work dependency only. SERP-380 remains `next`; SERP-234 remains `in_progress`, valid, and subject to its own acceptance obligations. The former dependency and waiver are retained in SERP-380 notes.
- **V4 rerun:** PASS. The board generator defines blocking semantics exclusively through `depends_on`; all seven `next` rows have no unresolved `depends_on` blocker. SERP-339's distinct legacy `dependencies` reference list remains intact as non-blocking acceptance context.
- **Canonical board:** unchanged at 382 total; 146 done; 192 planned; 28 in progress; 9 blocked; 7 next; 26 review-pending; 38.22% completion.
- **Nexus evidence:** `075eb1b57482144e570b00ef4fd44922be1cdbc2` (`nexus/orgspace`, pushed) contains only the two canonical dependency-waiver corrections and regenerated ERP projection. All 15 projections pass.
- **Separate follow-up observation:** the ignored generated library index still triggers two public-tier third-party-name findings (Nashid and Naleez). Founder explicitly ruled those non-P0 blockers; they were not changed or included in this closure.

P0 board-convergence correction is **CLOSED**. This authorises dispatch from the verified seven-row `next` queue subject to normal worker eligibility and acceptance boundaries; it does not start product implementation, merge to `main`, or close any product task.
