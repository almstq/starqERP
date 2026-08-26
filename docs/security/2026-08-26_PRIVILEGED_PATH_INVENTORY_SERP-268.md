# Privileged & Non-Interactive Path Inventory (SERP-268)

- **Date:** 2026-08-26
- **Task:** SERP-268 (Admin MFA — the accounts that can see every tenant are the accounts worth stealing)
- **Decisions:** DEC-073 (Privileged Boundary Defense), DEC-083 (Non-Interactive Credential Inventory)
- **Author:** Codex / Antigravity
- **Scope:** Complete inventory of interactive and non-interactive privileged boundaries, access paths, and cryptographic credentials across StarqERP.

---

## 1. Context & Asymmetry Principle

> *"A compromised client user exposes one tenant. A compromised admin exposes every tenant, plus the ability to grant itself more. Once there is a second tenant that is somebody else's company, single-factor admin access is a decision to accept a whole-platform breach as a possibility."*

SERP-268 mandates:
1. Every interactive user account able to cross tenants or alter tenant entitlements must have Multi-Factor Authentication (MFA) enforced.
2. Non-interactive privileged paths (service-role keys, CI credentials, automation scripts, vault keys) must be strictly inventoried, constrained, or recorded as accepted risk with a named owner and scheduled review date.

---

## 2. Privileged Access Path Inventory

| # | Path / Credential | Type | Scope / Capability | Mitigation / Constraint Status | Named Risk Owner | Review Date |
|---|---|---|---|---|---|---|
| **P-01** | **Interactive Web / Admin Sessions** (`user-1`, Super Admin, MD, Director) | Interactive Auth | Cross-tenant inspection, role mutation, user authorization, platform configuration | **CONSTRAINED**: Enforced 2FA (TOTP + 8 single-use recovery codes) before privileged elevation or cross-tenant context switch. | Ali Musthaq (Managing Director) | 2026-11-25 |
| **P-02** | **`SUPABASE_SERVICE_ROLE_KEY`** (Edge Functions Environment) | Non-Interactive Secret | Bypasses PostgreSQL Row-Level Security (RLS) on server-side Edge RPC functions | **ACCEPTED RISK**: Constrained to server-side Edge Function boundary (`supabase/functions/`). Never delivered to web/mobile clients. Edge code strictly enforces `tenant_id` invariants independently. | Elder (Technical Lead) | 2026-11-25 |
| **P-03** | **CI/CD Deployment Credentials** (GitHub Actions / Supabase Tokens) | Automation Key | Can deploy migrations and build release assets | **CONSTRAINED**: Stored in GitHub Encrypted Secrets with restricted branch protection rules (`main` only). Requires signed commits. | Codex / DevOps | 2026-11-25 |
| **P-04** | **Database Admin / Disposable Probe Scripts** (`tests/`, `scripts/`) | Local Scripting | Runs schema analysis, contract sweeps, and rehearsal probes | **CONSTRAINED**: Run strictly against ephemeral local rPostgres containers. Zero production connection strings or credentials committed to repository. | QA Lead | 2026-11-25 |
| **P-05** | **Emergency Recovery Codes & Release Signing Vault** (`STARQ SECRETS`) | Cryptographic Key Material | Contains master MFA recovery seeds and Android APK release signing keystore | **CONSTRAINED**: Stored in `STARQ SECRETS` vault, encrypted with a standalone master passphrase completely distinct from `STARQ ARK`. Offline air-gapped backup. | Ali Musthaq (Founder) | 2026-11-25 |

---

## 3. Recovery Codes & Vault Invariants

* **Recovery Key Format:** 8 single-use alphanumeric tokens formatted `REC<index>-<4_HEX>` (e.g. `REC1-9921`).
* **Consumption Model:** Consuming a recovery key atomically burns the token from the user's active recovery set and logs an immutable audit event (`STATUS_CHANGED` under `users` module).
* **Storage Invariant:** Vault keys are protected in `STARQ SECRETS` with independent key derivation, ensuring that access to public repositories or general backup archives does not compromise administrative break-glass capability.
