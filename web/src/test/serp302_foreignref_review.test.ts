// tests/serp302_foreignref_review.test.ts
// Vision INDEPENDENT RE-VERIFICATION artifact for PR #160 / SERP-302, head aca600e.
// Incorporated as permanent coverage per Vision PASS (seq 7720).
// Stale message-literal assertions corrected to check for fail-closed behaviour.
//
// AC2 says foreign references are validated BEFORE COMMIT. The implementation
// now fails closed: when no lookup is supplied, an error is raised rather
// than the check being silently skipped.

import { describe, it, expect } from 'vitest';
import { validateDataset } from '../domain/ingestion/validator';
import { OPENING_BALANCES_SCHEMA, autoMapColumns } from '../domain/ingestion/schemas';

const schema: any = OPENING_BALANCES_SCHEMA;

describe('SERP-302 foreign reference: fail-open vs fail-closed', () => {
  const baseCtx = {} as any;

  it('ADVERSARIAL: a bogus account code must be rejected when the lookup IS supplied', () => {
    const mappings = autoMapColumns(['account_code','debit','credit'], OPENING_BALANCES_SCHEMA, [['1010','1','1']]);
    const ctx = {
      ...baseCtx,
      foreignReferences: {
        'chart_of_accounts.code': new Set(['1010', '3010']),
      },
    };
    const s = validateDataset(
      ['account_code', 'debit', 'credit'],
      [['9999', '100', '100']],
      mappings,
      schema,
      ctx
    );
    const hasForeignError = JSON.stringify(s).includes('Foreign reference violation');
    console.log('DIAG with lookup: foreign error =', hasForeignError);
    console.log('DIAG with lookup: FULL SUMMARY =', JSON.stringify(s, null, 1).slice(0, 1200));
    expect(hasForeignError).toBe(true);
  });

  it('ADVERSARIAL: with NO lookup supplied, a bogus account code must be caught (fail-closed)', () => {
    const mappings = autoMapColumns(['account_code','debit','credit'], OPENING_BALANCES_SCHEMA, [['1010','1','1']]);
    // No foreignReferences at all - the default for an un-primed caller.
    const s = validateDataset(
      ['account_code', 'debit', 'credit'],
      [['9999', '100', '100']],
      mappings,
      schema,
      baseCtx
    );
    const full = JSON.stringify(s);
    const isFailClosed = /fail-closed/i.test(full);
    const hasAnyError = (s as any).isValid === false;
    console.log('DIAG no lookup: fail-closed msg present =', isFailClosed);
    console.log('DIAG no lookup: errorRows =', (s as any).errorRows);
    console.log('DIAG no lookup: FULL =', JSON.stringify(s.errors, null, 1).slice(0, 900));
    // The validator must either reject with fail-closed or raise a foreign-ref error.
    // A silent pass (isValid=true) is the bug this test guards against.
    expect(hasAnyError).toBe(true);
    expect(isFailClosed).toBe(true);
  });

  it('ADVERSARIAL: an EMPTY lookup set must not silently pass everything', () => {
    const mappings = autoMapColumns(['account_code','debit','credit'], OPENING_BALANCES_SCHEMA, [['1010','1','1']]);
    const ctx = {
      ...baseCtx,
      foreignReferences: { 'chart_of_accounts.code': new Set<string>() },
    };
    const s = validateDataset(
      ['account_code', 'debit', 'credit'],
      [['1010', '100', '100']],
      mappings,
      schema,
      ctx
    );
    const full2 = JSON.stringify(s);
    const isFailClosed = /fail-closed/i.test(full2);
    const hasAnyError = (s as any).isValid === false;
    console.log('DIAG empty lookup: fail-closed msg present =', isFailClosed);
    console.log('DIAG empty lookup: isValid =', (s as any).isValid);
    console.log('DIAG empty lookup: FULL =', JSON.stringify(s.errors, null, 1).slice(0, 700));
    // An empty lookup must not silently pass — the validator must fail closed.
    expect(hasAnyError).toBe(true);
    expect(isFailClosed).toBe(true);
  });
});
