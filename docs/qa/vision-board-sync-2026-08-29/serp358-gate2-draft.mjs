#!/usr/bin/env node
// SERP-358 Gate 2 probe — draft (Gate script framework)
// Model used: thinkingmachines/inkling:free (Vision's current model)
// Independent verification — does NOT rely on Codex/AG outputs.
// Per Elder's directive: raw output, model flagged, Elder spot-check (not self-close, DEC-072).

const rules = `
SERP-358 GATE 2 — PROBE CHECKLIST (draft)
-----------------------------------------
1. Source file: D:/StarqTech/starqERP/scripts/serp358-gate2.mjs
2. Verifies: build-output integrity (SERP-360 artifact cross-check), RLS role drop (re-run variant of SERP-300 assertion), bus cursor state
3. Raw-output only; any exception = FAIL line with message
4. Model: thinkingmachines/inkling:free (Vision session); Elder spot-check applies
`;
console.log(rules.trim());
console.log("GATE 2 PROBE — model=inkling:free — draft complete — NOT SELF-CLOSING (DEC-072) — awaiting Elder review + Gate 2 live execution");
