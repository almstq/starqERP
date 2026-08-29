# SERP-117 — is `api_session_authority` missing from a database the Edge already calls?

**Raised:** 22 Aug 2026, as pre-condition P1 of the SERP-115 change plan.
**Settled:** 22 Aug 2026, by Elder, read-only, from local evidence.
**Verdict:** **Case 1 — benign. The deployed Edge Function predates the call. Production sign-in
is not failing.**

---

## The question

`supabase/functions/starq-api/index.ts:147` calls `api_session_authority`. That function is created
**only** by migration `202608200008`, which the ledger says is not applied. The deployment record
says the `starq-api` Edge Function *is* deployed. Three mutually exclusive explanations, and nobody
had checked which:

| | implication |
|---|---|
| **A** — deployed Edge is an older build that does not call it | benign; the call arrives with 0008 |
| **B** — deployed Edge does call it and the function is absent | **sign-in failing in production today** |
| **C** — the function exists by some route outside the ledger | the ledger is untrustworthy — worse |

## The evidence

**1. The call and the migration were born in the same commit, the day *after* the deploy.**

```
e6a75fb  2026-08-21 22:38:07 +0500   supabase/functions/starq-api/index.ts   (call introduced)
e6a75fb  2026-08-21 22:38:07 +0500   .../202608200008_session_authority.sql  (function introduced)
```

`git log -S'api_session_authority'` returns exactly one commit for `index.ts`. The whole history of
that file is two commits, `e6a75fb` and `5ce8c17`, both on 21 August. The deployment record
(`CLOUD-DEPLOYMENT-RECORD.md`) is dated **20 August** and lists applied migrations `0001`–`0007`.
The deployed build is roughly **30 hours older than the line in question**.

**2. Nothing has been deployed since.** Both session records — 21 and 22 August — close with
*"No production, cloud, secret, database or deployment change was made in this session."*
This matters because `supabase functions deploy` ships from **local disk, not from a git push**, so
"the commits are unpushed" is *not* on its own an argument that the code did not reach production.
That reasoning was considered and rejected. The load is carried by the deployment record and the
two session certifications, not by the push state.

**3. Case C is ruled out on the ledger side.** `api_session_authority` appears in **no** migration
other than `0008` — checked across all ten files, not inferred. It is absent from every applied
migration `0001`–`0007`, so there is no route by which it exists on the remote under the ledger.

**4. The target is the right one.** `supabase/.temp/project-ref` is `wthabguvueewgtabjsdo`, matching
the project reference in the deployment record. The analysis is about the database we mean.

## What this does not prove — read this before citing the verdict

**No live observation was made.** This is a documentary argument: a dated deployment record, two
session certifications, and a calling line thirty hours younger than the deploy. It is strong, and
it is sufficient to retire the alarming case — **B is what P1 existed to rule out, and B is ruled
out** — but it is *not* the same as watching the remote answer.

Two residues survive, and both are cheap:

- If someone deployed the function outside a recorded session, the record would not show it. Nothing
  suggests anyone did; nobody is asserting it either.
- The direct confirmation is one read-only command against the linked project, and **it is already
  in the plan as P3**, which is re-run immediately before the push regardless:

```bash
supabase migration list --linked
```

If P3 shows the pending set as exactly `{0008, 0009, 0010}`, that independently re-confirms this
finding at the moment it matters. **P1 is therefore satisfied for the purpose it was raised for, and
its live half is folded into P3 rather than dropped.**

## Consequence for the push

The ordering is unaffected and the plan does not change. One thing gets *better*: applying `0008` is
no longer only safe, it is **corrective** — the deployed Edge will begin calling a function that
exists, instead of one that would 401. AG reached the same conclusion independently in its
SERP-115 review ("applying migration 0008 is not only safe; it is REQUIRED").

## The wider point, still open

Every "closed" claim in the audit trail was asserted against the **repository**, not a running
system. This finding settles the one that could have meant a live outage. It does **not** re-check
the others, and audit critical #1 remains **written, not in effect**, until `0008` is applied.
That re-check stays on SERP-117's acceptance list.
