# Usability log

**Established:** 30 August 2026 (SERP-257) · **Append-only** · Reviewed weekly

> **Write it in the moment.** Reconstructed friction is systematically wrong in one direction: the
> annoyance is forgotten once the workaround becomes habit, so a log written afterwards fills with
> the problems that were never solved and loses every problem that was silently absorbed. **The
> absorbed ones are the ones costing time every day.**

---

## Who writes here

**Only the humans doing the work.** No agent writes entries in this file — that is an explicit
condition of SERP-257, and it is not bureaucratic: an agent writing entries would produce a log of
what an agent *imagines* is annoying, which is exactly the reconstructed-friction problem in a
different costume.

Elder created this file and its append command. Elder does not add rows.

---

## How to add an entry

```bash
node scripts/log-usability.mjs "what you were doing" "what happened" 5
```

Three arguments: the task attempted, what happened, and rough minutes lost. The timestamp is added
for you. That is the whole ceremony, deliberately — a log that takes effort to write is a log that
stops being written on the day it would have been most useful.

Or append by hand in the same shape. The command exists to remove excuses, not to be mandatory.

---

## What belongs here, and what does not

**Here:** it was slow · it needed a second attempt · the label did not mean what it looked like ·
you could not find where to do the thing · you got it wrong the first time and had to redo it.

**Not here — use the [workaround register](./WORKAROUND_REGISTER.md):** the system does not do this
at all and you did it another way. That is a different and more dangerous animal, and it has its own
rules, including that anything touching a financial figure is raised as P0 immediately.

**An empty log means the pilot was not really used.** It does not mean nothing was wrong. That is a
Phase 5 exit-gate input and it gets challenged.

---

## Review

Weekly. Every entry either becomes a board task or is explicitly closed as accepted — with the
reason it is acceptable. Nothing is left in an unreviewed middle, because an unreviewed entry
teaches people the log is a suggestion box.

---

## Entries

<!-- Newest at the bottom. Appended by scripts/log-usability.mjs or by hand. -->
<!-- Format: YYYY-MM-DD HH:MM | who | task attempted | what happened | ~minutes -->

| When | Who | Task attempted | What happened | ~min |
|---|---|---|---|---|
