import { User } from '@/types/auth';
import { apiFetch, ApiError, setTokens, clearTokens } from './client';

interface TokenResponse {
  access: string;
  refresh: string;
}

interface ApiUser {
  id: number | string;
  email: string;
  name: string;
  role: 'employee' | 'admin';
  department?: string;
  position?: string;
  avatar?: string;
}

export function mapUser(u: ApiUser): User {
  return {
    id: String(u.id),
    email: u.email,
    name: u.name,
    role: u.role,
    department: u.department || undefined,
    position: u.position || undefined,
    avatar: u.avatar || undefined,
  };
}

function applySession(tokens: TokenResponse, user: User): User {
  setTokens(tokens.access, tokens.refresh);
  localStorage.setItem('user', JSON.stringify(user));
  return user;
}

export async function loginRequest(email: string, password: string): Promise<User> {
  try {
    const tokens = await apiFetch<TokenResponse>('/auth/token/', {
      method: 'POST',
      body: JSON.stringify({ username: email, password }),
    }, false);
    setTokens(tokens.access, tokens.refresh);
    const me = await apiFetch<ApiUser>('/auth/me/');
    return applySession(tokens, mapUser(me));
  } catch (err) {
    if (err instanceof ApiError && err.data && typeof err.data === 'object') {
      const data = err.data as Record<string, unknown>;
      const nested =
        data.detail && typeof data.detail === 'object'
          ? (data.detail as Record<string, unknown>)
          : data;
      if (nested.code === 'email_not_verified' || data.code === 'email_not_verified') {
        const unverified = new ApiError(
          err.status,
          err.data,
          typeof nested.detail === 'string'
            ? nested.detail
            : err.message,
        );
        (unverified as ApiError & { code?: string; email?: string }).code =
          'email_not_verified';
        (unverified as ApiError & { code?: string; email?: string }).email =
          (typeof nested.email === 'string' && nested.email) ||
          (typeof data.email === 'string' && data.email) ||
          email;
        throw unverified;
      }
    }
    throw err;
  }
}

export async function googleLoginRequest(idToken: string): Promise<User> {
  const data = await apiFetch<TokenResponse & { user: ApiUser }>('/auth/google/', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken }),
  }, false);
  return applySession(
    { access: data.access, refresh: data.refresh },
    mapUser(data.user),
  );
}

export async function registerRequest(payload: {
  name: string;
  email: string;
  password: string;
  department?: string;
  position?: string;
}): Promise<{ email: string; requires_verification: boolean; detail: string }> {
  return apiFetch('/auth/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false);
}

export async function verifyEmailRequest(email: string, code: string): Promise<User> {
  const data = await apiFetch<TokenResponse & { user: ApiUser }>('/auth/verify-email/', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  }, false);
  return applySession(
    { access: data.access, refresh: data.refresh },
    mapUser(data.user),
  );
}

export async function forgotPasswordRequest(email: string): Promise<{ detail: string }> {
  return apiFetch('/auth/forgot-password/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }, false);
}

export async function resetPasswordRequest(
  email: string,
  code: string,
  password: string,
): Promise<{ detail: string }> {
  return apiFetch('/auth/reset-password/', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  }, false);
}

export async function resendCodeRequest(
  email: string,
  purpose: 'signup' | 'reset',
): Promise<{ detail: string }> {
  return apiFetch('/auth/resend-code/', {
    method: 'POST',
    body: JSON.stringify({ email, purpose }),
  }, false);
}

export async function fetchMe(): Promise<User> {
  const me = await apiFetch<ApiUser>('/auth/me/');
  const user = mapUser(me);
  localStorage.setItem('user', JSON.stringify(user));
  return user;
}

export function logoutRequest() {
  clearTokens();
}
