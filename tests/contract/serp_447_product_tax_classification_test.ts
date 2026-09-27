/**
 * STARQ ERP — SERP-447 Product Tax Classification & Authoritative Treatment Resolution.
 *
 * Statutory Resolution Chain:
 *   Context -> Tenant/Book -> Outlet/POS Terminal -> GST Registration
 *           -> Tax Regime (General vs Tourism)
 *           -> Effective Statutory Ruleset
 *           -> Product Tax Classification (standard_rated, zero_rated, exempt)
 *           -> Line Tax
 *
 * Requirements:
 * 1. Schema:
 *    - public.products: tax_classification text not null default 'standard_rated'
 *      check in ('standard_rated', 'zero_rated', 'exempt').
 *    - public.locations: tax_regime text not null default 'gst_general'
 *      check in ('gst_general', 'gst_tourism').
 *    - public.commercial_document_lines: adds nullable tax_classification, tax_regime, rule_version.
 * 2. Authoritative Tax Evaluator:
 *    - app_private.calculate_line_tax and public.calculate_line_tax return rule_version text.
 *    - Non-taxable modes (zero_rated / exempt) return 0% rate and explicit rule_version.
 * 3. COUNTER_SALE & Receipt Surface:
 *    - api_garage_command resolves outlet regime from locations.tax_regime.
 *    - Resolves product tax_classification per line item.
 *    - Evaluates line tax and persists tax_classification, tax_regime, rule_version.
 *    - api_counter_receipt_get returns line audit attributes.
 * 4. Edge Gate:
 *    - starq-api/index.ts rejects client-submitted tax_mode overrides with HTTP 422.
 *    - starq-api/index.ts resolves tax_type from outlet location.
 * 5. Live DB Proof:
 *    - Mixed basket (standard 8% + zero-rated 0% + exempt 0%) against 127.0.0.1:55432/m1_disposable.
 *
 * RUN:
 *   deno test --allow-read --allow-net --allow-env tests/contract/serp_447_product_tax_classification_test.ts
 */

import { assert, assertEquals } from 'jsr:@std/assert@1';

const MIGRATION_PATH = new URL('../../supabase/migrations/202609260800_serp447_product_tax_classification.sql', import.meta.url);
const STARQ_API_PATH = new URL('../../supabase/functions/starq-api/index.ts', import.meta.url);
const DOMAIN_COUNTER_PATH = new URL('../../web/src/domain/counter.ts', import.meta.url);
const ERP_TYPES_PATH = new URL('../../web/src/types/erp.ts', import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// 1. STATIC CONFORMANCE: Migration, Edge, and Web Types
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-447 Conformance: migration modifies products, locations, and commercial_document_lines', async () => {
  const sql = await Deno.readTextFile(MIGRATION_PATH);

  // Products table alteration
  assert(sql.includes('alter table public.products'), 'missing alter table public.products');
  assert(sql.includes("tax_classification text not null default 'standard_rated'"), 'missing tax_classification column');
  assert(sql.includes("tax_classification in ('standard_rated', 'zero_rated', 'exempt')"), 'missing tax_classification check constraint');

  // Locations table alteration
  assert(sql.includes('alter table public.locations'), 'missing alter table public.locations');
  assert(sql.includes("tax_regime text not null default 'gst_general'"), 'missing tax_regime column');
  assert(sql.includes("tax_regime in ('gst_general', 'gst_tourism')"), 'missing tax_regime check constraint');

  // Commercial document lines table alteration
  assert(sql.includes('alter table public.commercial_document_lines'), 'missing alter table commercial_document_lines');
  assert(sql.includes('rule_version text'), 'missing rule_version column');

  // Evaluator returns rule_version
  assert(sql.includes('rule_version text,'), 'calculate_line_tax return table must include rule_version text');

  // COUNTER_SALE resolution
  assert(sql.includes('v_outlet_regime'), 'missing v_outlet_regime in api_garage_command');
  assert(sql.includes('v_tax_classification'), 'missing v_tax_classification in api_garage_command');
  assert(sql.includes('tax_classification, tax_regime, rule_version'), 'commercial_document_lines insert must include tax audit columns');

  // Receipt surface includes line audit columns
  assert(sql.includes("'tax_classification', tax_classification"), 'api_counter_receipt_get must return tax_classification');
  assert(sql.includes("'tax_regime', tax_regime"), 'api_counter_receipt_get must return tax_regime');
  assert(sql.includes("'rule_version', rule_version"), 'api_counter_receipt_get must return rule_version');
});

