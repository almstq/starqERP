# SERP-382: Founder Disposition Pack — Aikido SAST Findings 2–6

**Task ID**: SERP-382  
**Title**: Independent Assessment of Five (5) Aikido High SAST "File Inclusion" Findings  
**Date**: 2026-09-03  
**Evaluator**: @antigravity (Independent L1 Assessment per Founder Routing seq #458)  
**Target Repository**: `starqERP` (Backend / Tooling)  
**Governing Governance**: Vulnerability Management Framework (SERP-226), DEC-072, DEC-103  
**Authority Boundary**: *Evidence and recommendations only. No disposition changes executed in Aikido console; no risk accepted by agent.*

---

## 1. Executive Summary & Recommendation Matrix

Aikido SAST reported six (6) High-severity findings for the `starqERP` repository. Finding 1 (unpinned third-party GitHub Action in `.github/workflows/ci.yml`) is an infrastructure pinning defect assigned to Codex.

**Findings 2 through 6** are all rule `{JS}` *"Potential file inclusion attack via reading file"* with a static risk score of 75, upgraded by Aikido's automated heuristics to "likely exploitable."

Our independent, source-level audit confirms that **all five (5) findings are classic Static Application Security Testing (SAST) FALSE POSITIVES**. They exist exclusively in offline developer, build, and CI verification scripts (`scripts/check-reality.mjs` and `scripts/generate-release-manifest.mjs`). None of these scripts are deployed in production, none accept network requests, and none take untrusted user input.

| Finding | Tool ID / Rule | File & Line | Claimed Vulnerability | Reachable in Production? | Independent Recommendation | Confidence |
|---|---|---|---|:---:|:---:|:---:|
| **Finding 2** | `{JS}` File Inclusion | `scripts/check-reality.mjs:130` | LFI via `path.join(root, ...)` | ❌ NO (Offline CI) | **`FALSE_POSITIVE`** | 99% |
| **Finding 3** | `{JS}` File Inclusion | `scripts/check-reality.mjs:136` | LFI via `fs.readFileSync(configPath)` | ❌ NO (Offline CI) | **`FALSE_POSITIVE`** | 99% |
| **Finding 4** | `{JS}` File Inclusion | `scripts/check-reality.mjs:173` | LFI via `fs.readFileSync(authPath)` | ❌ NO (Offline CI) | **`FALSE_POSITIVE`** | 99% |
| **Finding 5** | `{JS}` File Inclusion | `scripts/check-reality.mjs:66` | LFI via `fs.readFileSync(clientPath)` | ❌ NO (Offline CI) | **`FALSE_POSITIVE`** | 99% |
| **Finding 6** | `{JS}` File Inclusion | `scripts/generate-release-manifest.mjs:13` | LFI via `fs.readFileSync(filepath)` | ❌ NO (Build Script) | **`FALSE_POSITIVE`** | 99% |

---

## 2. Detailed Technical Assessment per Finding

### Finding 2: `scripts/check-reality.mjs` (Line 130)
- **Tool Rule**: `{JS}` Potential file inclusion attack via reading file (High, Risk Score: 75)
- **Target Code**:
  ```javascript
  // scripts/check-reality.mjs:128-130
  export function checkGatewayDeclared(opts = {}) {
    const root = opts.root || ROOT;
    const configPath = path.join(root, 'supabase', 'config.toml');
  ```
- **What Aikido Claims**: The scanner flagged `path.join(root, ...)` because `root` is derived from parameter `opts.root || ROOT`. The scanner's automated AI heuristic assumed `opts` could be controlled by an external HTTP attacker to traverse directories.
- **Actual Code / Path Evidence**:
  - `check-reality.mjs` is an internal test and verification script executed exclusively via Node.js CLI during CI: `node scripts/check-reality.mjs`.
  - When executed from CLI, `opts` defaults to `{}` and `root` resolves to `ROOT = path.join(path.dirname(__filename), '..')` (the local repository root).
  - The parameter `opts` exists solely for local unit test injection (`tests/check_reality_mutation.test.mjs`) to test mutation failure paths without touching disk.
- **Reachability**: **UNREACHABLE**. Not exposed over HTTP, RPC, WebSocket, or any network interface.
- **Recommendation**: **`FALSE_POSITIVE`**
- **Confidence**: **99%**
- **Consequence if Wrongly Dismissed**: Exactly zero in production. Even on the local machine, `configPath` is hardcoded to `'supabase', 'config.toml'`. A user capable of invoking `check-reality.mjs` already has direct filesystem shell access.

---

### Finding 3: `scripts/check-reality.mjs` (Line 136)
- **Tool Rule**: `{JS}` Potential file inclusion attack via reading file (High, Risk Score: 75)
- **Target Code**:
  ```javascript
  // scripts/check-reality.mjs:136
  const toml = opts.configContent || fs.readFileSync(configPath, 'utf8');
  ```
- **What Aikido Claims**: Calling `fs.readFileSync` on non-literal variable `configPath` allows an attacker to read arbitrary files from the host.
- **Actual Code / Path Evidence**:
  - Direct consumer of `configPath` defined at line 130.
  - The sole purpose of this call is reading the repository's own `supabase/config.toml` to assert `verify_jwt = false` is pinned in version control, preventing deployment gateway lockouts.
- **Reachability**: **UNREACHABLE**.
- **Recommendation**: **`FALSE_POSITIVE`**
- **Confidence**: **99%**
- **Consequence if Wrongly Dismissed**: None. Identical to Finding 2.

---

### Finding 4: `scripts/check-reality.mjs` (Line 173)
- **Tool Rule**: `{JS}` Potential file inclusion attack via reading file (High, Risk Score: 75)
- **Target Code**:
  ```javascript
  // scripts/check-reality.mjs:168, 173
  const authPath = path.join(legacyEngine, 'auth.py');
  ...
  const py = opts.authContent || fs.readFileSync(authPath, 'utf8');
  ```
- **What Aikido Claims**: The variable `authPath` depends on `legacyEngine = opts.legacyEngine || DEFAULT_LEGACY_ENGINE`, which Aikido flags as controllable input.
- **Actual Code / Path Evidence**:
  - `checkPortalContractDrift` verifies that the legacy Python engine seat dictionary matches the TypeScript contract.
  - Path resolves to `ROOT/legacy/engine/auth.py`.
  - Executed only in local CI runs.
- **Reachability**: **UNREACHABLE**.
- **Recommendation**: **`FALSE_POSITIVE`**
- **Confidence**: **99%**
- **Consequence if Wrongly Dismissed**: None.

---

### Finding 5: `scripts/check-reality.mjs` (Line 66)
- **Tool Rule**: `{JS}` Potential file inclusion attack via reading file (High, Risk Score: 75)
- **Target Code**:
  ```javascript
  // scripts/check-reality.mjs:63, 66
  const clientPath = path.join(legacyEngine, 'client', 'api_client.dart');
  ...
  const client = opts.clientContent || fs.readFileSync(clientPath, 'utf8');
  ```
- **What Aikido Claims**: Arbitrary file read via variable `clientPath`.
- **Actual Code / Path Evidence**:
  - Reads `legacy/engine/client/api_client.dart` to assert required HTTP headers are sent by legacy clients.
  - Static path within repository root.
- **Reachability**: **UNREACHABLE**.
- **Recommendation**: **`FALSE_POSITIVE`**
- **Confidence**: **99%**
- **Consequence if Wrongly Dismissed**: None.

---

### Finding 6: `scripts/generate-release-manifest.mjs` (Line 13)
- **Tool Rule**: `{JS}` Potential file inclusion attack via reading file (High, Risk Score: 75)
- **Target Code**:
  ```javascript
  // scripts/generate-release-manifest.mjs:12-14
  function hashFile(filepath) {
    const content = fs.readFileSync(filepath);
  ```
- **What Aikido Claims**: Helper function `hashFile(filepath)` reads whatever path is passed to it, enabling arbitrary file disclosure.
- **Actual Code / Path Evidence**:
  - `generate-release-manifest.mjs` is an offline release build utility. It takes zero command-line arguments and accepts no user input.
  - `hashFile` is invoked exclusively on hardcoded, internal repository paths:
    ```javascript
    artifacts.push(hashFile(path.join(migrationsDir, f)));       // supabase/migrations/*.sql
    artifacts.push(hashFile(path.join(ROOT, 'contracts', 'commands.ts')));
    artifacts.push(hashFile(path.join(ROOT, 'docs', 'PRIVACY.md')));
    artifacts.push(hashFile(path.join(ROOT, 'docs', 'TERMS.md')));
    artifacts.push(hashFile(path.join(ROOT, 'docs', 'SUPPORT.md')));
    artifacts.push(hashFile(path.join(ROOT, 'docs', 'DPA.md')));
    ```
- **Reachability**: **UNREACHABLE**.
- **Recommendation**: **`FALSE_POSITIVE`**
- **Confidence**: **99%**
- **Consequence if Wrongly Dismissed**: None. Only internal static assets are hashed.

---

## 3. Threat Model & Architectural Analysis

### Why Did Aikido Flag These as "High"?
1. **Source Pattern**: The SAST engine searches for the AST pattern `fs.readFileSync($EXPR)` where `$EXPR` is not a string literal.
2. **AI Taint Heuristic**: In modern SAST tools (Aikido / Semgrep), an AI classifier reviews function signatures. Because `checkGatewayDeclared(opts)` and `hashFile(filepath)` take parameters, the AI classifier assumes they could be invoked by an untrusted web controller (e.g. Express route handler) and elevates the severity to "Likely Exploitable."
3. **Repository Context**: In reality, `starqERP`'s server-side runtime is Supabase Edge Functions (Deno) and PostgreSQL RLS. The files in `scripts/*.mjs` are build-time Node.js scripts executed only in GitHub Actions runners and developer workstations.

### Is Production at Risk?
**Zero Risk**. An attacker would need remote code execution on the developer's laptop or the GitHub Actions runner to influence these file paths, at which point file read vulnerabilities are completely redundant.

---

## 4. Founder Decision Card

```markdown
┌────────────────────────────────────────────────────────────────────────────┐
│                    SERP-382 FOUNDER DECISION CARD                          │
│               Aikido SAST High Findings 2–6 (File Inclusion)               │
├────────────────────────────────────────────────────────────────────────────┤
│ Finding 2: check-reality.mjs:130 (supabase/config.toml)  → FALSE_POSITIVE  │
│ Finding 3: check-reality.mjs:136 (supabase/config.toml)  → FALSE_POSITIVE  │
│ Finding 4: check-reality.mjs:173 (legacy/engine/auth.py) → FALSE_POSITIVE  │
│ Finding 5: check-reality.mjs:66  (api_client.dart)       → FALSE_POSITIVE  │
│ Finding 6: generate-release-manifest.mjs:13 (hashFile)   → FALSE_POSITIVE  │
├────────────────────────────────────────────────────────────────────────────┤
│ RATIONALE: All 5 findings reside in offline developer/CI verification      │
│ scripts. None are web-accessible, none are deployed to production, and all │
│ paths are hardcoded internal repository artifacts.                         │
├────────────────────────────────────────────────────────────────────────────┤
│ RECOMMENDED FOUNDER ACTION IN AIKIDO CONSOLE:                              │
│ Mark Findings 2, 3, 4, 5, and 6 as "False Positive" with reason:           │
│ "Offline CI/build verification script; no external input or runtime        │
│ web exposure."                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```
