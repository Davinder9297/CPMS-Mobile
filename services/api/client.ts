import { storage } from '@/utils/storage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const ACCESS_TOKEN_KEY = '@cpms/access_token';
const REFRESH_TOKEN_KEY = '@cpms/refresh_token';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export class AuthSessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'AuthSessionExpiredError';
  }
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function getAccessToken(): Promise<string | null> {
  return storage.get<string>(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return storage.get<string>(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    storage.set(ACCESS_TOKEN_KEY, accessToken),
    storage.set(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([storage.remove(ACCESS_TOKEN_KEY), storage.remove(REFRESH_TOKEN_KEY)]);
}

let sessionExpiredHandler: (() => void) | null = null;

// Registered once by the root layout so the client can trigger a redirect
// to /(auth)/login without importing the router or the Redux store directly.
export function onSessionExpired(handler: () => void): void {
  sessionExpiredHandler = handler;
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ refreshToken }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) return null;

      const tokens = json.data as TokenPair;
      await setTokens(tokens.accessToken, tokens.refreshToken);
      return tokens.accessToken;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  // Skip attaching a bearer token and skip the 401-refresh dance — for
  // endpoints that are public or that authenticate via their own body (login, refresh).
  skipAuth?: boolean;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipAuth = false } = options;

  const doFetch = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // ngrok's free tier serves an HTML interstitial (no CORS headers) to browser GETs without this.
      'ngrok-skip-browser-warning': '1',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  const token = skipAuth ? null : await getAccessToken();
  let res = await doFetch(token);

  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      await clearTokens();
      sessionExpiredHandler?.();
      throw new AuthSessionExpiredError();
    }
    res = await doFetch(newToken);
  }

  const json = await res.json().catch(() => null);

  if (!json || json.success === false) {
    const code = json?.error?.code ?? 'UNKNOWN_ERROR';
    const message = json?.error?.message ?? `Request failed with status ${res.status}`;
    throw new ApiError(code, message, res.status);
  }

  return json.data as T;
}
