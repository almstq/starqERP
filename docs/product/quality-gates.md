# StarqERP Quality Gates Specification

This document defines the mandatory quality gates that must be passed before any module, stage, or release can be deployed to production. These gates enforce correctness over speed, even in an AI-accelerated development environment.

## 1. Philosophy

Speed is an advantage. Correctness is non-negotiable.

StarqERP's AI-assisted development can produce modules unusually fast. That does not mean we relax correctness. Instead, we use quality gates to ensure that each component — no matter how quickly built — meets the same standards as a conventionally developed module.

Gates are defined at the module/stage level, not the calendar level. A module is ready when it passes its gates, not because the calendar says so.

## 2. Gate Levels

| Level | Description | When Applied |
|-------|-------------|--------------|
| **L0 - Code Review** | Static analysis, linting, security scan, ADR compliance checked | Every PR/commit |
| **L1 - Unit Tests** | Automated tests covering core logic, edge cases, error handling | Every module/function |
| **L2 - Integration Tests** | End-to-end workflows across modules; tenant isolation; cross-module data consistency | Every stage |
| **L3 - Pre-production Validation** | Performance, recovery, backup/restore, audit integrity, AI control plane behavior | Before any production deployment |
| **L4 - Post-deployment Monitoring** | Metrics, error rates, cost-per-tenant, user feedback | After deployment; ongoing |

## 3. Module-Specific Quality Gates

### Core Platform (M0/M1)

**Gate: Tenant Isolation and Security**

Must pass before any business module can be deployed.

| Check | Description | Test/Evidence | Pass Criteria |
|-------|-------------|---------------|---------------|
| **Tenant Scoping** | Every database query filters by tenant ID; cross-tenant reads/commands denied | Unit + integration tests with 2+ tenants | 100% cross-tenant denial; no cross-tenant data leakage |
| **Session Management** | Server-authoritative sessions; client-supplied tenant IDs never trusted; session revocation works | Integration tests simulating hijack attempts | Session cannot be hijacked; tenant ID from client ignored |
| **RBAC Enforcement** | Module permissions (view/create/edit/delete/post) enforced at API and UI level | Integration tests for each permission level | Unauthorized actions blocked with appropriate error |
| **Audit Trail Integrity** | All business events recorded; audit log immutable and append-only; links business event → operational consequence → financial consequence → ledger | Integration tests simulating events | Audit log links complete chain; tampering detected |
| **Segregation of Duties (SoD)** | Conflicting roles cannot perform certain actions (e.g., create + approve bill) | Unit tests for SoD rules | SoD violations blocked |
| **Backup/Restore** | Encrypted backup and scratch restore rehearsal completed | Operational test (not just documentation) | Backup created; restore to scratch environment successful; data integrity verified |

**Reference**: SERP-001, SERP-002, The Starq Operating Manual Section 2 (Tenancy & Security)

### Accounting Core (Stage 1)

**Gate: Financial Integrity and Tax Compliance**

Must pass before any financial operations can be exposed to tenants.

| Check | Description | Test/Evidence | Pass Criteria |
|-------|-------------|---------------|---------------|
| **Double-Entry Ledger** | Every transaction posts debit and credit; ledger balances; all entries debit=credit | Unit tests with full transaction lifecycle | All entries balanced; ledger balances; no orphan entries |
| **Tax Calculation** | Date-effective tax rules applied correctly; TIN on invoices; locked sequences | Unit tests for each tax rule and date range | Correct tax rate for invoice date; TIN present; sequence locked |
| **MIRA-Ready Export** | Tax reports conform to MIRA filing templates | Manual verification against MIRA specs; automated format check | Exports match MIRA required format; all required fields present |
| **Period Locking** | Periods can be locked; no transactions posted to locked periods | Unit tests for period lock/unlock | Locked period rejects new transactions; unlock restores |
| **Year-End Close** | Closing workflow produces correct opening balances for next period | Integration test simulating year-end close | Opening balances correct; no data lost; audit trail complete |
| **AR/AP Aging** | Aging reports calculated correctly; balance reconciliation | Unit tests for aging calculation | Aging buckets correct; balance matches subledger |
| **AI-Assisted Reconciliation** | OCR extraction + AI proposal + deterministic validation for bank reconciliation | Integration test with sample bank statements | OCR accuracy > 90%; AI proposals valid; deterministic base validates before commit |
| **Immutable Journal** | Journal entries cannot be edited; only reversed/corrected with history retained | Unit tests for journal lifecycle | Edit blocked; reversal creates new entry with link to original; history preserved |

