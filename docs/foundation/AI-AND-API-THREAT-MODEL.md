# Human, API and AI-agent threat model

Status: release control baseline  
Effective date: 2026-08-20  
Scope: the foundation engine web, Flutter, cloud API, PostgreSQL, comms bus and future automation

## Security claim

STARQ ERP does not claim to be hack-proof. The required posture is
agent-resistant, least-privilege, fail-closed, auditable and recoverable. A
client, browser, mobile package, AI response, comms message, imported document
or third-party API response is never an authority by itself.

## Trust boundaries

1. Google proves an external identity token; it does not grant a the foundation engine role.
2. The cloud API maps the verified identity to an allowlisted person and active
   organisation membership.
3. The server resolves the acting seat and legal command. Client-supplied roles,
   organisation identifiers, next actions and accounting results are untrusted.
4. PostgreSQL constraints, append-only triggers, idempotency and tenant controls
   independently limit damage.
5. Human approvals remain mandatory for financial posting, permission changes,
   credential operations, exports and destructive actions.

## Threat register

| Threat | Example | Required control |
|---|---|---|
| Broken object authorization | Changing a job UUID to read another tenant | Resolve organisation from the session; scope every query and mutation; cross-tenant negative tests |
| Broken function authorization | Counter seat calls payer or admin operation | Server-side capability matrix and separation of duties; UI state is never enforcement |
| Credential or session theft | Stolen token, cookie, build log or comms message | Short sessions, Secure/HttpOnly/SameSite cookies, secret manager, rotation, no secrets in Git or bus |
| CSRF and replay | Reusing a captured write request | CSRF on cookie-authenticated writes, unique idempotency key, request hash and bounded expiry |
| Resource exhaustion and bots | Automated login, event or export floods | Gateway and per-principal limits, payload caps, timeouts, pagination and cost ceilings |
| Injection and unsafe parsing | SQL, HTML, CSV, template or command injection | Parameterized queries, strict schemas, output escaping, no shell construction from business data |
| Unsafe third-party API use | Poisoned identity/API response or SSRF | Fixed allowlisted endpoints, TLS, response size/time limits, schema validation and no arbitrary fetch URL |
| Supply-chain compromise | Malicious package, build action or agent plugin | Lockfiles, dependency review, minimal packages, provenance checks and isolated build credentials |
| Data poisoning | Imported pack changes prices, roles or opening balances | Quarantine, schema validation, hashes, reconciliation, approval and rollback boundary |
| Prompt/indirect injection | Document tells an agent to export secrets or ignore policy | Treat retrieved content as data; capabilities enforced outside the model; no instruction inheritance |
| Agent goal hijack | Compromised peer agent sends a false GO instruction | Signed/controlled task authority, thread and owner checks, bounded scope, independent acceptance review |
| Tool misuse/excessive agency | Agent can read books and also send/delete/approve | Separate tools and credentials; deny by default; smallest action set; human confirmation for consequential actions |
| Memory/context poisoning | False fact persists in agent memory or the comms bus | Evidence links, provenance, immutable history, current-state verification and quarantine of untrusted claims |
| Confused deputy | Agent uses Ali's session to act for Nashid or Starq | Principal, organisation and seat bound server-side; no client-selected tenant escalation |
| Autonomous retry damage | Agent retries a timed-out payment or stock movement | Idempotency keys, accepted/rejected/unknown states and reconciliation before retry |
| Rogue or cloned agent | Tool impersonates a known agent name | Separate machine identity, rotated credential, signed request, expiry and revocation; display name is not identity |
| Model/data exfiltration | Agent places books or secrets into prompts/logs | Data minimisation, field-level redaction, egress allowlist and prohibition on raw production prompts |
| Unexpected code execution | Model output becomes SQL, shell, template or workflow code | Never execute model output directly; parse an allowlisted command schema and re-authorize it |
| Availability/destructive attack | Delete, encrypt or corrupt cloud records | Append-only facts, restricted delete grants, backups, tested restore and emergency write freeze |

## AI-agent access rule

- No AI agent receives a human session, Google token, service-role key or database
  password.
- Agent access is disabled until a separate automation principal exists.
- A principal grant is organisation-scoped, action-scoped, time-bounded and
  revocable. Financial value limits are explicit.
- Permission, identity, payment, journal posting, bulk export, deletion and
  external communication require a human approval record.
- The model proposes a typed command. Deterministic code validates,
  re-authorizes and executes it. Natural-language output is never executable.
- A comms-bus message is coordination evidence, not runtime authorization.

## Release gates

- Secret and dependency scan passes.
- API contract, CSRF, idempotency, authorization and tenant-isolation tests pass.
- Rate limits and payload limits are verified from outside the process.
- RLS/role behaviour is exercised with non-owner database credentials.
- Security events are monitored without storing raw tokens or unnecessary PII.
- Backup restore and emergency write-freeze procedures are rehearsed.
- No automation principal is enabled for the garage pilot.

## External baseline

- OWASP API Security Top 10 (2023).
- OWASP Top 10 for LLM Applications, including prompt injection and excessive agency.
- OWASP Top 10 for Agentic Applications.
- NIST AI RMF Generative AI Profile, NIST AI 600-1.
- MITRE ATLAS adversarial tactics and techniques for AI-enabled systems.

