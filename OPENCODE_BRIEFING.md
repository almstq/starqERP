# OPENCODE ACTION DIRECTIVE: VITEST FIXES & SERP-328 COMPLETION

**To**: `@opencode` (OpenCode)  
**From**: `@antigravity` (Core Architecture) via Founder Directive  
**Status**: Playwright E2E is 15/15 GREEN (Excellent progress!). Now fixing the 2 unit test blockers.

---

## 1. Fix Failing `journals.test.ts` (`derives balanced journals...`)

### Root Cause:
In `src/domain/journals.ts`, payment journals were updated to balance:
- **Debit**: `1010 Bank - BML MVR` (Asset)
- **Credit**: `1100 Accounts Receivable` (Asset)

In your unit test `src/domain/journals.test.ts`, the mock invoice or payment expectation expects the legacy account code or is missing the GST breakdown.

### Exact Fix:
In `src/domain/journals.test.ts`, locate the failing test `derives balanced journals from operational invoices, payments, expenses`:

```typescript
it('derives balanced journals from operational invoices, payments, expenses', () => {
  const invoice: Invoice = {
    id: 'INV-001',
    invoiceNumber: 'INV-2026-001',
    customerName: 'Test Client',
    totalAmount: 1080,
    taxAmount: 80,
    amountPaid: 1080,
    status: 'Paid',
    createdAt: '2026-08-20T00:00:00.000Z',
    items: [
      { description: 'Service', quantity: 1, unitPrice: 1000, taxRate: 8, total: 1080 }
    ]
  };

  const payment: Payment = {
    id: 'PAY-001',
    invoiceId: 'INV-001',
    amount: 1080,
    paymentMethod: 'Bank Transfer',
    reference: 'REF-001',
    createdAt: '2026-08-20T00:00:00.000Z'
  };

  const journals = deriveJournalsFromOperations([invoice], [payment], []);

  // Assert every derived journal is balanced: sum(debit) === sum(credit)
  for (const j of journals) {
    const totalDebit = j.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = j.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThanOrEqual(0.01);
  }
});
```

---

## 2. Fix Hanging / Crashing `frontend_smoke_audit.test.tsx` (`Surface 10: Reports`)

### Root Cause of the 240s Timeout & Hang:
`ReportsView.tsx` mounts sub-components that attempt to read `creditNotes`, `periods`, or compute trial balances over `accounts`. When passed `undefined`, or when an uncleaned timer runs, React enters an unhandled rejection loop that prevents the Vitest jsdom worker thread from exiting.

### Exact Fix:
In `src/test/frontend_smoke_audit.test.tsx`, locate `Surface 10: Reports`:

1. **Provide complete mock ERP & Finance context**:
```typescript
const fullMockContext = {
  ...baseMockERPContext,
  accounts: [],
  journals: [],
  invoices: [],
  creditNotes: [],
  payments: [],
  customers: [],
  suppliers: [],
  expenses: [],
  periods: [],
  isGstRegistered: true,
  currentPeriod: null,
};
```

2. **Add `afterEach(() => { vi.clearAllTimers(); })`** or run single-thread if jsdom worker pools hang on Windows:
```bash
npx vitest run --pool=forks --testTimeout=10000
```

---

## 3. Immediate Commands to Run & Verify

Run each test individually to confirm the fix:

```powershell
# 1. Run journals unit test
npx vitest run src/domain/journals.test.ts

# 2. Run frontend smoke audit
npx vitest run src/test/frontend_smoke_audit.test.tsx

# 3. Run full vitest suite
npx vitest run --pool=forks
```

---

## 4. Announce Completion on Nexus

Once `npx vitest run` and `npx playwright test` are 100% green, announce completion to the swarm:

```powershell
node ../../agent-comms/scripts/send.mjs --from opencode --room --body "ACK · DONE #SERP-328 Playwright E2E (15/15) and Vitest suite 100% green." --task SERP-328 --action done
```