**Reference**: ACC-001, ACC-002, ACC-003, TAX-MV-001, TAX-MV-002

### Inventory Module (Stage 2)

**Gate: Stock Integrity and Valuation Accuracy**

| Check | Description | Test/Evidence | Pass Criteria |
|-------|-------------|---------------|---------------|
| **Stock Movement Audit** | Every movement has tenant, actor, source, destination, quantity, timestamp | Integration test simulating all movement types | Full audit trail for every movement; no missing links |
| **Valuation Consistency** | FIFO/weighted average valuation matches GL COGS postings | Test with realistic purchase/sale cycles | Valuation matches COGS; no discrepancies |
| **Stock Count** | Physical count can be entered; variance calculated; adjustments posted with reason | Integration test simulating stock take | Count entry; variance calculated; adjustment posted with reason code; audit trail |
| **Reorder Points** | Min/max reorder points configured; low stock alerts triggered | Test with various reorder scenarios | Alerts triggered when stock < min; appropriate notification |
| **Batch/Expiry Tracking** | Batch and expiry dates tracked; FEFO (first-expired-first-out) enforced where required | Test with products having batch/expiry | FEFO allocation correct; expiring stock flagged |
| **Inter-Island Workflow** | Transfer → dispatch → in-transit → manifest → vessel → destination → received → discrepancy/damage | Integration test simulating full inter-island transfer | All steps tracked; discrepancy/damage captured; destination stock updated |
| **Landed Cost Allocation** | Import shipment costs allocated across SKUs by weight/value/qty/volume | Integration test with import shipment | Costs allocated correctly; true unit cost calculated; margin reflects landed cost |

**Reference**: INV-001, INV-002, INV-003

### Counter/POS Module (Stage 3)

**Gate: Transaction Integrity and Offline Reliability**

| Check | Description | Test/Evidence | Pass Criteria |
|-------|-------------|---------------|---------------|
| **Transaction Posting** | Each sale posts correct debit/credit entries (Dr Cash, Cr Sales, Cr GST, Dr COGS, Cr Inventory) | Unit tests for each tender type and product type | Correct journal entries for all combinations |
| **Offline Transaction Queue** | Transactions can be entered offline; queue persists; sync after reconnection | Integration test simulating offline operation | Offline transactions saved; sync successful after reconnect; no conflicts |
| **Sync Conflict Resolution** | Conflicts (same transaction edited offline) resolved safely | Test with concurrent offline edits | Conflict detected; resolution strategy applied (e.g., last-write-wins with audit, or human resolution); no data loss |
| **Multi-Tender Support** | Cash, card, bank transfer, M-Faisaa, split tender all supported | Unit tests for each tender | All tender types accepted; correct GL postings; receipts generated |
| **Register Shift Management** | Shift open/close records cash in/out; X/Z reports generated; till reconciliation | Integration test simulating shift | Shift open/close works; X/Z reports correct; reconciliation matches expected vs counted |
| **Void/Override Audit** | Price overrides and voids require approval; audit recorded | Unit tests for void/override flows | Override requires approval; audit recorded; reason required |
| **Digital Receipts** | WhatsApp/email/QR receipt delivery works | Integration test sending receipt | Receipt delivered via chosen channel; QR code valid |
| **Customer Credit at POS** | Customer credit limits checked at sale; credit hold enforced | Unit tests for credit limit scenarios | Credit limit checked; sale blocked if over limit; credit hold respected |

**Reference**: POS-001, POS-002, POS-003

### AI Control Plane (M8)

**Gate: AI Safety and Deterministic Verification**

| Check | Description | Test/Evidence | Pass Criteria |
|-------|-------------|---------------|---------------|
| **Scoped Agents** | Each AI agent has defined scope; cannot access data or operations outside scope | Unit tests for agent scope boundaries | Agent cannot access out-of-scope data or perform out-of-scope operations |
| **Typed Proposals** | AI outputs are structured, verifiable proposals (not free-text instructions) | Test agent outputs | Proposals have defined schema; evidence attached; confidence score |
| **Deterministic Base Validation** | No AI proposal can execute without the deterministic base validating tenant, permission, state, amount, SoD, idempotency, approval | Integration test simulating AI proposal flow | Base validates all checks; proposal rejected if any check fails |
| **Human Approval for Consequential Actions** | Payments, journals, permissions changes, bulk export, deletion require explicit human approval | Test flows for each consequential action type | Approval required; no auto-execution; audit records approval |
| **Kill Switch** | Kill switch immediately revokes all AI agent grants; no partial or delayed effect | Test kill switch activation | All agent grants revoked instantly; no pending actions execute |
| **Audit of AI Actions** | All AI proposals and decisions recorded in audit trail | Integration test with AI actions | Audit records: agent, proposal, human decision, outcome; traceable |

