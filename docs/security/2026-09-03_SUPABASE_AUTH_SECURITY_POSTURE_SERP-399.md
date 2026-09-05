# Supabase Auth Security Posture Baseline & Drift Register

**Task ID**: SERP-399  
**Phase**: Final stretch (P5)  
**Date Established**: 2026-08-30 (Founder Resolution Addendum)  
**Date Recorded**: 2026-09-03  
**Status**: ACTIVE BASELINE  
**Author**: @antigravity  
**Reviewer**: @Elder  
**Governing Principle**: *"Console-set configuration that nobody wrote down is configuration that silently regresses. Live posture must become durable repository evidence so drift is immediately visible on review."*

---

## 1. Purpose & Threat Context

On 30 August 2026, the Founder completed an authoritative Supabase Auth console security pass across production environments. In cloud-hosted authentication engines, configuration managed solely through web consoles is vulnerable to silent regression during staging refreshes, manual operator intervention, or platform tier upgrades.

This document establishes the canonical repository baseline for Supabase Auth configuration in **starqERP**. Any divergence between the live Supabase Project configuration and this document constitutes a security finding requiring explicit triage under the project's vulnerability management framework.

---

## 2. Authoritative Security Posture Matrix

| Category | Security Parameter | Baseline Value | Operational Rationale | Verification / Drift Check |
|---|---|---|---|---|
| **Audit Trails** | `audit_log_persistence` | **ENABLED** | Guarantees non-repudiation and immutable tracking of login, token refresh, and identity lifecycle events. | Inspect `auth.audit_log_entries` retention and Supabase log drain integrity. |
| **Password Policy** | Minimum Length | **12 characters** | Mitigates brute-force and dictionary attacks on tenant accounts. | Attempt user signup/reset with 11 characters; verify rejection. |
| **Password Policy** | Character Sets | **Lowercase + Uppercase + Number + Symbol** | Enforces entropy across all tenant seats and administrative principals. | Test regex enforcement: `(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])`. |
| **Credential Change** | `secure_password_change` | **ENABLED** (Requires current password) | Prevents account takeover from compromised or unattended active sessions. | Verify `updateUser({ password })` fails without valid prior credential authentication. |
| **MFA** | TOTP Enrollment | **RETAINED / ENABLED** | Provides secondary proof of possession for administrative and financial operators. | Verify RFC 6238 TOTP challenge-response via authenticator app. |
| **MFA** | Enhanced MFA Posture | **RETAINED** | Step-up authentication enforced on high-privilege operations; SERP-381 MFA bypass resolution held. | Validate AAL2 assurance level requirement on sensitive RPCs. |
| **Rate Limiting** | Auth Endpoint Limits | **RETAINED (Sane Production Bounds)** | Defends against automated credential stuffing and denial of service. | Verify HTTP 429 Too Many Requests response on burst attempts against `/auth/v1/*`. |
| **Token Lifecycle** | Compromise Detection | **ENABLED** | Replay of rotated refresh tokens triggers revocation of the entire token family. | Re-use rotated refresh token after grace window; verify subsequent requests yield `401 Unauthorized`. |
| **Token Lifecycle** | Refresh Token Reuse Interval | **10 seconds** | Permits network retries and transient mobile latency without immediate session invalidation while maintaining tight replay boundaries. | Ensure token reuse <10s succeeds; token reuse >10s invalidates session family. |

---

## 3. Session & Credential Boundary Details

### 3.1 Password Complexity Rules
The Supabase Auth project is configured with strict password validation:
```json
{
  "password_min_length": 12,
  "password_required_characters": [
    "lowercase",
    "uppercase",
    "digits",
    "symbols"
  ]
}
```
Any programmatic or client-side password modification must satisfy all four character classes.

### 3.2 Refresh Token Rotation and Anti-Replay
To protect users against token theft over untrusted Wi-Fi or compromised local storage:
1. When a refresh token is exchanged at `/auth/v1/token?grant_type=refresh_token`, a new access token and a new refresh token are issued.
2. A **10-second reuse interval** is permitted solely to handle parallel client requests or network retries.
3. If an expired or previously used refresh token is presented **after** the 10-second interval, Supabase Auth flags the session as compromised and revokes all refresh tokens belonging to that user session chain.

### 3.3 Re-Authentication on Credential Modification
Self-service password resets initiated within an authenticated session cannot proceed with a simple `auth.updateUser({ password: newPassword })` payload. The user must provide their existing credentials or complete an email/TOTP challenge, preventing lateral takeover on shared workshop terminals.

---

## 4. Production Domain & CORS Boundary (SERP-299 / Founder Ruling #1475)

1. **Canonical Hostname**:
   - `erp.starq.mv` is the canonical production application hostname.
   - `starq.mv` serves as the corporate/public root.
   - Production browser/OAuth origin is strictly `https://erp.starq.mv`.

2. **CORS Allowlist Policy**:
   - Environment-specific exact origin allowlists enforced at the `starq-api` Edge boundary.
   - Production permits: `https://erp.starq.mv` and `https://starq.mv`.
   - Staging/dev origins remain isolated to their respective environments.
   - **Zero Wildcards on Credentialed Routes**: No wildcard `*.vercel.app` or arbitrary regex matches are permitted in production mode. Any preview origin matching must be explicitly opted into via `STARQBOOKS_ALLOW_PREVIEW_ORIGINS` and isolated from production data.

---

## 5. Privileged Secret Management & Rotation Policy (SERP-299)

1. **Secret Ownership & Invariants**:
   - `STARQBOOKS_SESSION_SECRET` is a backend-only Supabase Edge Secret utilized solely by `starq-api` for HMAC-SHA256 session token signing. It is never exposed to Vite, client browsers, git repositories, or operational log sinks.
   - Supabase Secret Key Modernization: The architecture transitions from legacy `SUPABASE_SERVICE_ROLE_KEY` to scoped Supabase Secret Keys as provider migration lands, maintaining strict backend-only authorization boundaries.

2. **Rotation Cadence & Triggers**:
   - **Scheduled Rotation**: Planned privileged secret review and rotation occurs every **90 days**.
   - **Immediate Emergency Rotation**: Mandatory upon any suspected key exposure, credential leakage, access revocation, compromised developer account/device, or material security incident.
   - **Audit Record**: Rotation events must log purpose, owner, date, trigger, affected service, and post-rotation verification smoke tests. Actual secret values must never appear in repository records.

---

## 6. Drift Audit & Review Cadence

1. **Change Control**: No operator may alter Supabase Auth settings in the Supabase Dashboard without a prior pull request referencing an approved architectural decision or incident response task.
2. **Review Verification**: During periodic security audits (e.g. SERP-120 and pre-release gates), the active Supabase project configuration must be checked against this document.
3. **Escalation**: Any discrepancy between this document and live production settings must immediately be logged as a **Security Drift Blocker** in the active task register.
