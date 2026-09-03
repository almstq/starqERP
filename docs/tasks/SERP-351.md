# Task Execution Report: SERP-351

## Provider registry and capability model — bounded correction on current main

- Phase: current-main correction for PR #32
- Priority: P1
- Execution state: correction branch prepared; implementation in progress; independent review not done
- Correction author: Vision
- Governing design: DEC-097 Option B, with bounded corrections for DEC-105 / F7 and DEC-106 / F8
- Review rule: author may correct; author may not self-review or self-accept

## Rehydrated repo reality

As rehydrated on 2026-09-03:
- origin/main = `19afab6` (post-PR #43)
- PR #32 head = `8f64cec` on `vision/starqerp-round1-serp-351-clean`
- The old PR #32 migration name `202608300035_payment_provider_tenant_scope.sql` is now out-of-order/duplicate on current main because `202608300035_chart_of_accounts_as_data.sql` already occupies that version.
- SSOT still shows SERP-351 blocked, while the current Founder/Nexus recovery makes the bounded correction surface explicit.

This correction therefore moves from the stale Round-1 migration file to a new current-main forward migration, without changing the approved architecture.

## Bounded correction surface actually implemented here

1. RLS/evidence semantics corrected:
   - `payment_provider_config` remains service-role-only.
   - No client read/write policy is introduced.
   - The earlier PR claim that tenant sessions gained read access is removed from the evidence record.

2. F7 / DEC-105:
   - `payment_intents.config_id` added.
   - `payment_attempts.config_id` added.
   - Composite tenant-safe foreign keys tie both tables to the exact `payment_provider_config` row.
   - `payment_attempts` is also constrained to the exact `(organisation_id, intent_id, provider_id, config_id)` tuple carried by its parent intent.

3. F8 / DEC-106:
   - bare boolean authority proof removed from the correction path
   - activation authority now requires a non-secret approval reference, recorder identity, timestamp, and audit-event linkage
   - a trigger records the audit event automatically when evidence is captured
   - production activation refuses when the evidence bundle is incomplete

4. Fail-closed migration posture:
   - no silent tenant inference
   - no silent config backfill
   - if historical rows already exist and the exact tenant/config identity cannot be inferred safely, the migration raises and stops

## Files in this correction branch

- `supabase/migrations/202609031047_payment_provider_tenant_scope.sql`
- `tests/serp_351_payment_provider_tenant_probe.sql`
- `docs/tasks/SERP-351.md`
- preserved unchanged from the original PR payload:
  - `docs/tasks/SERP-196.md`
  - `docs/tasks/SERP-238.md`

## Verification target

Before review request, this branch must show:
- migration lint green on current main
- no duplicate/out-of-order migration version
- probe file updated to the corrected structure/evidence semantics
- commit/PR wording no longer claiming independent review

## Remaining gate after implementation

Independent non-author L1 review by Elder if still eligible. No self-acceptance.
