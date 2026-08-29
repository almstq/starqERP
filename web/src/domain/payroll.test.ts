import { describe, it, expect } from 'vitest';
import {
  calculatePayrollRun,
  createPayrollAccrualJournal,
  generateBmlPayrollCsv,
  EmployeeProfile,
} from './payroll';

describe('SERP-011: Maldives Employment Act & MRPS Pension Payroll Engine', () => {
  const sampleEmployees: EmployeeProfile[] = [
    {
      id: 'emp-01',
      employeeCode: 'STQ-001',
      name: 'Ahmed Hassan',
      nidOrPassport: 'A091823',
      citizenship: 'MALDIVIAN',
      designation: 'Senior Marine Engineer',
      department: 'Engineering',
      joinDate: '2024-01-15',
      basicSalaryMvr: 25000,
      foodAllowanceMvr: 3000,
      housingAllowanceMvr: 5000,
      otherAllowanceMvr: 2000,
      bankName: 'BML',
      bankAccountNumber: '7701192837101',
      pensionEnrolled: true,
      ramadanAllowanceEligible: true,
      status: 'ACTIVE',
    },
    {
      id: 'emp-02',
      employeeCode: 'STQ-002',
      name: 'Ramesh Kumar',
      nidOrPassport: 'P9901923',
      citizenship: 'EXPATRIATE',
      designation: 'Hull Technician',
      department: 'Operations',
      joinDate: '2025-03-01',
      basicSalaryMvr: 15000,
      foodAllowanceMvr: 2000,
      housingAllowanceMvr: 3000,
      otherAllowanceMvr: 0,
      bankName: 'BML',
      bankAccountNumber: '7704882710192',
      pensionEnrolled: false, // Expatriates exempt from Maldives Pension
      ramadanAllowanceEligible: false,
      status: 'ACTIVE',
    },
  ];

  it('calculates Maldives Pension (7% employee + 7% employer) for Maldivian citizens and exempts expats', () => {
    const run = calculatePayrollRun({
      employees: sampleEmployees,
      periodYear: 2026,
      periodMonth: 8,
      isRamadanMonth: false,
      tenantId: 'tenant-01',
    });

    const maldivian = run.payslips.find((p) => p.employeeCode === 'STQ-001')!;
    expect(maldivian.basicSalary).toBe(25000);
    expect(maldivian.grossPay).toBe(35000); // 25k + 3k + 5k + 2k
    expect(maldivian.employeePension).toBe(1750); // 7% of 25,000
    expect(maldivian.employerPension).toBe(1750); // 7% of 25,000
    expect(maldivian.netPay).toBe(33250); // 35k - 1,750

    const expat = run.payslips.find((p) => p.employeeCode === 'STQ-002')!;
    expect(expat.basicSalary).toBe(15000);
    expect(expat.grossPay).toBe(20000);
    expect(expat.employeePension).toBe(0); // Expat exempt
    expect(expat.netPay).toBe(20000);
  });

  it('calculates statutory Ramadan Allowance (MVR 3,000) during Ramadan month', () => {
    const run = calculatePayrollRun({
      employees: sampleEmployees,
      periodYear: 2026,
      periodMonth: 3, // Ramadan month
      isRamadanMonth: true,
      ramadanAllowanceAmount: 3000,
      tenantId: 'tenant-01',
    });

    const maldivian = run.payslips.find((p) => p.employeeCode === 'STQ-001')!;
    expect(maldivian.ramadanAllowance).toBe(3000);
    expect(maldivian.grossPay).toBe(38000); // 35k + 3k
    expect(run.totalRamadanAllowance).toBe(3000);
  });

  it('generates a balanced double-entry payroll provision journal for General Ledger', () => {
    const run = calculatePayrollRun({
      employees: sampleEmployees,
      periodYear: 2026,
      periodMonth: 8,
      isRamadanMonth: false,
      tenantId: 'tenant-01',
    });

    const je = run.journalEntry;
    expect(je).toBeDefined();
    expect(je?.isBalanced).toBe(true);
    expect(je?.totalDebit).toBe(run.totalCompanyCost);
    expect(je?.totalCredit).toBe(run.totalCompanyCost);
    expect(je?.lines.find((l) => l.accountCode === '2130')?.credit).toBe(3500); // MRPS 14% (1750 + 1750)
    expect(je?.lines.find((l) => l.accountCode === '2140')?.credit).toBe(53250); // Total Net Pay
  });

  it('generates compliant BML Bulk Payroll CSV export', () => {
    const run = calculatePayrollRun({
      employees: sampleEmployees,
      periodYear: 2026,
      periodMonth: 8,
      isRamadanMonth: false,
      tenantId: 'tenant-01',
    });

    const csv = generateBmlPayrollCsv(run);
    expect(csv).toContain('BENEFICIARY_ACCOUNT,BENEFICIARY_NAME,AMOUNT');
    expect(csv).toContain('7701192837101,Ahmed Hassan,33250.00,MVR');
    expect(csv).toContain('7704882710192,Ramesh Kumar,20000.00,MVR');
  });
});
