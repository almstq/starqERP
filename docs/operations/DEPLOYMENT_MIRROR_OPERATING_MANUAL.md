# Personal Deployment Mirror — Operating Manual

**Date:** 2026-11-07  
**Status:** Founder-approved dual-repository deployment architecture (Room #18550, #18551, #18553).

---

## 1. Architecture & Authority Boundaries

1. **PRIMARY — Sole Engineering Authority:**
   - **Repository:** `Starq-Technologies-Pvt-Ltd/starqERP` (repo id `1346424349`, private, default `main`).
   - **Role:** Sole source of truth for all code, migrations, PRs, CI gates, and reviews.
   - **Engineering remotes:** All local development and agent worktrees point `origin` exclusively to this repository.

2. **SECONDARY — Personal Deployment Mirror:**
   - **Repository:** `almstq/starqERP` (repo id `R_kgDOVmb4LA`, private, default `main`).
   - **Role:** Dedicated deployment mirror targeted by Vercel (`starq-erp`).
   - **Governance:** Strictly NO manual development, NO direct commits, NO PRs, and NO branches on the mirror.

3. **Data Flow (Strictly One-Way):**
   - `Starq-Technologies-Pvt-Ltd/starqERP` (`main`) $\longrightarrow$ `almstq/starqERP` (`main`).
   - Synchronization is exclusively **one-way**. Reverse synchronization is architecturally prohibited and credential-isolated.

---

## 2. Synchronization Mechanism

- **Workflow File:** `.github/workflows/deployment-mirror-sync.yml` in the PRIMARY repository.
- **Triggers:**
  - `push` to `main` (automatically executes after any PR merge into `main`).
  - `workflow_dispatch` (manual execution via GitHub CLI or web UI).
- **Behavior:**
  - Performs full checkout of PRIMARY `main`.
  - Configures SSH key using secret `MIRROR_DEPLOY_KEY`.
  - Executes `git push --force git@github.com:almstq/starqERP.git HEAD:refs/heads/main`.
  - Verifies exact SHA equality (`PRIMARY_SHA == MIRROR_SHA`) via `git ls-remote`.

---

## 3. Credential Isolation & Security Guardrails

- **Host-Key Security:** Pinned official GitHub ed25519 host key (`SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`) with strict host-key verification, eliminating unpinned runtime `ssh-keyscan` and guarding against network MITM.
- **Credential Boundary:** Repository-scoped write deploy key (id `169117482`) on `almstq/starqERP`, private key in Actions secret `MIRROR_DEPLOY_KEY` on `Starq-Technologies-Pvt-Ltd/starqERP`. Secret passed via isolated environment variable (`DEPLOY_KEY`), preventing multiline bash interpolation.
- **Zero In-Tree Secrets:** No private keys or tokens are stored in source code or Git history.
- **Reverse Flow Prevention:**
  - The deploy key cannot write to `Starq-Technologies-Pvt-Ltd/starqERP`.
  - The workflow contains an explicit repository identity gate: `if: github.repository == 'Starq-Technologies-Pvt-Ltd/starqERP'`, ensuring it no-ops if cloned or executed in any other context.

---

## 4. Verification & Health Monitoring

To verify SHA parity across primary and mirror:

```bash
# Verify PRIMARY main SHA
git ls-remote https://github.com/Starq-Technologies-Pvt-Ltd/starqERP.git refs/heads/main

# Verify MIRROR main SHA
git ls-remote https://github.com/almstq/starqERP.git refs/heads/main
```

Both outputs must produce the exact same commit hash.

---

## 5. Permanent Operating Model (Founder-ratified 2026-11-07)

The dual-repository arrangement is the **permanent** StarqERP engineering operating model. All studios and builders — Cloudroom, Herdr, Codex, Claude, WSL Claude, Antigravity and any other assigned builder — operate under these rules:

1. **PRIMARY = `Starq-Technologies-Pvt-Ltd/starqERP`** is the single engineering authority. Every studio's primary Git `origin` points here.
2. **Development writes = PRIMARY only.** All engineering branches, PRs, reviews, tests and Founder-approved merges happen in PRIMARY.
3. **DEPLOYMENT MIRROR = `almstq/starqERP`** receives PRIMARY `main` automatically via the PR #198 synchronization workflow. It is **deployment-only**.
4. The mirror must **never** become a separate development authority or receive independent engineering pushes.
5. **Deployment source = the mirror.** Vercel (`starq-erp`) connects to `almstq/starqERP`, Production Branch `main`, application root preserved.
6. **Synchronization = PRIMARY `main` → mirror `main`** only. Every successful PRIMARY-`main` merge must eventually leave both repositories at the **same immutable `main` SHA**.
7. **Any sync failure or SHA mismatch is a deployment-integration blocker** — surface it to Command immediately. Do **not** reverse-sync or manually alter the mirror.

**Verification authority:** independent verification is performed by **Vision through Command**; **Founder merge approval remains mandatory** for every PRIMARY merge. No automatic merges.

---

## 6. Live-Sync Evidence — Stage A (2026-11-07)

First end-to-end proof that the workflow (not merely PR-branch CI) synchronizes PRIMARY → mirror:

- **Trigger:** merge of PR #198 into PRIMARY `main`. Merge SHA / PRIMARY `main` HEAD = `d9c58546e3fe2d5de76c5ecedac4c09026965995` (merged 2026-11-07T18:11:53Z).
- **Workflow run:** `deployment-mirror-sync` run **`42400063435`** (event `push`, head `d9c58546…`) — conclusion **`success`**.
- **Mirror result:** `almstq/starqERP` `main` = `d9c58546e3fe2d5de76c5ecedac4c09026965995` (`git ls-remote`).
- **Parity:** PRIMARY `main` SHA == MIRROR `main` SHA ✅ — acceptance condition met; one-way sync demonstrated live. Independently verified by Command (not inferred from PR-branch CI).
