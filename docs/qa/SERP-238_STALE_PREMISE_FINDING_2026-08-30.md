# SERP-238 — not executed. Its safety premise is stale and its acceptance is unsatisfiable.

**Date:** 30 August 2026 · **By:** Elder
**Action taken:** **none.** Nothing removed, moved or retired.
**Why:** the task is written around a live system that was closed the day before, and one of its
acceptance criteria cannot be met as written.

---

## 1. What the task says, and why it says it so forcefully

SERP-238 opens: *"READ THE DISTINCTION BEFORE TOUCHING ANYTHING. The Python portal on :51810 KEEPS
RUNNING and remains the authoritative posting system for the live books… Confusing those two would
take the company's books offline."*

That framing is correct and well-written **for the world it was written in**. It is why I checked
before acting rather than after.

---

## 2. Three checks, three contradictions

| Claim in the task | Verified state |
|---|---|
| The Python portal on `:51810` **keeps running** | **Not running.** Nothing is listening on that port |
| It **remains the authoritative posting system** | `CLAUDE.md:153` — ***"CLOSED 29 Aug 2026. The Python shell is frozen, unrunning, and absorbed as reference only. Do not start it, and do not report :51810 being down as a fault."*** |
| **DEC-079 governs and has not moved** | `DEC-079` status is **`closed`** |

The task was written before the 29 August closure. It has not been re-scoped since.

**The acceptance criterion *"The Python portal on :51810 is untouched and still serving; verified
running after the change"* is therefore impossible to satisfy** — not because the change would break
it, but because the portal is deliberately not running and the standing instruction is not to start
it.

---

## 3. A documentation conflict worth fixing separately

`CLAUDE.md` contradicts itself on the same subject:

- **line 153** — Starq Portal (:51810), *"CLOSED 29 Aug 2026… frozen, unrunning"*
- **line 389** — Starq Portal, *"**shipped alpha**, running on :51810"*

Two lines in the authority file, one saying closed and one saying running. **This is the same failure
class as the `.bak` beside a live file that the 22 August TGST adjudication moved to `_recyclebin`:
a search returns both the corrected and uncorrected text with nothing marking which is which.**
Anyone grepping `CLAUDE.md` for the portal's status gets a coin flip.

---

## 4. What I found while checking, which changes the task's size

**The starqERP client has no legacy engine traces at all.** A search of `web/src` for `51810`,
`legacy/engine` and foundation-engine references returns **zero matches**.

So the "old client components, routes, helpers and types" the task describes removing **appear
already to be gone from the application**. What remains is `starqERP/legacy/` — 1.8 MB of Python:
`auth.py`, `accounts.csv`, `assets/`, `__pycache__/` — which is the **engine itself**, not client
residue, and which `CLAUDE.md:153` explicitly designates as *"absorbed as reference only."*

**That inverts the task.** It was scoped as "remove client traces, do not touch the engine." The
client traces are already absent; what is left is the engine, which the task says not to touch.

---

## 5. Why I stopped rather than proceeding

Three reasons, in order of weight:

1. **The task's own safety warning is about the live books.** When a brief opens by saying a mistake
   takes the company's books offline, and its stated premise turns out to be a day out of date, the
   correct response is to stop and report — not to reason my way to which half is still true.
2. **`__pycache__` and `accounts.csv` are in there.** `accounts.csv` in an engine that until
   recently held the live books is not something to sweep into `_recyclebin` on my own judgement,
   even under the never-delete rule.
3. **The acceptance cannot be met**, so any "completion" would be a claim I could not evidence —
   which is the exact failure this project keeps finding.

---

## 6. What the founder needs to decide

1. **Re-scope or close SERP-238.** Its client-trace half looks already done; its acceptance
   references a service that is closed. If the intent now is *"retire `starqERP/legacy/` to
   `_recyclebin`"*, that is a different task with different risk and should say so.
2. **Fix the `CLAUDE.md` contradiction** — line 153 or line 389 is wrong, and right now a reader
   gets whichever they find first.
3. **Confirm what `legacy/accounts.csv` is.** If it holds real account data from the period the
   Python engine was authoritative, it is records, not residue, and belongs in the vault rather than
   in a product repository.

**Nothing has been changed. This is a finding.**
