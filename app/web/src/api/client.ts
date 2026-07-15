import type {
  Account,
  AccountStatus,
  AuthResponse,
  Insights,
  Transaction,
  User,
} from '../types';

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

export interface TxnFilters {
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
  q?: string;
}

function queryString(filters?: TxnFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.start) params.set('start', filters.start);
  if (filters.end) params.set('end', filters.end);
  if (filters.q) params.set('q', filters.q);
  const s = params.toString();
  return s ? `?${s}` : '';
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
  updateAccount: (id: string, patch: { holder_name?: string; status?: AccountStatus }) =>
    request<Account>(`/api/v1/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
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
  insights: (id: string) => request<Insights>(`/api/v1/accounts/${id}/insights`),
  transactions: (id: string, filters?: TxnFilters) =>
    request<Transaction[]>(`/api/v1/accounts/${id}/transactions${queryString(filters)}`),
  statementCsv: async (id: string, filters?: TxnFilters): Promise<Blob> => {
    const token = getToken();
    const resp = await fetch(`${BASE}/api/v1/accounts/${id}/statement.csv${queryString(filters)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) throw new ApiError(resp.status, 'error', 'Could not export statement');
    return resp.blob();
  },
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
