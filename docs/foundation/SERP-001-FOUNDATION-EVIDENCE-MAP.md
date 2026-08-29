# SERP-001 — Foundation Evidence Map and R0 Release Checklist

**Task:** SERP-021  
**Prepared by:** DP (WSL; bus ID `hermes`)  
**Date:** 2026-08-20  
**Status:** Evidence draft for Codex technical acceptance and Elder / Claude Code independent review  
**Boundary:** Source-only review. No secrets, vault data, browser accounts, Supabase, production data, code, database, cloud configuration, board state, or production process were accessed or changed.

## 1. Authorized source map

| Ref | Source | Authority established by the source set | Evidence state |
|---|---|---|---|
| S1 | `D:\StarqTech\the foundation engine\docs\foundation\STARQ-ERP-UNIFIED-BLUEPRINT.md` | Founder-directed working baseline for the unified product, main base, release slices, transition rules, and delivery council (lines 3-5, 7-27, 88-118). | Current design/control baseline; not implementation proof. |
| S2 | `D:\StarqTech\the foundation engine\docs\foundation\AI-NATIVE-ERP-ARCHITECTURE.md` | Founder product doctrine for the deterministic core, agent plane, automation levels, and non-negotiable controls (lines 3-4, 21-40, 55-92). | Current architecture baseline; not implementation proof. |
| S3 | `D:\StarqTech\the foundation engine\docs\foundation\AI-AND-API-THREAT-MODEL.md` | Release-control baseline for web, Flutter, cloud API, PostgreSQL, comms bus, and future automation (lines 3-5, 14-24, 26-71). | Required security/release controls; not test proof. |
| S4 | `D:\!starq\starqNexus\data\starq-erp-tasks.json` | Active STARQ ERP delivery board; identifies SERP-001 and SERP-021 as in progress and assigns work/evidence owners (lines 2-7, 20-42, 240-242). | Work status and acceptance definitions; no attached execution artifacts. |
| S5 | `D:\!starq\starqNexus\data\archive\STARQ_ERP_SUPERSESSION_2026-08-20.md` | Supersession record: STARQ ERP is the only active ERP roadmap; former the foundation engine and STARQ POS boards are historical evidence (lines 3-20). | Current roadmap authority and retirement record. |

### Authority conclusion

The source set consistently establishes one active product: **STARQ ERP**, built on one controlled main base. `legacy/engine` is transitional implementation evidence, and the former STARQ POS track is historical evidence whose counter-sales behavior may be ported through reviewed ERP module work (S1 lines 7-9, 98-104; S5 lines 3-18).

No source in this bounded set contains current CI logs, test reports, build logs, runtime configuration, screenshots, cloud acceptance output, database schemas, backup artifacts, or restore logs. Therefore, this map treats design statements and board statuses as requirements—not proof that controls are implemented or passing.

## 2. R0 evidence checklist

Status vocabulary:

- **Specified:** explicitly required by an authorized source.
- **Planned / in progress:** board state only; not proof of completion.
- **Unknown:** the bounded source set contains no implementation or execution evidence.
- **N/A for R0:** later capability must remain disabled; R0 evidence is proof of disablement, not premature implementation.

### A. API and session boundary

| Check | Accountable owner(s) | Required acceptance evidence | Current status | Source basis |
|---|---|---|---|---|
| Server resolves identity, membership, acting seat, legal command, and permitted tenant; client-supplied role/tenant/action/accounting data is untrusted. | Codex; independent control review by Elder / Claude Code | API contract plus negative authorization results showing server-derived principal/tenant/seat and denial of client-forged values. | **Specified; proof unknown.** | S1 lines 76-80; S3 lines 14-24. |
| Native Flutter session persistence uses a secure OS-backed boundary; web authentication remains browser-managed with secure cookie controls. | AG for client evidence; Codex for API/session acceptance | Separate Flutter and web evidence packs identifying the credential boundary, persistence behavior, logout/revocation behavior, and absence of client-side authority. | **SERP-001 in progress; proof unknown.** | S1 lines 88-91; S4 lines 22-40. |
| Cookie-authenticated writes resist CSRF and replay. | Codex | Passing CSRF, idempotency, request-hash, expiry, and replay tests, including accepted/rejected/unknown command outcomes. | **Specified; proof unknown.** | S2 lines 79-92; S3 lines 30-44, 63-71. |
| Sessions and credentials are bounded and not exposed through Git, logs, builds, or the comms bus. | Codex; AG for client/build artifacts | Secret scan, credential/session configuration evidence with values redacted, and tests for expiry/revocation. | **Specified; proof unknown.** | S3 lines 32-37, 50-61, 63-71. |
| A safe test action is server-authorized and idempotent. | Codex + AG | One bounded test record showing authorization decision, idempotency key, first result, replay result, and associated audit event—with no sensitive payload copied into this map. | **R0 acceptance item; proof unknown.** | S4 lines 34-40. |

