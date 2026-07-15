import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/useTheme';
import { BankIcon, LogOutIcon, MoonIcon, SunIcon } from './icons';
import { Avatar } from './ui';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-brand-600 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  ].join(' ');

export default function NavBar() {
  const [theme, toggleTheme] = useTheme();
  const { user, logout } = useAuth();
  const nav = useNavigate();

  function onLogout() {
    logout();
    nav('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/70">
      <nav className="mx-auto flex h-16 max-w-5xl items-center gap-1.5 px-4 sm:px-6">
        <NavLink to="/" className="mr-2 flex items-center gap-2.5 font-semibold sm:mr-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-glow">
            <BankIcon width={20} height={20} />
          </span>
          <span className="hidden text-slate-900 dark:text-white sm:inline">Atechbroe Bank</span>
        </NavLink>

        <NavLink to="/" end className={linkClass}>
          Accounts
        </NavLink>
        <NavLink to="/transfer" className={linkClass}>
          Transfer
        </NavLink>
        {user?.is_admin && (
          <NavLink to="/admin" className={linkClass}>
            Admin
          </NavLink>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {theme === 'dark' ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
          </button>

          {user && (
            <>
              <span className="ml-1 hidden items-center gap-2 sm:flex">
                <Avatar name={user.full_name} seed={user.id} size="sm" />
                <span className="max-w-[9rem] truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {user.full_name}
                </span>
              </span>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Sign out"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
              >
                <LogOutIcon width={18} height={18} />
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
