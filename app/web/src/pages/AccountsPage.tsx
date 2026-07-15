import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { ChevronRight, PlusIcon, WalletIcon } from '../components/icons';
import { Avatar, Notice, Spinner, StatusBadge } from '../components/ui';
import { formatMoney } from '../lib/money';
import type { Account } from '../types';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    try {
      setAccounts(await api.listAccounts());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.createAccount(name.trim(), currency);
      setName('');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create account');
    } finally {
      setCreating(false);
    }
  }

  // Totals grouped by currency (summing across currencies would be meaningless).
  const totals = accounts.reduce<Record<string, number>>((m, a) => {
    m[a.currency] = (m[a.currency] ?? 0) + a.balance_cents;
    return m;
  }, {});
  const currencies = Object.keys(totals);
  const primary = currencies[0];
  const activeCount = accounts.filter((a) => a.status === 'active').length;

  return (
    <div className="animate-slide-up space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Overview
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your accounts, balances, and recent activity at a glance.
        </p>
      </header>

      {/* Summary: balance hero + stat cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-600 to-violet-600 p-6 text-white shadow-glow md:col-span-2">
          <WalletIcon
            width={140}
            height={140}
            className="pointer-events-none absolute -right-6 -top-6 opacity-15"
          />
          <p className="text-sm font-medium text-white/70">Total balance</p>
          {loading ? (
            <div className="mt-3 h-9 w-48 rounded-lg bg-white/20" />
          ) : primary ? (
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-bold tracking-tight">
                {formatMoney(totals[primary], primary)}
              </span>
              {currencies.slice(1).map((c) => (
                <span key={c} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                  {formatMoney(totals[c], c)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-2xl font-semibold text-white/80">—</p>
          )}
          <p className="mt-4 text-xs text-white/60">
            Across {accounts.length} account{accounts.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-1">
          <div className="card flex flex-col justify-center p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Accounts</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '—' : accounts.length}
            </p>
          </div>
          <div className="card flex flex-col justify-center p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {loading ? '—' : activeCount}
            </p>
          </div>
        </div>
      </section>

      {/* Open an account */}
      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <PlusIcon width={18} height={18} className="text-brand-600 dark:text-brand-400" />
          Open an account
        </h2>
        <form onSubmit={onCreate} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="label">Account holder</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              required
            />
          </label>
          <label className="sm:w-36">
            <span className="label">Currency</span>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
            </select>
          </label>
          <button className="btn-primary sm:w-auto" disabled={creating}>
            {creating ? <Spinner /> : <PlusIcon width={18} height={18} />}
            Create account
          </button>
        </form>
        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
      </section>

      {/* Accounts list */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Your accounts</h2>
          {!loading && accounts.length > 0 && (
            <span className="text-sm text-slate-400">{accounts.length} total</span>
          )}
        </div>

        {loading ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <li key={i} className="card p-5">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-11 w-11 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3.5 w-28" />
                    <div className="skeleton h-3 w-16" />
                  </div>
                </div>
                <div className="skeleton mt-5 h-7 w-32" />
              </li>
            ))}
          </ul>
        ) : accounts.length === 0 ? (
          <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              <WalletIcon width={26} height={26} />
            </span>
            <p className="mt-4 font-medium text-slate-900 dark:text-white">No accounts yet</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Open your first account using the form above to get started.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {accounts.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/accounts/${a.id}`}
                  className="card group flex items-center gap-4 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-glow dark:hover:border-brand-500/40"
                >
                  <Avatar name={a.holder_name} seed={a.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-900 dark:text-white">
                        {a.holder_name}
                      </span>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {formatMoney(a.balance_cents, a.currency)}
                    </div>
                    <div className="mt-1 font-mono text-xs text-slate-400">
                      {a.currency} · {a.id.slice(0, 8)}
                    </div>
                  </div>
                  <ChevronRight
                    width={18}
                    height={18}
                    className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-slate-600"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