### B. Native Flutter and Flutter web release evidence

| Check | Accountable owner(s) | Required acceptance evidence | Current status | Source basis |
|---|---|---|---|---|
| Native Flutter release gate passes independently. | AG; Codex technical acceptance | Reproducible native Flutter build/test/analyzer outputs for the exact candidate revision, with platform and revision identified. | **R0 blocker; current build/test logs are not present in the five-source set.** | S1 lines 88-91; S4 lines 34-40. |
| Flutter web cloud build gate passes independently. | AG; Codex technical acceptance | Reproducible Flutter web cloud-build/test output for the same candidate revision, with browser credential-boundary checks. Nexus TypeScript/type-check evidence belongs to the separate Nexus project board and is not STARQ ERP R0 client proof. | **R0 blocker; current Flutter web cloud-build/test logs are not present in the five-source set.** | S1 lines 88-91; S4 lines 34-40. |
| Real owner sign-in succeeds against the intended cloud acceptance environment. | Founder supplies the human action; AG captures client evidence; Codex accepts the boundary | Redacted sign-in evidence from native Flutter and Flutter web showing server-resolved identity/membership and no secret/token disclosure. | **R0 blocker; proof unknown.** | S4 lines 34-40. |
| A preview is not represented as a release. | Codex + Elder / Claude Code | Release decision record linking all required evidence and explicitly identifying the accepted candidate/environment. | **Specified; release decision absent from source set.** | S1 lines 88-95. |

### C. Tenant, role, and segregation-of-duties controls — R1 scope

| Check | Accountable owner(s) | Required acceptance evidence | Current status | Source basis |
|---|---|---|---|---|
| Every business query and mutation is tenant-scoped using the server-resolved tenant. | Codex | Automated cross-tenant read/write denial tests, including identifier substitution and function-authorization cases. | **Specified for R1; proof unknown; not an R0 acceptance blocker.** | S1 lines 27-38, 76-80, 88-95; S3 lines 28-31, 43-45, 63-68; S4 lines 44-61. |
| Role, seat, capability, module entitlement, and SoD enforcement are server-side; UI state is not enforcement. | Codex; Elder / Claude Code reviews control doctrine | Capability/SoD matrix and negative tests showing a lower-privilege seat cannot invoke admin, payer, posting, export, identity, or approval operations. | **Specified for the R1 organisation spine; proof unknown; not an R0 acceptance blocker.** | S1 lines 17-24, 29-38, 88-95; S3 lines 30-31, 50-61; S4 lines 44-61. |
| Starq Technologies and Club Ignition are equal legal tenants; Starq Dynamics and Ignition Ink are subordinate activity/outlet concepts, not separate ledger tenants. | Founder owns tenant facts; Codex implements; Elder reviews product/control integrity | Founder-confirmed seed/config record plus automated equal-control and isolation tests. | **Current baseline stated; R1 implementation proof unknown; not an R0 acceptance blocker.** | S1 lines 29-38; S4 lines 44-61. |
| R0 preserves the server-authoritative session boundary without falsely claiming the complete R1 dual-tenant spine. | Codex + Elder / Claude Code | R0 acceptance record limited to the active cloud-client/session boundary; R1 later carries the full organisation, tenant-isolation, role, and SoD evidence pack. | **Scope separated: R0 acceptance first; R1 organisation spine remains planned.** | S1 lines 88-95; S4 lines 22-61. |

