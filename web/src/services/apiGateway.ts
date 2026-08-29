import {
  CommandName,
  ScmStep,
} from '../../../contracts/commands';
import { getApiBaseUrl } from './auth';

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
  const base = getApiBaseUrl();
  const idempotencyKey = generateIdempotencyKey();

  const body: Record<string, unknown> = {
    ...params.payload as Record<string, unknown>,
    type: params.command,
  };
  if (params.step) {
    body.scm_step = params.step;
  }

  const response = await fetch(`${base}/api/ops/event`, {
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
  const base = getApiBaseUrl();
  const response = await fetch(`${base}${path}`, {
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

export async function apiPost<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const base = getApiBaseUrl();
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-csrf-token': getCsrfToken(),
    },
    body: JSON.stringify({ ...payload, csrf: getCsrfToken() }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? 'request_failed', data?.request_id);
  }

  return data as T;
}

export interface OrganisationApplicationPayload {
  name: string;
  legal_name?: string;
  archetype_id: string;
  primary_book_name?: string;
  primary_book_code?: string;
  island: string;
  atoll: string;
  phone?: string;
}

export interface PlatformApplicationRecord {
  id: string;
  applicant_person_id: string;
  applicant_email: string;
  applicant_name: string;
  name: string;
  legal_name: string;
  archetype_id: string;
  primary_book_name: string;
  primary_book_code: string;
  island: string;
  atoll: string;
  phone?: string;
  status: 'pending' | 'approved' | 'rejected' | 'info_requested';
  notes?: string;
  rejection_reason?: string;
  info_request_note?: string;
  provisioned_organisation_id?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export async function submitOrganisationApplication(
  payload: OrganisationApplicationPayload
): Promise<{ ok: boolean; application: PlatformApplicationRecord; user?: any }> {
  return apiPost<{ ok: boolean; application: PlatformApplicationRecord; user?: any }>(
    '/api/onboarding/apply',
    payload as unknown as Record<string, unknown>
  );
}

export async function getApplicantApplication(): Promise<{ ok: boolean; application: PlatformApplicationRecord | null }> {
  return apiGet<{ ok: boolean; application: PlatformApplicationRecord | null }>('/api/onboarding/application');
}

export async function getPlatformApplications(): Promise<{ ok: boolean; applications: PlatformApplicationRecord[] }> {
  return apiGet<{ ok: boolean; applications: PlatformApplicationRecord[] }>('/api/platform/applications');
}

export async function approvePlatformApplication(
  applicationId: string
): Promise<{ ok: boolean; result: any }> {
  return apiPost<{ ok: boolean; result: any }>(
    `/api/platform/applications/${applicationId}/approve`,
    {}
  );
}

export async function rejectPlatformApplication(
  applicationId: string,
  reason: string
): Promise<{ ok: boolean; status: string }> {
  return apiPost<{ ok: boolean; status: string }>(
    `/api/platform/applications/${applicationId}/reject`,
    { reason }
  );
}

export async function requestInfoPlatformApplication(
  applicationId: string,
  note: string
): Promise<{ ok: boolean; status: string }> {
  return apiPost<{ ok: boolean; status: string }>(
    `/api/platform/applications/${applicationId}/request-info`,
    { note }
  );
}

export interface StaffInvitationRecord {
  id: string;
  organisation_id: string;
  email: string;
  name: string;
  role_id: string;
  job_title?: string;
  phone?: string;
  book_ids: string[];
  location_ids: string[];
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked' | 'cancelled';
  invited_by?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  persons?: {
    display_label?: string;
  };
}

export interface CreateStaffInvitationPayload {
  email: string;
  name: string;
  role_id: string;
  job_title?: string;
  phone?: string;
  book_ids?: string[];
  location_ids?: string[];
}

export async function getTenantInvitations(): Promise<{ ok: boolean; invitations: StaffInvitationRecord[] }> {
  return apiGet<{ ok: boolean; invitations: StaffInvitationRecord[] }>('/api/tenant/invitations');
}

export async function createTenantInvitation(
  payload: CreateStaffInvitationPayload
): Promise<{ ok: boolean; invitation: StaffInvitationRecord }> {
  return apiPost<{ ok: boolean; invitation: StaffInvitationRecord }>(
    '/api/tenant/invitations',
    payload as unknown as Record<string, unknown>
  );
}

export async function resendTenantInvitation(
  invitationId: string
): Promise<{ ok: boolean; invitation: StaffInvitationRecord }> {
  return apiPost<{ ok: boolean; invitation: StaffInvitationRecord }>(
    `/api/tenant/invitations/${invitationId}/resend`,
    {}
  );
}

export async function revokeTenantInvitation(
  invitationId: string
): Promise<{ ok: boolean; status: string }> {
  return apiPost<{ ok: boolean; status: string }>(
    `/api/tenant/invitations/${invitationId}/revoke`,
    {}
  );
}
