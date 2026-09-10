import '@testing-library/jest-dom';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../data/defaultChartOfAccounts';

// TEST-SEED ONLY — not a production fallback.
// AccountsView persists the tenant chart under this key in production;
// seed it here so components that read a tenant-authorized account source
// (BankReconciliationView) find it present during tests. The production
// code path stays fail-closed: BankReconciliationView returns [] when the
// key is empty and never falls back to the global fixture itself.
if (typeof window !== 'undefined') {
  localStorage.setItem('starq:chart_of_accounts:v1', JSON.stringify(DEFAULT_CHART_OF_ACCOUNTS));
}

if (typeof window !== 'undefined') {
  if (!window.ResizeObserver) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  }

  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
}