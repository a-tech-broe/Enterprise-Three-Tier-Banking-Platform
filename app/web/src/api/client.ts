import type { Account, AuthResponse, Transaction, User } from '../types';

// Base URL for the banking API. Empty (default) means same-origin / dev proxy;
// set VITE_API_URL at build time to point the SPA at the ALB/API host.
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const TOKEN_KEY = 'atechbroe_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (resp.status === 401) {
    // Token missing/expired: clear it and let the app fall back to login.
    setToken(null);
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  if (!resp.ok) {
    let code = 'error';
    let message = resp.statusText;
    try {
      const body = await resp.json();
      code = body.error ?? code;
      message = body.message ?? body.detail ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(resp.status, code, message);
  }
  return resp.status === 204 ? (undefined as T) : ((await resp.json()) as T);
}

export const api = {
  register: (email: string, full_name: string, password: string) =>
    request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, full_name, password }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/api/v1/auth/me'),

  listAccounts: () => request<Account[]>('/api/v1/accounts'),
  getAccount: (id: string) => request<Account>(`/api/v1/accounts/${id}`),
  createAccount: (holder_name: string, currency: string) =>
    request<Account>('/api/v1/accounts', {
      method: 'POST',
      body: JSON.stringify({ holder_name, currency }),
    }),
  deposit: (id: string, amount_cents: number, reference?: string) =>
    request<Transaction>(`/api/v1/accounts/${id}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount_cents, reference }),
    }),
  withdraw: (id: string, amount_cents: number, reference?: string) =>
    request<Transaction>(`/api/v1/accounts/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount_cents, reference }),
    }),
  transactions: (id: string) =>
    request<Transaction[]>(`/api/v1/accounts/${id}/transactions`),
  transfer: (
    from_account_id: string,
    to_account_id: string,
    amount_cents: number,
    reference?: string,
  ) =>
    request<Transaction>('/api/v1/transfers', {
      method: 'POST',
      body: JSON.stringify({ from_account_id, to_account_id, amount_cents, reference }),
    }),
};
