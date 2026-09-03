# SERP-226 open-ID location map — 2026-09-02

## Scope and evidence

The 30 IDs below are the IDs absent from the aligned repository export for Aikido repository `2978093` (`starqERP`, branch `serp-226-batch1-remediation`). The fresh account-wide export reports all 30 as `open` and identifies 29 as belonging to Aikido repository `2963718` (`starqERP`, branch `main`). The remaining SCM finding has no repository ID, branch, revision, file, or path in Aikido's machine-readable record.

- Account-wide issue export: `D:/StarqTech/agent-comms/evidence/SERP-226/aikido-issues-account-all-20260902_012639.json`
- Repository location export: `D:/StarqTech/agent-comms/evidence/SERP-226/aikido-repositories-starqERP-location-20260902_013113.json`
- Repository detail export: `D:/StarqTech/agent-comms/evidence/SERP-226/aikido-repository-details-location-20260902_013113.json`

Aikido exposes repository branch and `last_scanned_at`, but does not expose the exact commit SHA in these repository records. The current GitHub `main` ref is `ce22028cc4f10cee6b68d8ff5db10395893e5734`; that is recorded only as the current ref, not asserted as the revision used for the historical main-branch findings. The aligned SERP-226 branch ref is `73b3089e174f8f4807a2086d57448ed61e85701f`.

## Grouped explanation

| Aikido group | Root cause | IDs | Repository / branch | Location class |
|---:|---|---|---|---|
| 42969575 | Leaked secret | 577932340 | 2963718 / main | protected main |
| 42969576 | Leaked secret | 577932341 | 2963718 / main | protected main |
| 42969577 | Leaked secret | 577932343 | 2963718 / main | protected main |
| 42969587 | GitHub Actions checkout persists credentials | 577932380 | 2963718 / main | protected main |
| 42969671 | GitHub Actions third-party action not pinned | 577932764 | 2963718 / main | protected main |
| 42969673 | Python dangerous `assert` | 577932766 | 2963718 / main | protected main |
| 42969672 | Potential file inclusion / LFI | 577932767, 577932769, 577932774 | 2963718 / main | protected main |
| 42969674 | Potential generic path traversal / file inclusion | 577932776–577932790, 577932792 | 2963718 / main | protected main |
| 43362181 | Open-source dependency finding | 602250085, 602250272, 602250473, 602250707 | 2963718 / main | protected main |
| 42969787 | SCM security finding; Aikido supplied no repository/path metadata | 577933697 | not exposed | unknown |

## Per-ID machine location map

| ID | Repository ID | Branch | Revision exposed? | File/path | Group/root cause | Class |
|---:|---:|---|---|---|---|---|
| 577932340 | 2963718 | main | no | `web/src/data/mockData.ts` | 42969575 / leaked secret | protected main |
| 577932341 | 2963718 | main | no | `tests/contract/commands_test.ts` | 42969576 / leaked secret | protected main |
| 577932343 | 2963718 | main | no | `web/src/test/serp_033_security_abuse_suite.test.tsx` | 42969577 / leaked secret | protected main |
| 577932380 | 2963718 | main | no | `.github/workflows/ci.yml` | 42969587 / checkout credential persistence | protected main |
| 577932764 | 2963718 | main | no | `.github/workflows/ci.yml` | 42969671 / unpinned action | protected main |
| 577932766 | 2963718 | main | no | `legacy/engine/auth.py` | 42969673 / dangerous assert | protected main |
| 577932767 | 2963718 | main | no | `legacy/engine/books.py` | 42969672 / LFI | protected main |
| 577932769 | 2963718 | main | no | `legacy/engine/masters.py` | 42969672 / LFI | protected main |
| 577932774 | 2963718 | main | no | `legacy/engine/serve.py` | 42969672 / LFI | protected main |
| 577932776 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932777 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932778 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932779 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932780 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932781 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932782 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932783 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932784 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932785 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932786 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932787 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932788 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932789 | 2963718 | main | no | `scripts/check-reality.mjs` | 42969674 / path traversal | protected main |
| 577932790 | 2963718 | main | no | `scripts/generate-release-manifest.mjs` | 42969674 / path traversal | protected main |
| 577932792 | 2963718 | main | no | `scripts/scan_unreferenced.cjs` | 42969674 / path traversal | protected main |
| 577933697 | not supplied | not supplied | not supplied | not supplied | 42969787 / SCM security | unknown |
| 602250085 | 2963718 | main | no | `web/bun.lock` | 43362181 / open source | protected main |
| 602250272 | 2963718 | main | no | `web/bun.lock` | 43362181 / open source | protected main |
| 602250473 | 2963718 | main | no | `web/package-lock.json` | 43362181 / open source | protected main |
| 602250707 | 2963718 | main | no | `web/package-lock.json` | 43362181 / open source | protected main |

## Conclusion

`current SERP-226 remediation branch=0`; `protected main=29`; `other persistent branch=0`; `historical/stale=0` by explicit repository metadata; `other repository=0`; `unknown=1`. The 30 findings are absent from the aligned branch export because 29 are attached to Aikido's separate `main` repository record and one has no repository metadata. This map does not infer that any are fixed or cleared and does not authorize remediation.
