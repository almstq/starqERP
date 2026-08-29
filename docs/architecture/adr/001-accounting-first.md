# ADR 001: Accounting-First Architecture

## Status
Accepted

## Context
StarqERP needs to define its core architectural philosophy. Competitors like Ewity treat accounting as an add-on (QuickBooks/Xero integrations), while FI-ES and Odoo have deep accounting but may not make it the central spine. The product vision requires StarqERP to be an AI-native, automation-first, Maldives-native business operating system designed to give local businesses enterprise-grade capability with SME-level simplicity and pricing.

## Decision
Make accounting the financial spine and central consequence layer of the system. Every economically meaningful transaction should ultimately hit the same accounting ledger. Accounting is not merely a module; it is the system's financial truth layer.

## Consequences
### Positive
- Ensures financial integrity and traceability
- Enables real-time financial reporting
- Supports complex accounting workflows (reversals, accruals, closing)
- Provides a single source of truth for financial data
- Facilitates audit and compliance

### Negative
- Requires careful design of event-to-accounting mapping
- May increase initial complexity in modeling
- Requires robust validation to prevent accounting errors

## Implementation Strategy
- All modules post to the General Ledger via approved journal/proposal boundary
- Deterministic base validates all accounting entries before commit
- AI agents can propose journal entries but cannot commit without base validation
- Audit layer links business events → operational consequences → financial consequences → ledger entries
- Chart of Accounts is Maldives-native with MVR/USD support and date-effective tax rules

## Related Requirements
ACC-001, ACC-002, ACC-003, AUD-001, CORE-001, CORE-002, TAX-MV-001

## Related Architecture Decisions
ADR 002 (AI-Native Control Plane), ADR 003 (Deterministic Base Verification), ADR 005 (Immutable Audit Trail)

## Notes
This decision satisfies the vision of "accountant-grade from Day 1" and differentiates from Ewity's reliance on external accounting integrations.