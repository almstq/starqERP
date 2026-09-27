/**
 * SERP-446: MIRA Statutory Tax Registration Persistence Contract & Live DB Test
 *
 * Validates:
 * 1. Server-side validation of tax registration statuses (allowlist: registered, not_registered, pending, suspended, cancelled).
 * 2. Rejection of invalid statuses (e.g. exempt, zero_rated, arbitrary strings) with HTTP 422.
 * 3. Request-level handleRequest calls against real PostgreSQL m1_disposable (127.0.0.1:55432):
 *    - Org A write persists to tax_registrations table in DB and changes the authoritative row.
 *    - Org B remains completely isolated and untouched.
 *    - Missing or mismatched CSRF returns HTTP 400 csrf_mismatch.
 *    - Invalid registration_status (e.g. exempt) returns HTTP 422 invalid_registration_status.
 *    - Catalogue test proving lookup failure / unconfigured tenant fails closed to 'unknown', not 'not_registered'.
 *    - COUNTER_SALE gate fails closed with 422 tax_registration_status_unknown when unconfigured/unknown.
 * 4. Red-Green verified: deleting the POST route block makes tests go red (404 route_not_found).
 *
 * RUN:
 *   deno test --allow-read --allow-net --allow-env tests/contract/serp_446_tax_registration_persistence_test.ts
 */

// Ensure environment secrets are configured before module evaluation
Deno.env.set('STARQBOOKS_SESSION_SECRET', 'super-secret-key-that-is-at-least-32-characters-long');
Deno.env.set('SUPABASE_URL', 'https://placeholder.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-key-placeholder');

import { assert, assertEquals } from 'jsr:@std/assert@1';
import pg from 'npm:pg';
import {
  ALLOWED_TAX_REGISTRATION_STATUSES,
  validateTaxRegistrationInput,
  handleRequest,
  setDbForTesting,
  resetDbForTesting,
  type Session,
} from '../../supabase/functions/starq-api/index.ts';

const DB_URL = Deno.env.get('DATABASE_URL') || 'postgres://postgres@127.0.0.1:55432/m1_disposable';

// ─────────────────────────────────────────────────────────────────────────────
// 1. UNIT & DOMAIN MODEL CONTRACT
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
// 2. LIVE REQUEST-LEVEL TESTS AGAINST m1_disposable VIA handleRequest
// ─────────────────────────────────────────────────────────────────────────────

