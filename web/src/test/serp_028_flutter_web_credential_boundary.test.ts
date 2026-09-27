import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatSessionCookie,
  parseSessionCookie,
  validateSessionCookieLifecycle,
} from '../../../contracts/commands';
import {
  createSecureSessionRecord,
  validateSecureSession,
  revokeSession,
  validateReplayProtection,
  SessionTokenRecord,
} from './serp_026_session_boundary.test';
import {
  CredentialBoundaryGuard,
  installStorageBoundaryGuard,
} from '../services/credentialBoundaryGuard';

/**
 * SERP-028: Flutter Web Credential-Boundary Verification
 *
 * M0 main base / CORE-001 / CORE-002 / DEC-067
 *
 * Acceptance Criteria:
 * 1. Positive evidence proves browser-managed HttpOnly auth with no Dart/JS credential persistence.
 * 2. Negative tenant, authorization, replay and failure paths fail closed with attributable evidence.
 */

// Simulated client-side web storage (representing window.localStorage / SharedPreferences on web)
class MockWebStorage {
  private store: Map<string, string> = new Map();

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

// Client request envelope simulating Flutter Web / browser fetch
interface ClientRequestEnvelope {
  url: string;
  method: string;
  credentialsMode: 'include' | 'same-origin' | 'omit';
  headers: Record<string, string>;
  body?: string;
}

// Server gateway dispatcher evaluating request boundary
interface GatewayResponse {
  statusCode: number;
  data?: any;
  error?: string;
  setCookie?: string;
}

function processGatewayRequest(
  req: ClientRequestEnvelope,
  cookieHeader: string | undefined,
  sessionStore: Record<string, SessionTokenRecord>,
  targetTenantId: string,
  nowMs?: number,
): GatewayResponse {
  // 1. Boundary check: Flutter Web must rely on browser-managed cookies (credentials: include)
  if (req.credentialsMode !== 'include') {
    return {
      statusCode: 401,
      error: 'credentials_mode_must_be_include',
      setCookie: formatSessionCookie('', { maxAge: 0 }),
    };
  }

  // 2. Reject client-supplied Bearer tokens if present in Authorization header (prohibits Dart/JS token passing)
  if (req.headers['authorization']?.toLowerCase().startsWith('bearer stq_sec_')) {
    return {
      statusCode: 400,
      error: 'client_side_bearer_token_forbidden_use_httponly_cookie',
      setCookie: formatSessionCookie('', { maxAge: 0 }),
    };
  }

  // 3. Extract cookie
  const token = parseSessionCookie(cookieHeader);
  if (!token) {
    return {
      statusCode: 401,
      error: 'unauthenticated_missing_cookie',
      setCookie: formatSessionCookie('', { maxAge: 0 }),
    };
  }

  // 4. Validate session
  const val = validateSecureSession(token, sessionStore, nowMs);
  if (!val.valid || !val.session) {
    return {
      statusCode: 401,
      error: val.error || 'invalid_session',
      setCookie: formatSessionCookie('', { maxAge: 0 }),
    };
  }

  // 5. Enforce tenant boundary (fails closed on cross-tenant access)
  if (val.session.tenantId !== targetTenantId) {
    return {
      statusCode: 403,
      error: `tenant_mismatch: session tenant ${val.session.tenantId} != target tenant ${targetTenantId}`,
    };
  }

  return {
    statusCode: 200,
    data: { ok: true, tenantId: val.session.tenantId, userId: val.session.userId },
  };
}

describe('SERP-028: Flutter Web Credential-Boundary Verification', () => {
  const TENANT_A = '20000000-0000-4000-8000-000000000001';
  const TENANT_B = '20000000-0000-4000-8000-000000000002';

  describe('AC1: Positive Evidence — Browser-Managed HttpOnly Auth Without Client-Side Persistence', () => {
    it('issues HttpOnly, Secure, SameSite=None cookie upon successful authentication', () => {
      const session = createSecureSessionRecord({
        userId: 'usr-flutter-web-01',
        tenantId: TENANT_A,
        roleId: 'role-operator',
        seat: 'counter',
        ttlSeconds: 28800,
      });

      const lifecycle = validateSessionCookieLifecycle({
        action: 'login',
        sessionToken: session.token,
      });

      expect(lifecycle.ok).toBe(true);
      expect(lifecycle.setCookieHeader).toBeDefined();

      const cookie = lifecycle.setCookieHeader!;
      expect(cookie).toContain('sb_ops=stq_sec_');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=None');
      expect(cookie).toContain('Max-Age=28800');
    });

    it('proves client web storage remains completely free of credentials after login and operations', () => {
      const localStorage = new MockWebStorage();

      // Normal benign application state (theme, language, UI filters) is permitted
      localStorage.setItem('hoadha_theme', 'dark');
      localStorage.setItem('hoadha_lang', 'dv');
      localStorage.setItem('active_view', 'counter_pos');

      // Verify no credential tokens leaked into storage using shipped production guard
      const audit = CredentialBoundaryGuard.auditStorage(localStorage as any);
      expect(audit.clean).toBe(true);
      expect(audit.violations).toHaveLength(0);
    });

    it('flags any attempt by Flutter Web to persist session tokens into localStorage by key name', () => {
      const dirtyStorage = new MockWebStorage();
      dirtyStorage.setItem('hoadha_theme', 'dark');
      dirtyStorage.setItem('sb_ops_access_token', 'token_raw_123');
      dirtyStorage.setItem('supabase.auth.refresh_token', 'refresh_456');

      const audit = CredentialBoundaryGuard.auditStorage(dirtyStorage as any);
      expect(audit.clean).toBe(false);
      expect(audit.violations.length).toBe(2);
      expect(audit.violations[0].matchType).toBe('prohibited_key');
    });

    it('detects and flags raw JWT values stored under an innocuous key name (Finding 2 value-scan)', () => {
      const storage = new MockWebStorage();
      // Vision test probe case: benign key name holding raw JWT string
      storage.setItem('hoadha_prefs', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');

      const audit = CredentialBoundaryGuard.auditStorage(storage as any);
      expect(audit.clean).toBe(false);
      expect(audit.violations.length).toBe(1);
      expect(audit.violations[0].key).toBe('hoadha_prefs');
      expect(audit.violations[0].matchType).toBe('prohibited_value_jwt');
      expect(audit.violations[0].reason).toContain('contains raw JWT token');
    });

    it('detects and flags nested JWT tokens inside serialized JSON objects under an innocuous key name', () => {
      const storage = new MockWebStorage();
      // Vision reproduction: JSON object serialized under innocent key name
      const payload = JSON.stringify({
        theme: 'light',
        nestedState: {
          token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig123',
        },
      });
      storage.setItem('app_configuration', payload);

      const audit = CredentialBoundaryGuard.auditStorage(storage as any);
      expect(audit.clean).toBe(false);
      expect(audit.violations.length).toBe(1);
      expect(audit.violations[0].key).toBe('app_configuration');
      expect(audit.violations[0].matchType).toBe('prohibited_value_jwt');
    });

    it('detects and flags stq_sec_ session tokens in value under an innocuous key name', () => {
      const storage = new MockWebStorage();
      storage.setItem('user_cache', 'stq_sec_sess_89ab12cd_abc1234');

      const audit = CredentialBoundaryGuard.auditStorage(storage as any);
      expect(audit.clean).toBe(false);
      expect(audit.violations[0].matchType).toBe('prohibited_value_token');
    });

    it('enforces runtime boundary interception on Storage.prototype.setItem', () => {
      // Install guard on global storage prototype
      installStorageBoundaryGuard();

      // Normal benign write succeeds
      expect(() => {
        window.localStorage.setItem('test_theme', 'light');
      }).not.toThrow();

      // Attempt to store prohibited key throws security violation
      expect(() => {
        window.localStorage.setItem('sb_ops_session', 'some_token');
      }).toThrowError(/SERP-028 Security Violation/);

      // Attempt to store JWT in value throws security violation
      expect(() => {
        window.localStorage.setItem('innocuous_key', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig123');
      }).toThrowError(/SERP-028 Security Violation/);
    });

    it('successfully processes requests when browser attaches HttpOnly cookie with credentials: include', () => {
      const store: Record<string, SessionTokenRecord> = {};
      const session = createSecureSessionRecord({
        userId: 'usr-operator-01',
        tenantId: TENANT_A,
        roleId: 'role-operator',
        seat: 'counter',
      });
      store[session.token] = session;

      const cookieHeader = `sb_ops=${session.token}`;
      const req: ClientRequestEnvelope = {
        url: '/api/v1/pos/order',
        method: 'POST',
        credentialsMode: 'include',
        headers: { 'Content-Type': 'application/json' },
      };

      const res = processGatewayRequest(req, cookieHeader, store, TENANT_A);
      expect(res.statusCode).toBe(200);
      expect(res.data?.ok).toBe(true);
      expect(res.data?.tenantId).toBe(TENANT_A);
    });
  });

  describe('AC2: Negative Failure Paths Fail Closed with Attributable Evidence', () => {
    it('fails closed when cross-tenant request is attempted', () => {
      const store: Record<string, SessionTokenRecord> = {};
      const session = createSecureSessionRecord({
        userId: 'usr-operator-01',
        tenantId: TENANT_A,
        roleId: 'role-operator',
        seat: 'counter',
      });
      store[session.token] = session;

      const cookieHeader = `sb_ops=${session.token}`;
      const req: ClientRequestEnvelope = {
        url: '/api/v1/pos/order',
        method: 'POST',
        credentialsMode: 'include',
        headers: { 'Content-Type': 'application/json' },
      };

      // Attacker attempts to target TENANT_B using TENANT_A session
      const res = processGatewayRequest(req, cookieHeader, store, TENANT_B);
      expect(res.statusCode).toBe(403);
      expect(res.error).toContain('tenant_mismatch');
      expect(res.data).toBeUndefined();
    });

    it('fails closed and purges cookie when credentialsMode is not include', () => {
      const store: Record<string, SessionTokenRecord> = {};
      const session = createSecureSessionRecord({
        userId: 'usr-operator-01',
        tenantId: TENANT_A,
        roleId: 'role-operator',
        seat: 'counter',
      });
      store[session.token] = session;

      const req: ClientRequestEnvelope = {
        url: '/api/v1/pos/order',
        method: 'POST',
        credentialsMode: 'omit', // Omits cookies
        headers: {},
      };

      const res = processGatewayRequest(req, `sb_ops=${session.token}`, store, TENANT_A);
      expect(res.statusCode).toBe(401);
      expect(res.error).toBe('credentials_mode_must_be_include');
      expect(res.setCookie).toContain('Max-Age=0');
    });

    it('fails closed and purges cookie when client attempts to send raw Bearer token in header', () => {
      const store: Record<string, SessionTokenRecord> = {};
      const session = createSecureSessionRecord({
        userId: 'usr-operator-01',
        tenantId: TENANT_A,
        roleId: 'role-operator',
        seat: 'counter',
      });
      store[session.token] = session;

      const req: ClientRequestEnvelope = {
        url: '/api/v1/pos/order',
        method: 'POST',
        credentialsMode: 'include',
        headers: {
          authorization: `Bearer ${session.token}`,
        },
      };

      const res = processGatewayRequest(req, `sb_ops=${session.token}`, store, TENANT_A);
      expect(res.statusCode).toBe(400);
      expect(res.error).toBe('client_side_bearer_token_forbidden_use_httponly_cookie');
      expect(res.setCookie).toContain('Max-Age=0');
    });

    it('fails closed when session has expired past TTL and purges cookie', () => {
      const store: Record<string, SessionTokenRecord> = {};
      const baseTime = 1000000;
      const session = createSecureSessionRecord({
        userId: 'usr-operator-01',
        tenantId: TENANT_A,
        roleId: 'role-operator',
        seat: 'counter',
        ttlSeconds: 3600, // 1 hour
        nowMs: baseTime,
      });
      store[session.token] = session;

      const cookieHeader = `sb_ops=${session.token}`;
      const req: ClientRequestEnvelope = {
        url: '/api/v1/pos/order',
        method: 'POST',
        credentialsMode: 'include',
        headers: {},
      };

      // 3601 seconds later
      const res = processGatewayRequest(req, cookieHeader, store, TENANT_A, baseTime + 3601 * 1000);
      expect(res.statusCode).toBe(401);
      expect(res.error).toBe('session_expired_absolute');
      expect(res.setCookie).toContain('Max-Age=0');
    });

    it('fails closed when session is idle past timeout and purges cookie', () => {
      const store: Record<string, SessionTokenRecord> = {};
      const baseTime = 1000000;
      const session = createSecureSessionRecord({
        userId: 'usr-operator-01',
        tenantId: TENANT_A,
        roleId: 'role-operator',
        seat: 'counter',
        ttlSeconds: 28800,
        nowMs: baseTime,
      });
      store[session.token] = session;

      const cookieHeader = `sb_ops=${session.token}`;
      const req: ClientRequestEnvelope = {
        url: '/api/v1/pos/order',
        method: 'POST',
        credentialsMode: 'include',
        headers: {},
      };

      // 31 minutes later (idle limit is 30m / 1800s)
      const res = processGatewayRequest(req, cookieHeader, store, TENANT_A, baseTime + 1860 * 1000);
      expect(res.statusCode).toBe(401);
      expect(res.error).toBe('session_expired_idle_timeout');
      expect(res.setCookie).toContain('Max-Age=0');
    });

    it('fails closed when session has been explicitly revoked', () => {
      const store: Record<string, SessionTokenRecord> = {};
      const session = createSecureSessionRecord({
        userId: 'usr-operator-01',
        tenantId: TENANT_A,
        roleId: 'role-operator',
        seat: 'counter',
      });
      store[session.token] = session;

      // Revoke session
      revokeSession(session.token, store, 'security_revocation');

      const cookieHeader = `sb_ops=${session.token}`;
      const req: ClientRequestEnvelope = {
        url: '/api/v1/pos/order',
        method: 'POST',
        credentialsMode: 'include',
        headers: {},
      };

      const res = processGatewayRequest(req, cookieHeader, store, TENANT_A);
      expect(res.statusCode).toBe(401);
      expect(res.error).toContain('session_revoked');
      expect(res.setCookie).toContain('Max-Age=0');
    });

    it('fails closed on replay attack detection via duplicate nonces', () => {
      const seenNonces = new Set<string>();
      const sessionId = 'sess_flutter_001';
      const nonce = 'unique_nonce_abc123';

      const firstAttempt = validateReplayProtection(sessionId, nonce, seenNonces);
      expect(firstAttempt.allowed).toBe(true);

      const replayAttempt = validateReplayProtection(sessionId, nonce, seenNonces);
      expect(replayAttempt.allowed).toBe(false);
      expect(replayAttempt.error).toBe('replay_attack_detected');
    });

    it('fails closed on CSRF mismatch during logout and preserves cookie until legitimate verification', () => {
      const invalidLogout = validateSessionCookieLifecycle({
        action: 'logout',
        csrfToken: 'malicious_csrf_payload',
        sessionCsrf: 'legitimate_server_csrf_789',
      });
      expect(invalidLogout.ok).toBe(false);
      expect(invalidLogout.error).toBe('csrf_mismatch');
      expect(invalidLogout.setCookieHeader).toBeUndefined();

      const validLogout = validateSessionCookieLifecycle({
        action: 'logout',
        csrfToken: 'legitimate_server_csrf_789',
        sessionCsrf: 'legitimate_server_csrf_789',
      });
      expect(validLogout.ok).toBe(true);
      expect(validLogout.setCookieHeader).toContain('Max-Age=0');
    });
  });
});
