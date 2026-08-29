# RESUME HERE — 22 Aug 2026, ~23:00

**You are one paste away from being inside the app.** Everything else is done and deployed.

## The one thing

```powershell
Get-Content 'D:\StarqTech\_secrets\starqBooks-allowlist.json' -Raw | Set-Clipboard
```

Then **Supabase Dashboard → Project Settings → Edge Functions → Secrets →
`STARQBOOKS_ALLOWLIST_JSON` → paste → Save.**

Then serve the web app and sign in:

```powershell
cd D:\!starq\starqBooks\starq-ops-app\build\web; python -m http.server 8080
```

Open `http://localhost:8080`, hard reload, **Sign in**.

**What you are looking for:** tap the seat badge, top right. Five seats, and one of them is
**`ledger_poster`**. That is the proof — it is one of the four seats the old 8-seat build
silently dropped, so seeing it means the widening took, and the same code path will hand the MD
`receiver` when he signs in.

### Why it is a dashboard paste and not a command

Elder mangled this secret twice — once interpolating 2KB of JSON into a double-quoted PowerShell
string (PowerShell ate the inner quotes), once via a dotenv file whose escaping did not survive.
The file on disk is already valid JSON. It needs **no transformation at all**, and every layer
added between the file and the Edge is a layer that corrupted it. The dashboard textarea has
zero layers.

## State as of tonight

**Deployed and working:** Edge Function live with audit criticals #1 and #5 fixed, seat
vocabulary widened 8 → 12, every DB call bounded at 10s, and the audit log now recording real
error codes. `check-cloud-api.ps1` returns PASS. The login screen renders, the Google GIS button
works, Google accepts the sign-in.

**The only thing broken** is that the allowlist secret on the Edge is corrupt JSON, so
`allowlist()` throws before anything else can happen. Hence the paste.

## When you are in

Run the walkaround, then two things are waiting and both are decisions, not typing:

1. **`SERP-136` — migration 0011 is blocked and must not be pushed.** It makes `quartermaster`
   the only seat that may `quote`, and nobody in the allowlist holds it. Either grant the seat or
   change the matrix. Elder wrote that matrix, AG approved it, and both checked it against the
   contract and never against who exists.
2. **`DEC-063`** — the deploy gate. Half of it is done: the Edge shipped. Record the outcome and
   answer the 0011 half once #1 is settled.

## Also ready, untouched

**Vercel prep is committed** (`starq-ops-app/vercel.json`, `vercel-build.sh`, `VERCEL.md`). It
needs a `git push` first — the GitHub remote is ~33 commits behind. Do that fresh, not tired:
two files under `ops/` want a look before anything goes up, even to a private repo.

## The debug log

Ten cards on the STARQ ERP board, lane **Debug 22 Aug** (`SERP-130`–`SERP-139`). Eight closed,
two open. Each carries symptom, cause, whose error, and fix. Four of the nine defects were
Elder's, and they are labelled as such.

The one to read if you read only one is **`SERP-137`**: 44 contract tests and 38 Python tests
were green through every single defect tonight. They verify the contract against itself, and
every failure lived in the join between the contract and the world — allowlists, deploy flags,
Console configuration, package capabilities, shell quoting. It proposes four cheap conformance
checks that read *configured* state instead of *declared* state.

And **`SERP-138`** is the one that paid for itself: the audit log had been storing the sanitized
error code, destroying the real reason at the only point that could have kept it. Fixed at
~22:15, and it named the next defect thirty seconds after deploying — a defect that had already
cost an hour of guessing.
