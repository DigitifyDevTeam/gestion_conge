const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown, message?: string) {
    super(message || `API error ${status}`);
    this.status = status;
    this.data = data;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem('user');
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const data = await res.json();
    localStorage.setItem(ACCESS_KEY, data.access);
    return data.access as string;
  } catch {
    clearTokens();
    return null;
  }
}

function extractErrorMessage(data: unknown): string {
  if (!data) return 'Request failed';
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === 'string') return obj.detail;
    if (obj.detail && typeof obj.detail === 'object') {
      const nested = obj.detail as Record<string, unknown>;
      if (typeof nested.detail === 'string') return nested.detail;
      if (typeof nested.message === 'string') return nested.message;
    }
    if (Array.isArray(obj.detail)) return String(obj.detail[0]);
    const firstKey = Object.keys(obj)[0];
    if (firstKey) {
      const val = obj[firstKey];
      if (Array.isArray(val)) return String(val[0]);
      if (typeof val === 'string') return val;
    }
  }
  return 'Request failed';
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, options, false);
    }
    clearTokens();
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
    throw new ApiError(401, null, 'Unauthorized');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, data, extractErrorMessage(data));
  }

  return data as T;
}

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  // Date-only: avoid timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}
