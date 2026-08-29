# StarqERP revision — retire the old surface, keep the core

**Date:** 23 August 2026 · **Author:** Elder · **Status:** proposal, awaiting founder
**Trigger:** founder, 23 Aug: *"restart from starqERP revision… if it is token effective, retire old and lets begin with this."*

---

## 1. What "this" actually is

The AI Studio build, extracted and read: **49 files, React 19 + TypeScript + Vite, front-end only.**
`src/types/erp.ts` (470 lines) carries `OrganisationTenant` and a `WorkflowStage` with `tenantId` —
so it is the generation I expected, not an earlier one. `src/context/ERPContext.tsx` (1,257 lines)
holds every state mutation in React state. `src/data/mockData.ts` (1,984 lines) is fake data.

**There is no backend, no auth, no persistence.** Its value is that it is a *specification with a
working face*, and the first artefact that models the product Starq can **sell** rather than one
garage's console.

## 2. The finding that changes the answer

**The core is already multi-tenant.** This was not obvious and it decides everything below.

`202608200001_core_foundation.sql` creates `organisations`, `memberships`, `membership_seats`,
`persons`. Every operational table carries `organisation_id`, and the foreign keys are **composite**
— `garage_jobs` references `contacts(organisation_id, id)`, not `contacts(id)`. A row in one tenant
**cannot** point at a row in another; the database refuses it. Idempotency keys are keyed
`(organisation_id, key)`. Audit events carry `organisation_id`.

The mockup's `tenantId` **already exists in the database.** Nobody has to invent it.

Only two things are single-tenant, and both are shallow:

| Where | What | Depth |
|---|---|---|
| `functions/starq-api/index.ts:218` | `CLUB_IGNITION_ID` hardcoded; any other org's session is rejected | one constant, one guard |
| `202608200002:118` | `garage_jobs.state` is a `CHECK` of 13 garage-specific strings | workflow is code, not data |

## 3. Gap table — mockup vs core

**Mockup has, core does not:**
- workflow stages as rows (per tenant, ordered, SLA, allowed roles, checklists)
- roles × module × action as data
- user `Pending Approval` — `memberships.status` is `active|suspended|ended`
- per-tenant GST rate, MIRA TIN, financial year, bank accounts, theme

**Core has, mockup does not — and this is the expensive half:**
- authentication and session authority (migration 0008)
- idempotency that survives retries
- an audit trail the actor cannot forge
- seat separation — the reason one person cannot quote, award, receive and pay in one motion
- RLS, and 13 defects already beaten out of it

## 4. Recommendation — what "retire the old" should mean

| | Verdict | Why |
|---|---|---|
| `src/data/mockData.ts`, local-state `ERPContext` | **RETIRE** | replaced by the real API — this is the actual "old" that must die |
| `garage_jobs.state` CHECK, `CLUB_IGNITION_ID` | **RETIRE** | the two single-tenant assumptions |
| `starq-ops-app` (Flutter console) | **PARK — frozen, not deleted** | RULE 2 forbids deletion. Not touched again until the core is generalised and the web app is real. **This is the token-effective half of the instruction: one surface at a time.** |
| `supabase/migrations/0001–0011`, `functions/starq-api`, `contracts/commands.ts` | **KEEP** | rebuilding these from a mockup would cost more than everything spent on the ERP so far and would re-open thirteen closed defects |

**Retiring the front end is cheap. Retiring the core is the single most expensive move available.**
The mockup is the half that was already free to produce; the core is the half that cost two days
and an independent audit.

## 5. The one decision only the founder can make — seats or roles

The contract (`contracts/commands.ts`) says: *a seat is an operational separation, not a corporate
office*. It exists so one person doing the whole chain still cannot quote, award, receive and pay
in a single unbroken motion. The mockup ships conventional RBAC: role → module × action.

**These are two different axes and merging them badly loses one of them.**

- **(a) Both, layered** — roles gate what you can **see** (modules/screens), seats gate what you can
  **do** (commands). *Recommended.* Only option that keeps `DEC-065` alive while giving tenants the
  settings screen the mockup already draws.
- **(b) Roles only** — drops segregation of duties. Simpler, and throws away the reason the seat
  vocabulary was unified two days ago.
- **(c) Seats only** — keeps the discipline, throws away a settings UI that is already designed.

## 6. Sequence — four steps, each shippable on its own

1. **Generalise the boundary.** Remove `CLUB_IGNITION_ID`; resolve the org from the session. Club
   Ignition becomes *a* tenant, not *the* tenant.
2. **Workflow stages as data.** `workflow_stages` table; drop the CHECK; transitions validated
   against rows plus allowed seats. Garage's 13 states become tenant #1's seed data.
3. **Roles as data, layered over seats** (pending §5). `memberships.status` gains `pending`.
4. **Wire the React app to the real API.** Delete `mockData.ts` last, not first — it is the
   fixture the wiring is tested against.

## 7. Open — awaiting Antigravity

Sent 23 Aug. AG owes: whether an AI Studio export landed on its side and whether it matches;
the full list of mutations in `ERPContext.tsx` (that list *is* the command surface the API must
expose); which screens can be wired to endpoints that already exist; and its read on §5.
