import { test, expect, Page, Locator } from '@playwright/test';
import { installGateway } from './support/gateway';
import { orgBAdminSession } from './support/sessions';

/**
 * SERP-328 acceptance 1 (Chromium + Firefox + WebKit, desktop & mobile):
 * "Automated Playwright tests execute complete business journeys ..."
 *
 * The journey: customer intake -> work order -> invoice -> payment ->
 * journal posting (General Ledger, derived from invoices + receipts).
 * All data starts from an empty slate seeded by the offline gateway.
 */

const CUSTOMER = 'E2E Inter-Island Transport';
const PLATE = 'E2E-8842';
const SCOPE = 'Full repaint, disassembly, premium clearcoat, final polish.';
const AMOUNT = '25000';
const PAY_REF = 'E2E-TXN-001';

function dialog(page: Page, name: RegExp): Locator {
  return page.getByRole('dialog', { name });
}

async function nav(page: Page, href: string) {
  const direct = page.locator(`a[href="${href}"]`).filter({ visible: true }).first();
  try {
    await direct.waitFor({ state: 'visible', timeout: 6000 });
    await direct.click();
  } catch {
    const hamburger = page.locator('button[aria-label="Open navigation menu"]').filter({ visible: true }).first();
    await hamburger.click();
    await page.locator(`a[href="${href}"]`).filter({ visible: true }).first().click();
  }
}

async function fillNear(dlg: Locator, label: string, value: string) {
  const control = dlg
    .getByText(label, { exact: true })
    .last()
    .locator('..')
    .locator('input, textarea');
  await control.fill(value);
}

async function selectByText(dlg: Locator, label: string, pattern: RegExp | string) {
  const select = dlg.getByText(label, { exact: true }).last().locator('..').locator('select');
  const option = select.locator('option', { hasText: pattern }).first();
  const value = await option.getAttribute('value');
  await select.selectOption({ value: value ?? '' });
}

test.describe('SERP-328 complete commercial journey', () => {
  test.beforeEach(async ({ page }) => {
    await installGateway(page, { session: orgBAdminSession });
    await page.goto('/');
  });

  test('customer intake > work order > invoice > payment > journal posting', async ({ page }) => {
    // 1. Customer intake
    await nav(page, '/customers');
    await page.getByRole('button', { name: /Add Customer/ }).click();
    const addCust = dialog(page, /Add New Customer/);
    await fillNear(addCust, 'Customer Name / Business Name *', CUSTOMER);
    await fillNear(addCust, 'Phone Number (Maldives) *', '+960 999-0000');
    await fillNear(addCust, 'Plate Number', PLATE);
    await addCust.getByRole('button', { name: 'Save Customer Profile' }).click();
    await expect(page.getByText(CUSTOMER, { exact: true }).first()).toBeVisible();

    // 2. Work order intake
    await nav(page, '/jobs');
    await page.getByRole('button', { name: /New Job Card/ }).click();
    const addJob = dialog(page, /Create New Job Order/);
    await expect(
      addJob.getByText('Customer / Fleet *', { exact: true }).last().locator('..').locator('select')
    ).toHaveValue(/\S+/);
    await fillNear(addJob, 'Plate Number', PLATE);
    await fillNear(addJob, 'Requested Scope of Work *', SCOPE);
    await fillNear(addJob, 'Quoted Price (MVR) *', AMOUNT);
    await addJob.getByRole('button', { name: 'Create & Assign to Bay' }).click();
    await page.getByRole('radio', { name: 'Table' }).click();
    await expect(page.getByText(CUSTOMER, { exact: true }).first()).toBeVisible();

    // 3. Invoice
    await nav(page, '/invoices');
    await page.getByRole('button', { name: /New Invoice/ }).click();
    const addInvoice = dialog(page, /Create MIRA GST Tax Invoice/);
    await expect(
      addInvoice.getByText('Customer / Fleet *', { exact: true })
        .last()
        .locator('..')
        .locator('select')
    ).toHaveValue(/\S+/);
    // Track A emptied modal defaults; journey still quotes MVR 25000 exclusive.
    await addInvoice.getByPlaceholder('Description of service / parts').fill(SCOPE);
    await addInvoice.getByPlaceholder('Unit Price').fill(AMOUNT);
    await expect(addInvoice.getByText(/Rf 25,000\.00/).first()).toBeVisible();
    await addInvoice.getByRole('button', { name: 'Issue Tax Invoice' }).click();
    await expect(page.getByText(CUSTOMER, { exact: true }).first()).toBeVisible();

    // 4. Payment -> invoice settled
    await nav(page, '/payments');
    await page.getByRole('button', { name: /Record Payment/ }).click();
    const payModal = dialog(page, /Record Customer Payment Receipt/);
    await selectByText(payModal, 'Select Invoice to Settle *', new RegExp(CUSTOMER));
    await fillNear(payModal, 'Payment Amount (MVR) *', AMOUNT);
    await selectByText(payModal, 'Payment Method', /Bank of Maldives \(BML Transfer\)/);
    await fillNear(payModal, 'Bank Slip / Transaction Reference', PAY_REF);
    await payModal.getByRole('button', { name: 'Confirm & Settle Balance' }).click();
    await expect(page.getByText(new RegExp(`Ref: ${PAY_REF}`))).toHaveCount(1);

    // Invoice registered as Paid
    await nav(page, '/invoices');
    const settleRow = page.locator('tr').filter({ has: page.getByText(/INV-2026-088/) }).first();
    await expect(settleRow).toContainText('Paid');

    // 5. Journal posting (General Ledger)
    await nav(page, '/accounts');
    await page.getByText('General Ledger', { exact: true }).first().click();
    await expect(page.getByText('Mathematical Invariant Validated')).toBeVisible();
    await expect(page.getByText('No general ledger transactions found')).toHaveCount(0);
    await expect(page.getByText(/JE-INV-INV-2026-088/).first()).toBeVisible();
    await expect(page.getByText(/JE-RCT-/).first()).toBeVisible();
  });
});