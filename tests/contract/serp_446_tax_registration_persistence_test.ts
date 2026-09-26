/**
 * SERP-446: MIRA Statutory Tax Registration Persistence Contract & Live DB Test
 *
 * Validates:
 * 1. Server-side validation of tax registration statuses (allowlist: registered, not_registered, pending, suspended, cancelled).
 * 2. Rejection of invalid statuses (e.g. exempt, zero_rated, arbitrary strings) with HTTP 422.
 * 3. Live round-trip persistence against m1_disposable (127.0.0.1:55432):
 *    - Save registered -> reload -> persists as registered.
 *    - Save pending -> reload -> persists as pending.
 *    - Save not_registered -> reload -> persists as not_registered.
 * 4. Tenant isolation: updates to tenant A do not mutate tenant B.
 * 5. Explicit unknown handling: tenants with no tax_registration row return null (hydrating as 'unknown' rather than 'not_registered').
 *
 * RUN:
 *   deno test --allow-read --allow-net --allow-env tests/contract/serp_446_tax_registration_persistence_test.ts
 */

import { assert, assertEquals } from 'jsr:@std/assert@1';
import pg from 'npm:pg';
import {
  ALLOWED_TAX_REGISTRATION_STATUSES,
  validateTaxRegistrationInput,
} from '../../supabase/functions/starq-api/index.ts';

const DB_URL = Deno.env.get('DATABASE_URL') || 'postgres://postgres@127.0.0.1:55432/m1_disposable';

// ─────────────────────────────────────────────────────────────────────────────
// 1. UNIT & CONTRACT VALIDATION SUITE
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-446: ALLOWED_TAX_REGISTRATION_STATUSES matches MIRA statutory domain model', () => {
  assertEquals(ALLOWED_TAX_REGISTRATION_STATUSES, [
    'registered',
    'not_registered',
    'pending',
    'suspended',
    'cancelled',
  ]);
});

Deno.test('SERP-446: validateTaxRegistrationInput accepts valid statutory statuses', () => {
  for (const status of ALLOWED_TAX_REGISTRATION_STATUSES) {
    const res = validateTaxRegistrationInput({
      registration_status: status,
      tin: '1186669',
      tax_type: 'gst_general',
    });
    assert(res.ok, `Expected status '${status}' to be valid`);
    assertEquals(res.registrationStatus, status);
    assertEquals(res.tin, '1186669');
    assertEquals(res.taxType, 'gst_general');
  }
});

Deno.test('SERP-446: validateTaxRegistrationInput rejects invalid or unallowed statuses with 422', () => {
  const invalidStatuses = ['exempt', 'zero_rated', 'active', 'inactive', 'true'];
  for (const status of invalidStatuses) {
    const res = validateTaxRegistrationInput({
      registration_status: status,
    });
    assertEquals(res.ok, false);
    assertEquals(res.status, 422);
    assertEquals(res.error, 'invalid_registration_status');
  }

  const emptyStatuses = ['', null, undefined];
  for (const status of emptyStatuses) {
    const res = validateTaxRegistrationInput({
      registration_status: status,
    });
    assertEquals(res.ok, false);
    assertEquals(res.status, 422);
    assertEquals(res.error, 'registration_status_required');
  }
});