### D. Audit trail and recovery controls

| Check | Accountable owner(s) | Required acceptance evidence | Current status | Source basis |
|---|---|---|---|---|
| Material commands and state changes produce attributable, append-only evidence. | Codex; Elder / Claude Code reviews control adequacy | Schema/constraint evidence plus tests showing immutable event history, actor/tenant/seat attribution, authorization outcome, idempotency state, and attempted prohibited action logging. | **Specified; proof unknown.** | S1 lines 17-24; S2 lines 55-64; S3 lines 21-24, 48, 63-71. |
| Security monitoring avoids raw tokens and unnecessary PII. | Codex | Redacted monitoring/event samples and retention configuration; evidence that monitoring is independent of the agent being monitored. | **Specified; proof unknown.** | S2 lines 87-92; S3 lines 63-71. |
| Emergency write freeze exists and can be exercised without relying on an AI agent. | Codex; Founder approves consequential use/risk acceptance | Procedure and bounded rehearsal output showing activation, denied writes, recovery, and audit events. | **Specified; proof unknown.** | S2 lines 79-92; S3 lines 48, 63-71. |

### E. AI-agent authority

| Check | Accountable owner(s) | Required acceptance evidence | Current status | Source basis |
|---|---|---|---|---|
| Natural-language output and comms messages are never runtime authority. | Codex; Elder / Claude Code reviews doctrine | Typed-command contract and tests showing deterministic validation, re-authorization, and rejection of free-form or forged commands. | **Specified; proof unknown.** | S1 lines 82-86; S2 lines 21-40, 79-92; S3 lines 39-47, 50-61. |
| No AI agent receives a human session, Google token, service-role key, or database password. | Codex | Configuration/control evidence with secret values omitted; negative tests demonstrating no credential inheritance from a human principal. | **Specified; proof unknown.** | S3 lines 50-61. |
| Garage-pilot automation principal is disabled. | Codex | Runtime/configuration evidence showing no enabled automation principal and no agent write path. | **Required safety posture; proof unknown. Full M8 implementation remains planned and is not an R0 blocker.** | S3 lines 63-71. |
| A0/A1 are the first intended capabilities; A2 remains disabled until tested grants; A3 requires human approval; A4 is prohibited. | Codex; Founder approves consequential escalation; Elder / Claude Code independently reviews | Capability-level registry and approval evidence when later enabled. For R0, proof that A2-A4 are disabled is sufficient. | **Specified; later implementation planned under SERP-015/016.** | S2 lines 66-77; S4 lines 222-226. |
| Full agent registry, scoped grants, kill switch, and AI proposal workflow are not falsely claimed as R0-complete. | Codex | Later SERP-015/016 acceptance artifacts. | **Planned, not R0 implementation evidence.** | S4 lines 222-226. |

### F. Backup, restore, and continuity

| Check | Accountable owner(s) | Required acceptance evidence | Current status | Source basis |
|---|---|---|---|---|
| Main-base backup and restore responsibilities are defined. | Codex; Founder owns risk acceptance and irreversible approval | Named backup scope, encryption/key-custody design, retention, recovery objective, and responsible operator—without exposing credentials. | **Specified at architecture level; operational facts unknown.** | S1 lines 17-24; S4 lines 237-238. |
| Encrypted backup is catalogued and a scratch restore reconciles successfully before real business records. | Codex; Founder approves/reviews the rehearsal boundary | Redacted backup catalogue entry, scratch-restore log, reconciliation result, and evidence production was not overwritten. | **SERP-020 planned; proof unknown.** | S3 lines 48, 63-71; S4 lines 237-238. |
| Recovery work remains in its named later gate and is not misreported as an R0 blocker. | Codex + Elder / Claude Code; Founder accepts residual risk | SERP-020 evidence before real business records, followed by the R2 recovery evidence required by the blueprint. | **Planned prerequisite for its own release boundary; not an R0 acceptance blocker.** S4 places SERP-020 after SERP-001 and before real records; S1 carries encrypted backup/scratch restore into R2. | S1 lines 88-95; S3 lines 63-71; S4 lines 237-238. |

