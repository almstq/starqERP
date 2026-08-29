# RUNBOOK — DEC-063: the Edge deploy, then migration 0011

**Written 22 August 2026 by Elder, for the founder.** All commands are PowerShell.
Everything technical is finished, reviewed and tested. What is left needs your Supabase access.

> **This closes audit criticals #1, #2 and #5.** They are all live in production right now.
> Option **B** of `DEC-063`: one window, in this order, no substitutions.

---

## Before you start — read these three, they are the whole runbook in miniature

1. **The order is not a preference.** Deploy the Edge **before** pushing 0011. Migration 0011 makes
   `receive` require the `receiver` seat; exactly one person holds it; the currently-deployed 8-seat
   Edge filters that seat out of his session. Push first and the garage cannot book a delivery.

2. **The Edge deploy is not reversible to what is running today, and AG's playbook for it is wrong.**
   AG's review offered `git checkout b6e7450 -- supabase/functions/starq-api/`. That commit contains
   no `supabase/functions/` at all, so the command fails outright. Worse: **no commit in this
   repository reproduces the deployed 20 August build** — the earliest commit holding the Edge source
   is `e6a75fb` (21 Aug), which already contains the new behaviour. Recovery is **forward only**:
   patch and redeploy, which takes well under a minute. This is why step 2 is not optional.

3. **Do not run `.\scripts\check-cloud-schema.ps1`.** It hardcodes *"Expected 8 ordered migrations"*
   and there are now 11. It will throw for a bogus reason and make you think something broke. Left
   alone deliberately — changing a checker in the same window as the thing it checks is how you end
   up unable to trust either. Fix it after.

---

## Pre-flight (2 minutes)

**P1. Be on the right commit.**

```powershell
cd D:\!starq\the foundation engine; git log --oneline -1
```

Expect `e0f30dd Bound every database call in the Edge boundary`. If it is not that, stop.

**P2. Confirm the link points where you think it does.**

```powershell
Get-Content D:\!starq\the foundation engine\supabase\.temp\project-ref
```

Expect `wthabguvueewgtabjsdo`.

**P3. Green tests on the build you are about to ship.**

```powershell
cd D:\!starq\the foundation engine; deno test --allow-read; python test_ops_guard.py
```

Expect `81 passed | 0 failed` and `Ran 38 tests ... OK`. Anything else, stop.

**P4. Have the three people reachable.** Step 2 needs all three to actually sign in. If you cannot
reach them tonight, do **step 1 and step 2 only**, and leave 0011 for when you can. That is a clean
stopping point — it is option A, and it is still safe.

---

## STEP 1 — Deploy the Edge Function

```powershell
cd D:\!starq\the foundation engine; supabase functions deploy starq-api --project-ref wthabguvueewgtabjsdo --no-verify-jwt
```

> **`--no-verify-jwt` is not optional and this runbook originally omitted it.** Without it the
> Supabase gateway demands an `Authorization: Bearer` token before the request reaches our code.
> `/health` 401s, and — the part that matters — the Flutter client sends no such header
> (`api_client.dart` `_buildHeaders`), so every request from the shop is rejected at the gateway
> and the garage app is down. This happened on the first run of this runbook, 22 Aug, and cost a
> redeploy. `supabase/config.toml` now declares `verify_jwt = false` so the flag is belt-and-braces
> rather than the only thing standing between you and an outage.

**What changes the instant this lands:**

| | |
|---|---|
| Critical #1 | Revocations take effect immediately. Sign-in stops writing `revoked_at: null`, so a revoked seat stays revoked |
| Critical #5 | Google tokens validated against a client-ID allowlist |
| Boundary gate | Every command checked against the contract before it reaches the database |
| Seat vocabulary | 8 → 12. **This is what lets Naleez sign in at all** |
| Timeouts | Every database call bounded at 10s, so a hung connection is a clean 401 rather than a frozen app |

---

## STEP 2 — Verify. This is the step that matters most.

Because recovery is forward-only, a problem you find in 30 seconds is a non-event and a problem you
find tomorrow is an outage.

