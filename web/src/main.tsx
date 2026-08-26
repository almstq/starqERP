import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ERPProvider } from './context/ERPContext';
import { router } from './app/router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ERPProvider>
        <RouterProvider router={router} />
      </ERPProvider>
    </ThemeProvider>
  </StrictMode>,
);
