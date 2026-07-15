import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { CheckCircle, SwapIcon } from '../components/icons';
import { Notice, Spinner } from '../components/ui';
import { formatMoney, toCents } from '../lib/money';
import type { Account } from '../types';

export default function TransferPage() {
  const nav = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listAccounts().then(setAccounts).catch(() => setError('Failed to load accounts'));
  }, []);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.transfer(from, to, toCents(amount));
      setDone(true);
      setTimeout(() => nav(`/accounts/${from}`), 900);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
      setBusy(false);
    }
  }

  const opt = (a: Account) => `${a.holder_name} · ${formatMoney(a.balance_cents, a.currency)}`;

  if (done) {
    return (
      <div className="mx-auto flex max-w-md animate-scale-in flex-col items-center py-16 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
          <CheckCircle width={32} height={32} />
        </span>
        <h2 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">Transfer complete</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Taking you to the account…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md animate-slide-up">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Transfer money
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Move funds instantly between accounts.
        </p>
      </header>

      <form onSubmit={onSubmit} className="card space-y-1 p-5 sm:p-6">
        <label className="block">
          <span className="label">From</span>
          <select className="input" value={from} onChange={(e) => setFrom(e.target.value)} required>
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {opt(a)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-center py-1">
          <button
            type="button"
            onClick={swap}
            aria-label="Swap accounts"
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:rotate-180 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
          >
            <SwapIcon width={18} height={18} />
          </button>
        </div>

        <label className="block">
          <span className="label">To</span>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)} required>
            <option value="">Select account…</option>
            {accounts
              .filter((a) => a.id !== from)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {opt(a)}
                </option>
              ))}
          </select>
        </label>

        <label className="block pt-2">
          <span className="label">Amount</span>
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>

        <div className="pt-3">
          <button disabled={busy} className="btn-primary w-full">
            {busy ? <Spinner /> : <SwapIcon width={18} height={18} />}
            Send transfer
          </button>
        </div>

        {error && (
          <div className="pt-2">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
      </form>
    </div>
  );
}
