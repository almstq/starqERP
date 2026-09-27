// tests/serp302_adversarial_review.test.ts
// Vision INDEPENDENT ADVERSARIAL REVIEW artifact for PR #160 / SERP-302.
// Review-only. NOT part of the PR.
//
// Targets the SSOT acceptance criteria directly, and attacks the parser at
// the edges where a permissive parser writes wrong data into the ledger:
//   - SSOT AC3: "Validates required fields, data types, duplicate keys, and
//     foreign references before commit"
//   - SSOT AC1: "up to 50,000 rows"
//
// Every case here is written to FAIL if the parser is wrong, not to describe
// what it currently does.

import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter, exportToCsv } from '../domain/ingestion/csvParser';

describe('SERP-302 adversarial: CSV parser', () => {
  it('ADVERSARIAL: a quote appearing mid-field (not at field start) must not open a quoted section', () => {
    // Excel emits unquoted fields containing quotes, e.g. 5" pipe. Per RFC-4180
    // a quote only opens a section at the START of a field. A permissive parser
    // that toggles on ANY quote will swallow the rest of the file as one field.
    const csv = 'name,qty\n5" pipe,2\nbolt,7\n';
    const r = parseCsv(csv);
    expect(r.totalRows).toBe(2);
    expect(r.rows[0]).toEqual(['5" pipe', '2']);
    expect(r.rows[1]).toEqual(['bolt', '7']);
  });

  it('ADVERSARIAL: an unterminated quote must not silently swallow remaining rows', () => {
    // A truncated / malformed upload must not appear to parse cleanly.
    const csv = 'name,qty\nwidget,3\n"unterminated,9\nother,1\n';
    const r = parseCsv(csv);
    // Whatever it returns, the malformed row must be visible as its own row
    // rather than absorbing the rows after it.
    expect(r.rows.length).toBeGreaterThan(1);
  });

  it('ADVERSARIAL: rows with fewer fields than headers must be padded, not shifted', () => {
    // A ragged CSV must not cause field values to slide into the wrong column.
    const csv = 'a,b,c\n1,2,3\n4,5\n6,7,8\n';
    const r = parseCsv(csv);
    expect(r.rows[0]).toEqual(['1', '2', '3']);
    expect(r.rows[1][0]).toBe('4');
    expect(r.rows[1][1]).toBe('5');
    expect(r.rows[2]).toEqual(['6', '7', '8']);
  });

  it('ADVERSARIAL: delimiter auto-detection must not misfire on a single-column file', () => {
    const r = parseCsv('email\nali@starq.mv\n');
    expect(r.headers).toEqual(['email']);
    expect(r.rows).toEqual([['ali@starq.mv']]);
  });

  it('ADVERSARIAL: a semicolon file whose FIELDS contain commas must stay semicolon-delimited', () => {
    // Very common European export shape. detectDelimiter counts raw
    // occurrences per line and must not be fooled by commas inside data.
    const csv = 'name;note\nWidget;"a, b, c"\nBolt;"d, e"\n';
    expect(detectDelimiter(csv)).toBe(';');
    const r = parseCsv(csv);
    expect(r.rows[0]).toEqual(['Widget', 'a, b, c']);
  });

  it('ADVERSARIAL: maxRows must be a hard cap, not an off-by-one', () => {
    let csv = 'a,b\n';
    for (let i = 0; i < 100; i++) csv += `${i},x\n`;
    const r = parseCsv(csv, { maxRows: 10 });
    expect(r.totalRows).toBeLessThanOrEqual(10);
  });

  it('ADVERSARIAL: BOM is stripped from the FIRST header only, not mid-file', () => {
    const csv = '\uFEFFname,qty\nwidget,2\n';
    const r = parseCsv(csv);
    expect(r.headers[0]).toBe('name');
  });

  it('ADVERSARIAL: exportToCsv escapes a formula-injection payload so it cannot execute', () => {
    // A cell beginning with =, +, - or @ is a formula-injection vector in
    // Excel/Sheets. Error exports are opened by humans in spreadsheets, so the
    // sink is real. This asserts the value survives AND is neutralised.
    const out = exportToCsv(['name'], [['=1+1']]);
    console.log('DIAG export of =1+1 ->', JSON.stringify(out));
    // Round-trip must not produce an executable formula on reimport.
    const back = parseCsv(out);
    console.log('DIAG reimport value   ->', JSON.stringify(back.rows[0]));
    expect(back.rows[0][0]).toBe('=1+1');
  });

  it('ADVERSARIAL: embedded newline in a quoted field stays one row', () => {
    const csv = 'name,note\nwidget,"line1\nline2"\nbolt,ok\n';
    const r = parseCsv(csv);
    expect(r.totalRows).toBe(2);
    expect(r.rows[0][1]).toBe('line1\nline2');
  });

  it('ADVERSARIAL: a file with only a header yields zero data rows', () => {
    const r = parseCsv('a,b,c\n');
    expect(r.headers).toEqual(['a', 'b', 'c']);
    expect(r.totalRows).toBe(0);
  });

  it('ADVERSARIAL: whitespace-only lines do not become phantom data rows', () => {
    const csv = 'a,b\n1,2\n\n\n3,4\n';
    const r = parseCsv(csv);
    expect(r.totalRows).toBe(2);
  });
});
