# SERP-226 Batch 1 Remediation Record — High Findings

**Remediation owner:** Codex  
**Founder triage owner:** Founder — interim  
**Founder risk-acceptance authority:** Founder — interim  
**Status:** Remediated pending independent review and Aikido re-scan; not self-accepted or closed.

## Authorized changes

| Aikido group / finding IDs | Disposition | Change | Evidence |
|---|---|---|---|
| `42969671` / `577932764` | Fix | Pinned `denoland/setup-deno` from mutable `v2` to immutable signed v2.0.5 revision `22d081ff2d3a40755e97629de92e3bcbfa7cf2ed`. | `.github/workflows/ci.yml`; commit recorded below |
| `42969674` / open IDs `577932776–577932790`, `577932792` | Fix | Added approved-root containment checks before repository/tooling file reads in `check-reality.mjs`, `generate-release-manifest.mjs`, and `scan_unreferenced.cjs`. Existing fixed-path behavior and test-content injection paths are preserved. | `scripts/check-reality.mjs`; `scripts/generate-release-manifest.mjs`; `scripts/scan_unreferenced.cjs`; commit recorded below |

The open ID range above is expanded explicitly as: `577932776, 577932777, 577932778, 577932779, 577932780, 577932781, 577932782, 577932783, 577932784, 577932785, 577932786, 577932787, 577932788, 577932789, 577932790, 577932792`.

## Ignored subissues not classified

No explicit Aikido false-positive rationale was present in the supplied export; `ignored_by: auto` is not sufficient evidence. The following remain surfaced for Founder ruling and were not silently changed: `577932791, 577932793, 577932794, 577932795, 577932796` within group `42969674`.

## Verification

- `node --check scripts/check-reality.mjs` — PASS.
- `node --check scripts/generate-release-manifest.mjs` — PASS.
- `node --check scripts/scan_unreferenced.cjs` — PASS.
- `node --test tests/check_reality_mutation.test.mjs` — PASS, 10/10 mutation cases.
- `node scripts/scan_unreferenced.cjs` — PASS, completed inventory (2 unreferenced files reported; informational output).
- `node scripts/lint-design-tokens.mjs --report` — PASS, report-only mode.

## Commit

Remediation commit: `8f1a7525c0ce859079bae1de8f0c7b910e1cd88d`.

Aikido re-scan evidence and independent acceptance remain outstanding.
