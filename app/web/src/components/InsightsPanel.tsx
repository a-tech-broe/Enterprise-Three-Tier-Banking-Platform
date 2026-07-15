import { formatMoney } from '../lib/money';
import type { Insights } from '../types';
import { txnMeta } from './ui';

function monthLabel(ym: string): string {
  const d = new Date(`${ym}-01T00:00:00`);
  return Number.isNaN(d.getTime())
    ? ym
    : d.toLocaleDateString(undefined, { month: 'short' });
}

export default function InsightsPanel({ insights }: { insights: Insights }) {
  const { currency } = insights;
  const money = (c: number) => formatMoney(c, currency);
  const maxMonthly = Math.max(
    1,
    ...insights.monthly.flatMap((m) => [m.in_cents, m.out_cents]),
  );
  const maxType = Math.max(1, ...insights.by_type.map((b) => b.total_cents));

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-semibold text-slate-900 dark:text-white">Insights</h2>

      {/* Totals */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Money in</p>
          <p className="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {money(insights.total_in_cents)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Money out</p>
          <p className="mt-0.5 text-lg font-bold text-rose-600 dark:text-rose-400">
            {money(insights.total_out_cents)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Net</p>
          <p className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">
            {money(insights.net_cents)}
          </p>
        </div>
      </div>

      {/* Monthly in/out bars */}
      <div className="mt-6">
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> In
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" /> Out
          </span>
        </div>
        <div className="mt-3 flex h-32 items-end gap-2">
          {insights.monthly.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-full w-full items-end justify-center gap-1">
                <div
                  className="w-2.5 rounded-t bg-emerald-500 transition-all"
                  style={{ height: `${(m.in_cents / maxMonthly) * 100}%` }}
                  title={`${monthLabel(m.month)} in: ${money(m.in_cents)}`}
                />
                <div
                  className="w-2.5 rounded-t bg-rose-400 transition-all"
                  style={{ height: `${(m.out_cents / maxMonthly) * 100}%` }}
                  title={`${monthLabel(m.month)} out: ${money(m.out_cents)}`}
                />
              </div>
              <span className="text-[10px] font-medium text-slate-400">{monthLabel(m.month)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By type */}
      <div className="mt-6 space-y-2.5">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">By category</p>
        {insights.by_type.map((b) => {
          const { label, positive } = txnMeta(b.type);
          return (
            <div key={b.type} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm capitalize text-slate-600 dark:text-slate-300">
                {label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${positive ? 'bg-emerald-500' : 'bg-rose-400'}`}
                  style={{ width: `${(b.total_cents / maxType) * 100}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right font-mono text-sm text-slate-700 dark:text-slate-200">
                {money(b.total_cents)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