Deno.test('SERP-446: validateTaxRegistrationInput rejects non-object payload with 400', () => {
  const res = validateTaxRegistrationInput('not an object');
  assertEquals(res.ok, false);
  assertEquals(res.status, 400);
  assertEquals(res.error, 'invalid_request_body');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. LIVE POSTGRESQL ROUND-TRIP TEST AGAINST m1_disposable
// ─────────────────────────────────────────────────────────────────────────────

Deno.test({
  name: 'SERP-446: Live Postgres round-trip persistence (save registered -> reload -> still registered)',
  fn: async () => {
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();

    try {
      const starqOrgId = '10000000-0000-4000-8000-000000000001';
      const ignitionOrgId = '20000000-0000-4000-8000-000000000001';

      // 1. Initial State: Read Starq's initial registration
      const initStarqRes = await client.query(
        `SELECT id, organisation_id, tax_type, registration_status, tin
         FROM public.tax_registrations
         WHERE organisation_id = $1 AND tax_type = 'gst_general'
         ORDER BY effective_from DESC LIMIT 1`,
        [starqOrgId]
      );
      assert(initStarqRes.rows.length > 0, 'Starq initial tax registration row missing in disposable DB');
      const initialStatus = initStarqRes.rows[0].registration_status;

      // 2. Save 'registered' with TIN '1186669'
      await client.query(
        `UPDATE public.tax_registrations
         SET registration_status = 'registered', tin = '1186669'
         WHERE organisation_id = $1 AND tax_type = 'gst_general'`,
        [starqOrgId]
      );

      // 3. Reload: Simulate fresh query as performed by /api/tenant/tax-registration
      const reloadedRes = await client.query(
        `SELECT id, organisation_id, tax_type, registration_status, tin
         FROM public.tax_registrations
         WHERE organisation_id = $1 AND tax_type = 'gst_general'
         ORDER BY effective_from DESC LIMIT 1`,
        [starqOrgId]
      );
      assertEquals(reloadedRes.rows.length, 1);
      assertEquals(reloadedRes.rows[0].registration_status, 'registered');
      assertEquals(reloadedRes.rows[0].tin, '1186669');

      // 4. Verify Tenant Isolation: Club Ignition remains registered with its own TIN '1186844'
      const ignitionRes = await client.query(
        `SELECT id, organisation_id, tax_type, registration_status, tin
         FROM public.tax_registrations
         WHERE organisation_id = $1 AND tax_type = 'gst_general'
         ORDER BY effective_from DESC LIMIT 1`,
        [ignitionOrgId]
      );
      assertEquals(ignitionRes.rows.length, 1);
      assertEquals(ignitionRes.rows[0].registration_status, 'registered');
      assertEquals(ignitionRes.rows[0].tin, '1186844');

      // 5. Save 'pending' and verify reload
      await client.query(
        `UPDATE public.tax_registrations
         SET registration_status = 'pending'
         WHERE organisation_id = $1 AND tax_type = 'gst_general'`,
        [starqOrgId]
      );
      const pendingRes = await client.query(
        `SELECT registration_status FROM public.tax_registrations
         WHERE organisation_id = $1 AND tax_type = 'gst_general'
         ORDER BY effective_from DESC LIMIT 1`,
        [starqOrgId]
      );
      assertEquals(pendingRes.rows[0].registration_status, 'pending');

      // 6. Save 'not_registered' and verify reload
      await client.query(
        `UPDATE public.tax_registrations
         SET registration_status = 'not_registered'
         WHERE organisation_id = $1 AND tax_type = 'gst_general'`,
        [starqOrgId]
      );
      const notRegisteredRes = await client.query(
        `SELECT registration_status FROM public.tax_registrations
         WHERE organisation_id = $1 AND tax_type = 'gst_general'
         ORDER BY effective_from DESC LIMIT 1`,
        [starqOrgId]
      );
      assertEquals(notRegisteredRes.rows[0].registration_status, 'not_registered');

      // 7. Unknown / Unconfigured tenant check:
      // A brand new tenant with no row in public.tax_registrations returns 0 rows,
      // which starq-api / SettingsView hydrator maps to 'unknown', NOT 'not_registered'
      const unconfiguredOrgId = '99999999-9999-4999-8999-999999999999';
      const unknownRes = await client.query(
        `SELECT id, registration_status FROM public.tax_registrations
         WHERE organisation_id = $1 AND tax_type = 'gst_general'`,
        [unconfiguredOrgId]
      );
      assertEquals(unknownRes.rows.length, 0);

      // Revert Starq to initial status
      await client.query(
        `UPDATE public.tax_registrations
         SET registration_status = $1
         WHERE organisation_id = $2 AND tax_type = 'gst_general'`,
        [initialStatus, starqOrgId]
      );
    } finally {
      await client.end();
    }
  },
});
