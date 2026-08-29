# Club Ignition Ops data

Append-only workflow log. **Not the ledger.**

- `events.jsonl` — one JSON object per line (created on first event)
- `state.json` — job counters and derived job cards (created on first load)

See `../ops.py`, `../AUTH_DESIGN.md`, and `../../scm/ignition-ink-ops/SB-01_STARQBOOKS-VERTICAL-SLICE.md`.
Sessions: `sessions.json` (gitignored). Events carry `actor_email` + `actor_role`.
