import {
  CommandName,
  ScmStep,
} from '../../../contracts/commands';

const API_BASE = '';

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export function getCsrfToken(): string {
  if (csrfToken) return csrfToken;
  const match = document.cookie.match(/sb_ops_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export interface ApiCommandParams<T> {
  command: CommandName;
  step?: ScmStep;
  payload: T;
}

export interface ApiResponse<T> {
  ok: boolean;
  state?: string;
  error?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public requestId?: string,
  ) {
    super(`API error ${status}: ${code}`);
    this.name = 'ApiError';
  }
}

export async function dispatchCommand<TReq = Record<string, unknown>, TRes = unknown>(
  params: ApiCommandParams<TReq>,
): Promise<TRes & { ok: boolean }> {
  const idempotencyKey = generateIdempotencyKey();

  const body: Record<string, unknown> = {
    ...params.payload as Record<string, unknown>,
    type: params.command,
  };
  if (params.step) {
    body.scm_step = params.step;
  }

  const response = await fetch(`${API_BASE}/api/ops/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-idempotency-key': idempotencyKey,
      'x-csrf-token': getCsrfToken(),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error ?? 'request_failed',
      data?.request_id,
    );
  }

  return data as TRes & { ok: boolean };
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data?.error ?? 'request_failed');
  }

  return response.json() as Promise<T>;
}
