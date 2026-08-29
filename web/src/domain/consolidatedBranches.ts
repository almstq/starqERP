export interface BusinessBranch {
  id: string;
  code: string;
  name: string;
  island: string;
  managerName: string;
  isHeadOffice: boolean;
}

export interface BranchIncomeStatement {
  branchId: string;
  branchCode: string;
  branchName: string;
  externalRevenue: number;
  internalInterBranchRevenue: number;
  totalRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  internalInterBranchCharges: number;
  netIncome: number;
}

export interface ConsolidatedFinancialReport {
  periodName: string;
  branches: BranchIncomeStatement[];
  
  // Aggregated Pre-Elimination Totals
  aggregatedExternalRevenue: number;
  aggregatedInternalRevenue: number;
  aggregatedTotalRevenue: number;
  aggregatedCogs: number;
  aggregatedGrossProfit: number;
  aggregatedOperatingExpenses: number;
  aggregatedInternalCharges: number;
  aggregatedNetIncome: number;

  // Inter-Company Elimination Adjustments
  eliminatedInterBranchRevenue: number;
  eliminatedInterBranchCharges: number;

  // Final Consolidated Figures
  consolidatedRevenue: number;
  consolidatedCogs: number;
  consolidatedGrossProfit: number;
  consolidatedOperatingExpenses: number;
  consolidatedNetIncome: number;
  consolidatedNetMarginPct: number;

  generatedAt: string;
}

export const STARQ_BUSINESS_BRANCHES: BusinessBranch[] = [
  {
    id: 'br-hq',
    code: 'BR-HQ',
    name: 'Corporate Head Office',
    island: 'Male',
    managerName: 'Ali Musthaq',
    isHeadOffice: true,
  },
  {
    id: 'br-mar',
    code: 'BR-MAR',
    name: 'Male Marine & Dock Services',
    island: 'Male',
    managerName: 'Ahmed Hassan',
    isHeadOffice: false,
  },
  {
    id: 'br-hul',
    code: 'BR-HUL',
    name: 'Hulhumale Commercial Logistics',
    island: 'Hulhumale',
    managerName: 'Ibrahim Rasheed',
    isHeadOffice: false,
  },
  {
    id: 'br-thl',
    code: 'BR-THL',
    name: 'Thilafushi Heavy Engineering Yard',
    island: 'Thilafushi',
    managerName: 'Naeem Shareef',
    isHeadOffice: false,
  },
];

/**
 * Calculates consolidated financial statements across business units with automated inter-branch eliminations.
 */
export function generateConsolidatedReport(params: {
  periodName: string;
  branchData: BranchIncomeStatement[];
}): ConsolidatedFinancialReport {
  const { periodName, branchData } = params;

  let aggExtRev = 0;
  let aggIntRev = 0;
  let aggCogs = 0;
  let aggOpex = 0;
  let aggIntExp = 0;
  let aggNetInc = 0;

  for (const b of branchData) {
    aggExtRev += b.externalRevenue;
    aggIntRev += b.internalInterBranchRevenue;
    aggCogs += b.costOfGoodsSold;
    aggOpex += b.operatingExpenses;
    aggIntExp += b.internalInterBranchCharges;
    aggNetInc += b.netIncome;
  }

  // Inter-branch eliminations: Inter-branch revenues and charges cancel out exactly
  const eliminationAmount = round2(Math.min(aggIntRev, aggIntExp));

  const consolidatedRevenue = round2(aggExtRev);
  const consolidatedCogs = round2(aggCogs);
  const consolidatedGrossProfit = round2(consolidatedRevenue - consolidatedCogs);
  const consolidatedOperatingExpenses = round2(aggOpex);
  const consolidatedNetIncome = round2(consolidatedGrossProfit - consolidatedOperatingExpenses);

  const consolidatedNetMarginPct = consolidatedRevenue > 0
    ? round2((consolidatedNetIncome / consolidatedRevenue) * 100)
    : 0;

  return {
    periodName,
    branches: branchData,
    aggregatedExternalRevenue: round2(aggExtRev),
    aggregatedInternalRevenue: round2(aggIntRev),
    aggregatedTotalRevenue: round2(aggExtRev + aggIntRev),
    aggregatedCogs: round2(aggCogs),
    aggregatedGrossProfit: round2((aggExtRev + aggIntRev) - aggCogs),
    aggregatedOperatingExpenses: round2(aggOpex),
    aggregatedInternalCharges: round2(aggIntExp),
    aggregatedNetIncome: round2(aggNetInc),
    eliminatedInterBranchRevenue: eliminationAmount,
    eliminatedInterBranchCharges: eliminationAmount,
    consolidatedRevenue,
    consolidatedCogs,
    consolidatedGrossProfit,
    consolidatedOperatingExpenses,
    consolidatedNetIncome,
    consolidatedNetMarginPct,
    generatedAt: new Date().toISOString(),
  };
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}
