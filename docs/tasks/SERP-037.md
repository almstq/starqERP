# SERP-037 — Backup catalogue and scratch-restore contract

Status: Implementation checkpoint green; independent review pending
Owner: Codex
Branch: `codex/serp-037-backup-restore`

## Scope boundary

This slice uses synthetic organisations and a dedicated local PostgreSQL 17 cluster. It performs no production reads, DNS changes, secret access, or customer-data operations. The only recreated databases are the fixed names `serp037_source` and `serp037_scratch` on port `55433`; runtime files stay under `D:\StarqTech\_tmp\serp037`.

## Delivered contract

- `platform.backup_catalogue` is append-only and stores integrity/encryption metadata, never backup bytes or encryption keys.
- `platform.restore_drill_reports` is append-only and records verified or failed non-production restore outcomes.
- Direct catalogue writes are denied to `authenticated` and `service_role`; the service role can only write through the two SECURITY DEFINER RPCs.
- `platform.register_backup` requires an active platform administrator, AES-256-GCM metadata, a non-secret KMS/vault/ephemeral key reference, distinct plaintext/ciphertext digests, and idempotent request ownership.
- `platform.record_restore_result` permits only `scratch` or `staging` targets, verifies the decrypted archive digest and exact source/restore manifests, and persists attributed success or failure audit events.
- Catalogue and restore request keys reject conflicting replay while identical replay returns the durable winner.

## Executable recovery drill

Run:

```powershell
pwsh -NoProfile -File tests/run_serp_037_backup_restore_probe.ps1
```

The harness:

1. Replays all repository migrations into a synthetic source database.
2. Creates deterministic Tenant A/Tenant B fixtures.
3. Produces a PostgreSQL custom-format archive.
4. Encrypts the archive with AES-256-GCM using a random memory-only key.
5. Proves `pg_restore` rejects the ciphertext.
6. Decrypts in memory, verifies the original SHA-256, and restores into a disposable scratch database.
7. Reconciles exact source/scratch manifests.
8. Records the actual encrypted backup and verified restore through the server-authoritative catalogue RPCs.
9. Executes authorization, tenant, plaintext, replay, mismatch, production-target, and immutability probes.
10. Removes transient plaintext archives and zeroes the encryption key.

## Evidence matrix

| Gate | Result |
|---|---|
| Static authority/scope tests | 4/4 pass |
| Clean migration replay | 0001–0027 plus 0029 pass |
| AES-256-GCM encrypted archive | pass; plaintext and ciphertext SHA-256 differ |
| Encrypted artifact rejected by `pg_restore` | pass |
| Decrypted archive SHA-256 matches source | pass |
| Scratch source/restore manifest reconciliation | exact match |
| Database contract probes | 12/12 pass |
| Authenticated catalogue/RPC access | denied |
| Service-role direct catalogue insert | denied |
| Cross-tenant non-admin registration | denied with zero Tenant B catalogue rows |
| Identical request replay | durable winner returned |
| Conflicting request replay | `idempotency_key_conflict` |
| Reconciliation mismatch | failed report plus attributable audit event |
| Production restore target | failed closed and recorded |
| Catalogue mutation | rejected as append-only |

Raw execution output is preserved in `docs/evidence/SERP-037/green-backup-restore-probe.txt`. This checkpoint is not self-accepted; a separate reviewer must reproduce the drill before the task can close.
