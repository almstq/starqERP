import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ERPProvider } from './context/ERPContext';
import { router } from './app/router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ERPProvider>
          <RouterProvider router={router} />
        </ERPProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
