/**
 * SERP-028: Credential Boundary Guard & Storage Sanitizer
 *
 * M0 main base / CORE-001 / CORE-002 / DEC-067
 *
 * Enforces browser-managed HttpOnly credential boundary by preventing any
 * authentication tokens, refresh tokens, session cookies, or bearer secrets
 * from being persisted into client-side storage (localStorage / sessionStorage),
 * either via key names or serialized values.
 */

export interface StorageViolation {
  readonly key: string;
  readonly reason: string;
  readonly matchType: 'prohibited_key' | 'prohibited_value_jwt' | 'prohibited_value_token';
}

export class CredentialBoundaryGuard {
  // Prohibited key name substrings/patterns
  private static readonly DISALLOWED_KEY_PATTERNS: readonly RegExp[] = [
    /access_token/i,
    /refresh_token/i,
    /sb_ops/i,
    /stq_sec_/i,
    /bearer/i,
    /session_token/i,
    /secret/i,
  ];

  // Prohibited value patterns (scans raw strings and serialized JSON)
  private static readonly JWT_VALUE_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
  private static readonly STQ_SEC_VALUE_PATTERN = /\bstq_sec_[A-Za-z0-9_-]+\b/;
  private static readonly SBOPS_COOKIE_VALUE_PATTERN = /\bsb_ops=[A-Za-z0-9_-]+\b/;
  private static readonly BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9_.-]{16,}\b/i;

  /**
   * Audits a single key-value entry for credential boundary violations.
   */
  static auditItem(key: string, value: unknown): { allowed: boolean; violation?: StorageViolation } {
    // 1. Audit key name
    for (const pattern of this.DISALLOWED_KEY_PATTERNS) {
      if (pattern.test(key)) {
        return {
          allowed: false,
          violation: {
            key,
            reason: `Prohibited credential key: "${key}" matches forbidden pattern ${pattern}`,
            matchType: 'prohibited_key',
          },
        };
      }
    }

    // 2. Audit value content
    const stringifiedValue = typeof value === 'string' ? value : (value !== null && value !== undefined ? JSON.stringify(value) : '');

    if (stringifiedValue) {
      if (this.JWT_VALUE_PATTERN.test(stringifiedValue)) {
        return {
          allowed: false,
          violation: {
            key,
            reason: `Prohibited credential value: key "${key}" contains raw JWT token`,
            matchType: 'prohibited_value_jwt',
          },
        };
      }

      if (this.STQ_SEC_VALUE_PATTERN.test(stringifiedValue) || this.SBOPS_COOKIE_VALUE_PATTERN.test(stringifiedValue) || this.BEARER_VALUE_PATTERN.test(stringifiedValue)) {
        return {
          allowed: false,
          violation: {
            key,
            reason: `Prohibited credential value: key "${key}" contains session/bearer credential token`,
            matchType: 'prohibited_value_token',
          },
        };
      }

      // Check if value is JSON string that unescapes into a nested object
      if (stringifiedValue.startsWith('{') || stringifiedValue.startsWith('[')) {
        try {
          const parsed = JSON.parse(stringifiedValue);
          const deepViolation = this.deepScanValue(key, parsed);
          if (deepViolation) {
            return { allowed: false, violation: deepViolation };
          }
        } catch (_) {
          // Non-JSON or malformed string is already checked via regex above
        }
      }
    }

    return { allowed: true };
  }

  private static deepScanValue(rootKey: string, obj: unknown): StorageViolation | null {
    if (obj === null || obj === undefined) return null;

    if (typeof obj === 'string') {
      if (this.JWT_VALUE_PATTERN.test(obj)) {
        return {
          key: rootKey,
          reason: `Prohibited credential value: nested string under key "${rootKey}" contains JWT token`,
          matchType: 'prohibited_value_jwt',
        };
      }
      if (this.STQ_SEC_VALUE_PATTERN.test(obj) || this.SBOPS_COOKIE_VALUE_PATTERN.test(obj)) {
        return {
          key: rootKey,
          reason: `Prohibited credential value: nested string under key "${rootKey}" contains session token`,
          matchType: 'prohibited_value_token',
        };
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const v = this.deepScanValue(rootKey, item);
        if (v) return v;
      }
    } else if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        for (const pattern of this.DISALLOWED_KEY_PATTERNS) {
          if (pattern.test(k)) {
            return {
              key: rootKey,
              reason: `Prohibited credential key: nested object key "${k}" matches forbidden pattern ${pattern}`,
              matchType: 'prohibited_key',
            };
          }
        }
        const violation = this.deepScanValue(rootKey, v);
        if (violation) return violation;
      }
    }

    return null;
  }

  /**
   * Audits an entire Storage instance (e.g. localStorage / sessionStorage).
   */
  static auditStorage(storage: Storage | { getItem: (k: string) => string | null; length: number; key?: (i: number) => string | null }): {
    clean: boolean;
    violations: StorageViolation[];
  } {
    const violations: StorageViolation[] = [];
    const keys: string[] = [];

    if ('length' in storage) {
      for (let i = 0; i < storage.length; i++) {
        const k = typeof (storage as any).key === 'function' ? (storage as any).key(i) : null;
        if (k) keys.push(k);
      }
    }

    // Fallback if keys array empty but object has own keys
    if (keys.length === 0 && typeof (storage as any).keys === 'function') {
      keys.push(...(storage as any).keys());
    }

    for (const key of keys) {
      const value = storage.getItem(key);
      const res = this.auditItem(key, value);
      if (!res.allowed && res.violation) {
        violations.push(res.violation);
      }
    }

    return {
      clean: violations.length === 0,
      violations,
    };
  }
}

/**
 * Installs the storage boundary guard on browser Storage prototype.
 * Intercepts window.localStorage.setItem and window.sessionStorage.setItem
 * to fail closed on any client-side credential persistence attempt.
 */
let installed = false;

export function installStorageBoundaryGuard(): void {
  if (installed || typeof window === 'undefined' || !window.Storage) return;

  const originalSetItem = window.Storage.prototype.setItem;

  window.Storage.prototype.setItem = function (key: string, value: string): void {
    const check = CredentialBoundaryGuard.auditItem(key, value);
    if (!check.allowed && check.violation) {
      const err = new Error(
        `[SERP-028 Security Violation] Attempted to persist sensitive credential into client-side storage: ${check.violation.reason}`
      );
      err.name = 'CredentialBoundaryViolationError';
      throw err;
    }
    return originalSetItem.call(this, key, value);
  };

  installed = true;
}