**2a. Boundary check — automated, already written:**

```powershell
cd D:\!starq\the foundation engine; .\scripts\check-cloud-api.ps1
```

Expect `PASS cloud API boundary check`. It proves health is ready, an unauthenticated `/api/me`
returns 401, an approved origin gets credentialed CORS, an unapproved origin gets 403, and the
security headers are present.

**2b. All three people sign in. Do not skip anyone, and do not do it for them.**

| Person | What must happen | Why this person |
|---|---|---|
| **Naleez** | **Signs in successfully** | He *cannot sign in at all today*. If he still cannot, the widening did not take and you should stop before step 3 |
| **Nashid** | Signs in, and his seat list includes `receiver` | `receiver` is the seat migration 0011 is about to start requiring. **If it is missing, do not run step 3** |
| **You** | Sign in, and your seat list includes `ledger_poster` | It is being silently dropped today |

Check the seat list by tapping the seat badge in the app — the switcher lists every seat held.

**2c. One real command end to end.** Take an intake at the counter seat. It should work exactly as
it did this morning. Nothing in this deploy changes the counter flow.

### Abort conditions — stop and do not proceed to step 3

- Naleez still cannot sign in
- `receiver` is absent from Nashid's seat list
- `check-cloud-api.ps1` fails on anything other than a network blip
- Anyone reports the app hanging rather than either working or bouncing to the login screen

**If you abort:** you are simply in option A with 0011 unpushed. Nothing is broken, criticals #1 and
#5 are closed, and #2 waits. Tell me what you saw and I will fix forward.

---

## STEP 3 — Push migration 0011

Only after step 2 passes cleanly.

```powershell
cd D:\!starq\the foundation engine; supabase db push --linked
```

This applies **only** `202608220011_wire_purchase_seat_matrix.sql` — 0008, 0009 and 0010 went live
this afternoon. It closes **audit critical #2**.

The migration refuses to run if 0010 is missing, and it carries a self-test that rolls itself back.
Watch for `SELF-TEST PASSED: purchase seat matrix is wired into api_garage_command`.

**What tightens.** Nothing widens:

```
need     seven named seats     (was: any held seat)   TIGHTENS
quote    quartermaster         (was: any held seat)   TIGHTENS
receive  receiver              (was: any held seat)   TIGHTENS
award    financial_controller  unchanged
match    financial_controller  unchanged
pay      payer                 unchanged
```

---

## STEP 4 — Verify procurement, because that is what step 3 touched

1. **Raise a `need`** from the counter seat. Should work.
2. **Try to `quote` from a seat that is not `quartermaster`.** Should be **refused** with
   `acting_seat_not_legal_for_command`. **A refusal here is the control working — it is the proof
   the whole day was for.**
3. **Quote as `quartermaster`.** Should work.
4. **Receive as `receiver`** (Nashid switches seat to do this). Should work.

If 4 fails, that is the ordering failure this runbook exists to prevent, and the fix is forward:
tell me and I will patch within minutes.

---

## After it is done

Reply to `DEC-063` in the Portal or Nexus with what you chose and what you saw. I will record the
outcome, close SERP-115, and mark criticals #1, #2 and #5 with the evidence — **by layer, and only
where a test proves it**, not by assertion. The lesson of today is that "closed" means nothing
without naming which layer it closed on.

**Cleanup queued, not urgent:** update `scripts\check-cloud-schema.ps1` from 8 migrations to 11.

---

## What is deliberately NOT in this runbook

- **A rollback command for the Edge.** There is no honest one. Recovery is forward. Saying otherwise
  would hand you a command that fails at the worst possible moment.
- **Any change to the counter flow**, so if the shop behaves differently tomorrow, it is not this.
- **The open posture question:** whether a transient database blip should destroy a session at all.
  The cookie is HMAC-signed and independently authentic, and the code currently treats *"cannot
  confirm authority right now"* and *"this session is forged"* as the same event. Not a blocker.
  Worth answering, and better before the deploy than after.
