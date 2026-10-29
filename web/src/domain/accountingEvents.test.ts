import { describe, it, expect } from 'vitest';
import {
  validateOperationalEvent,
  translateEventToProposal,
  evaluateEventReplay,
  buildPaymentReceivedEvent,
  OperationalFactEvent,
} from './accountingEvents';
import { AccountRecord } from './accounts';

describe('SERP-460 Accounting-Event / Subledger Abstraction', () => {
  // Test fixture: Chart of Accounts containing Postable, Control, System, and Header accounts
  const mockAccounts: AccountRecord[] = [
    {
      id: 'acc-1',
      code: '1110', // Postable Cash
      name: 'Cash on Hand',
      accountClass: 'ASSET',
      subtype: 'BANK_AND_CASH',
      parentId: null,
      level: 1,
      currency: 'MVR',
      status: 'ACTIVE',
      balance: 0,
      isSystem: false,
    },
    {
      id: 'acc-2',
      code: '1115', // Control Bank
      name: 'Bank Control',
      accountClass: 'ASSET',
      subtype: 'BANK_AND_CASH',
      parentId: null,
      level: 1,
      currency: 'MVR',
      status: 'ACTIVE',
      balance: 0,
      isSystem: false,
    },
    {
      id: 'acc-3',
      code: '1210', // Control Accounts Receivable
      name: 'Trade Receivables Control',
      accountClass: 'ASSET',
      subtype: 'ACCOUNTS_RECEIVABLE',
      parentId: null,
      level: 1,
      currency: 'MVR',
      status: 'ACTIVE',
      balance: 0,
      isSystem: false,
    },
    {
      id: 'acc-4',
      code: '4110', // Postable Sales Revenue
      name: 'Sales Revenue',
      accountClass: 'REVENUE',
      subtype: 'SALES_REVENUE',
      parentId: null,
      level: 1,
      currency: 'MVR',
      status: 'ACTIVE',
      balance: 0,
      isSystem: false,
    },
    {
      id: 'acc-5',
      code: '2121', // Control Output GST
      name: 'GST Output Payable',
      accountClass: 'LIABILITY',
      subtype: 'TAX_PAYABLE',
      parentId: null,
      level: 1,
      currency: 'MVR',
      status: 'ACTIVE',
      balance: 0,
      isSystem: false,
    },
    {
      id: 'acc-header',
      code: '1000', // Header Account
      name: 'Current Assets Header',
      accountClass: 'ASSET',
      subtype: 'CURRENT_ASSET',
      parentId: null,
      level: 0,
      currency: 'MVR',
      status: 'ACTIVE',
      balance: 0,
      isSystem: false,
    },
  ];

  it('validates and translates a payment operational fact into a balanced journal proposal', () => {
    const paymentEvent: OperationalFactEvent = {
      id: 'evt_pay_001',
      organisationId: 'org_test_123',
      family: 'CASH_PAYMENT',
      eventType: 'PAYMENT_RECEIVED',
      sourceType: 'pos_counter_session',
      sourceId: 'sess_999',
      idempotencyKey: 'idem_pay_20261026_001',
      eventDate: '2026-10-26',
      currency: 'MVR',
      grossAmount: 1500.0,
      narration: 'POS Retail Cash Payment #1244',
      lines: [
        { lineNo: 1, accountCode: '1110', debit: 1500.0, credit: 0, narration: 'Cash receipt' },
        { lineNo: 2, accountCode: '1210', debit: 0, credit: 1500.0, narration: 'Customer receivable cleared' },
      ],
      recordedAt: '2026-10-26T08:00:00Z',
    };

    const res = translateEventToProposal(paymentEvent, mockAccounts, 'system');
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.proposal).toBeDefined();

    const prop = res.proposal!;
    expect(prop.status).toBe('draft');
    expect(prop.isBalanced).toBe(true);
    expect(prop.totalDebit).toBe(1500.0);
    expect(prop.totalCredit).toBe(1500.0);
    expect(prop.lines).toHaveLength(2);
    expect(prop.lines[0].amount).toBe(1500.0); // Debit positive
    expect(prop.lines[1].amount).toBe(-1500.0); // Credit negative
  });

  it('validates and translates a sales invoice operational fact (Order-to-Cash with Tax)', () => {
    const salesEvent: OperationalFactEvent = {
      id: 'evt_sale_002',
      organisationId: 'org_test_123',
      family: 'ORDER_TO_CASH',
      eventType: 'SALES_INVOICE_ISSUED',
      sourceType: 'commercial_document',
      sourceId: 'inv_888',
      idempotencyKey: 'idem_sale_20261026_002',
      eventDate: '2026-10-26',
      currency: 'MVR',
      grossAmount: 1080.0,
      netAmount: 1000.0,
      taxAmount: 80.0,
      narration: 'Commercial Sales Invoice INV-888',
      lines: [
        { lineNo: 1, accountCode: '1210', debit: 1080.0, credit: 0, narration: 'Gross receivable' },
        { lineNo: 2, accountCode: '4110', debit: 0, credit: 1000.0, narration: 'Net sales revenue' },
        { lineNo: 3, accountCode: '2121', debit: 0, credit: 80.0, narration: 'Output GST (8%)' },
      ],
      recordedAt: '2026-10-26T08:05:00Z',
    };

    const res = translateEventToProposal(salesEvent, mockAccounts, 'system');
    expect(res.isValid).toBe(true);
    expect(res.proposal).toBeDefined();
    expect(res.proposal!.totalDebit).toBe(1080.0);
    expect(res.proposal!.totalCredit).toBe(1080.0);
    expect(res.proposal!.lines).toHaveLength(3);
  });

  it('rejects an unbalanced operational fact (invariant enforcement)', () => {
    const unbalancedEvent: OperationalFactEvent = {
      id: 'evt_bad_003',
      organisationId: 'org_test_123',
      family: 'CASH_PAYMENT',
      eventType: 'PAYMENT_RECEIVED',
      sourceType: 'pos_counter_session',
      sourceId: 'sess_bad',
      idempotencyKey: 'idem_unbal_003',
      eventDate: '2026-10-26',
      currency: 'MVR',
      grossAmount: 500.0,
      narration: 'Corrupted Unbalanced Fact',
      lines: [
        { lineNo: 1, accountCode: '1110', debit: 500.0, credit: 0 },
        { lineNo: 2, accountCode: '1210', debit: 0, credit: 490.0 }, // 10 MVR imbalance
      ],
      recordedAt: '2026-10-26T08:10:00Z',
    };

    const res = translateEventToProposal(unbalancedEvent, mockAccounts, 'system');
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('Accounting event lines are unbalanced');
    expect(res.proposal).toBeUndefined();
  });

  it('rejects an operational fact with a minute 0.001 variance (exact zero-tolerance invariant)', () => {
    const minuteVarianceEvent: OperationalFactEvent = {
      id: 'evt_minute_003b',
      organisationId: 'org_test_123',
      family: 'CASH_PAYMENT',
      eventType: 'PAYMENT_RECEIVED',
      sourceType: 'pos_counter_session',
      sourceId: 'sess_minute',
      idempotencyKey: 'idem_min_003b',
      eventDate: '2026-10-26',
      currency: 'MVR',
      grossAmount: 100.0,
      narration: '0.001 MVR Variance Attack/Error',
      lines: [
        { lineNo: 1, accountCode: '1110', debit: 100.0, credit: 0 },
        { lineNo: 2, accountCode: '1210', debit: 0, credit: 99.999 }, // 0.001 variance
      ],
      recordedAt: '2026-10-26T08:11:00Z',
    };

    const res = translateEventToProposal(minuteVarianceEvent, mockAccounts, 'system');
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('Accounting event lines are unbalanced');
    expect(res.proposal).toBeUndefined();
  });

  it('rejects direct posting to header grouping accounts', () => {
    const headerEvent: OperationalFactEvent = {
      id: 'evt_hdr_004',
      organisationId: 'org_test_123',
      family: 'CASH_PAYMENT',
      eventType: 'PAYMENT_RECEIVED',
      sourceType: 'pos_counter_session',
      sourceId: 'sess_hdr',
      idempotencyKey: 'idem_hdr_004',
      eventDate: '2026-10-26',
      currency: 'MVR',
      grossAmount: 200.0,
      narration: 'Illegal Header Posting Attempt',
      lines: [
        { lineNo: 1, accountCode: '1000', debit: 200.0, credit: 0 }, // Level 0 Header
        { lineNo: 2, accountCode: '1210', debit: 0, credit: 200.0 },
      ],
      recordedAt: '2026-10-26T08:12:00Z',
    };

    const res = translateEventToProposal(headerEvent, mockAccounts, 'system');
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('is a header grouping and cannot accept entries');
  });

  it('guarantees safe idempotent replay and detects payload conflicts', () => {
    const originalEvent: OperationalFactEvent = {
      id: 'evt_orig_005',
      organisationId: 'org_test_123',
      family: 'CASH_PAYMENT',
      eventType: 'PAYMENT_SETTLED',
      sourceType: 'payment_settlement',
      sourceId: 'set_101',
      idempotencyKey: 'idem_settle_101',
      eventDate: '2026-10-26',
      currency: 'MVR',
      grossAmount: 350.0,
      narration: 'Settlement Batch 101',
      lines: [
        { lineNo: 1, accountCode: '1115', debit: 350.0, credit: 0 },
        { lineNo: 2, accountCode: '1110', debit: 0, credit: 350.0 },
      ],
      recordedAt: '2026-10-26T08:15:00Z',
    };

    const existingEvents: OperationalFactEvent[] = [originalEvent];

    // 1. Exact replay attempt (same key, same payload): safe replay
    const replayAttempt: OperationalFactEvent = { ...originalEvent, id: 'evt_replay_new_attempt' };
    const replayCheck = evaluateEventReplay(replayAttempt, existingEvents);
    expect(replayCheck.isReplay).toBe(true);
    expect(replayCheck.isConflict).toBe(false);

    // 2. Tampered replay attempt (same key, different amount): conflict detected
    const tamperedAttempt: OperationalFactEvent = {
      ...originalEvent,
      id: 'evt_tampered',
      grossAmount: 400.0,
    };
    const conflictCheck = evaluateEventReplay(tamperedAttempt, existingEvents);
    expect(conflictCheck.isReplay).toBe(false);
    expect(conflictCheck.isConflict).toBe(true);
  });

  describe('buildPaymentReceivedEvent (SERP-460 producer wiring)', () => {
    it('builds a balanced event that translates to a valid draft proposal (bank/card method)', () => {
      const event = buildPaymentReceivedEvent({
        paymentId: 'pay-wire-001',
        organisationId: 'org_test_123',
        invoiceId: 'inv-555',
        invoiceNumber: 'INV-2026-0555',
        amount: 750.0,
        paymentDate: '2026-10-29',
        method: 'BML Bank Transfer',
      });

      expect(event.lines).toHaveLength(2);
      expect(event.lines.find((l) => l.accountCode === '1115')?.debit).toBe(750.0); // Bank Control, not Cash
      expect(event.lines.find((l) => l.accountCode === '1210')?.credit).toBe(750.0);

      const res = translateEventToProposal(event, mockAccounts, 'system');
      expect(res.isValid).toBe(true);
      expect(res.proposal?.status).toBe('draft');
      expect(res.proposal?.isBalanced).toBe(true);
    });

    it('routes cash payments to the Cash on Hand account, not Bank Control', () => {
      const event = buildPaymentReceivedEvent({
        paymentId: 'pay-wire-002',
        organisationId: 'org_test_123',
        invoiceId: 'inv-556',
        invoiceNumber: 'INV-2026-0556',
        amount: 100.0,
        paymentDate: '2026-10-29',
        method: 'Cash',
      });

      expect(event.lines.find((l) => l.accountCode === '1110')?.debit).toBe(100.0);
      expect(event.lines.some((l) => l.accountCode === '1115')).toBe(false);
    });

    it('is a safe re-run: evaluateEventReplay flags the identical payment id as a replay, not a double translation', () => {
      const params = {
        paymentId: 'pay-wire-003',
        organisationId: 'org_test_123',
        invoiceId: 'inv-557',
        invoiceNumber: 'INV-2026-0557',
        amount: 200.0,
        paymentDate: '2026-10-29',
        method: 'Cash',
      };
      const firstEvent = buildPaymentReceivedEvent(params);
      const secondEvent = buildPaymentReceivedEvent(params); // same payment id => same idempotency key

      const replay = evaluateEventReplay(secondEvent, [firstEvent]);
      expect(replay.isReplay).toBe(true);
      expect(replay.isConflict).toBe(false);
    });
  });
});