**Reference**: AI-001, AI-002, AI-003, AI-004, CORE-002

## 4. Gate Enforcement Process

### Before Any Module Can Enter Production

1. **All L0-L3 gates for that module must pass**
2. **Upstream module gates must pass** (e.g., Accounting must pass before POS can deploy, because POS depends on accounting)
3. **Quality gate checklist must be signed off** by module owner (human) and reviewed by Elder/claude if module is consequential
4. **Migration files must be reviewed** (independent review if database schema changes)
5. **Backup/recovery rehearsal must be completed** before first production deployment of any new component

### Continuous Gate Monitoring

1. **Automated gate checks run on every PR**: lint, unit tests, security scan
2. **Daily gate health check**: Integration tests run; failures block deployment
3. **Weekly gate review**: Quality metrics reviewed; any drift addressed before next deployment
4. **Monthly comprehensive gate audit**: Full L0-L4 review; findings fed back into gate definitions

## 5. Gate Exceptions and Escalation

### Exceptions
- **Temporary bypasses** for debugging/testing in development environments only — never in production
- **Planned exceptions** must be documented, approved by founder for irreversible items, and time-bounded
- **No exceptions** for: tenant isolation, financial invariants, audit trail integrity, deterministic base verification, backup/restore, migration review

### Escalation
- **Blocker identified**: Document in issue tracker with gate ID, description, impact
- **Blocker review**: Elder/claude reviews blocker; may require additional tests or architecture changes
- **Blocker resolution**: Tests updated, gate re-run, sign-off obtained
- **Post-resolution**: Gate definition updated if needed to prevent recurrence

## 6. Gate Evolution

Gates are living specifications. They should be updated when:

- **New failure modes discovered** (add new gate check)
- **Competitor capabilities emerge** (raise bar for our gates)
- **Regulatory changes** (e.g., new MIRA requirements → update tax gate)
- **Architecture changes** (e.g., new module dependencies → update dependency gates)
- **Feedback from incidents** (actual incidents reveal gaps → close them)

All gate changes must go through the same ADR process as other architectural decisions.

## 7. Example: Inventory Module Gate Checklist

```
Module: Inventory (Stage 2)
Gate Owner: [Module Owner]
Reviewer: Elder/claude (independent review)

[✓] L0: Code review passed; linting clean; security scan clean; ADR compliance verified
[✓] L1: Unit tests passed (100% coverage on core logic)
[✓] L2: Integration tests passed:
     - Stock movement audit trail complete
     - Valuation matches GL COGS
     - Stock count variance and adjustment flow working
     - Reorder point alerts triggering
     - Batch/expiry FEFO enforcement working
     - Inter-island transfer workflow complete
     - Landed cost allocation correct
[✓] L3: Pre-production validation:
     - Performance: 10,000 stock movements processed in < 5 seconds
     - Recovery: Inventory data backed up and restored successfully
     - Tenant isolation: Cross-tenant inventory queries denied
     - Audit: Full chain from transaction to ledger verified
[✓] Upstream gates: Accounting (Stage 1) gates passed
[✓] Migration review: Independent review completed (if schema changes)
[✓] Backup/recovery rehearsal: Completed
[✓] Sign-off: Module owner + reviewer

Result: GATE PASSED — Ready for production deployment
```

## 8. Relation to Other Specifications

- **Product Principles**: Gate philosophy derives from Principle 3 (AI-native, not decoration), Principle 7 (deterministic truth, probabilistic reasoning), Principle 9 (quality gates over calendar promises)
- **Architecture Decisions**: Gates enforce ADR compliance (e.g., ADR 001 Accounting-First requires financial integrity gate)
- **Requirement Registry**: Each requirement has explicit gate checks in its acceptance criteria
- **Roadmap**: Quality gates define when stages can proceed, not calendar dates

---
*This specification is the operationalization of the product vision: build fast, but build right. Speed without gates creates technical debt; gates enable speed with confidence.*