// Small presentational atoms shared across pages.
import type { ReactNode } from 'react';
import type { AccountStatus, TxnType } from '../types';
import { ArrowDownLeft, ArrowUpRight } from './icons';

/** Coloured pill for an account status. */
export function StatusBadge({ status }: { status: AccountStatus }) {
  const styles: Record<AccountStatus, string> = {
    active:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    frozen: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    closed: 'bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400',
  };
  return (
    <span className={`badge ${styles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

/** Money-in vs money-out semantics for a transaction type. */
export function txnMeta(type: TxnType) {
  const positive = type === 'deposit' || type === 'transfer_in';
  const label = type.replace('_', ' ');
  return { positive, label, Icon: positive ? ArrowDownLeft : ArrowUpRight };
}

/** Round icon tile used in transaction rows. */
export function TxnIcon({ type }: { type: TxnType }) {
  const { positive, Icon } = txnMeta(type);
  const tone = positive
    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300';
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone}`}>
      <Icon width={18} height={18} />
    </span>
  );
}

/** Deterministic coloured initials avatar for an account holder. */
export function Avatar({
  name,
  seed,
  size = 'md',
}: {
  name: string;
  seed: string;
  size?: 'sm' | 'md';
}) {
  const dims = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-11 w-11 text-sm';
  const palette = [
    'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
    'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
    'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
    'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className={`grid ${dims} shrink-0 place-items-center rounded-full font-semibold ${palette[hash % palette.length]}`}
    >
      {initials || '?'}
    </span>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Inline error / success message banner. */
export function Notice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const styles =
    tone === 'error'
      ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  return (
    <div className={`animate-scale-in rounded-xl px-3.5 py-2.5 text-sm font-medium ${styles}`}>
      {children}
    </div>
  );
}
