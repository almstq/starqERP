/**
 * SERP-288 — no synthetic business series on a tenant surface.
 *
 * WHY A TEST AND NOT JUST THE FIX. The fabricated statutory identifier of
 * SERP-237 was removed twice and came back twice. A cleanup does not survive
 * contact with the next feature; a test does. This one guards the same class of
 * defect on the analytics surfaces.
 *
 * THE DEFECT IT LOCKS OUT. MONTHLY_SALES_CHART_DATA — six months of invented
 * trading totalling MVR 1,051,700 — was rendered under the heading "Financial
 * Performance (MVR)" as soon as a tenant entered ONE invoice. Gating it on the
 * tenant's own activity is what made it dangerous rather than obviously fake:
 * it looked earned. SERVICE_BREAKDOWN_DATA showed a car-workshop service mix to
 * every tenant whatever business they were in.
 *
 * THE RULE: a number a reader would take as a measurement of their business is
 * derived from their records, or it is not shown.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = sourceFiles(SRC);
const read = (f: string) => fs.readFileSync(f, 'utf8');
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/');

/** Surfaces that present business performance to a tenant. */
const ANALYTICS = /^components\/(dashboard|reports)\//;

describe('SERP-288 — synthetic business series', () => {
  it('the two removed constants are gone by name, everywhere', () => {
    // Two files NAME them in prose — the tombstone in mockData.ts and the
    // rationale at the top of dashboardSeries.ts. Both explain why they were
    // removed, which is the record this task exists to leave behind. So they
    // are exempt from the mention check and subject to a stricter one: neither
    // may DECLARE such a constant.
    const EXPLAINS = /^(data\/mockData\.ts|domain\/dashboardSeries\.ts)$/;
    for (const known of ['MONTHLY_SALES_CHART_DATA', 'SERVICE_BREAKDOWN_DATA']) {
      const offenders = files
        .filter((f) => !EXPLAINS.test(rel(f)) && read(f).includes(known))
        .map(rel);
      expect(offenders, `${known} was removed by SERP-288 and came back`).toEqual([]);
    }
    for (const f of files.filter((x) => EXPLAINS.test(rel(x)))) {
      expect(read(f), `${rel(f)} may explain the removal, not undo it`)
        .not.toMatch(/export const (MONTHLY_SALES_CHART_DATA|SERVICE_BREAKDOWN_DATA)/);
    }
  });

  it('no analytics surface imports from mockData at all', () => {
    // The narrow fix would be to ban the two names. The defect is the channel:
    // any constant reachable from a dashboard becomes a number on a screen a
    // founder reads as a measurement.
    const offenders = files
      .filter((f) => ANALYTICS.test(rel(f)) && /from\s+['"][^'"]*data\/mockData['"]/.test(read(f)))
      .map(rel);
    expect(
      offenders,
      'An analytics surface may only render figures derived from the tenant records.',
    ).toEqual([]);
  });

  it('no analytics surface carries an inline month-series literal', () => {
    // The exact shape that was there: an array of objects keyed by month with a
    // revenue or sales figure attached. Catches a reintroduction that renames
    // the constant or moves it inline to dodge the check above.
    const pattern = /\{\s*month\s*:\s*['"][A-Za-z]{3}[^'"]*['"]\s*,[^}]*\b(revenue|sales|turnover)\b\s*:\s*\d{3,}/;
    const offenders = files.filter((f) => ANALYTICS.test(rel(f)) && pattern.test(read(f))).map(rel);
    expect(
      offenders,
      'A month-keyed revenue literal on a dashboard is invented trading history.',
    ).toEqual([]);
  });

  it('the derivation module is what the analytics surfaces actually use', () => {
    // A positive assertion, not only prohibitions: a test suite that can pass
    // by deleting the charts has proven nothing.
    for (const surface of ['components/dashboard/DashboardView.tsx', 'components/reports/ReportsView.tsx']) {
      const body = read(path.join(SRC, surface));
      expect(body, `${surface} must derive its series`).toMatch(/from\s+['"][^'"]*domain\/dashboardSeries['"]/);
      expect(body).toMatch(/buildMonthlyPerformance\(/);
      expect(body).toMatch(/buildServiceMix\(/);
    }
  });

  it('revenue on those surfaces is taken net of GST', () => {
    // GST collected is held for MIRA. buildMonthlyPerformance sums `subtotal`;
    // this asserts nobody "fixes" it to totalAmount later, which would overstate
    // the chart by 8% (16-17% on tourism supplies) without any visible symptom.
    const domain = read(path.join(SRC, 'domain/dashboardSeries.ts'));
    expect(domain).toMatch(/inv\.subtotal/);
    expect(domain, 'totalAmount includes GST and is not revenue').not.toMatch(/inv\.totalAmount/);
  });
});
