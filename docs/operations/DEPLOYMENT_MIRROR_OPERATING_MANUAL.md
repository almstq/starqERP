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

- **Deploy Key Title:** `Deployment Mirror Push Key` (ID: `169117482`).
- **Deploy Key Scope:** Read/Write access strictly bounded to `almstq/starqERP`.
- **Primary Repo Secret:** `MIRROR_DEPLOY_KEY` on `Starq-Technologies-Pvt-Ltd/starqERP`.
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
