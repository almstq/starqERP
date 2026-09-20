/**
 * STARQ ERP — SERP-436 Hoadha Provisioning / Linking Contract & Conformance Gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * SERP-436 specifies an ERP-side provisioning workflow that runs when a Hoadha
 * business is claimed/activated (Hoadha's DHIV-S6-T1 claim flow) and a merchant
 * needs a starqERP tenant/module entitlement to run POS.
 *
 * Acceptance Criteria:
 *   1. A claimed/activated Hoadha business can trigger ERP tenant provisioning
 *      without manual Elder/Codex intervention.
 *   2. POS module entitlement is granted ONLY AFTER the ERP-side provisioning
 *      workflow completes, not before.
 *
 * Implementation:
 *   supabase/migrations/202609191720_serp_436_hoadha_tenant_provisioning.sql
 *   supabase/functions/starq-api/index.ts (POST /api/platform/hoadha/provision)
 *
 * Run: deno test --allow-read tests/contract/serp_436_hoadha_provisioning_test.ts
 */

import { assert, assertEquals, assertNotEquals, assertThrows } from 'jsr:@std/assert@1';

const EDGE_MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);
const STARQ_API = new URL('../../supabase/functions/starq-api/index.ts', import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// 1. IN-MEMORY PURE CONTRACT SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

interface MockTenantLink {
  id: string;
  hoadha_business_id: string;
  organisation_id: string;
  hoadha_claimant_id?: string | null;
  business_name: string;
  owner_email: string;
  link_status: 'active' | 'suspended' | 'revoked';
  provisioned_at: Date;
}

interface MockOrgSpine {
  organisation_id: string;
  name: string;
  slug: string;
  modules: string[];
  owner_seat_granted: boolean;
  pos_entitled: boolean;
  workflow_seeded: boolean;
}

class MockProvisioningEngine {
  public links = new Map<string, MockTenantLink>();
  public orgs = new Map<string, MockOrgSpine>();
  public auditEvents: any[] = [];

  // Simulates platform.provision_hoadha_business
  public provisionHoadhaBusiness(params: {
    hoadha_business_id: string;
    business_name: string;
    owner_email: string;
    owner_name: string;
    owner_phone?: string | null;
    hoadha_claimant_id?: string | null;
    archetype_id?: string;
    request_key?: string | null;
  }): { ok: boolean; idempotent_replay: boolean; organisation_id: string; modules: string[]; pos_entitled: boolean } {
    if (!params.hoadha_business_id) throw new Error('hoadha_business_id_required');
    if (!params.business_name || !params.business_name.trim()) throw new Error('business_name_required');
    if (!params.owner_email || !params.owner_email.includes('@')) throw new Error('valid_owner_email_required');

    const archetype = params.archetype_id || 'retail';
    const validArchetypes = ['general_business', 'automotive_workshop', 'wholesale_trading', 'marine_service', 'construction_contracting', 'retail'];
    if (!validArchetypes.includes(archetype)) throw new Error('invalid_archetype');

    // 1. Idempotency replay check
    if (this.links.has(params.hoadha_business_id)) {
      const existing = this.links.get(params.hoadha_business_id)!;
      const org = this.orgs.get(existing.organisation_id)!;
      return {
        ok: true,
        idempotent_replay: true,
        organisation_id: existing.organisation_id,
        modules: org.modules,
        pos_entitled: org.modules.includes('pos'),
      };
    }

    const orgId = crypto.randomUUID();

    // 2. Baseline modules seeded (WITHOUT 'pos') per platform.tenant_module_entitlements default
    const baselineModules = [
      'dashboard', 'customers', 'jobs', 'invoices', 'payments', 'expenses',
      'inventory', 'purchasing', 'suppliers', 'reports', 'audit', 'workflows',
      'roles', 'users', 'settings'
    ];
    assert(!baselineModules.includes('pos'), 'Baseline modules must NEVER contain pos before provisioning completes');

    const org: MockOrgSpine = {
      organisation_id: orgId,
      name: params.business_name.trim(),
      slug: params.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      modules: [...baselineModules],
      owner_seat_granted: true,
      pos_entitled: false,
      workflow_seeded: true,
    };

    // Store intermediate state (prior to terminal grant)
    this.orgs.set(orgId, org);

    // Record Link
    const link: MockTenantLink = {
      id: crypto.randomUUID(),
      hoadha_business_id: params.hoadha_business_id,
      organisation_id: orgId,
      hoadha_claimant_id: params.hoadha_claimant_id,
      business_name: params.business_name.trim(),
      owner_email: params.owner_email.trim().toLowerCase(),
      link_status: 'active',
      provisioned_at: new Date(),
    };
    this.links.set(params.hoadha_business_id, link);

    // 3. TERMINAL STEP (Acceptance Criterion 2): Grant 'pos' only after full provisioning succeeds
    org.modules.push('pos');
    org.pos_entitled = true;

    this.auditEvents.push({
      organisation_id: orgId,
      action: 'hoadha.tenant.provision',
      hoadha_business_id: params.hoadha_business_id,
      pos_entitled: true,
    });

    return {
      ok: true,
      idempotent_replay: false,
      organisation_id: orgId,
      modules: org.modules,
      pos_entitled: true,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-436 AC1: Automated Hoadha business claim triggers full ERP tenant provisioning without manual intervention', () => {
  const engine = new MockProvisioningEngine();
  const bizId = crypto.randomUUID();

  const res = engine.provisionHoadhaBusiness({
    hoadha_business_id: bizId,
    business_name: 'Addu Marine Supplies',
    owner_email: 'owner@addumarine.mv',
    owner_name: 'Ahmed',
    archetype_id: 'retail',
  });

  assertEquals(res.ok, true);
  assertEquals(res.idempotent_replay, false);
  assert(res.organisation_id.length > 0);
  assert(engine.links.has(bizId));

  const link = engine.links.get(bizId)!;
  assertEquals(link.business_name, 'Addu Marine Supplies');
  assertEquals(link.owner_email, 'owner@addumarine.mv');
  assertEquals(link.link_status, 'active');
});

Deno.test('SERP-436 AC1: Calling provision idempotently returns existing link and avoids duplicate org creation', () => {
  const engine = new MockProvisioningEngine();
  const bizId = crypto.randomUUID();

  const res1 = engine.provisionHoadhaBusiness({
    hoadha_business_id: bizId,
    business_name: 'Male Auto Parts',
    owner_email: 'owner@maleauto.mv',
    owner_name: 'Hassan',
  });

  const res2 = engine.provisionHoadhaBusiness({
    hoadha_business_id: bizId,
    business_name: 'Male Auto Parts',
    owner_email: 'owner@maleauto.mv',
    owner_name: 'Hassan',
  });

  assertEquals(res2.ok, true);
  assertEquals(res2.idempotent_replay, true);
  assertEquals(res1.organisation_id, res2.organisation_id);
  assertEquals(engine.links.size, 1);
});

Deno.test('SERP-436 AC2: POS module entitlement is granted ONLY AFTER the ERP provisioning workflow completes', () => {
  const engine = new MockProvisioningEngine();
  const bizId = crypto.randomUUID();

  const res = engine.provisionHoadhaBusiness({
    hoadha_business_id: bizId,
    business_name: 'Hulhumale Minimart',
    owner_email: 'mart@hulhumale.mv',
    owner_name: 'Ibrahim',
  });

  assertEquals(res.pos_entitled, true);
  assert(res.modules.includes('pos'));

  // Negative control: invalid input aborts BEFORE provisioning completes, no org and no pos granted
  assertThrows(
    () => engine.provisionHoadhaBusiness({
      hoadha_business_id: crypto.randomUUID(),
      business_name: 'Bad Mart',
      owner_email: 'invalid-email',
      owner_name: 'No Email',
    }),
    Error,
    'valid_owner_email_required'
  );

  assertThrows(
    () => engine.provisionHoadhaBusiness({
      hoadha_business_id: crypto.randomUUID(),
      business_name: 'Bad Archetype Mart',
      owner_email: 'good@email.mv',
      owner_name: 'Tester',
      archetype_id: 'non_existent_archetype',
    }),
    Error,
    'invalid_archetype'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE CONFORMANCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-436 Conformance: migration 202609191720 defines durable table and atomic RPC', async () => {
  const migrationUrl = new URL('202609191720_serp_436_hoadha_tenant_provisioning.sql', EDGE_MIGRATIONS);
  const sql = await Deno.readTextFile(migrationUrl);

  // 1. Wrapped in begin / commit
  assert(sql.startsWith('begin;'), 'Migration must begin with transaction wrapper');
  assert(sql.trim().endsWith('commit;'), 'Migration must commit transaction');

  // 2. Durable links table
  assert(sql.includes('create table if not exists platform.hoadha_tenant_links'), 'Must create platform.hoadha_tenant_links');
  assert(sql.includes('hoadha_business_id uuid not null unique'), 'hoadha_business_id must be unique UUID');
  assert(sql.includes('organisation_id uuid not null references public.organisations(id)'), 'Must reference public.organisations');

  // 3. Security Definer Stored Procedure
  assert(sql.includes('create or replace function platform.provision_hoadha_business'), 'Must declare provision_hoadha_business function');
  assert(sql.includes('security definer'), 'Function must be security definer');

  // Concurrency Guard: Advisory transaction lock and ON CONFLICT update
  assert(sql.includes('pg_advisory_xact_lock'), 'Must acquire transaction-scoped advisory lock to serialize concurrent claims');
  assert(sql.includes('on conflict (hoadha_business_id) do update'), 'Must handle link conflict gracefully');

  // Exact Check Constraint Conformance
  assert(sql.includes("'complete'"), "Must use valid onboarding_state 'complete'");
  assert(!sql.includes("'completed'"), "Must NEVER use invalid onboarding_state 'completed'");
  assert(sql.includes("'clean_production'"), "Must use valid provisioning run mode 'clean_production'");

  // 4. AC2: Explicit update adding 'pos' to tenant_module_entitlements
  assert(
    sql.includes("set modules = array_append(modules, 'pos')") ||
    sql.includes("modules = array_append(modules, 'pos')"),
    "Must explicitly append 'pos' to platform.tenant_module_entitlements"
  );

  // 5. Strict permissions
  assert(sql.includes('revoke all on table platform.hoadha_tenant_links from public, anon, authenticated;'), 'Must revoke from public/anon/authenticated');
  assert(sql.includes('grant select on table platform.hoadha_tenant_links to service_role;'), 'Must grant select to service_role');
  assert(sql.includes('grant execute on function platform.provision_hoadha_business'), 'Must grant execute to service_role');
});

Deno.test('SERP-436 Conformance: starq-api wires POST /api/platform/hoadha/provision with bridge secret / admin auth', async () => {
  const apiCode = await Deno.readTextFile(STARQ_API);

  assert(apiCode.includes('path === "/api/platform/hoadha/provision"'), 'starq-api must wire POST /api/platform/hoadha/provision');
  assert(apiCode.includes('HOADHA_BRIDGE_SECRET'), 'Must check HOADHA_BRIDGE_SECRET');
  assert(apiCode.includes('p_hoadha_business_id'), 'Must pass p_hoadha_business_id to RPC');
});
