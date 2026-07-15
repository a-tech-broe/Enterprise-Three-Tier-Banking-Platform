import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight } from '../components/icons';
import { Notice, Spinner, StatusBadge, TxnIcon, txnMeta } from '../components/ui';
import { formatMoney, relativeTime, toCents } from '../lib/money';
import type { Account, Transaction } from '../types';

const PRESETS = [10, 50, 100, 500];

export default function AccountPage() {
  const { id = '' } = useParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'deposit' | 'withdraw' | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  async function refresh() {
    try {
      const [acct, tx] = await Promise.all([api.getAccount(id), api.transactions(id)]);
      setAccount(acct);
      setTxns(tx);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load account');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function move(kind: 'deposit' | 'withdraw') {
    setError(null);
    setBusy(kind);
    try {
      const cents = toCents(amount);
      if (kind === 'deposit') await api.deposit(id, cents);
      else await api.withdraw(id, cents);
      setAmount('');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runAction(fn: () => Promise<unknown>) {
    setError(null);
    setActionBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setActionBusy(false);
    }
  }

  function saveRename() {
    const name = nameDraft.trim();
    if (!name) return;
    runAction(() => api.updateAccount(id, { holder_name: name })).then(() => setRenaming(false));
  }

  function closeAccount() {
    if (!window.confirm('Close this account? This cannot be undone.')) return;
    runAction(() => api.updateAccount(id, { status: 'closed' }));
  }

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-44 w-full rounded-2xl" />
        <div className="skeleton h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Link to="/" className="btn-ghost w-max">
          <ArrowLeft width={18} height={18} /> Back to accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
      >
        <ArrowLeft width={16} height={16} /> Accounts
      </Link>

      {/* Balance card */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900 p-6 text-white shadow-glow sm:p-8">
        <div
          aria-hidden
          className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/30 blur-3xl"
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/60">Account holder</p>
            <h1 className="mt-0.5 text-xl font-semibold">{account.holder_name}</h1>
          </div>
          <StatusBadge status={account.status} />
        </div>
        <div className="relative mt-6">
          <p className="text-sm text-white/60">Available balance</p>
          <p className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
            {formatMoney(account.balance_cents, account.currency)}
          </p>
        </div>
        <p className="relative mt-6 font-mono text-xs text-white/50">
          {account.currency} · {account.id}
        </p>
      </section>

      {error && <Notice tone="error">{error}</Notice>}

      {account.status === 'closed' ? (
        <Notice tone="error">This account is closed and can no longer transact.</Notice>
      ) : (
        <>
          {/* Move money */}
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white">Move money</h2>
            {account.status === 'frozen' && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                This account is frozen. Unfreeze it below to deposit or withdraw.
              </p>
            )}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="label">Amount ({account.currency})</span>
                <input
                  className="input"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={account.status !== 'active'}
                />
              </label>
              <div className="flex gap-3">
                <button
                  className="btn-success flex-1 sm:flex-none"
                  disabled={busy !== null || account.status !== 'active'}
                  onClick={() => move('deposit')}
                >
                  {busy === 'deposit' ? <Spinner /> : <ArrowDownLeft width={18} height={18} />}
                  Deposit
                </button>
                <button
                  className="btn-ghost flex-1 sm:flex-none"
                  disabled={busy !== null || account.status !== 'active'}
                  onClick={() => move('withdraw')}
                >
                  {busy === 'withdraw' ? <Spinner /> : <ArrowUpRight width={18} height={18} />}
                  Withdraw
                </button>
              </div>
            </div>
            {account.status === 'active' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(String(p))}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10"
                  >
                    +{p}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Manage account */}
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white">Manage account</h2>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              {renaming ? (
                <>
                  <label className="flex-1">
                    <span className="label">Account name</span>
                    <input
                      className="input"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      autoFocus
                    />
                  </label>
                  <div className="flex gap-2">
                    <button className="btn-primary" disabled={actionBusy} onClick={saveRename}>
                      {actionBusy && <Spinner />}
                      Save
                    </button>
                    <button className="btn-ghost" type="button" onClick={() => setRenaming(false)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex w-full items-center justify-between gap-3">
                  <div>
                    <p className="label mb-0">Account name</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {account.holder_name}
                    </p>
                  </div>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      setNameDraft(account.holder_name);
                      setRenaming(true);
                    }}
                  >
                    Rename
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              {account.status === 'active' ? (
                <button
                  className="btn-ghost"
                  disabled={actionBusy}
                  onClick={() => runAction(() => api.updateAccount(id, { status: 'frozen' }))}
                >
                  Freeze account
                </button>
              ) : (
                <button
                  className="btn-ghost"
                  disabled={actionBusy}
                  onClick={() => runAction(() => api.updateAccount(id, { status: 'active' }))}
                >
                  Unfreeze account
                </button>
              )}
              <button
                type="button"
                onClick={closeAccount}
                disabled={actionBusy || account.balance_cents !== 0}
                title={account.balance_cents !== 0 ? 'Balance must be zero to close' : undefined}
                className="btn bg-rose-50 text-rose-600 hover:bg-rose-100 focus-visible:ring-rose-400/30 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
              >
                Close account
              </button>
            </div>
            {account.balance_cents !== 0 && (
              <p className="mt-2 text-xs text-slate-400">
                Withdraw or transfer the remaining balance to close this account.
              </p>
            )}
          </section>
        </>
      )}

      {/* Transactions */}
      <section>
        <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Transactions</h2>
        {txns.length === 0 ? (
          <div className="card px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No transactions yet. Make a deposit to see activity here.
          </div>
        ) : (
          <ul className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
            {txns.map((t) => {
              const { positive, label } = txnMeta(t.type);
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/40 sm:px-5"
                >
                  <TxnIcon type={t.type} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium capitalize text-slate-900 dark:text-white">{label}</p>
                    <p className="truncate text-xs text-slate-400">
                      {t.reference || relativeTime(t.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-mono font-semibold ${
                        positive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {positive ? '+' : '−'}
                      {formatMoney(t.amount_cents, account.currency)}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      {formatMoney(t.balance_after_cents, account.currency)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
