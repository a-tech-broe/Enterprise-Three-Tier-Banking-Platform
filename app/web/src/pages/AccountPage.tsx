import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { formatMoney, toCents } from '../lib/money';
import type { Account, Transaction } from '../types';

export default function AccountPage() {
  const { id = '' } = useParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [acct, tx] = await Promise.all([api.getAccount(id), api.transactions(id)]);
      setAccount(acct);
      setTxns(tx);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load account');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function move(kind: 'deposit' | 'withdraw') {
    setError(null);
    setBusy(true);
    try {
      const cents = toCents(amount);
      if (kind === 'deposit') await api.deposit(id, cents);
      else await api.withdraw(id, cents);
      setAmount('');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <div>
        {error ? <p className="text-red-600">{error}</p> : <p className="text-slate-500">Loading…</p>}
        <Link to="/" className="text-sm text-slate-500 underline">
          Back to accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-slate-500 underline">
        ← Accounts
      </Link>

      <section className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex justify-between items-baseline">
          <h2 className="font-semibold">{account.holder_name}</h2>
          <span className="text-xs uppercase text-slate-400">{account.status}</span>
        </div>
        <div className="text-3xl font-semibold mt-2">
          {formatMoney(account.balance_cents, account.currency)}
        </div>

        <div className="flex flex-wrap gap-3 items-end mt-4">
          <input
            className="border rounded-md px-3 py-2 w-40"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
          <button
            disabled={busy}
            onClick={() => move('deposit')}
            className="bg-emerald-600 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Deposit
          </button>
          <button
            disabled={busy}
            onClick={() => move('withdraw')}
            className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Withdraw
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </section>

      <section>
        <h3 className="font-semibold mb-3">Transactions</h3>
        {txns.length === 0 ? (
          <p className="text-slate-500">No transactions yet.</p>
        ) : (
          <table className="w-full text-sm bg-white rounded-lg border border-slate-200 overflow-hidden">
            <thead className="bg-slate-100 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-right">Balance</th>
                <th className="px-4 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 capitalize">{t.type.replace('_', ' ')}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatMoney(t.amount_cents, account.currency)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatMoney(t.balance_after_cents, account.currency)}
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
