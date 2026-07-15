import type { ReactNode } from 'react';
import { BankIcon } from './icons';

/** Centered, branded container for the login and register screens. */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="animate-slide-up">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white shadow-glow">
            <BankIcon width={24} height={24} />
          </span>
          <span className="text-lg font-semibold text-slate-900 dark:text-white">
            Atechbroe Bank
          </span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>

        <div className="card mt-6 p-5 sm:p-6">{children}</div>

        <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">{footer}</p>
      </div>
    </div>
  );
}
