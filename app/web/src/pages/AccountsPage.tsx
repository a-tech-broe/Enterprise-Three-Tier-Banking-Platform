import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { formatMoney } from '../lib/money';
import type { Account } from '../types';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    try {
      await api.createAccount(name.trim(), currency);
      setName('');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create account');
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="font-semibold mb-3">Open an account</h2>
        <form onSubmit={onCreate} className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col text-sm">
            <span className="text-slate-500 mb-1">Account holder</span>
            <input
              className="border rounded-md px-3 py-2 w-56"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              required
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-slate-500 mb-1">Currency</span>
            <select
              className="border rounded-md px-3 py-2"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
            </select>
          </label>
          <button className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm font-medium">
            Create
          </button>
        </form>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>

      <section>
        <h2 className="font-semibold mb-3">Accounts</h2>
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-slate-500">No accounts yet — open one above.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {accounts.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/accounts/${a.id}`}
                  className="block bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-400"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium">{a.holder_name}</span>
                    <span className="text-xs uppercase text-slate-400">{a.status}</span>
                  </div>
                  <div className="text-2xl font-semibold mt-2">
                    {formatMoney(a.balance_cents, a.currency)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">{a.id.slice(0, 8)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
