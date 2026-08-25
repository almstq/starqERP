import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ERPProvider } from './context/ERPContext';
import { router } from './app/router';
import './index.css';

/**
 * ERPProvider still wraps the tree. It is a fixture store today and becomes an
 * API client in SERP-166 — the swap happens inside the provider, so no view has
 * to change when the real backend lands. That is the point of keeping it.
 *
 * THE THEME CLASS HAS EXACTLY ONE OWNER, and it is ERPProvider. This file used
 * to add `dark` here as well; the provider then mounted, read its own default,
 * and removed it again. Two owners of one class is a race that resolves against
 * you, and it produced a page that rendered perfectly and could not be read.
 */

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ERPProvider>
      <RouterProvider router={router} />
    </ERPProvider>
  </StrictMode>,
);
