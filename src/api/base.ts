const API_PATH_PREFIX = '/api/v1';
const HTTP_URL_PATTERN = /^https?:\/\//i;

function normalizeApiOrigin(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

export const API_ORIGIN = normalizeApiOrigin(import.meta.env.VITE_API_ORIGIN);
export const API_BASE_URL = `${API_ORIGIN}${API_PATH_PREFIX}`;

export function apiOriginUrl(pathOrUrl: string): string {
  if (HTTP_URL_PATTERN.test(pathOrUrl) || pathOrUrl.startsWith('//')) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_ORIGIN}${path}`;
}

export function apiUrl(path: string): string {
  const endpoint = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${endpoint}`;
}
const ACCESS_TOKEN_KEY = 'nexus_studio_access_token';
const REFRESH_TOKEN_KEY = 'nexus_studio_refresh_token';
const REFRESH_LOCK_NAME = 'nexus_studio_auth_refresh';

let refreshPromise: Promise<string | null> | null = null;

export interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function redirectToLoginOnAuthFailure(): Promise<never> {
  clearTokens();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    const from = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/login?from=${encodeURIComponent(from)}`);
  }
  throw new Error('登录已失效，请重新登录');
}

async function performTokenRefresh(refreshToken: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    throw new Error('token_refresh_unavailable');
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<{
    access_token: string;
    refresh_token: string;
  }> | null;

  // Another tab may have rotated the shared localStorage token while this request was in flight.
  if (getRefreshToken() !== refreshToken) {
    return getAccessToken();
  }
  if (response.status >= 500) {
    throw new Error('token_refresh_unavailable');
  }
  if (!response.ok || payload === null || payload.code !== 0 || !payload.data) {
    return null;
  }

  setTokens(payload.data.access_token, payload.data.refresh_token);
  return payload.data.access_token;
}

async function runTokenRefresh(): Promise<string | null> {
  const observedRefreshToken = getRefreshToken();
  if (!observedRefreshToken) return null;

  if (navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK_NAME, async () => {
      const currentRefreshToken = getRefreshToken();
      if (!currentRefreshToken) return null;
      if (currentRefreshToken !== observedRefreshToken) {
        return getAccessToken();
      }
      return performTokenRefresh(currentRefreshToken);
    });
  }

  return performTokenRefresh(observedRefreshToken);
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = runTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getAccessToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** fetch with Bearer token; on 401 refresh access token once and retry. */
export async function fetchWithAuth(
  url: string,
  init?: RequestInit,
  retry = true,
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: authHeaders(init?.headers),
  });

  if (response.status === 401 && retry) {
    const hadSession = Boolean(getAccessToken() || getRefreshToken());
    const newToken = await refreshAccessToken();
    if (newToken) {
      return fetchWithAuth(url, init, false);
    }
    // Guest browsing public pages: surface 401 without forcing a login redirect.
    if (!hadSession) {
      return response;
    }
    return redirectToLoginOnAuthFailure();
  }

  return response;
}

export async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const response = await fetchWithAuth(
    apiUrl(path),
    {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    },
    retry,
  );

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || payload === null || payload.code !== 0) {
    throw new Error(payload?.msg ?? `请求失败: ${response.status}`);
  }

  return payload.data;
}
