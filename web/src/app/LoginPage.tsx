import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { loginWithGoogle } from '../services/auth';
import { useNavigate } from 'react-router-dom';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export const LoginPage: React.FC = () => {
  const { login, session } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true });
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        setIsLoggingIn(true);
        setError(null);
        try {
          const user = await loginWithGoogle(response.credential);
          login(user);
          navigate('/', { replace: true });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
          setIsLoggingIn(false);
        }
      },
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      text: 'signin_with',
      shape: 'rectangular',
      width: 300,
    });
  }, [login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--md-sys-color-surface)]">
      <div className="w-full max-w-md p-8 rounded-2xl bg-[var(--md-sys-color-surface-container)] shadow-lg text-center">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] mb-2">
            Starq ERP
          </h1>
          <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
            Sign in to access your workspace
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] text-sm">
            {error}
          </div>
        )}

        {GOOGLE_CLIENT_ID ? (
          <div className="flex justify-center">
            <div ref={buttonRef} />
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] text-sm">
            <p className="font-medium mb-1">Configuration Required</p>
            <p>
              Set <code className="font-mono text-xs">VITE_GOOGLE_CLIENT_ID</code> in your environment to enable Google Sign-In.
            </p>
          </div>
        )}

        {isLoggingIn && (
          <p className="mt-4 text-sm text-[var(--md-sys-color-on-surface-variant)]">
            Signing in...
          </p>
        )}
      </div>
    </div>
  );
};
