import { test, expect } from '@playwright/test';
import { installGateway, installFakeGoogleIdentity } from './support/gateway';
import { orgAAdminSession } from './support/sessions';

/**
 * SERP-328 auth acceptance (Chromium desktop):
 *  2. "Simulates multi-tenant login, staff invitation acceptance, and workspace switching"
 *     — login is simulated at the network boundary (Google OAuth is never called live);
 *       workspace switching is exercised through the real Organization switcher.
 */
test.describe('SERP-328 · multi-tenant login & workspace switching', () => {
  test('unauthenticated visitor is redirected to the Google sign-in surface', async ({ page }) => {
    await installGateway(page, { session: () => null, afterAuth: orgAAdminSession });
    await installFakeGoogleIdentity(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="gis-google-button"]')).toBeVisible();
  });

  test('simulated Google sign-in establishes an active org A session', async ({ page }) => {
    const gateway = await installGateway(page, { session: () => null, afterAuth: orgAAdminSession });
    await installFakeGoogleIdentity(page);
    await page.goto('/login');
    await page.locator('[data-testid="gis-google-button"]').click();

    const switcher = page.getByRole('button', { name: 'Organization switcher' });
    await expect(switcher).toBeVisible();
    await expect(switcher).toContainText(/Starq Technologies/);
    await expect(page.getByText(/Good (morning|afternoon|evening), Org/)).toBeVisible({ timeout: 15_000 });

    const googleCalls = gateway.captured.filter(
      (r) => r.method === 'POST' && r.path === '/api/auth/google'
    );
    expect(googleCalls.length).toBeGreaterThanOrEqual(1);
  });

  test('workspace switcher moves between Club Ignition, Starq HQ platform and back', async ({ page }) => {
    await installGateway(page, { session: orgAAdminSession });
    await page.goto('/');

    const switcher = page.getByRole('button', { name: 'Organization switcher' });
    await expect(switcher).toContainText(/Starq Technologies/);

    // Tenant plane: Club Ignition → active book "Ignition Ink"
    await switcher.click();
    await page.getByRole('menuitem', { name: /Ignition Ink/ }).click();
    await expect(switcher).toContainText(/Club Ignition/);

    // Platform plane: Starq HQ
    await switcher.click();
    await page.getByRole('menuitem', { name: /Starq HQ/ }).click();
    await expect(switcher).toContainText(/Starq HQ/);
    await expect(page.getByRole('heading', { name: /Platform Operator Console/ })).toBeVisible();

    // Back to tenant plane: Starq Technologies (STQ book)
    await switcher.click();
    await page.getByRole('menuitem', { name: /\[STQ\] Starq Technologies/ }).click();
    await expect(switcher).toContainText(/Starq Technologies/);
  });
});