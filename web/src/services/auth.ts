export interface UserSession {
  person_id: string;
  name: string;
  seats: string[];
  acting_as: string;
  seat_label: string;
  csrf: string;
  allowed_entities: string[];
  organisations?: { id: string; name: string }[];
  current_organisation_id?: string;
  platform_entitlement?: {
    operator_role: string;
    mfa_verified: boolean;
  } | null;
}

export interface AuthState {
  session: UserSession | null;
  isLoading: boolean;
  error: string | null;
}

export async function fetchCurrentUser(): Promise<UserSession | null> {
  try {
    const response = await fetch('/api/me', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.ok ? (data.user as UserSession) : null;
  } catch {
    return null;
  }
}

export async function loginWithGoogle(credential: string): Promise<UserSession> {
  const response = await fetch('/api/auth/google', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-starq-client-kind': 'web',
    },
    body: JSON.stringify({ credential }),
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? 'login_failed');
  }

  return data.user as UserSession;
}

export async function logout(csrf: string): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-csrf-token': csrf,
    },
    body: JSON.stringify({ csrf }),
  });
}

export async function switchSeat(seat: string, csrf: string): Promise<UserSession> {
  const response = await fetch('/api/auth/seat', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-csrf-token': csrf,
    },
    body: JSON.stringify({ seat, csrf }),
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? 'seat_switch_failed');
  }

  return data.user as UserSession;
}
