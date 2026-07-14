import type { Account, Transaction } from '../types';

// Base URL for the banking API. Empty (default) means same-origin / dev proxy;
// set VITE_API_URL at build time to point the SPA at the ALB/API host.
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

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
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
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
