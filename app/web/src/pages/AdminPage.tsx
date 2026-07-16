import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { ChevronRight } from '../components/icons';
import { Notice, Spinner, StatusBadge, TxnIcon, txnMeta } from '../components/ui';
import { useAuth } from '../lib/auth';
import { formatMoney, relativeTime } from '../lib/money';
import type { AdminAccount, AdminStats, Transaction } from '../types';

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);

  async function loadOverview() {
    try {
      const [s, a] = await Promise.all([api.adminStats(), api.adminAccounts()]);
      setStats(s);
      setAccounts(a);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setTxnsLoading(true);
    try {
      setTxns(await api.adminAccountTransactions(id));
    } catch {
      setTxns([]);
    } finally {
      setTxnsLoading(false);
    }
  }

  async function reverse(txnId: string) {
    if (!window.confirm('Reverse this transaction? A compensating entry will be posted.')) return;
    setError(null);
    setReversingId(txnId);
    try {
      await api.reverseTransaction(txnId);
      if (openId) setTxns(await api.adminAccountTransactions(openId));
      await loadOverview();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reverse transaction');
    } finally {
      setReversingId(null);
    }
  }

  // Non-admins never see this page.
  if (user && !user.is_admin) return <Navigate to="/" replace />;

  return (
    <div className="animate-slide-up space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Back office
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Every account across the bank, with the ability to reverse a transaction.
        </p>
      </header>

      {error && <Notice tone="error">{error}</Notice>}

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { k: 'Users', v: stats?.user_count },
          { k: 'Accounts', v: stats?.account_count },
          { k: 'Transactions', v: stats?.transaction_count },
        ].map((s) => (
          <div key={s.k} className="card p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{s.k}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '—' : s.v}
            </p>
          </div>
        ))}
        <div className="card p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total held</p>
          <div className="mt-1 space-y-0.5">
            {loading || !stats ? (
              <p className="text-2xl font-bold text-slate-900 dark:text-white">—</p>
            ) : stats.balances_by_currency.length === 0 ? (
              <p className="text-2xl font-bold text-slate-900 dark:text-white">—</p>
            ) : (
              stats.balances_by_currency.map((b) => (
                <p key={b.currency} className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatMoney(b.total_cents, b.currency)}
                </p>
              ))
            )}
          </div>
        </div>
      </section>

      {/* All accounts */}
      <section>
        <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">All accounts</h2>
        {loading ? (
          <div className="card p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>
        ) : accounts.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500 dark:text-slate-400">No accounts yet.</div>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.id} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <ChevronRight
                    width={16}
                    height={16}
                    className={`shrink-0 text-slate-400 transition ${openId === a.id ? 'rotate-90' : ''}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-white">
                      {a.holder_name}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {a.owner_name} · {a.owner_email}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                  <span className="w-32 shrink-0 text-right font-mono font-semibold text-slate-900 dark:text-white">
                    {formatMoney(a.balance_cents, a.currency)}
                  </span>
                </button>

                {openId === a.id && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                    {txnsLoading ? (
                      <p className="p-3 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
                    ) : txns.length === 0 ? (
                      <p className="p-3 text-sm text-slate-500 dark:text-slate-400">
                        No transactions.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {txns.map((t) => {
                          const { positive, label } = txnMeta(t.type);
                          const isReversal = t.reference?.startsWith('Reversal of ');
                          return (
                            <li key={t.id} className="flex items-center gap-3 px-2 py-2.5">
                              <TxnIcon type={t.type} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium capitalize text-slate-800 dark:text-slate-100">
                                  {label}
                                </p>
                                <p className="truncate text-xs text-slate-400">
                                  {t.reference || relativeTime(t.created_at)}
                                </p>
                              </div>
                              <span
                                className={`font-mono text-sm font-semibold ${
                                  positive
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {positive ? '+' : '−'}
                                {formatMoney(t.amount_cents, a.currency)}
                              </span>
                              <button
                                type="button"
                                onClick={() => reverse(t.id)}
                                disabled={reversingId === t.id || isReversal}
                                title={isReversal ? 'This is a reversal entry' : 'Reverse'}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10"
                              >
                                {reversingId === t.id ? <Spinner className="h-3.5 w-3.5" /> : 'Reverse'}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