## 3. Founder-owned facts and decisions

### Already stated as the current baseline

These are stated in founder-directed sources and must not be re-decided or silently changed by implementation agents:

1. STARQ ERP is the single active ERP product roadmap; `legacy/engine` and the former STARQ POS board are historical/transitional evidence (S1 lines 7-9, 98-104; S5 lines 3-20).
2. Starq Technologies and Club Ignition are the initial equal legal tenants; neither receives a privileged bypass (S1 lines 29-38).
3. Starq Dynamics is an operating activity of Starq Technologies, and Ignition Ink is an outlet/trading operation of Club Ignition (S1 lines 29-38; S4 lines 44-61).
4. Consequential AI actions—payments, journals, permissions, external representation, bulk export, and deletion—require explicit human approval; fully autonomous consequential operation is prohibited (S1 lines 82-86; S2 lines 66-92).
5. The product may be described as AI-native and ISO-aligned in engineering approach, but not as ISO certified, infallible, hack-proof, or autonomously unlimited (S1 lines 98-104; S2 lines 94-101; S3 lines 7-12).

### Founder involvement still required for R0 evidence

The bounded source set identifies founder ownership but does not contain a completed founder decision artifact for:

- Performing and evidencing the real-owner sign-in required by SERP-001.
- Accepting residual release risk after Codex technical acceptance and Elder / Claude Code independent review.
- Approving any consequential action used in testing. The safe R0 test action must remain bounded, reversible, non-financial, non-destructive, and server-authorized.
- Confirming operational recovery facts that are not specified here, such as risk tolerance/recovery objectives and key custody, if those are required for the accepted R0 boundary.

No business, tax, legal, staffing, pricing, payment, or accounting policy is inferred by this map.

## 4. Effective R0 P0 gaps

Only the following are blockers to **SERP-001 R0 acceptance**:

1. **Cloud-client/session acceptance pack missing:** no candidate revision, cloud acceptance output, or release decision is attached; native secure persistence and the Flutter web browser credential boundary remain unevidenced.
2. **Current native Flutter and Flutter web evidence missing:** no reproducible candidate-specific build/test/analyzer logs are present for either client surface.
3. **Real owner sign-in missing:** no redacted evidence shows the owner signing in against the intended cloud acceptance environment through the required client surfaces.
4. **Safe idempotent action missing:** no record shows a bounded server-authorized test action, idempotent replay result, and associated authorization/audit outcome.

### Planned controls that are not R0 blockers

- **R1 organisation spine:** full dual-tenant schema, tenant-isolation tests, role/capability matrix, module entitlements, and SoD evidence.
- **SERP-020 / R2 recovery:** encrypted backup, scratch restore, reconciliation, and later pilot recovery proof before their named release boundaries.
- **M8 AI control plane:** agent registry, grants, proposal workflow, and kill switch under SERP-015/016. R0 must not falsely claim these are complete.
- **Later audit/control depth:** append-only event history, independent monitoring, and write-freeze proof remain required by their applicable main-base/release gates, but are not added to the four explicit SERP-001 R0 acceptance blockers.

## 5. Acceptance routing

| Role | Required next evidence action |
|---|---|
| **AG** | Produce revision-specific Flutter and web build/test evidence and client credential-boundary evidence; support the redacted owner sign-in and bounded safe-action capture. |
| **Codex** | Assemble API/session, authorization, CSRF/idempotency, tenant/SoD, audit/monitoring, AI-disablement, and release-candidate evidence; resolve the technical interpretation of R0 gates. |
| **Elder / Claude Code** | Independently challenge product/control completeness, especially R0/R1 gate timing, SoD, audit, and recovery; issue accept/reject findings rather than relying on implementer self-approval. |
| **Founder** | Perform/confirm required human acceptance actions, decide residual risk and recovery-policy questions, and approve any consequential or irreversible test action. |

## 6. Integrity statement

This document maps requirements and missing evidence only. It does not certify implementation, approve a release, authorize cloud or production changes, or substitute design text for executed proof. Every implementation statement not demonstrated inside the five authorized sources remains **unknown**.
