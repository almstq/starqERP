import fs from 'fs';
import path from 'path';

const nexusPath = 'D:/StarqTech/starqNexus/data/starq-erp-tasks.json';
const data = JSON.parse(fs.readFileSync(nexusPath, 'utf8'));

// Verify baseline
const existingIds = new Set(data.tasks.map((t) => t.id));
console.log('Starting baseline tasks:', data.tasks.length);
console.log('Existing done count:', data.tasks.filter((t) => t.status === 'done').length);

const newTasks = [
  // ==========================================
  // GROUP 1 (G1): COMMERCIAL PILOT READINESS / EXPEDITE NOW (P0)
  // ==========================================
  {
    id: 'SERP-283',
    title: 'Platform realignment PR #10 CI resolution and branch merge',
    description: 'Resolve all CI test checks on PR #10 (feat/platform-realignment), confirm 100% green test suite across all 37 test files, and merge to main.',
    phase: 'Phase 1 - Organisation spine',
    blueprint_phase: 1,
    release_track: 'R1',
    group: 'G1',
    status: 'next',
    priority: 'P0',
    module: 'platform',
    dependencies: [],
    acceptance: [
      'PR #10 CI quality gate passes cleanly on GitHub Actions',
      '37 test files / 153 tests pass with 0 TypeScript compilation errors',
      'Vite production build succeeds in < 10s',
      'Branch feat/platform-realignment is cleanly merged into main'
    ]
  },
  {
    id: 'SERP-284',
    title: 'Live database deployment and verification of Migrations 0024 & 0025',
    description: 'Deploy 202608270024_platform_control_plane.sql (platform schema and registry) and 202608270025_books_and_operating_activities.sql (books, memberships, shared locations) to live Supabase.',
    phase: 'Phase 1 - Organisation spine',
    blueprint_phase: 1,
    release_track: 'R1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'database',
    dependencies: ['SERP-283'],
    acceptance: [
      'Migration 0024 applied and verified on live Supabase instance',
      'Migration 0025 applied and verified on live Supabase instance',
      'Deterministic default books backfilled for Starq Technologies (STQ, DYN) and Club Ignition (INK)',
      'Composite tenant-safe FK constraints active on garage_jobs, commercial_documents, journal_entries'
    ]
  },
  {
    id: 'SERP-285',
    title: 'Gateway full authorization graph resolution on Google sign-in',
    description: 'Update establishPerson in Edge Function to return complete authorization graph: identity -> platform_entitlement + tenant memberships -> legal entities -> operating books.',
    phase: 'Phase 1 - Organisation spine',
    blueprint_phase: 1,
    release_track: 'R1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'auth',
    dependencies: ['SERP-284'],
    acceptance: [
      'POST /api/auth/google returns full user authorization graph with platform_entitlement and organisations[]',
      'Each organization exposes its available operable books (public.books)',
      'Active context initializes to primary tenant and default book',
      'Zero ambient access granted across unassigned organizations or platform plane'
    ]
  },
  {
    id: 'SERP-286',
    title: 'Tenant-admin self-service staff invitation and lifecycle workflow',
    description: 'Implement complete self-service staff invitation lifecycle: public.invitations table, tenant owner invites Google email, assigns organization/books/locations/roles, employee accepts on Google login, with expiry, resend, revoke, and exact-email mismatch prevention.',
    phase: 'Phase 1 - Organisation spine',
    blueprint_phase: 1,
    release_track: 'R1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'auth',
    dependencies: ['SERP-285'],
    acceptance: [
      'Tenant admin can send employee invitation with role, books, and locations assigned',
      'Invitation creates pending record in public.invitations with 7-day expiration token',
      'Employee signing in with matching Google email automatically activates membership',
      'Mismatched email or uninvited login is rejected with unauthorized_invitation_required',
      'Admin can resend, revoke, suspend, or terminate staff with immutable audit event logging',
      'Seat limits per subscription plan are strictly enforced at invitation creation'
    ]
  },
  {
    id: 'SERP-287',
    title: 'Removal of hardcoded backend staff allowlist dependency',
    description: 'Deprecate and remove the hardcoded STARQBOOKS_ALLOWLIST_JSON environment variable requirement; transition production auth resolution entirely to dynamic public.persons, public.memberships, and public.invitations.',
    phase: 'Phase 1 - Organisation spine',
    blueprint_phase: 1,
    release_track: 'R1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'auth',
    dependencies: ['SERP-286'],
    acceptance: [
      'Edge function establishPerson queries database tables instead of environment JSON',
      'Existing pilot accounts seamlessly migrated to database person/membership rows',
      'New organizations can onboard staff without backend redeployment'
    ]
  },
  {
    id: 'SERP-288',
    title: 'Clean production workspace hygiene and zero demo data contamination',
    description: 'Enforce strict isolation between production workspaces and mock demo data: ensure freshly provisioned organizations start with calm empty states, 0 mock customers/invoices/stock, and genuine operational alerts only.',
    phase: 'Phase 2 - Measured internal pilot',
    blueprint_phase: 2,
    release_track: 'R2',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'ui',
    dependencies: ['SERP-287'],
    acceptance: [
      'New organization renders 100% clean dashboard with calm empty states and zero fake incidents',
      'No demo customers, suppliers, invoices, or inventory items leak into customer tenant',
      'Dashboard alerts and AI recommendations generate exclusively from real transactional records'
    ]
  },
  {
    id: 'SERP-289',
    title: 'Removal of browser/mock business authority & pure Edge RPC routing',
    description: 'Transition all mutating actions in the web client (creating invoices, updating stock, executing job transitions, recording payments) to route exclusively through signed Edge RPCs with CSRF and idempotency keys, eliminating in-memory mock fallback mutations.',
    phase: 'Phase 2 - Measured internal pilot',
    blueprint_phase: 2,
    release_track: 'R2',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'gateway',
    dependencies: ['SERP-288'],
    acceptance: [
      'All business operations dispatch to /api/ops/* endpoints with signed HMAC session cookie',
      'UI displays transactional loading and optimistic state with server rollback on rejection',
      'No direct unauthenticated state mutation occurs in browser memory'
    ]
  },
  {
    id: 'SERP-290',
    title: 'Chart of Accounts management and account hierarchy UI',
    description: 'Build user-facing Chart of Accounts management interface allowing accountants to view, add, and configure asset, liability, equity, revenue, and expense sub-accounts with MVR/USD designations.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'accounting',
    dependencies: ['SERP-289'],
    acceptance: [
      'Standard Maldivian Chart of Accounts seeded per industry archetype',
      'Accountant can create sub-accounts under Assets, Liabilities, Equity, Revenue, Expenses',
      'Account balances display real-time roll-up from posted general ledger lines',
      'Account activation, archival, and currency tagging supported'
    ]
  },
  {
    id: 'SERP-291',
    title: 'Live double-entry journal posting UI and General Ledger explorer',
    description: 'Implement real-time general ledger journal posting on all commercial transactions (sales, purchases, payments, adjustments) with balanced DR/CR validation and a General Ledger explorer view.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'accounting',
    dependencies: ['SERP-290'],
    acceptance: [
      'Every invoice, bill, and payment generates balanced journal_entries and journal_lines',
      'General Ledger explorer allows searching and filtering all debit/credit postings by account and date',
      'Unbalanced journal entries are rejected by database triggers',
      'Manual journal entry creator provided for adjustments with audit attribution'
    ]
  },
  {
    id: 'SERP-292',
    title: 'Standard Trial Balance and authoritative Balance Sheet reporting',
    description: 'Build standard 2-column Trial Balance report (Debit = Credit) and authoritative Balance Sheet with strict Assets = Liabilities + Equity mathematical integrity.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'accounting',
    dependencies: ['SERP-291'],
    acceptance: [
      'Trial Balance renders all active accounts with current debit/credit totals and verifies sum(DR) === sum(CR)',
      'Balance Sheet calculates Assets, Liabilities, and Equity including computed period Net Income',
      'Reports support filtering by Operating Book and consolidated Legal Entity view'
    ]
  },
  {
    id: 'SERP-293',
    title: 'Authoritative P&L statement with drilldowns and AR/AP aging matrices',
    description: 'Implement authoritative Profit & Loss statement with direct cost breakdowns, Gross Margin %, and 30/60/90+ day Accounts Receivable and Accounts Payable aging reports.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'accounting',
    dependencies: ['SERP-292'],
    acceptance: [
      'P&L statement displays Revenue, Direct Costs, Gross Profit, Operating Expenses, and Net Profit',
      'Clicking any P&L line item opens drilldown list of contributing journal lines',
      'AR aging matrix buckets outstanding invoices into Current, 1-30, 31-60, 61-90, 90+ days overdue',
      'AP aging matrix buckets outstanding supplier liabilities'
    ]
  },
  {
    id: 'SERP-294',
    title: 'Credit notes, customer advance deposits, and settlement allocation',
    description: 'Implement formal credit note issuance, customer advance holding accounts, and flexible allocation of credit against outstanding invoices.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'accounting',
    dependencies: ['SERP-293'],
    acceptance: [
      'Credit notes can be issued against existing invoices or as standalone customer credits',
      'Credit balances can be allocated to settle one or more unpaid invoices via settlement_allocations',
      'Over-allocation and negative allocations are rejected by database trigger',
      'Appropriate reversing journal entries are posted automatically'
    ]
  },
  {
    id: 'SERP-295',
    title: 'Accounting period lock, month-end close, and year-end roll-forward',
    description: 'Implement accounting period lifecycle in UI: locking closed months against backdated transaction edits and executing fiscal year-end roll-forward into Retained Earnings.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'accounting',
    dependencies: ['SERP-294'],
    acceptance: [
      'Financial controller can lock a past accounting period, blocking new/modified journal postings in that date range',
      'Year-end closing wizard zeroes revenue/expense accounts and posts net balance to Retained Earnings',
      'Closed periods require audited unlocking workflow'
    ]
  },
  {
    id: 'SERP-296',
    title: 'Bank & cash ledger with BML/MIB CSV statement reconciliation',
    description: 'Build bank account management and reconciliation interface allowing accountants to upload BML/MIB CSV statements and match lines against starqERP payments and receipts.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'accounting',
    dependencies: ['SERP-295'],
    acceptance: [
      'Bank accounts can be configured with BML/MIB account numbers and currencies',
      'Accountant can upload standard BML/MIB CSV statement file',
      'Side-by-side reconciliation interface suggests matching recorded payments and auto-clears verified lines',
      'Unmatched bank statement items can be booked directly as bank fees or interest'
    ]
  },
  {
    id: 'SERP-297',
    title: 'MIRA GST-201 formal tax return schedule and export',
    description: 'Generate official MIRA GST-201 tax filing schedule with exact box-by-box layout (Standard Sales, Output Tax, Zero-Rated, Standard Purchases, Input Tax, Net MIRA Payable).',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'tax',
    dependencies: ['SERP-296'],
    acceptance: [
      'GST report matches MIRA online filing portal boxes 1 through 13',
      'Consolidates all taxable supplies and purchases across all books for the legal entity',
      'Generates downloadable PDF and CSV summary for direct MIRA filing',
      'Non-GST-registered tenants are clearly demarcated with zero tax liability'
    ]
  },
  {
    id: 'SERP-298',
    title: 'Starq HQ platform control plane console for tenant management',
    description: 'Build operational console for Starq HQ platform operators to view tenant registry, monitor usage metrics, manage subscription tiers/seats, and execute tenant provisioning/suspension.',
    phase: 'Phase 1 - Organisation spine',
    blueprint_phase: 1,
    release_track: 'R1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'platform',
    dependencies: ['SERP-284'],
    acceptance: [
      'Starq HQ operators can view list of registered tenants, active books, and subscriber status',
      'Provisioning workflow initializes new tenant with selected industry archetype and owner invitation',
      'Operator can suspend/reactivate tenant with zero ambient access to tenant financial ledgers',
      'All platform operator actions logged to platform.operator_audit'
    ]
  },
  {
    id: 'SERP-299',
    title: 'Production domain, Google OAuth verified origins, and secrets verification',
    description: 'Configure production DNS, HTTPS certificates, Google Cloud Console OAuth consent and redirect URIs, and verify Supabase production secrets and allowed CORS origins.',
    phase: 'Phase 0 - Main base',
    blueprint_phase: 0,
    release_track: 'R0',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'security',
    dependencies: ['SERP-283'],
    acceptance: [
      'Custom production domain configured with valid SSL/TLS certificate',
      'Google OAuth Client ID authorized for production origins',
      'STARQBOOKS_SESSION_SECRET, SUPABASE_SERVICE_ROLE_KEY configured securely in production',
      'CORS headers strictly reject unauthorized external origins'
    ]
  },
  {
    id: 'SERP-300',
    title: 'Live multi-tenant RLS isolation & book isolation automated test suite',
    description: 'Execute adversarial multi-tenant and multi-book RLS test suite against live Supabase instance proving cross-tenant read/write attempts are strictly rejected at the database level.',
    phase: 'Phase 1 - Organisation spine',
    blueprint_phase: 1,
    release_track: 'R1',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'security',
    dependencies: ['SERP-284'],
    acceptance: [
      'Adversarial test probes attempt cross-tenant reads on all tables and receive 0 rows',
      'Adversarial test probes attempt cross-tenant writes and receive permission denied',
      'Cross-book authorization tests prove unauthorized book access is rejected',
      'Test results documented with raw SQL test logs'
    ]
  },
  {
    id: 'SERP-301',
    title: 'Production observability, structured error logging, and alerts',
    description: 'Implement structured telemetry, error boundary logging, and operational alerting for Edge Function exceptions, failed auth attempts, and security violations.',
    phase: 'Phase 0 - Main base',
    blueprint_phase: 0,
    release_track: 'R0',
    group: 'G1',
    status: 'planned',
    priority: 'P0',
    module: 'platform',
    dependencies: ['SERP-299'],
    acceptance: [
      'Edge Function logs structured JSON events with request_id, person_uuid, and latency',
      'Security violations (CSRF failures, audience rejections) trigger immediate alert events',
      'Frontend unhandled errors captured and reported without exposing stack traces to users'
    ]
  },

  // ==========================================
  // GROUP 2 (G2): ERP REPLACEMENT READINESS / MANDATORY AFTER G1
  // ==========================================
  {
    id: 'SERP-302',
    title: 'Universal CSV/XLSX data ingestion framework and validator',
    description: 'Build core client-side and server-side data ingestion pipeline with schema validation, column mapping, row-by-row error reporting, and atomic batch insert capabilities.',
    phase: 'Phase 2 - Measured internal pilot',
    blueprint_phase: 2,
    release_track: 'R2',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'migration',
    dependencies: ['SERP-289'],
    acceptance: [
      'Supports drag-and-drop CSV and XLSX file uploads up to 50,000 rows',
      'Validates required fields, data types, duplicate keys, and foreign references before commit',
      'Provides interactive column mapping interface matching customer spreadsheet headers to starqERP schema',
      'Atomic batch execution commits valid batches or rolls back completely on fatal errors'
    ]
  },
  {
    id: 'SERP-303',
    title: 'Customer and supplier master data bulk import tool',
    description: 'Implement customer and vendor migration wizard allowing businesses to import their existing client contacts, phone numbers, emails, TINs, and billing addresses from Odoo/SAP.',
    phase: 'Phase 2 - Measured internal pilot',
    blueprint_phase: 2,
    release_track: 'R2',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'migration',
    dependencies: ['SERP-302'],
    acceptance: [
      'Standard Excel template provided for Customer and Supplier imports',
      'Validates Maldivian phone numbers, email formats, and TIN syntax',
      'Seamlessly inserts into public.contacts with tenant isolation',
      'Generates import summary report detailing imported vs skipped records'
    ]
  },
  {
    id: 'SERP-304',
    title: 'Product catalog & SKU master data bulk import tool',
    description: 'Implement inventory product catalog migration wizard allowing businesses to upload thousands of SKUs, categories, barcodes, units of measure, cost prices, and selling prices.',
    phase: 'Phase 2 - Measured internal pilot',
    blueprint_phase: 2,
    release_track: 'R2',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'migration',
    dependencies: ['SERP-302'],
    acceptance: [
      'Supports uploading product catalog with category auto-creation',
      'Validates SKU uniqueness within the organization',
      'Imports selling price, purchase cost, reorder levels, and unit definitions',
      'Populates public.products and public.product_prices'
    ]
  },
  {
    id: 'SERP-305',
    title: 'Opening stock quantity & valuation migration wizard',
    description: 'Build opening inventory count wizard allowing warehouse managers to upload initial quantities on hand per location with unit cost basis, automatically creating opening stock movements.',
    phase: 'Phase 2 - Measured internal pilot',
    blueprint_phase: 2,
    release_track: 'R2',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'migration',
    dependencies: ['SERP-304'],
    acceptance: [
      'Imports stock quantities mapped by SKU and location/warehouse',
      'Creates public.stock_movements with movement_type = opening',
      'Posts corresponding opening inventory asset valuation journal entry'
    ]
  },
  {
    id: 'SERP-306',
    title: 'Opening trial balance & financial balances onboarding wizard',
    description: 'Build guided 3-step opening balance wizard for CFOs to input opening bank balances, cash on hand, opening AR, opening AP, fixed assets, and equity, generating balanced opening journal entry.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'migration',
    dependencies: ['SERP-291', 'SERP-302'],
    acceptance: [
      'Wizard captures opening balances across all Chart of Accounts accounts as of Go-Live date',
      'Verifies sum(Debits) === sum(Credits)',
      'Posts immutable Opening Balance Journal Entry in public.journal_entries',
      'Initializes bank ledger balances accurately'
    ]
  },
  {
    id: 'SERP-307',
    title: 'Unpaid customer invoices (AR) & supplier bills (AP) migration wizard',
    description: 'Build migration wizard to import outstanding unpaid customer invoices and unpaid vendor bills from legacy ERP so cashiers can collect payments and settle debts without double-posting revenue.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'migration',
    dependencies: ['SERP-306'],
    acceptance: [
      'Imports unpaid invoices with original invoice numbers, issue dates, due dates, and balances due',
      'Imports unpaid supplier bills with supplier details and payment terms',
      'Links invoices and bills to opening AR/AP accounts without distorting current period P&L'
    ]
  },
  {
    id: 'SERP-308',
    title: 'Odoo & SAP cutover migration runbook and reconciliation validator',
    description: 'Develop standardized cutover runbook and automated reconciliation tool that compares legacy Odoo/SAP trial balance and inventory valuation against starqERP post-migration.',
    phase: 'Phase 2 - Measured internal pilot',
    blueprint_phase: 2,
    release_track: 'R2',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'migration',
    dependencies: ['SERP-307'],
    acceptance: [
      'Step-by-step cutover guide covering data extraction, formatting, upload order, and cutover weekend checklist',
      'Reconciliation validator compares pre-migration and post-migration totals across AR, AP, Cash, and Inventory',
      'Produces audit sign-off report for customer financial controller'
    ]
  },
  {
    id: 'SERP-309',
    title: 'Perpetual inventory valuation engine and automated COGS posting',
    description: 'Implement automated real-time inventory valuation (AVCO / Moving Average) with automatic Cost of Goods Sold (COGS) journal entry posting upon goods delivery or invoice issue.',
    phase: 'Stage 2 - Inventory & stock',
    blueprint_phase: 4,
    release_track: 'S2',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'inventory',
    dependencies: ['SERP-291'],
    acceptance: [
      'Calculates weighted average cost basis dynamically on stock receipts',
      'Issuing stock or completing work orders automatically posts DR: COGS (Expense) and CR: Inventory (Asset)',
      'Inventory valuation report matches Inventory Asset balance on Balance Sheet'
    ]
  },
  {
    id: 'SERP-310',
    title: 'Landed cost allocation for container imports (freight, customs, port handling)',
    description: 'Implement landed cost calculation engine allowing importers to allocate ocean freight, customs duty, harbor handling, and transport costs across purchase order lines by value, quantity, or weight.',
    phase: 'Stage 4 - Commercial & purchasing',
    blueprint_phase: 6,
    release_track: 'S4',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'purchasing',
    dependencies: ['SERP-309'],
    acceptance: [
      'Purchasing manager can create Landed Cost Document linking multiple POs / Goods Receipts',
      'Allocates freight, customs duty, and port fees across items proportionally by value or quantity',
      'Updates inventory unit cost basis and posts landed cost accrual journal entries'
    ]
  },
  {
    id: 'SERP-311',
    title: '3-Way matching for procurement (Purchase Order vs GRN vs Supplier Bill)',
    description: 'Implement 3-way matching validation ensuring supplier bills cannot be paid unless quantities match Goods Receipt Notes and prices match approved Purchase Orders.',
    phase: 'Stage 4 - Commercial & purchasing',
    blueprint_phase: 6,
    release_track: 'S4',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'purchasing',
    dependencies: ['SERP-310'],
    acceptance: [
      'System checks matching quantities between PO, Goods Receipt, and Supplier Bill',
      'Price or quantity variance exceeding configured threshold triggers approval block',
      'Prevents over-billing and duplicate payment of supplier invoices'
    ]
  },
  {
    id: 'SERP-312',
    title: 'Multi-warehouse stock transfer orders and transit tracking',
    description: 'Implement inter-warehouse stock transfer orders allowing multi-location businesses (e.g. Male vs Hulhumale vs Thilafushi) to request, dispatch, track in-transit, and receive inventory.',
    phase: 'Stage 9 - Warehouse module',
    blueprint_phase: 11,
    release_track: 'S9',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'inventory',
    dependencies: ['SERP-309'],
    acceptance: [
      'User can create Stock Transfer Order between source and destination location',
      'Dispatch moves stock to in_transit status with decrement from source warehouse',
      'Receiving warehouse accepts stock, updating destination quantity on hand',
      'Stock in transit ledger maintained accurately'
    ]
  },
  {
    id: 'SERP-313',
    title: 'Batch and serial number tracking lifecycle',
    description: 'Implement batch and serial number tracking for automotive spare parts, paints, marine lubricants, and medical supplies with expiration dates and warranty lookup.',
    phase: 'Stage 2 - Inventory & stock',
    blueprint_phase: 4,
    release_track: 'S2',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'inventory',
    dependencies: ['SERP-309'],
    acceptance: [
      'Items can be designated as Serial-Tracked or Batch-Tracked in product catalog',
      'Serial/batch numbers captured on receipt and validated on issuance/sale',
      'Full traceability report tracks complete history from supplier purchase to customer invoice'
    ]
  },
  {
    id: 'SERP-314',
    title: 'Tiered customer price lists (Retail, Wholesale, Resort, VIP)',
    description: 'Implement multi-tier pricing engine allowing businesses to assign custom price lists or percentage discounts per customer category with automated price resolution on quotes and invoices.',
    phase: 'Stage 4 - Commercial & purchasing',
    blueprint_phase: 6,
    release_track: 'S4',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'sales',
    dependencies: ['SERP-291'],
    acceptance: [
      'Admin can create custom Price Lists (e.g. Resort Wholesale, Trade Discount 15%)',
      'Customer profile binds to designated Price List',
      'Creating invoice automatically resolves item unit price based on customer tier'
    ]
  },
  {
    id: 'SERP-315',
    title: 'Customer credit limit enforcement and automated dunning reminders',
    description: 'Implement hard and soft credit limit controls on customer accounts, blocking new sales orders when credit limits are exceeded, and generating automated WhatsApp/Email account statements.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'sales',
    dependencies: ['SERP-293'],
    acceptance: [
      'Customer profile supports Credit Limit (MVR) and Payment Terms (e.g. Net 30)',
      'Sales orders exceeding credit limit or past grace period require manager override',
      'Statement of Account generator creates clean PDF with outstanding invoice table and payment link'
    ]
  },
  {
    id: 'SERP-316',
    title: 'Inter-book journal transfers and consolidated balance sheet elimination',
    description: 'Implement inter-book operational transfers between operating activities (e.g. Starq Technologies to Starq Dynamics) with automatic intercompany journal elimination on consolidated statements.',
    phase: 'Stage 6 - Business units & branches',
    blueprint_phase: 8,
    release_track: 'S6',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'accounting',
    dependencies: ['SERP-292'],
    acceptance: [
      'Enables transferring goods, expenses, or services between books under the same legal entity',
      'Generates corresponding Due To / Due From inter-book accounts',
      'Consolidated legal entity balance sheet automatically eliminates inter-book balances'
    ]
  },
  {
    id: 'SERP-317',
    title: 'Direct and indirect Cash Flow Statement reporting',
    description: 'Build authoritative Cash Flow Statement categorizing cash movements across Operating, Investing, and Financing activities.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'accounting',
    dependencies: ['SERP-292'],
    acceptance: [
      'Generates Cash Flow Statement from posted cash and bank journal movements',
      'Categorizes cash inflows/outflows by Operating, Investing, and Financing activities',
      'Ending cash balance matches Cash & Bank balance on Balance Sheet'
    ]
  },
  {
    id: 'SERP-318',
    title: 'Multi-currency purchasing, dynamic MMA exchange rates, and FX gain/loss',
    description: 'Implement multi-currency transactions (USD, EUR) with daily Maldives Monetary Authority (MMA) exchange rates and automatic realized/unrealized foreign exchange gain/loss calculation.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'accounting',
    dependencies: ['SERP-291'],
    acceptance: [
      'Invoices and POs can be transacted in USD, EUR, or MVR',
      'Exchange rate recorded on transaction date and converted to base currency MVR',
      'Payment settlement calculates and posts Realized FX Gain/Loss automatically'
    ]
  },
  {
    id: 'SERP-319',
    title: 'MIRA Tourism Goods and Services Tax (16% TGSTA) and Green Tax support',
    description: 'Implement 16% TGSTA calculation and Green Tax ($6/night) tracking for tourism-sector operators (safari yachts, guesthouses, resort contractors).',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'tax',
    dependencies: ['SERP-297'],
    acceptance: [
      'Supports configuring 16% TGSTA tax regime per operating book or item category',
      'Generates dedicated MIRA TGSTA tax schedule',
      'Tracks Green Tax liabilities separately from standard GST'
    ]
  },
  {
    id: 'SERP-320',
    title: 'Staged and progress billing against contract milestones',
    description: 'Implement milestone and percentage-of-completion progress billing for marine boatyard refits, yacht overhauls, and construction contracting projects.',
    phase: 'Stage 8 - Projects & job costing',
    blueprint_phase: 10,
    release_track: 'S8',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'projects',
    dependencies: ['SERP-291'],
    acceptance: [
      'Project contracts define milestone payment stages (e.g. 30% Intake, 40% Mid-Refit, 30% Handover)',
      'Invoices can be generated directly against approved project milestone stages',
      'Tracks unbilled work-in-progress (WIP) and deferred revenue'
    ]
  },
  {
    id: 'SERP-321',
    title: 'Technician timesheets and job labor costing',
    description: 'Implement technician time tracking and hourly labor rate costing on job cards for workshops, boatyards, and field engineering.',
    phase: 'Stage 8 - Projects & job costing',
    blueprint_phase: 10,
    release_track: 'S8',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'projects',
    dependencies: ['SERP-289'],
    acceptance: [
      'Technicians can clock labor hours against specific job card tasks on mobile',
      'Calculates labor cost based on technician hourly cost rate',
      'Real-time job margin analysis updates labor vs parts profit margin'
    ]
  },
  {
    id: 'SERP-322',
    title: 'Subcontractor retention money & MIRA Non-Resident Withholding Tax (WHT)',
    description: 'Implement contractor retention money withholding (e.g. 5% retention held for 6 months) and 10% MIRA Non-Resident Withholding Tax deduction on foreign contractor payments.',
    phase: 'Stage 8 - Projects & job costing',
    blueprint_phase: 10,
    release_track: 'S8',
    group: 'G2',
    status: 'planned',
    priority: 'P1',
    module: 'tax',
    dependencies: ['SERP-297'],
    acceptance: [
      'Subcontractor bills support retention deduction held in Liability account',
      'Withholding tax (10% WHT) deducted and posted to MIRA WHT Payable ledger',
      'Generates MIRA WHT certificate and filing summary'
    ]
  },

  // ==========================================
  // GROUP 3 (G3): MALDIVES COMPETITIVE ADVANTAGE (MOAT)
  // ==========================================
  {
    id: 'SERP-323',
    title: 'Bilingual Dhivehi (Thaana) / English document templates and print engine',
    description: 'Integrate native Thaana typography (Faruma / MV Waheed fonts) for customer invoices, receipts, and estimates with right-to-left (RTL) Dhivehi item descriptions and legal terms.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G3',
    status: 'planned',
    priority: 'P2',
    module: 'localization',
    dependencies: ['SERP-291'],
    acceptance: [
      'Customer invoice print template supports bilingual English and Thaana layout',
      'Custom Dhivehi notes and terms render with accurate RTL font kerning',
      'PDF generation renders crisp vector Thaana typography'
    ]
  },
  {
    id: 'SERP-324',
    title: 'Verified MMA Favara / BML instant QR payment generation on invoices',
    description: 'Embed dynamic MMA Favara / BML instant payment QR codes on digital and printed invoices, allowing Maldivian customers to scan and pay instantly via BML Mobile Banking.',
    phase: 'Stage 1 - Finance kernel',
    blueprint_phase: 3,
    release_track: 'S1',
    group: 'G3',
    status: 'planned',
    priority: 'P2',
    module: 'localization',
    dependencies: ['SERP-291'],
    acceptance: [
      'Generates valid MMA Favara / BML compatible payment QR payload on invoices',
      'Customer scanning QR in BML Mobile App automatically populates merchant account, amount, and invoice reference',
      'Payment verification workflow marks invoice settled upon transaction confirmation'
    ]
  },
  {
    id: 'SERP-325',
    title: 'Multi-island sea-cargo, dhoni dispatch, and harbor gate pass tracking',
    description: 'Implement Maldives inter-island cargo logistics tracking: assigning orders to transport vessels (Dhoni, Speedboat, Cargo Boat), harbor manifests, and delivery gate passes.',
    phase: 'Stage 9 - Warehouse module',
    blueprint_phase: 11,
    release_track: 'S9',
    group: 'G3',
    status: 'planned',
    priority: 'P2',
    module: 'logistics',
    dependencies: ['SERP-312'],
    acceptance: [
      'Sales dispatch supports Sea-Cargo delivery method with Boat Name, Captain Contact, and Harbor Berth',
      'Generates Harbor Gate Pass and Boat Delivery Manifest document',
      'Tracks cargo delivery status to outer atoll island councils and resorts'
    ]
  },
  {
    id: 'SERP-326',
    title: 'Maldives-specific operational defaults & Island Council directory',
    description: 'Embed complete authoritative Maldives geographic directory (20 Atolls, 187 inhabited islands, industrial zones) and local operating defaults (prayer-time retail pauses, Friday operating schedules).',
    phase: 'Phase 1 - Organisation spine',
    blueprint_phase: 1,
    release_track: 'R1',
    group: 'G3',
    status: 'planned',
    priority: 'P2',
    module: 'localization',
    dependencies: ['SERP-284'],
    acceptance: [
      'Customer and supplier addresses auto-complete with standard Atoll and Island names',
      'Ministry of Economic Development (MED) business registration validation formats embedded',
      'Local working week (Sunday-Thursday standard, Friday prayer pause) supported in shift calendars'
    ]
  },
  {
    id: 'SERP-327',
    title: 'Maldives Pension Administration Office (MPAO) statutory deduction module',
    description: 'Implement mandatory Maldives Pension Scheme (7% employer + 7% employee contribution) calculations, employee salary register, and MPAO Koshaaru filing export.',
    phase: 'Stage 7 - HR and payroll',
    blueprint_phase: 9,
    release_track: 'S7',
    group: 'G3',
    status: 'planned',
    priority: 'P2',
    module: 'payroll',
    dependencies: ['SERP-291'],
    acceptance: [
      'Employee master captures National ID Card (NID) / Work Permit and Pension ID',
      'Monthly payroll runs compute 7% employee deduction and 7% employer contribution',
      'Generates MPAO Koshaaru compliant CSV contribution file and payslip PDFs'
    ]
  },

  // ==========================================
  // GROUP 4 (G4): SCALE & ENTERPRISE READINESS
  // ==========================================
  {
    id: 'SERP-328',
    title: 'Playwright automated end-to-end (E2E) browser test suite',
    description: 'Implement comprehensive Playwright browser automation suite testing full end-to-end commercial workflows: intake -> job -> invoice -> payment -> journal posting across desktop and mobile viewports.',
    phase: 'Phase 2 - Measured internal pilot',
    blueprint_phase: 2,
    release_track: 'R2',
    group: 'G4',
    status: 'planned',
    priority: 'P3',
    module: 'testing',
    dependencies: ['SERP-289'],
    acceptance: [
      'Automated Playwright tests execute complete business journeys in Chromium, Firefox, WebKit',
      'Simulates multi-tenant login, staff invitation acceptance, and workspace switching',
      'Integrated into GitHub Actions CI pipeline with artifact video/screenshot capture on failure'
    ]
  },
  {
    id: 'SERP-329',
    title: 'Route-based code splitting and performance budget optimization',
    description: 'Refactor web bundle with React lazy loading, dynamic chunk splitting, and asset optimization to reduce initial bundle from 1.17 MB down to < 300 kB.',
    phase: 'Phase 0 - Main base',
    blueprint_phase: 0,
    release_track: 'R0',
    group: 'G4',
    status: 'planned',
    priority: 'P3',
    module: 'performance',
    dependencies: ['SERP-283'],
    acceptance: [
      'All major views (Dashboard, Jobs, Invoices, Inventory, Accounting, Settings) code-split dynamically',
      'Initial entry bundle size is < 300 kB gzipped',
      'Lighthouse Performance score >= 90 on mobile 4G network profile'
    ]
  },
  {
    id: 'SERP-330',
    title: 'Low-connectivity offline caching and PWA service worker sync',
    description: 'Implement Progressive Web App (PWA) service worker caching and offline mutation queue for island locations with unstable mobile connectivity.',
    phase: 'Phase 2 - Measured internal pilot',
    blueprint_phase: 2,
    release_track: 'R2',
    group: 'G4',
    status: 'planned',
    priority: 'P3',
    module: 'mobile',
    dependencies: ['SERP-289'],
    acceptance: [
      'App shell and static assets cached offline via service worker',
      'Shop-floor mechanics can create job notes and inspections offline, queued in IndexedDB',
      'Automatic background sync commits queued mutations when connectivity resumes'
    ]
  },
  {
    id: 'SERP-331',
    title: 'High-concurrency load testing and database connection pool tuning',
    description: 'Execute high-concurrency synthetic load testing simulating 500 concurrent active users and tune Supabase PostgreSQL connection pooling and query performance.',
    phase: 'Phase 0 - Main base',
    blueprint_phase: 0,
    release_track: 'R0',
    group: 'G4',
    status: 'planned',
    priority: 'P3',
    module: 'performance',
    dependencies: ['SERP-284'],
    acceptance: [
      'Load test sustains 500 concurrent simulated users at < 200ms p95 API response time',
      'Supabase connection pooling (PgBouncer / Supavisor) tuned to prevent connection exhaustion',
      'Query execution plans verified with indexes on all foreign key lookups'
    ]
  },
  {
    id: 'SERP-332',
    title: 'Specialized WCAG 2.1 AAA accessibility and multi-device physical lab audit',
    description: 'Perform formal accessibility audit against WCAG 2.1 AAA standards and physical device lab testing across representative Maldivian mobile devices (Samsung Galaxy A-series, iPhone, Redmi).',
    phase: 'Phase 0 - Main base',
    blueprint_phase: 0,
    release_track: 'R0',
    group: 'G4',
    status: 'planned',
    priority: 'P3',
    module: 'ui',
    dependencies: ['SERP-283'],
    acceptance: [
      'Full keyboard navigation, screen reader ARIA labels, and color contrast compliance verified',
      'Physical device validation passes on low-end mobile devices without touch target overlap',
      'Audit report published in docs/qa/'
    ]
  },
  {
    id: 'SERP-333',
    title: 'Public REST API gateway and Webhooks subscription infrastructure',
    description: 'Build secure external REST API and outgoing Webhooks system allowing enterprise clients to integrate starqERP with ecommerce storefronts, POS terminals, and third-party logistics.',
    phase: 'Stage 5 - Full ERP integrations',
    blueprint_phase: 7,
    release_track: 'S5',
    group: 'G4',
    status: 'planned',
    priority: 'P3',
    module: 'api',
    dependencies: ['SERP-289'],
    acceptance: [
      'Scoped API keys with granular read/write capability grants',
      'Outgoing webhooks dispatch events (invoice.paid, job.completed, stock.low) with HMAC signatures',
      'Interactive OpenAPI / Swagger documentation published'
    ]
  },
  {
    id: 'SERP-334',
    title: 'Multi-region automated disaster recovery and warm standby failover',
    description: 'Establish automated multi-region daily backup replication, Point-In-Time Recovery (PITR), and tested warm standby failover runbook for enterprise SLA compliance.',
    phase: 'Phase 0 - Main base',
    blueprint_phase: 0,
    release_track: 'R0',
    group: 'G4',
    status: 'planned',
    priority: 'P3',
    module: 'security',
    dependencies: ['SERP-299'],
    acceptance: [
      'Automated daily encrypted offsite backups replicated to secondary cloud region',
      'Point-in-Time Recovery verified with RPO < 15 minutes and RTO < 1 hour',
      'Disaster recovery rehearsal documented and signed off'
    ]
  },
  {
    id: 'SERP-335',
    title: 'Starq HQ platform tenant telemetry, active usage, and billing automation',
    description: 'Implement automated platform billing, invoice generation, active user seat metering, and resource usage tracking across all customer tenants.',
    phase: 'Phase 1 - Organisation spine',
    blueprint_phase: 1,
    release_track: 'R1',
    group: 'G4',
    status: 'planned',
    priority: 'P3',
    module: 'platform',
    dependencies: ['SERP-298'],
    acceptance: [
      'Aggregates daily active seats and transactional volume per tenant in platform.usage_daily',
      'Generates automated monthly subscription invoices for customer tenants',
      'Alerts Starq operators when tenant approaches plan resource limits'
    ]
  },
  {
    id: 'SERP-336',
    title: 'Advanced operational diagnostics, tracing & health telemetry',
    description: 'Deploy distributed tracing, OpenTelemetry instrumentation, and real-time operational health dashboards for Starq engineering support.',
    phase: 'Phase 0 - Main base',
    blueprint_phase: 0,
    release_track: 'R0',
    group: 'G4',
    status: 'planned',
    priority: 'P3',
    module: 'platform',
    dependencies: ['SERP-301'],
    acceptance: [
      'End-to-end distributed tracing across client, Edge gateway, and database RPCs',
      'Real-time health status dashboard reporting uptime, error rates, and API latencies',
      'Automated PagerDuty / Telegram incident alerts for critical service degradations'
    ]
  }
];

// Append new tasks
data.tasks = data.tasks.concat(newTasks);
data.generated_at = new Date().toISOString();

fs.writeFileSync(nexusPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Successfully appended', newTasks.length, 'new canonical tasks to starq-erp-tasks.json');
console.log('New total tasks on canonical Nexus board:', data.tasks.length);
console.log('Done tasks:', data.tasks.filter((t) => t.status === 'done').length);
console.log('New completion percentage:', ((data.tasks.filter((t) => t.status === 'done').length / data.tasks.length) * 100).toFixed(2) + '%');
