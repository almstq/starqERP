export type AccountClass = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type AccountSubtype =
  | 'CURRENT_ASSET'
  | 'BANK_AND_CASH'
  | 'ACCOUNTS_RECEIVABLE'
  | 'INVENTORY'
  | 'PREPAID_EXPENSE'
  | 'FIXED_ASSET'
  | 'ACCUMULATED_DEPRECIATION'
  | 'NON_CURRENT_ASSET'
  | 'CURRENT_LIABILITY'
  | 'ACCOUNTS_PAYABLE'
  | 'CREDIT_CARD'
  | 'TAX_PAYABLE'
  | 'ACCRUED_EXPENSES'
  | 'LONG_TERM_LIABILITY'
  | 'OWNERS_EQUITY'
  | 'RETAINED_EARNINGS'
  | 'CAPITAL_CONTRIBUTION'
  | 'DRAWINGS'
  | 'OPERATING_REVENUE'
  | 'SALES_REVENUE'
  | 'SERVICE_REVENUE'
  | 'DISCOUNT_GIVEN'
  | 'OTHER_INCOME'
  | 'COST_OF_GOODS_SOLD'
  | 'OPERATING_EXPENSE'
  | 'PAYROLL_EXPENSE'
  | 'RENT_AND_UTILITIES'
  | 'BANK_FEES_AND_CHARGES'
  | 'MARKETING_EXPENSE'
  | 'TAX_EXPENSE'
  | 'DEPRECIATION_EXPENSE';

export type AccountCurrency = 'MVR' | 'USD' | 'MULTI';

export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface AccountRecord {
  id: string;
  code: string;
  name: string;
  accountClass: AccountClass;
  subtype: AccountSubtype;
  parentId: string | null;
  level: number;
  currency: AccountCurrency;
  status: AccountStatus;
  balance: number;
  isSystem: boolean;
  description?: string;
  taxCode?: string;
}

export interface AccountHierarchyNode extends AccountRecord {
  children: AccountHierarchyNode[];
}

export const CLASS_LABELS: Record<AccountClass, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expenses',
};

export const CLASS_CODE_RANGES: Record<AccountClass, { min: string; max: string; prefix: string }> = {
  ASSET: { min: '1000', max: '1999', prefix: '1' },
  LIABILITY: { min: '2000', max: '2999', prefix: '2' },
  EQUITY: { min: '3000', max: '3999', prefix: '3' },
  REVENUE: { min: '4000', max: '4999', prefix: '4' },
  EXPENSE: { min: '5000', max: '6999', prefix: '5' },
};

export const SUBTYPE_LABELS: Record<AccountSubtype, string> = {
  CURRENT_ASSET: 'Current Asset',
  BANK_AND_CASH: 'Bank & Cash',
  ACCOUNTS_RECEIVABLE: 'Accounts Receivable (Trade Debtors)',
  INVENTORY: 'Inventory & Stock Asset',
  PREPAID_EXPENSE: 'Prepayments & Deposits',
  FIXED_ASSET: 'Property, Plant & Equipment',
  ACCUMULATED_DEPRECIATION: 'Accumulated Depreciation',
  NON_CURRENT_ASSET: 'Non-Current Asset',
  CURRENT_LIABILITY: 'Current Liability',
  ACCOUNTS_PAYABLE: 'Accounts Payable (Trade Creditors)',
  CREDIT_CARD: 'Credit Card & Short Loans',
  TAX_PAYABLE: 'MIRA Tax & GST Payable',
  ACCRUED_EXPENSES: 'Accrued Liabilities',
  LONG_TERM_LIABILITY: 'Long-Term Borrowings',
  OWNERS_EQUITY: 'Owner / Partner Capital',
  RETAINED_EARNINGS: 'Retained Earnings',
  CAPITAL_CONTRIBUTION: 'Capital Contributions',
  DRAWINGS: 'Owner Drawings',
  OPERATING_REVENUE: 'Primary Operating Revenue',
  SALES_REVENUE: 'Goods & Merchandise Sales',
  SERVICE_REVENUE: 'Services & Labor Revenue',
  DISCOUNT_GIVEN: 'Sales Discounts & Rebates',
  OTHER_INCOME: 'Other Income & Gains',
  COST_OF_GOODS_SOLD: 'Cost of Goods Sold (COGS)',
  OPERATING_EXPENSE: 'General & Administrative Expense',
  PAYROLL_EXPENSE: 'Salaries & Staff Benefits',
  RENT_AND_UTILITIES: 'Rent, Power & Internet',
  BANK_FEES_AND_CHARGES: 'Bank & Merchant Gateway Fees',
  MARKETING_EXPENSE: 'Advertising & Marketing',
  TAX_EXPENSE: 'Statutory Taxes & Green Tax',
  DEPRECIATION_EXPENSE: 'Depreciation & Amortization',
};

export function buildAccountTree(accounts: AccountRecord[]): AccountHierarchyNode[] {
  const map = new Map<string, AccountHierarchyNode>();
  const roots: AccountHierarchyNode[] = [];

  for (const acc of accounts) {
    map.set(acc.id, { ...acc, children: [] });
  }

  for (const acc of accounts) {
    const node = map.get(acc.id)!;
    if (acc.parentId && map.has(acc.parentId)) {
      map.get(acc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRecursive = (nodes: AccountHierarchyNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortRecursive(node.children);
      }
    }
  };

  sortRecursive(roots);
  return roots;
}

export function flattenAccountTree(nodes: AccountHierarchyNode[], expandedIds: Set<string>): AccountHierarchyNode[] {
  const result: AccountHierarchyNode[] = [];

  function traverse(list: AccountHierarchyNode[]) {
    for (const node of list) {
      result.push(node);
      if (node.children.length > 0 && expandedIds.has(node.id)) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return result;
}
