import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { ArrowLeft, PlusIcon } from '../components/icons';
import { Notice, Spinner } from '../components/ui';

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
];

export default function CreateAccountPage() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter the account holder’s name.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const account = await api.createAccount(name.trim(), currency);
      // Straight to the new account so the holder can fund it immediately.
      nav(`/accounts/${account.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create account');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md animate-slide-up">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
      >
        <ArrowLeft width={16} height={16} /> Accounts
      </Link>

      <header className="mb-5 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Open a new account
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose a name and currency — you can fund it on the next screen.
        </p>
      </header>

      <form onSubmit={onSubmit} className="card space-y-5 p-5 sm:p-6">
        <label className="block">
          <span className="label">Account holder</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            autoFocus
            required
          />
        </label>

        <div>
          <span className="label">Currency</span>
          <div className="grid grid-cols-3 gap-2">
            {CURRENCIES.map((c) => {
              const active = c.code === currency;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCurrency(c.code)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/60 dark:bg-brand-500/10 dark:text-brand-200'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="text-lg">{c.symbol}</span>
                  {c.code}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            {CURRENCIES.find((c) => c.code === currency)?.label}
          </p>
        </div>

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : <PlusIcon width={18} height={18} />}
          Open account
        </button>

        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </div>
  );
}
