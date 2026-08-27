import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { loginWithGoogle } from '../services/auth';
import { lookupAllowlistEmail } from '../services/allowlist';
import { StarqBrandLockup } from '../components/brand/StarqLogo';
import { ThemeSelector } from '../components/ui/ThemeSelector';
import {
  ShieldCheck,
  Building2,
  Lock,
  AlertCircle,
  CheckCircle2,
  Mail,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

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

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
const IS_DEV = import.meta.env.DEV;

function sanitizeErrorMessage(code: string): string {
  switch (code) {
    case 'not_allowlisted':
      return 'Your account is not allowlisted for this starqERP tenant. Please contact your organization administrator to request access.';
    case 'identity_audience_rejected':
      return 'Authentication audience mismatch. The client application configuration does not match the server policy.';
    case 'invalid_google_token':
      return 'The Google identity token was invalid or has expired. Please sign in again.';
    case 'no_active_seat':
      return 'Your account exists but has no active seats assigned. Please contact your administrator.';
    case 'identity_binding_conflict':
      return 'Account binding conflict detected. Please sign in using your originally linked Google account.';
    case 'organisation_not_found':
      return 'Your assigned organization was not found or is currently inactive.';
    case 'network_error':
    case 'Failed to fetch':
      return 'Unable to reach the starqERP authentication service. Please check your internet connection and try again.';
    default:
      return code.startsWith('error:') ? code.slice(6).trim() : code || 'Sign in failed. Please try again.';
  }
}

export const LoginPage: React.FC = () => {
  const { login, session } = useAuth();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();

  const [emailInput, setEmailInput] = useState('a.musthaq@gmail.com');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [buttonWidth, setButtonWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.min(320, Math.max(220, window.innerWidth - 64)) : 320,
  );
  const buttonContainerRef = useRef<HTMLDivElement>(null);

  // Dynamically observe container width for Google Button responsiveness
  useEffect(() => {
    const handleResize = () => {
      const width = typeof window !== 'undefined' ? window.innerWidth : 360;
      const target = Math.min(320, Math.max(220, width - 48));
      setButtonWidth(target);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // If already authenticated, redirect to root workspace
  useEffect(() => {
    if (session) {
      navigate('/', { replace: true });
    }
  }, [session, navigate]);

  // Handle direct allowlist email authentication
  const handleEmailLogin = useCallback(
    (emailToUse?: string) => {
      const targetEmail = (emailToUse || emailInput).trim().toLowerCase();
      if (!targetEmail) {
        setError('Please enter your authorized email address.');
        return;
      }

      setIsLoggingIn(true);
      setError(null);

      try {
        const allowlisted = lookupAllowlistEmail(targetEmail);
        if (!allowlisted) {
          setError(sanitizeErrorMessage('not_allowlisted'));
          setIsLoggingIn(false);
          return;
        }

        login(allowlisted);
        navigate('/', { replace: true });
      } catch (err) {
        setError('Sign in failed. Please try again.');
        setIsLoggingIn(false);
      }
    },
    [emailInput, login, navigate],
  );

  // Handle Google Identity Services credential response
  const handleCredentialResponse = useCallback(
    async (response: { credential?: string }) => {
      if (!response.credential) {
        setError('No identity credential received from Google.');
        return;
      }

      setIsLoggingIn(true);
      setError(null);

      try {
        const user = await loginWithGoogle(response.credential);
        login(user);
        navigate('/', { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setError(sanitizeErrorMessage(message));
      } finally {
        setIsLoggingIn(false);
      }
    },
    [login, navigate],
  );

  // Check for Google Identity Services script availability
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setGisLoaded(true);
      return;
    }

    const checkInterval = setInterval(() => {
      if (window.google?.accounts?.id) {
        setGisLoaded(true);
        clearInterval(checkInterval);
      }
    }, 150);

    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
    }, 4000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  // Initialize and render Google Sign-In button whenever GIS, theme, or width changes
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !gisLoaded || !buttonContainerRef.current || !window.google?.accounts?.id) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Clear any prior rendered button children
      buttonContainerRef.current.innerHTML = '';

      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        type: 'standard',
        text: 'continue_with',
        shape: 'rectangular',
        width: buttonWidth,
        logo_alignment: 'left',
      });
    } catch (renderError) {
      console.error('[starqERP] Failed to render Google Sign-In button:', renderError);
    }
  }, [gisLoaded, resolvedTheme, buttonWidth, handleCredentialResponse]);

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between overflow-x-hidden"
      style={{
        backgroundColor: 'var(--md-sys-color-surface)',
        color: 'var(--md-sys-color-on-surface)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* ── Top App Bar Utility Strip ── */}
      <header className="w-full px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)]/40 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <StarqBrandLockup size="sm" />
          <span
            className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full font-medium shrink-0 border border-[var(--md-sys-color-outline-variant)]/60"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
            <span className="hidden xs:inline">Production </span>
            <span>Auth Gate</span>
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span
            className="hidden sm:inline-block text-xs"
            style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
          >
            Appearance
          </span>
          <ThemeSelector align="right" />
        </div>
      </header>

      {/* ── Main Content Responsive Unified Surface ── */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-12 flex items-center justify-center">
        <div
          className="w-full grid grid-cols-1 lg:grid-cols-12 rounded-[var(--md-sys-shape-corner-extra-large)] border border-[var(--md-sys-color-outline-variant)] shadow-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
          }}
        >
          {/* 
            ── Primary Sign-In Pane ──
            Order on mobile: 1 (top of stack)
            Order on desktop: 2 (right 5 columns)
          */}
          <div
            className="order-1 lg:order-2 col-span-1 lg:col-span-5 flex flex-col justify-center p-5 sm:p-8 lg:p-12 relative border-b lg:border-b-0 lg:border-l border-[var(--md-sys-color-outline-variant)]/60"
            style={{
              backgroundColor: 'var(--md-sys-color-surface)',
            }}
          >
            <div className="w-full max-w-sm mx-auto space-y-5 sm:space-y-6">
              {/* Header & Canonical Logo Lockup */}
              <div className="space-y-2 sm:space-y-3 text-center sm:text-left">
                <div className="flex justify-center sm:justify-start">
                  <StarqBrandLockup size="lg" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[var(--md-sys-color-on-surface)] tracking-tight">
                    Sign in to your workspace
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--md-sys-color-on-surface-variant)] mt-1">
                    Continue with your verified organization account to access your business operations.
                  </p>
                </div>
              </div>

              {/* Error Notification Banner */}
              {error && (
                <div
                  role="alert"
                  className="p-3 sm:p-3.5 rounded-[var(--md-sys-shape-corner-medium)] flex items-start gap-2.5 sm:gap-3 text-xs leading-relaxed border animate-in fade-in duration-200"
                  style={{
                    backgroundColor: 'var(--md-sys-color-error-container)',
                    color: 'var(--md-sys-color-on-error-container)',
                    borderColor: 'var(--md-sys-color-error)',
                  }}
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold mb-0.5">Authentication Issue</p>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {/* Active Sign-In Action Area */}
              <div className="pt-1 sm:pt-2 space-y-4">
                {/* 1. Quick Launch for Founder (Instant Login) */}
                <button
                  type="button"
                  onClick={() => handleEmailLogin('a.musthaq@gmail.com')}
                  disabled={isLoggingIn}
                  className="w-full p-3 rounded-[var(--md-sys-shape-corner-medium)] border flex items-center justify-between transition-all cursor-pointer text-left group hover:shadow-md"
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary-container)',
                    borderColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary-container)',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                      style={{
                        backgroundColor: 'var(--md-sys-color-primary)',
                        color: 'var(--md-sys-color-on-primary)',
                      }}
                    >
                      AM
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs truncate">Ali Musthaq</span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-semibold">
                          Founder
                        </span>
                      </div>
                      <p className="text-[11px] opacity-85 truncate">
                        a.musthaq@gmail.com
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-bold text-xs">
                    <span>Enter</span>
                    <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* 2. Direct Authorized Email Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleEmailLogin();
                  }}
                  className="space-y-2 pt-1"
                >
                  <div className="relative">
                    <Mail
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--md-sys-color-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="Enter authorized email..."
                      aria-label="Authorized email address"
                      style={{
                        backgroundColor: 'var(--md-sys-color-surface-container-high)',
                        color: 'var(--md-sys-color-on-surface)',
                        borderColor: 'var(--md-sys-color-outline-variant)',
                        borderRadius: 'var(--md-sys-shape-corner-medium)',
                      }}
                      className="w-full h-10 pl-9 pr-3 text-xs border outline-none focus:border-[var(--md-sys-color-primary)] focus:ring-1 focus:ring-[var(--md-sys-color-primary)]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full h-10 rounded-[var(--md-sys-shape-corner-medium)] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--md-sys-color-primary)',
                      color: 'var(--md-sys-color-on-primary)',
                    }}
                  >
                    <span>Sign In with Email</span>
                    <ArrowRight size={14} />
                  </button>
                </form>

                {/* 3. Google Sign-In Button Container */}
                {GOOGLE_CLIENT_ID && (
                  <div className="pt-2">
                    <div className="relative flex py-2 items-center">
                      <div
                        className="flex-grow border-t"
                        style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}
                      />
                      <span
                        className="flex-shrink mx-3 text-[10px] uppercase font-bold tracking-wider text-[var(--md-sys-color-on-surface-variant)]"
                      >
                        or Google Sign-In
                      </span>
                      <div
                        className="flex-grow border-t"
                        style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}
                      />
                    </div>

                    <div className="flex flex-col items-center justify-center min-h-[44px] w-full pt-1">
                      <div
                        ref={buttonContainerRef}
                        className={`flex justify-center w-full max-w-[320px] overflow-hidden transition-opacity duration-200 ${
                          isLoggingIn ? 'opacity-40 pointer-events-none' : 'opacity-100'
                        }`}
                      />

                      {!gisLoaded && !isLoggingIn && (
                        <div className="flex items-center gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)] py-1">
                          <div
                            className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                            aria-hidden="true"
                          />
                          <span className="text-[11px]">Connecting Google Identity Services...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isLoggingIn && (
                  <div
                    className="flex items-center justify-center gap-2 text-xs font-medium py-2"
                    style={{ color: 'var(--md-sys-color-primary)' }}
                    aria-live="polite"
                  >
                    <div
                      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                      aria-hidden="true"
                    />
                    <span>Verifying organization credentials...</span>
                  </div>
                )}
              </div>

              {/* Security & Regulatory Footprint */}
              <div className="pt-3 sm:pt-4 border-t border-[var(--md-sys-color-outline-variant)]/60 space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  <Lock size={13} className="shrink-0 text-[var(--md-sys-color-primary)]" />
                  <span className="font-medium">Secure 256-bit encrypted operational session</span>
                </div>
                <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]/80 leading-relaxed">
                  Only authorized personnel listed in tenant memberships can sign in. Revoked credentials and seats terminate immediately.
                </p>
              </div>
            </div>
          </div>

          {/* 
            ── Product & Architectural Trust Context ──
            Order on mobile: 2 (cleanly below sign-in action)
            Order on desktop: 1 (left 7 columns)
          */}
          <div
            className="order-2 lg:order-1 col-span-1 lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 lg:p-12 relative overflow-hidden"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
            }}
          >
            {/* Background Decorative Accent Ring */}
            <div
              className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-15 pointer-events-none"
              style={{ backgroundColor: 'var(--md-sys-color-primary)' }}
              aria-hidden="true"
            />

            <div className="relative z-10 space-y-5 sm:space-y-6">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
                style={{
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                }}
              >
                <ShieldCheck size={14} className="shrink-0" />
                <span>Maldives SME Operating Record</span>
              </div>

              <div className="space-y-2 sm:space-y-3 max-w-lg">
                <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] leading-snug">
                  Operations, procurement, and ledger settlement in one single truth.
                </h1>
                <p className="text-xs sm:text-sm lg:text-base text-[var(--md-sys-color-on-surface-variant)] leading-relaxed">
                  Designed specifically for Maldivian enterprises. Authoritative persistence, strict tenant isolation, GST-compliant invoicing, and atomic document numbering.
                </p>
              </div>

              {/* Architecture Core Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-2 sm:pt-4 max-w-lg">
                <div
                  className="p-3 sm:p-3.5 rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)]/60 flex items-start gap-3"
                  style={{ backgroundColor: 'var(--md-sys-color-surface)' }}
                >
                  <div
                    className="p-2 rounded-lg shrink-0 mt-0.5"
                    style={{
                      backgroundColor: 'var(--md-sys-color-secondary-container)',
                      color: 'var(--md-sys-color-on-secondary-container)',
                    }}
                  >
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-[var(--md-sys-color-on-surface)]">
                      Tenant Isolation
                    </h3>
                    <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5 leading-relaxed">
                      Row-level security enforcement across organisations.
                    </p>
                  </div>
                </div>

                <div
                  className="p-3 sm:p-3.5 rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)]/60 flex items-start gap-3"
                  style={{ backgroundColor: 'var(--md-sys-color-surface)' }}
                >
                  <div
                    className="p-2 rounded-lg shrink-0 mt-0.5"
                    style={{
                      backgroundColor: 'var(--md-sys-color-primary-container)',
                      color: 'var(--md-sys-color-on-primary-container)',
                    }}
                  >
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-[var(--md-sys-color-on-surface)]">
                      Authoritative Ledger
                    </h3>
                    <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5 leading-relaxed">
                      Append-only audit events and durable idempotency.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Proof Quote */}
            <div className="relative z-10 pt-5 sm:pt-8 mt-4 sm:mt-6 border-t border-[var(--md-sys-color-outline-variant)]/60 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
              <span>First Production Tenant: <strong className="font-semibold text-[var(--md-sys-color-on-surface)]">Club Ignition</strong></span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--md-sys-color-surface-container-high)]">v0.2.0-cloud</span>
            </div>
          </div>
        </div>
      </main>

      {/* ── Minimalist Corporate Attribution Footer ── */}
      <footer className="w-full px-4 sm:px-8 py-3.5 sm:py-4 border-t border-[var(--md-sys-color-outline-variant)]/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left text-xs text-[var(--md-sys-color-on-surface-variant)] shrink-0">
        <div>
          <span>&copy; 2026 <strong>Starq Technologies Pvt Ltd</strong>. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-[var(--md-sys-color-on-surface-variant)]/70">
            Maldives SME Operational Operating System
          </span>
        </div>
      </footer>
    </div>
  );
};