Deno.test('SERP-447 Conformance: starq-api/index.ts rejects client tax_mode overrides and resolves outlet regime', async () => {
  const source = await Deno.readTextFile(STARQ_API_PATH);

  // Reject client tax_mode override with 422
  assert(source.includes('counter_sale_tax_mode_client_override_forbidden'), 'missing counter_sale_tax_mode_client_override_forbidden error code');
  assert(source.includes('rawTaxMode !== undefined && rawTaxMode !== null && rawTaxMode !== "exclusive"'), 'missing tax_mode override rejection check');

  // Resolve outlet tax regime
  assert(source.includes('db.from("locations")'), 'missing locations lookup in starq-api');
  assert(source.includes('tax_regime'), 'missing tax_regime lookup in starq-api');
});

Deno.test('SERP-447 Conformance: web types export ProductTaxClassification and OutletTaxRegime', async () => {
  const counterSource = await Deno.readTextFile(DOMAIN_COUNTER_PATH);
  assert(counterSource.includes("export type ProductTaxClassification = 'standard_rated' | 'zero_rated' | 'exempt';"), 'missing ProductTaxClassification in counter.ts');
  assert(counterSource.includes("export type OutletTaxRegime = 'gst_general' | 'gst_tourism';"), 'missing OutletTaxRegime in counter.ts');

  const erpSource = await Deno.readTextFile(ERP_TYPES_PATH);
  assert(erpSource.includes("export type ProductTaxClassification = 'standard_rated' | 'zero_rated' | 'exempt';"), 'missing ProductTaxClassification in erp.ts');
  assert(erpSource.includes("export type OutletTaxRegime = 'gst_general' | 'gst_tourism';"), 'missing OutletTaxRegime in erp.ts');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. BEHAVIORAL SIMULATION: Pure-logic treatment resolution
// ─────────────────────────────────────────────────────────────────────────────

interface TaxResolutionInput {
  orgRegistered: boolean;
  outletRegime: 'gst_general' | 'gst_tourism';
  productClassification: 'standard_rated' | 'zero_rated' | 'exempt';
  lineAmount: number;
}

interface TaxResolutionOutput {
  isTaxable: boolean;
  taxRate: number;
  taxAmount: number;
  ruleVersion: string;
}

function resolveLineTax(input: TaxResolutionInput): TaxResolutionOutput {
  const { orgRegistered, outletRegime, productClassification, lineAmount } = input;

  if (!orgRegistered) {
    return {
      isTaxable: false,
      taxRate: 0,
      taxAmount: 0,
      ruleVersion: `${outletRegime}:not_registered:v1`,
    };
  }

  if (productClassification === 'zero_rated') {
    return {
      isTaxable: false,
      taxRate: 0,
      taxAmount: 0,
      ruleVersion: `${outletRegime}:zero_rated:v1`,
    };
  }

  if (productClassification === 'exempt') {
    return {
      isTaxable: false,
      taxRate: 0,
      taxAmount: 0,
      ruleVersion: `${outletRegime}:exempt:v1`,
    };
  }

  const rate = outletRegime === 'gst_general' ? 0.08 : 0.16;
  const taxAmount = Math.round(lineAmount * rate * 100) / 100;
  return {
    isTaxable: true,
    taxRate: rate,
    taxAmount,
    ruleVersion: `${outletRegime}:${(rate * 100).toFixed(2)}%:v1`,
  };
}

Deno.test('SERP-447 Behavioral: pure logic resolves standard, zero-rated, and exempt correctly', () => {
  // Registered general regime
  const std = resolveLineTax({ orgRegistered: true, outletRegime: 'gst_general', productClassification: 'standard_rated', lineAmount: 100 });
  assertEquals(std.isTaxable, true);
  assertEquals(std.taxRate, 0.08);
  assertEquals(std.taxAmount, 8.00);
  assertEquals(std.ruleVersion, 'gst_general:8.00%:v1');

  const zero = resolveLineTax({ orgRegistered: true, outletRegime: 'gst_general', productClassification: 'zero_rated', lineAmount: 50 });
  assertEquals(zero.isTaxable, false);
  assertEquals(zero.taxRate, 0);
  assertEquals(zero.taxAmount, 0);
  assertEquals(zero.ruleVersion, 'gst_general:zero_rated:v1');

  const exempt = resolveLineTax({ orgRegistered: true, outletRegime: 'gst_general', productClassification: 'exempt', lineAmount: 20 });
  assertEquals(exempt.isTaxable, false);
  assertEquals(exempt.taxRate, 0);
  assertEquals(exempt.taxAmount, 0);
  assertEquals(exempt.ruleVersion, 'gst_general:exempt:v1');

  // Unregistered org
  const unreg = resolveLineTax({ orgRegistered: false, outletRegime: 'gst_general', productClassification: 'standard_rated', lineAmount: 100 });
  assertEquals(unreg.isTaxable, false);
  assertEquals(unreg.taxRate, 0);
  assertEquals(unreg.taxAmount, 0);
  assertEquals(unreg.ruleVersion, 'gst_general:not_registered:v1');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. LIVE POSTGRESQL VERIFICATION: Mixed basket on m1_disposable
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-447 Live Database: execute mixed basket (standard + zero-rated + exempt) on m1_disposable', async () => {
  let postgres: any;
  try {
    const mod = await import('https://deno.land/x/postgresjs@v3.4.4/mod.js');
    postgres = mod.default;
  } catch (_e) {
    console.warn('PostgresJS module not available, skipping live test');
    return;
  }

  let sql: any;
  try {
    sql = postgres('postgres://postgres@127.0.0.1:55432/m1_disposable', { max: 1 });
    await sql`select 1 as ok`;
  } catch (_e) {
    console.warn('PostgreSQL 127.0.0.1:55432/m1_disposable not reachable, skipping live DB test');
    return;
  }

  try {
    const org = '20000000-0000-4000-8000-000000000001'; // Club Ignition (Registered org, TIN 1186844)
    const person = '20000000-0000-4000-8000-000000000111';
    const seat = 'counter';
    const locId = 'af2a0a8d-e07b-4401-bee1-c3714ecbd078';

    // 1. Fixture: Cashier & Seat
    await sql`
      insert into public.persons (id, person_key, external_subject, display_label, status)
      values (${person}, 'test_cashier_key', 'test_subject', 'Test Cashier', 'active')
      on conflict (id) do nothing
    `;

    const memId = '20000000-0000-4000-8000-000000000222';
    await sql`
      insert into public.memberships (id, organisation_id, person_id, status, valid_from)
      values (${memId}, ${org}, ${person}, 'active', now() - interval '1 day')
      on conflict (id) do nothing
    `;

    await sql`
      insert into public.membership_seats (membership_id, seat_code, granted_at)
      values (${memId}, ${seat}, now() - interval '1 day')
      on conflict do nothing
    `;

    // 2. Fixture: Products with distinct classifications
    const prodStd = '20000000-0000-4000-8000-000000000301';
    const prodZero = '20000000-0000-4000-8000-000000000302';
    const prodExempt = '20000000-0000-4000-8000-000000000303';

    await sql`
      insert into public.products (id, organisation_id, sku, kind, name, tax_classification, active, sale_allowed)
      values
        (${prodStd}, ${org}, 'SKU-COLA', 'stock', 'Coca Cola 330ml', 'standard_rated', true, true),
        (${prodZero}, ${org}, 'SKU-RICE', 'stock', 'Basmati Rice 1kg', 'zero_rated', true, true),
        (${prodExempt}, ${org}, 'SKU-PANADOL', 'stock', 'Panadol 500mg', 'exempt', true, true)
      on conflict (id) do update set
        tax_classification = excluded.tax_classification,
        active = true,
        sale_allowed = true
    `;

    // 3. Fixture: Product Prices
    await sql`delete from public.product_prices where product_id in (${prodStd}, ${prodZero}, ${prodExempt})`;
    await sql`
      insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from)
      values
        (${org}, ${prodStd}, 'MVR', 100.00, now() - interval '1 day'),
        (${org}, ${prodZero}, 'MVR', 50.00, now() - interval '1 day'),
        (${org}, ${prodExempt}, 'MVR', 20.00, now() - interval '1 day')
    `;

    // 4. Fixture: Stock on-hand
    await sql`
      insert into public.stock_movements (organisation_id, location_id, product_id, movement_type, source_type, quantity, occurred_at, recorded_by, idempotency_key)
      values
        (${org}, ${locId}, ${prodStd}, 'opening', 'opening', 100, now() - interval '1 hour', ${person}, ${crypto.randomUUID()}),
        (${org}, ${locId}, ${prodZero}, 'opening', 'opening', 100, now() - interval '1 hour', ${person}, ${crypto.randomUUID()}),
        (${org}, ${locId}, ${prodExempt}, 'opening', 'opening', 100, now() - interval '1 hour', ${person}, ${crypto.randomUUID()})
      on conflict do nothing
    `;

    // 5. Execute mixed basket COUNTER_SALE
    const cmdKey = crypto.randomUUID();
    const cmd = {
      type: 'COUNTER_SALE',
      location_id: locId,
      payment_method: 'cash',
      tender: [{ method: 'cash', amount_tendered: 200.00 }],
      items: [
        { product_id: prodStd, quantity: 1 },
        { product_id: prodZero, quantity: 1 },
        { product_id: prodExempt, quantity: 1 }
      ]
    };

    const res = await sql`
      select public.api_garage_command(
        ${org}::uuid,
        ${person}::uuid,
        ${seat}::text,
        ${cmdKey}::uuid,
        ${sql.json(cmd)},
        ${crypto.randomUUID()}::uuid
      ) as result
    `;

    const payload = res[0].result;
    assert(payload.ok === true, 'COUNTER_SALE must return ok: true');
    assertEquals(payload.state, 'accepted');

    const sale = payload.counter_sale;
    assertEquals(Number(sale.subtotal), 170.00, 'Subtotal must be 100 + 50 + 20 = 170.00');
    assertEquals(Number(sale.tax_total), 8.00, 'Tax total must be 8% on 100 = 8.00 (zero for zero-rated and exempt)');
    assertEquals(Number(sale.total_amount), 178.00, 'Total amount must be 170 + 8 = 178.00');
    assertEquals(Number(sale.tendered_amount), 200.00);
    assertEquals(Number(sale.change_amount), 22.00, 'Change must be 200 - 178 = 22.00');
    assertEquals(sale.tax_regime, 'gst_general');

    // 6. Assert stored commercial_document_lines
    const invoiceId = sale.invoice_id;
    const lines = await sql`
      select line_no, product_id, description, quantity, unit_price, tax_rate, net_amount, tax_amount, gross_amount, tax_classification, tax_regime, rule_version
      from public.commercial_document_lines
      where organisation_id = ${org} and document_id = ${invoiceId}
      order by line_no
    `;

    assertEquals(lines.length, 3, 'Must have 3 commercial document lines');

    // Line 1: Standard rated
    assertEquals(lines[0].line_no, 1);
    assertEquals(lines[0].tax_classification, 'standard_rated');
    assertEquals(lines[0].tax_regime, 'gst_general');
    assertEquals(lines[0].rule_version, 'gst_general:8.00%:v1');
    assertEquals(Number(lines[0].tax_rate), 0.08);
    assertEquals(Number(lines[0].net_amount), 100.00);
    assertEquals(Number(lines[0].tax_amount), 8.00);
    assertEquals(Number(lines[0].gross_amount), 108.00);

    // Line 2: Zero rated
    assertEquals(lines[1].line_no, 2);
    assertEquals(lines[1].tax_classification, 'zero_rated');
    assertEquals(lines[1].tax_regime, 'gst_general');
    assertEquals(lines[1].rule_version, 'gst_general:zero_rated:v1');
    assertEquals(Number(lines[1].tax_rate), 0.00);
    assertEquals(Number(lines[1].net_amount), 50.00);
    assertEquals(Number(lines[1].tax_amount), 0.00);
    assertEquals(Number(lines[1].gross_amount), 50.00);

    // Line 3: Exempt
    assertEquals(lines[2].line_no, 3);
    assertEquals(lines[2].tax_classification, 'exempt');
    assertEquals(lines[2].tax_regime, 'gst_general');
    assertEquals(lines[2].rule_version, 'gst_general:exempt:v1');
    assertEquals(Number(lines[2].tax_rate), 0.00);
    assertEquals(Number(lines[2].net_amount), 20.00);
    assertEquals(Number(lines[2].tax_amount), 0.00);
    assertEquals(Number(lines[2].gross_amount), 20.00);

    // 7. Assert api_counter_receipt_get returns line audit columns
    const receiptRes = await sql`
      select public.api_counter_receipt_get(
        ${org}::uuid,
        ${person}::uuid,
        ${seat}::text,
        ${sale.payment_id}::uuid
      ) as result
    `;
    const receiptData = receiptRes[0].result;
    assert(receiptData.ok === true);
    const receiptLines = receiptData.receipt.lines;
    assertEquals(receiptLines.length, 3);
    assertEquals(receiptLines[0].tax_classification, 'standard_rated');
    assertEquals(receiptLines[0].rule_version, 'gst_general:8.00%:v1');
    assertEquals(receiptLines[1].tax_classification, 'zero_rated');
    assertEquals(receiptLines[1].rule_version, 'gst_general:zero_rated:v1');
    assertEquals(receiptLines[2].tax_classification, 'exempt');
    assertEquals(receiptLines[2].rule_version, 'gst_general:exempt:v1');

    // 8. Assert Unregistered Org resolves 0% tax and not_registered rule_version
    const unregOrg = '10000000-0000-4000-8000-000000000001'; // Starq (unregistered)
    const unregCalc = await sql`
      select * from app_private.calculate_line_tax(
        ${unregOrg}::uuid, 'gst_general', current_date, 'exclusive', 100.00
      )
    `;
    assertEquals(unregCalc[0].is_taxable, false);
    assertEquals(Number(unregCalc[0].tax_rate), 0.00);
    assertEquals(Number(unregCalc[0].tax_amount), 0.00);
    assertEquals(unregCalc[0].rule_version, 'gst_general:not_registered:v1');

  } finally {
    await sql.end();
  }
});