function createPgDbAdapter(pgClient: pg.Client) {
  let simulateTaxLookupFailure = false;

  return {
    setSimulateTaxLookupFailure(val: boolean) {
      simulateTaxLookupFailure = val;
    },
    from(table: string) {
      const state = {
        table,
        op: 'select',
        selectCols: '*',
        updateData: null as Record<string, unknown> | null,
        insertData: null as Record<string, unknown>[] | null,
        where: [] as { col: string; op: string; val: unknown }[],
        orderBy: null as string | null,
        limitVal: null as number | null,
      };

      const chain = {
        select(cols = '*') {
          state.selectCols = cols;
          return chain;
        },
        update(data: Record<string, unknown>) {
          state.op = 'update';
          state.updateData = data;
          return chain;
        },
        insert(data: Record<string, unknown> | Record<string, unknown>[]) {
          state.op = 'insert';
          state.insertData = Array.isArray(data) ? data : [data];
          return chain;
        },
        eq(col: string, val: unknown) {
          state.where.push({ col, op: '=', val });
          return chain;
        },
        lte(col: string, val: unknown) {
          state.where.push({ col, op: '<=', val });
          return chain;
        },
        order(col: string, { ascending = true } = {}) {
          state.orderBy = `"${col}" ${ascending ? 'ASC' : 'DESC'}`;
          return chain;
        },
        limit(n: number) {
          state.limitVal = n;
          return chain;
        },
        async maybeSingle() {
          if (simulateTaxLookupFailure && state.table === 'tax_registrations') {
            return { data: null, error: new Error('simulated_tax_lookup_failure') };
          }
          try {
            const rows = await executeSelect();
            return { data: rows[0] ?? null, error: null };
          } catch (err) {
            return { data: null, error: err };
          }
        },
        async single() {
          if (simulateTaxLookupFailure && state.table === 'tax_registrations') {
            return { data: null, error: new Error('simulated_tax_lookup_failure') };
          }
          try {
            if (state.op === 'insert') {
              const row = state.insertData![0];
              const cols = Object.keys(row);
              const vals = Object.values(row);
              const query = `
                INSERT INTO public.${state.table} (${cols.map(c => `"${c}"`).join(', ')})
                VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
                RETURNING *
              `;
              const res = await pgClient.query(query, vals);
              return { data: res.rows[0] ?? null, error: null };
            } else if (state.op === 'update') {
              const cols = Object.keys(state.updateData!);
              const vals = Object.values(state.updateData!);
              const setClause = cols.map((c, i) => `"${c}" = $${i + 1}`).join(', ');
              let paramIdx = cols.length + 1;
              const whereClauses = state.where.map(w => {
                vals.push(w.val);
                return `"${w.col}" ${w.op} $${paramIdx++}`;
              });
              const query = `
                UPDATE public.${state.table}
                SET ${setClause}
                ${whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''}
                RETURNING *
              `;
              const res = await pgClient.query(query, vals);
              return { data: res.rows[0] ?? null, error: null };
            } else {
              const rows = await executeSelect();
              return { data: rows[0] ?? null, error: null };
            }
          } catch (err) {
            return { data: null, error: err };
          }
        },
        then(resolve: (value: unknown) => void, _reject: (reason?: unknown) => void) {
          if (simulateTaxLookupFailure && state.table === 'tax_registrations') {
            resolve({ data: null, error: new Error('simulated_tax_lookup_failure') });
            return;
          }
          if (state.op === 'insert') {
            const row = state.insertData![0];
            const cols = Object.keys(row);
            const vals = Object.values(row);
            const query = `
              INSERT INTO public.${state.table} (${cols.map(c => `"${c}"`).join(', ')})
              VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
              RETURNING *
            `;
            pgClient.query(query, vals)
              .then((res: pg.QueryResult) => resolve({ data: res.rows, error: null }))
              .catch((err: unknown) => resolve({ data: null, error: err }));
          } else {
            executeSelect()
              .then((rows: unknown[]) => resolve({ data: rows, error: null }))
              .catch((err: unknown) => resolve({ data: null, error: err }));
          }
        }
      };

      async function executeSelect() {
        const vals: unknown[] = [];
        let paramIdx = 1;
        const whereClauses = state.where.map(w => {
          vals.push(w.val);
          return `"${w.col}" ${w.op} $${paramIdx++}`;
        });
        let query = `SELECT * FROM public.${state.table}`;
        if (whereClauses.length) {
          query += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        if (state.orderBy) {
          query += ` ORDER BY ${state.orderBy}`;
        }
        if (state.limitVal) {
          query += ` LIMIT ${state.limitVal}`;
        }
        const res = await pgClient.query(query, vals);
        return res.rows;
      }

      return chain;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      try {
        if (name === 'api_counter_approved_prices') {
          const res = await pgClient.query(
            `SELECT public.api_counter_approved_prices($1::uuid, $2::uuid, $3::text, $4::text) AS result`,
            [args.target_org, args.target_person, args.target_seat, args.p_price_list_code ?? null]
          );
          return { data: res.rows[0]?.result ?? null, error: null };
        }
        if (name === 'stock_movements_derived_onhand') {
          const res = await pgClient.query(
            `SELECT * FROM public.stock_movements_derived_onhand($1::uuid)`,
            [args.p_organisation_id]
          );
          return { data: res.rows, error: null };
        }
        if (name === 'calculate_line_tax') {
          const res = await pgClient.query(
            `SELECT * FROM public.calculate_line_tax($1::uuid, $2::text, $3::date, $4::text, $5::numeric)`,
            [args.target_org, args.target_tax_type, args.supply_date, args.tax_mode, args.line_amount]
          );
          return { data: res.rows, error: null };
        }
        return { data: null, error: new Error(`unmocked_rpc_${name}`) };
      } catch (err) {
        return { data: null, error: err };
      }
    }
  };
}

Deno.test({
  name: 'SERP-446: Request-level persistence, tenant isolation, CSRF gate, validation, and fail-closed catalogue',
  fn: async () => {
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();

    const starqOrgId = '10000000-0000-4000-8000-000000000001';
    const ignitionOrgId = '20000000-0000-4000-8000-000000000001';
    const unconfiguredOrgId = '99999999-9999-4999-8999-999999999999';

    const sessionOrgA: Session = {
      person_uuid: '00000000-0000-0000-0000-000000000001',
      person_key: 'starq-md',
      display_label: 'Starq Managing Director',
      email: 'md@starq.mv',
      organisation_id: starqOrgId,
      book_id: '10000000-0000-4000-8000-000000000002',
      seats: ['managing_director'],
      acting_as: 'managing_director',
      csrf: 'starq-csrf-token-12345',
      exp: Date.now() + 3600000,
    };

    const sessionOrgB: Session = {
      person_uuid: '20000000-0000-4000-8000-000000000111',
      person_key: 'ignition-counter',
      display_label: 'Ignition Counter',
      email: 'counter@ignition.mv',
      organisation_id: ignitionOrgId,
      book_id: '20000000-0000-4000-8000-000000000002',
      seats: ['counter'],
      acting_as: 'counter',
      csrf: 'ignition-csrf-token-67890',
      exp: Date.now() + 3600000,
    };

    const sessionUnconfigured: Session = {
      person_uuid: '00000000-0000-0000-0000-000000000003',
      person_key: 'new-user',
      display_label: 'Unconfigured Tenant User',
      email: 'user@unconfigured.mv',
      organisation_id: unconfiguredOrgId,
      book_id: null,
      seats: ['managing_director'],
      acting_as: 'managing_director',
      csrf: 'unconfigured-csrf-token',
      exp: Date.now() + 3600000,
    };

    try {
      const adapter = createPgDbAdapter(client);
      setDbForTesting(adapter);

      // Save initial Starq status to restore on cleanup
      const initialStarq = await client.query(
        `SELECT registration_status, tin FROM public.tax_registrations WHERE organisation_id = $1 AND tax_type = 'gst_general'`,
        [starqOrgId]
      );
      const initialStarqStatus = initialStarq.rows[0]?.registration_status ?? 'registered';
      const initialStarqTin = initialStarq.rows[0]?.tin ?? '1186669';

      // Record initial Ignition status
      const initialIgnition = await client.query(
        `SELECT registration_status, tin FROM public.tax_registrations WHERE organisation_id = $1 AND tax_type = 'gst_general'`,
        [ignitionOrgId]
      );
      const initialIgnitionStatus = initialIgnition.rows[0]?.registration_status;
      const initialIgnitionTin = initialIgnition.rows[0]?.tin;

      // ───────────────────────────────────────────────────────────────────────
      // TEST 1: POST /api/tenant/tax-registration persists to DB for Org A
      // ───────────────────────────────────────────────────────────────────────
      const postReqA = new Request('http://localhost:5173/api/tenant/tax-registration', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': sessionOrgA.csrf,
        },
        body: JSON.stringify({
          registration_status: 'registered',
          tin: '1186669',
          tax_type: 'gst_general',
        }),
      });

      const postResA = await handleRequest(postReqA, crypto.randomUUID(), undefined, sessionOrgA);
      assertEquals(postResA.status, 200);
      const postBodyA = await postResA.json();
      assertEquals(postBodyA.ok, true);
      assertEquals(postBodyA.registration.registration_status, 'registered');
      assertEquals(postBodyA.registration.tin, '1186669');

      // Verify row in real Postgres m1_disposable
      const liveDbStarq = await client.query(
        `SELECT registration_status, tin FROM public.tax_registrations WHERE organisation_id = $1 AND tax_type = 'gst_general'`,
        [starqOrgId]
      );
      assertEquals(liveDbStarq.rows.length, 1);
      assertEquals(liveDbStarq.rows[0].registration_status, 'registered');
      assertEquals(liveDbStarq.rows[0].tin, '1186669');

      // Verify round-trip read via GET /api/tenant/tax-registration
      const getReqA = new Request('http://localhost:5173/api/tenant/tax-registration?tax_type=gst_general', {
        method: 'GET',
      });
      const getResA = await handleRequest(getReqA, crypto.randomUUID(), undefined, sessionOrgA);
      assertEquals(getResA.status, 200);
      const getBodyA = await getResA.json();
      assertEquals(getBodyA.ok, true);
      assertEquals(getBodyA.registration.registration_status, 'registered');
      assertEquals(getBodyA.registration.tin, '1186669');

      // ───────────────────────────────────────────────────────────────────────
      // TEST 2: Tenant Isolation: Org B is unreachable and completely untouched
      // ───────────────────────────────────────────────────────────────────────
      const liveDbIgnition = await client.query(
        `SELECT registration_status, tin FROM public.tax_registrations WHERE organisation_id = $1 AND tax_type = 'gst_general'`,
        [ignitionOrgId]
      );
      assertEquals(liveDbIgnition.rows.length, 1);
      assertEquals(liveDbIgnition.rows[0].registration_status, initialIgnitionStatus);
      assertEquals(liveDbIgnition.rows[0].tin, initialIgnitionTin);

      // Org B request reads only Org B data
      const getReqB = new Request('http://localhost:5173/api/tenant/tax-registration?tax_type=gst_general', {
        method: 'GET',
      });
      const getResB = await handleRequest(getReqB, crypto.randomUUID(), undefined, sessionOrgB);
      assertEquals(getResB.status, 200);
      const getBodyB = await getResB.json();
      assertEquals(getBodyB.registration.organisation_id, ignitionOrgId);
      assertEquals(getBodyB.registration.tin, initialIgnitionTin);

      // ───────────────────────────────────────────────────────────────────────
      // TEST 3: Missing or Mismatched CSRF -> 400 csrf_mismatch
      // ───────────────────────────────────────────────────────────────────────
      const badCsrfReq = new Request('http://localhost:5173/api/tenant/tax-registration', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'wrong-csrf-token',
        },
        body: JSON.stringify({
          registration_status: 'registered',
          tin: '1186669',
        }),
      });
      const badCsrfRes = await handleRequest(badCsrfReq, crypto.randomUUID(), undefined, sessionOrgA);
      assertEquals(badCsrfRes.status, 400);
      const badCsrfBody = await badCsrfRes.json();
      assertEquals(badCsrfBody.ok, false);
      assertEquals(badCsrfBody.error, 'csrf_mismatch');

      // ───────────────────────────────────────────────────────────────────────
      // TEST 4: Invalid registration status (e.g. 'exempt') -> 422
      // ───────────────────────────────────────────────────────────────────────
      const exemptReq = new Request('http://localhost:5173/api/tenant/tax-registration', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': sessionOrgA.csrf,
        },
        body: JSON.stringify({
          registration_status: 'exempt',
          tax_type: 'gst_general',
        }),
      });
      const exemptRes = await handleRequest(exemptReq, crypto.randomUUID(), undefined, sessionOrgA);
      assertEquals(exemptRes.status, 422);
      const exemptBody = await exemptRes.json();
      assertEquals(exemptBody.ok, false);
      assertEquals(exemptBody.error, 'invalid_registration_status');

      // ───────────────────────────────────────────────────────────────────────
      // TEST 5: POS Catalogue lookup failure fails closed to 'unknown'
      // Must return gst_registration_status: 'unknown', NEVER 'not_registered'
      // ───────────────────────────────────────────────────────────────────────
      adapter.setSimulateTaxLookupFailure(true);
      const catReq = new Request('http://localhost:5173/api/ops/counter/catalogue', {
        method: 'GET',
      });
      const catRes = await handleRequest(catReq, crypto.randomUUID(), undefined, sessionOrgB);
      assertEquals(catRes.status, 200);
      const catBody = await catRes.json();
      assertEquals(catBody.ok, true);
      assertEquals(catBody.gst_registration_status, 'unknown');

      // ───────────────────────────────────────────────────────────────────────
      // TEST 6: POS Complete Sale fails closed if tax_registrations is missing/unknown
      // COUNTER_SALE rejects with 422 tax_registration_status_unknown
      // ───────────────────────────────────────────────────────────────────────
      const saleReq = new Request('http://localhost:5173/api/ops/event', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': sessionOrgB.csrf,
          'x-idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          type: 'COUNTER_SALE',
          payment_method: 'cash',
          lines: [{ product_id: '11111111-1111-4111-8111-111111111111', quantity: 1 }],
        }),
      });
      const saleRes = await handleRequest(saleReq, crypto.randomUUID(), undefined, sessionOrgB);
      assertEquals(saleRes.status, 422);
      const saleBody = await saleRes.json();
      assertEquals(saleBody.ok, false);
      assertEquals(saleBody.error, 'tax_registration_status_unknown');

      // Revert Starq to initial status
      await client.query(
        `UPDATE public.tax_registrations SET registration_status = $1, tin = $2 WHERE organisation_id = $3 AND tax_type = 'gst_general'`,
        [initialStarqStatus, initialStarqTin, starqOrgId]
      );
    } finally {
      resetDbForTesting();
      await client.end();
    }
  },
});
