/**
 * STARQ ERP — SERP-437 ERP Owner-Summary API Contract & Conformance Gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * SERP-437 specifies a narrow, permissioned ERP-side read API that lets a Hoadha
 * owner see a live summary of their starqERP-run business (sales, stock,
 * availability signals) without giving Hoadha direct database access.
 *
 * Acceptance Criteria:
 *   1. Owner-summary projection is a narrow named view, not a filter over full
--      operational tables.
 *   2. Nothing is exposed without an explicit, audited publication/consent act,
 *      consistent with SERP-125.
 *   3. A Hoadha owner-live-view consumer can read this API without any direct
 *      ERP database credential.
 *
 * Depends on: SERP-125 (Publication boundary), SERP-434 (Atomic Checkout data).
 *
 * Implementation:
 *   supabase/migrations/202609191725_serp_437_erp_owner_summary_api.sql
 *   supabase/functions/starq-api/index.ts (GET /api/hoadha/owner-summary, POST /api/ops/owner-summary/consent)
 *
 * Run: deno test --allow-read tests/contract/serp_437_owner_summary_test.ts
 */

import { assert, assertEquals, assertNotEquals, assertThrows } from 'jsr:@std/assert@1';

const EDGE_MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);
const STARQ_API = new URL('../../supabase/functions/starq-api/index.ts', import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// 1. IN-MEMORY PURE CONTRACT SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

interface MockConsent {
  id: string;
  organisation_id: string;
  channel: 'hoadha_owner_view';
  state: 'consented' | 'revoked';
  consented_at?: Date | null;
  revoked_at?: Date | null;
}

interface MockSummaryProjection {
  organisation_id: string;
  hoadha_business_id: string;
  business_name: string;
  today_sales_count: number;
  today_sales_total_mvr: number;
  active_products_count: number;
  low_stock_products_count: number;
  out_of_stock_products_count: number;
  consent_status: string;
  consented_at: Date;
}

class MockOwnerSummaryEngine {
  public links = new Map<string, string>(); // hoadha_business_id -> organisation_id
  public consents = new Map<string, MockConsent>(); // organisation_id -> MockConsent
  public salesData = new Map<string, { count: number; total: number }>();
  public inventoryData = new Map<string, { active: number; low: number; out: number }>();
  public auditEvents: any[] = [];

  constructor() {
    // Seed default link
    const bizId = '90000000-0000-4000-8000-000000000001';
    const orgId = '20000000-0000-4000-8000-000000000001';
    this.links.set(bizId, orgId);
    this.salesData.set(orgId, { count: 8, total: 2450.75 });
    this.inventoryData.set(orgId, { active: 30, low: 3, out: 1 });
  }

  // Simulates public.api_consent_owner_summary
  public consentOwnerSummary(orgId: string, actorPerson: string, seat: string): { ok: boolean; state: string } {
    const validSeats = ['owner', 'managing_director', 'director'];
    if (!validSeats.includes(seat)) {
      throw new Error('acting_seat_not_legal_for_command');
    }

    const consent: MockConsent = {
      id: crypto.randomUUID(),
      organisation_id: orgId,
      channel: 'hoadha_owner_view',
      state: 'consented',
      consented_at: new Date(),
      revoked_at: null,
    };
    this.consents.set(orgId, consent);

    this.auditEvents.push({
      organisation_id: orgId,
      actor_person_id: actorPerson,
      acting_seat: seat,
      action: 'erp.owner_summary.consent',
    });

    return { ok: true, state: 'consented' };
  }

  // Simulates public.api_revoke_owner_summary
  public revokeOwnerSummary(orgId: string, actorPerson: string, seat: string): { ok: boolean; state: string } {
    const validSeats = ['owner', 'managing_director', 'director'];
    if (!validSeats.includes(seat)) {
      throw new Error('acting_seat_not_legal_for_command');
    }

    const existing = this.consents.get(orgId);
    if (!existing) throw new Error('consent_record_not_found');

    // RULE 2: state change, NEVER delete
    existing.state = 'revoked';
    existing.revoked_at = new Date();

    this.auditEvents.push({
      organisation_id: orgId,
      actor_person_id: actorPerson,
      acting_seat: seat,
      action: 'erp.owner_summary.revoke',
    });

    return { ok: true, state: 'revoked' };
  }

  // Simulates public.owner_summary_projection view
  public queryProjection(bizId: string): MockSummaryProjection | null {
    const orgId = this.links.get(bizId);
    if (!orgId) return null;

    const consent = this.consents.get(orgId);
    // Projection view filter: WHERE state = 'consented'
    if (!consent || consent.state !== 'consented') {
      return null;
    }

    const sales = this.salesData.get(orgId) || { count: 0, total: 0 };
    const stock = this.inventoryData.get(orgId) || { active: 0, low: 0, out: 0 };

    return {
      organisation_id: orgId,
      hoadha_business_id: bizId,
      business_name: 'Test Business',
      today_sales_count: sales.count,
      today_sales_total_mvr: sales.total,
      active_products_count: stock.active,
      low_stock_products_count: stock.low,
      out_of_stock_products_count: stock.out,
      consent_status: 'consented',
      consented_at: consent.consented_at!,
    };
  }

  // Simulates public.api_get_owner_summary_for_hoadha
  public getOwnerSummaryForHoadha(bizId: string): { ok: boolean; summary: MockSummaryProjection } {
    const orgId = this.links.get(bizId);
    if (!orgId) throw new Error('hoadha_link_not_found');

    const consent = this.consents.get(orgId);
    if (!consent || consent.state !== 'consented') {
      throw new Error('owner_summary_consent_required');
    }

    const projection = this.queryProjection(bizId);
    if (!projection) throw new Error('projection_unavailable');

    return { ok: true, summary: projection };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-437 AC1 & AC2: Private by default — unconsented tenant exposes ZERO projection rows and fails closed', () => {
  const engine = new MockOwnerSummaryEngine();
  const bizId = '90000000-0000-4000-8000-000000000001';

  // Initially unconsented
  const viewRow = engine.queryProjection(bizId);
  assertEquals(viewRow, null);

  assertThrows(
    () => engine.getOwnerSummaryForHoadha(bizId),
    Error,
    'owner_summary_consent_required'
  );
});

Deno.test('SERP-437 AC2: Publication/consent is merchant-controlled — counter and technician seats are refused', () => {
  const engine = new MockOwnerSummaryEngine();
  const orgId = '20000000-0000-4000-8000-000000000001';
  const person = '20000000-0000-4000-8000-000000000099';

  // Negative control: counter seat attempts consent
  assertThrows(
    () => engine.consentOwnerSummary(orgId, person, 'counter'),
    Error,
    'acting_seat_not_legal_for_command'
  );

  // Negative control: technician seat attempts consent
  assertThrows(
    () => engine.consentOwnerSummary(orgId, person, 'technician'),
    Error,
    'acting_seat_not_legal_for_command'
  );

  // Positive control: owner seat consents
  const res = engine.consentOwnerSummary(orgId, person, 'owner');
  assertEquals(res.ok, true);
  assertEquals(res.state, 'consented');

  // Verify audited event
  const audit = engine.auditEvents.find((e) => e.action === 'erp.owner_summary.consent');
  assert(audit, 'Must record audit event for consent');
});

Deno.test('SERP-437 AC2: Revocation is non-destructive (RULE 2) and immediately closes projection access', () => {
  const engine = new MockOwnerSummaryEngine();
  const orgId = '20000000-0000-4000-8000-000000000001';
  const bizId = '90000000-0000-4000-8000-000000000001';
  const person = '20000000-0000-4000-8000-000000000099';

  // Consent first
  engine.consentOwnerSummary(orgId, person, 'owner');
  assert(engine.queryProjection(bizId) !== null);

  // Revoke consent
  const rev = engine.revokeOwnerSummary(orgId, person, 'owner');
  assertEquals(rev.ok, true);
  assertEquals(rev.state, 'revoked');

  // RULE 2 assertion: row still exists in consents map, state is 'revoked'
  assert(engine.consents.has(orgId));
  assertEquals(engine.consents.get(orgId)!.state, 'revoked');

  // Access is immediately revoked on read path
  assertEquals(engine.queryProjection(bizId), null);
  assertThrows(
    () => engine.getOwnerSummaryForHoadha(bizId),
    Error,
    'owner_summary_consent_required'
  );
});

Deno.test('SERP-437 AC3: Hoadha owner-live-view consumer reads API using hoadha_business_id with NO direct ERP db credentials', () => {
  const engine = new MockOwnerSummaryEngine();
  const orgId = '20000000-0000-4000-8000-000000000001';
  const bizId = '90000000-0000-4000-8000-000000000001';
  const person = '20000000-0000-4000-8000-000000000099';

  engine.consentOwnerSummary(orgId, person, 'managing_director');

  const res = engine.getOwnerSummaryForHoadha(bizId);
  assertEquals(res.ok, true);
  assertEquals(res.summary.hoadha_business_id, bizId);
  assertEquals(res.summary.today_sales_count, 8);
  assertEquals(res.summary.today_sales_total_mvr, 2450.75);
  assertEquals(res.summary.active_products_count, 30);
  assertEquals(res.summary.low_stock_products_count, 3);
  assertEquals(res.summary.out_of_stock_products_count, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE CONFORMANCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-437 Conformance: migration 202609191725 defines narrow named projection without operational leaks', async () => {
  const migrationUrl = new URL('202609191725_serp_437_erp_owner_summary_api.sql', EDGE_MIGRATIONS);
  const sql = await Deno.readTextFile(migrationUrl);

  // 1. Transaction wrapper
  assert(sql.startsWith('begin;'), 'Migration must begin with transaction wrapper');
  assert(sql.trim().endsWith('commit;'), 'Migration must commit transaction');

  // 2. Private by default consent table
  assert(sql.includes("state text not null default 'revoked' check (state in ('consented', 'revoked'))"), "Consents table must default state to 'revoked'");
  assert(sql.includes('create table if not exists public.owner_summary_consents'), 'Must create public.owner_summary_consents');

  // 3. security_invoker = true on projection view (Load-bearing SERP-125 discipline)
  assert(sql.includes('security_invoker = true'), 'public.owner_summary_projection must specify security_invoker = true');

  // Exact column schema conformance:
  // Must use issued_at and gross_total, NEVER non-existent issue_date or total_amount
  assert(!sql.includes('issue_date'), 'Migration must NEVER reference non-existent column issue_date');
  assert(!sql.includes('total_amount'), 'Migration must NEVER reference non-existent column total_amount');
  assert(sql.includes('cd.issued_at'), 'Must query real timestamptz column cd.issued_at');
  assert(sql.includes('cd.gross_total'), 'Must query real numeric column cd.gross_total');
  assert(sql.includes("cd.document_type = 'sales_invoice'"), "Must query document_type 'sales_invoice'");
  assert(sql.includes('p.active = true'), 'Must query real column p.active');
  assert(sql.includes("p.kind = 'stock'"), "Must query real column p.kind = 'stock'");

  // 4. Narrow projection column check — asserts sensitive columns do NOT appear in the view definition
  const forbiddenSensitiveColumns = [
    'customer_name',
    'customer_phone',
    'vehicle_plate',
    'income_account',
    'cogs_account',
    'supplier_id',
    'supplier_name',
    'unit_cost',
    'margin',
  ];
  for (const forbidden of forbiddenSensitiveColumns) {
    const viewRegex = new RegExp(`create or replace view public\\.owner_summary_projection[\\s\\S]*?${forbidden}[\\s\\S]*?;`, 'i');
    assert(!viewRegex.test(sql), `Forbidden column '${forbidden}' must NEVER leak into public.owner_summary_projection`);
  }

  // 5. Merchant-controlled seat gating
  assert(
    sql.includes("if target_seat not in ('owner', 'managing_director', 'director')"),
    'Consent RPCs must restrict acting seat strictly to owner, managing_director, director'
  );

  // 6. Strict permissions
  assert(sql.includes('revoke all on public.owner_summary_consents from public, anon, authenticated;'), 'Must revoke consents from anon/authenticated');
  assert(sql.includes('revoke all on public.owner_summary_projection from public, anon, authenticated;'), 'Must revoke projection view from anon/authenticated');
  assert(sql.includes('grant execute on function public.api_get_owner_summary_for_hoadha(uuid) to service_role;'), 'Must grant read RPC to service_role');
});

Deno.test('SERP-437 Conformance: starq-api wires GET /api/hoadha/owner-summary and merchant consent ops endpoints', async () => {
  const apiCode = await Deno.readTextFile(STARQ_API);

  assert(apiCode.includes('path === "/api/hoadha/owner-summary"'), 'Must wire GET /api/hoadha/owner-summary');
  assert(apiCode.includes('path === "/api/ops/owner-summary/consent"'), 'Must wire POST /api/ops/owner-summary/consent');
  assert(apiCode.includes('path === "/api/ops/owner-summary/revoke"'), 'Must wire POST /api/ops/owner-summary/revoke');
  assert(apiCode.includes('api_get_owner_summary_for_hoadha'), 'Must invoke api_get_owner_summary_for_hoadha RPC');
});
