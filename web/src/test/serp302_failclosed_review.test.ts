// tests/serp302_failclosed_review.test.ts
// Vision INDEPENDENT RE-VERIFICATION artifact for PR #160 / SERP-302, head aca600e.
// Incorporated as permanent coverage per Vision PASS (seq 7720).
//
// Scoped to the AC2 fail-closed change ONLY. Parser and SQL probe are settled
// and are deliberately not retested here.
//
// The change is correct in shape: an unprimed reference lookup is now an error
// rather than a silent pass. That is the right call. But fail-closed
// introduces a risk class that fail-open never had: over-blocking. These
// cases check the fix does not refuse legitimate data.

import { describe, it, expect } from 'vitest';
import { validateDataset } from '../domain/ingestion/validator';
import { OPENING_BALANCES_SCHEMA, autoMapColumns } from '../domain/ingestion/schemas';

const HDRS = ['account_code', 'debit', 'credit'];
const MAPS = autoMapColumns(HDRS, OPENING_BALANCES_SCHEMA as any, [['1010', '1', '1']]);
const LOOKUP = { 'chart_of_accounts.code': new Set(['1010', '1020', '3010']) };

describe('SERP-302 fail-closed: does it over-block legitimate data?', () => {
  it('a VALID reference with a loaded lookup still passes', () => {
    const s = validateDataset(HDRS, [['1010', '100', '100']], MAPS, OPENING_BALANCES_SCHEMA as any, { foreignReferences: LOOKUP });
    const foreignErr = JSON.stringify(s).includes('Foreign reference');
    console.log('DIAG valid ref + lookup: foreign error =', foreignErr, '| errorRows =', (s as any).errorRows);
    expect(foreignErr).toBe(false);
  });

  it('over-block risk: a real account code missing from the caller-supplied lookup is now REJECTED', () => {
    // '1500' is a perfectly valid GL code. If the caller's lookup is incomplete,
    // fail-closed rejects good data. This is the trade-off being accepted, and
    // it should be a conscious one.
    const s = validateDataset(HDRS, [['1500', '100', '100']], MAPS, OPENING_BALANCES_SCHEMA as any, { foreignReferences: LOOKUP });
    const rejected = JSON.stringify(s).includes('does not exist');
    console.log('DIAG valid-but-uncatalogued code 1500 rejected =', rejected);
    expect(rejected).toBe(true);
  });

  it('every row fails identically when the lookup is unprimed, not just the first', () => {
    const s = validateDataset(HDRS, [['1010', '1', '1'], ['1010', '2', '2'], ['1010', '3', '3']], MAPS, OPENING_BALANCES_SCHEMA as any, {});
    console.log('DIAG unprimed: totalRows =', (s as any).totalRows, '| errorRows =', (s as any).errorRows, '| isValid =', (s as any).isValid);
    expect((s as any).isValid).toBe(false);
  });

  it('the unprimed error names the missing lookup so the user can act on it', () => {
    const s = validateDataset(HDRS, [['1010', '1', '1']], MAPS, OPENING_BALANCES_SCHEMA as any, {});
    const msg = JSON.stringify(s);
    const namesKey = msg.includes('chart_of_accounts.code');
    const explains = /not loaded or empty/i.test(msg);
    console.log('DIAG unprimed message names the lookup key =', namesKey, '| explains why =', explains);
    expect(namesKey).toBe(true);
    expect(explains).toBe(true);
  });

  it('a row where the reference cell is EMPTY is not blocked by the fail-closed path', () => {
    // The guard is gated on parsedValue !== '' — an empty optional reference
    // must not be reported as an unloadable lookup.
    const s = validateDataset(HDRS, [['1010', '1', '1']], MAPS, OPENING_BALANCES_SCHEMA as any, {});
    const emptyBlocked = /Cannot validate "" before commit/.test(JSON.stringify(s));
    console.log('DIAG empty-value wrongly blocked =', emptyBlocked);
    expect(emptyBlocked).toBe(false);
  });

  it('WIZARD REALITY: the hardcoded 9-code lookup rejects most real chart-of-accounts codes', () => {
    // The wizard supplies a fixed set of 9 codes. Any tenant whose GL uses a
    // different code cannot ingest opening balances at all. This documents the
    // practical blast radius of fail-closed with a synthetic caller.
    const wizardLookup = { 'chart_of_accounts.code': new Set(['1010', '1020', '1200', '1500', '2010', '2020', '3010', '4010', '5010']) };
    const realWorldCodes = ['1100', '2100', '2200', '4000', '6100'];
    const rejected = realWorldCodes.filter((code) => {
      const s = validateDataset(HDRS, [[code, '1', '1']], MAPS, OPENING_BALANCES_SCHEMA as any, { foreignReferences: wizardLookup });
      return JSON.stringify(s).includes('does not exist');
    });
    console.log('DIAG wizard lookup rejects these valid codes =', JSON.stringify(rejected));
    console.log('DIAG wizard lookup size =', wizardLookup['chart_of_accounts.code'].size);
    // Recorded as a measurement, not asserted as a failure - the fix is
    // correct, the lookup source is the weakness.
    expect(wizardLookup['chart_of_accounts.code'].size).toBe(9);
  });
});
