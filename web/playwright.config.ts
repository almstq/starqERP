import { defineConfig, devices } from '@playwright/test';

/**
 * starqERP Playwright configuration (SERP-328).
 *
 * Runs against the REAL Vite dev server (web, port 3001) in `--mode e2e`.
 * The app boots with a fixture-simulated gateway: every /api/* call is
 * fulfilled in-browser by `e2e/support/gateway.ts`, so no production traffic
 * leaves the machine (security freeze respected by construction).
 *
 * Acceptance surface (starq-erp-tasks.json, SERP-328):
 *   - complete business journeys in Chromium, Firefox, WebKit
 *   - simulated multi-tenant login, staff invitation acceptance, workspace switching
 *   - CI pipeline integration with video/screenshot capture on failure
 */
// Port is overridable so the suite can run alongside a dev server that already
// holds 3001. This matters more than it looks: with reuseExistingServer set,
// Playwright will happily attach to whatever is already on the port — and a
// dev server started from a different worktree, or without `--mode e2e`, means
// the suite silently tests the wrong code and still reports green.
const E2E_PORT = process.env.E2E_PORT ?? '3001';
// 127.0.0.1, not localhost: vite binds --host 127.0.0.1, and on this machine
// `localhost` resolves to ::1 first, which vite is not listening on. Using the
// literal v4 address removes a whole class of ERR_FAILED that looks like a test
// failure and is really a name-resolution mismatch.
const E2E_ORIGIN = `http://127.0.0.1:${E2E_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }]]
    : [['list']],
  use: {
    baseURL: E2E_ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `npx vite --mode e2e --port ${E2E_PORT} --host 127.0.0.1`,
    cwd: '.',
    url: E2E_ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
      // Runs the full set (incl. the fixme-marked invitation ACCEPTANCE spec,
      // which is blocked by SERP-300 and must surface in reports as evidence).
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /invitations\.spec\.ts/,
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /invitations\.spec\.ts/,
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 7'],
        // Desktop + mobile viewports per SERP-328 description; the mobile pass
        // reuses the same journey specs to prove responsive execution.
        baseURL: E2E_ORIGIN,
      },
      testIgnore: /(invitations|auth)\.spec\.ts/,
    },
  ],
});