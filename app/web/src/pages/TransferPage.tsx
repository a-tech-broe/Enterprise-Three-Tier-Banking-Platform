import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { formatMoney, toCents } from '../lib/money';
import type { Account } from '../types';

export default function TransferPage() {
  const nav = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listAccounts().then(setAccounts).catch(() => setError('Failed to load accounts'));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      await api.transfer(from, to, toCents(amount));
      setOk('Transfer complete.');
      setAmount('');
      setTimeout(() => nav(`/accounts/${from}`), 700);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const opt = (a: Account) => `${a.holder_name} · ${formatMoney(a.balance_cents, a.currency)}`;

  return (
    <div className="max-w-md">
      <h2 className="font-semibold mb-4">Transfer money</h2>
      <form onSubmit={onSubmit} className="space-y-4 bg-white rounded-lg border border-slate-200 p-5">
        <label className="flex flex-col text-sm">
          <span className="text-slate-500 mb-1">From</span>
          <select className="border rounded-md px-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} required>
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {opt(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-slate-500 mb-1">To</span>
          <select className="border rounded-md px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} required>
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
        <label className="flex flex-col text-sm">
          <span className="text-slate-500 mb-1">Amount</span>
          <input
            className="border rounded-md px-3 py-2"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <button
          disabled={busy}
          className="w-full bg-slate-900 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Send transfer
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {ok && <p className="text-emerald-600 text-sm">{ok}</p>}
      </form>
    </div>
  );
}
