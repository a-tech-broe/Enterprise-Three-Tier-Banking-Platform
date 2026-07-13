import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const airportsDropdownLinks = [
  { to: '/map',      label: 'Map'     },
  { to: '/weather',  label: 'Weather' },
  { to: '/winds',    label: 'Winds'   },
];

const opsDropdownLinks = [
  { to: '/route',    label: 'Briefing' },
  { to: '/currency', label: 'Currency' },
  { to: '/dispatch', label: 'Dispatch' },
];

// Flat, grouped list for the mobile menu (touch devices can't hover dropdowns)
const mobileSections = [
  { heading: 'Airports', links: [{ to: '/airports', label: 'Airports' }, ...airportsDropdownLinks] },
  { heading: 'Ops',      links: [{ to: '/ops', label: 'Ops Overview' }, ...opsDropdownLinks] },
];

const AIRPORTS_PATHS = new Set(['/airports', '/map', '/weather', '/winds']);
const OPS_PATHS      = new Set(['/ops', '/route', '/currency', '/dispatch']);

const NAV_ITEM   = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1';
const NAV_ACTIVE = 'bg-blue-600 text-white';
const NAV_IDLE   = 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800';

function Chevron() {
  return (
    <svg className="w-3 h-3 opacity-60" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 8L1 3h10z"/>
    </svg>
  );
}

interface DropdownProps {
  to: string;
  label: string;
  isActive: boolean;
  items: { to: string; label: string }[];
}

function DropdownNav({ to, label, isActive, items }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onEnter() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function onLeave() {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  return (
    <div className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <NavLink to={to} className={`${NAV_ITEM} ${isActive ? NAV_ACTIVE : NAV_IDLE}`}>
        {label}
        <Chevron />
      </NavLink>

      {open && (
        <div className="absolute top-full left-0 pt-1 z-50">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden min-w-[130px]">
            {items.map(({ to: itemTo, label: itemLabel }) => (
              <NavLink
                key={itemTo}
                to={itemTo}
                onClick={() => setOpen(false)}
                className={({ isActive: ia }) =>
                  `block px-4 py-2 text-sm font-medium transition-colors ${
                    ia
                      ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                  }`
                }
              >
                {itemLabel}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  dark: boolean;
  onToggle: () => void;
}

export default function NavBar({ dark, onToggle }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const airportsActive = AIRPORTS_PATHS.has(location.pathname);
  const opsActive      = OPS_PATHS.has(location.pathname);

  // Close the mobile menu whenever the route changes
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  function handleLogout() {
    setMobileOpen(false);
    logout();
    navigate('/', { replace: true });
  }

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="container mx-auto px-4 max-w-7xl flex items-center h-14 gap-6">

        {/* Logo */}
        <div className="flex flex-col leading-tight flex-shrink-0">
          <span className="text-blue-500 dark:text-blue-400 font-bold text-lg tracking-tight">
            ✈ SkyBroe
          </span>
          <span className="text-slate-400 dark:text-slate-500 text-[10px] tracking-wide">
            powered by atechbroe
          </span>
        </div>

        {/* Desktop nav links — only shown when logged in */}
        {user && (
          <div className="hidden md:flex gap-1 flex-1 items-center">
            <DropdownNav to="/airports" label="Airports" isActive={airportsActive} items={airportsDropdownLinks} />
            <DropdownNav to="/ops"      label="Ops"      isActive={opsActive}      items={opsDropdownLinks}      />
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          {/* User email chip + logout */}
          {user && (
            <>
              <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block max-w-[140px] truncate">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Log out
              </button>
            </>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={onToggle}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle light/dark mode"
          >
            {dark ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Mobile hamburger — only when logged in */}
          {user && (
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileOpen
                  ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                  : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile menu panel */}
      {user && mobileOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-slide-up">
          <div className="container mx-auto px-4 max-w-7xl py-3 space-y-4">
            {mobileSections.map(section => (
              <div key={section.heading}>
                <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {section.heading}
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {section.links.map(({ to, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end
                      className={({ isActive }) =>
                        `px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`
                      }
                    >
                      {label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
            {user && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="px-3 text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                  {user.email}
                </span>
                <button onClick={handleLogout} className="btn-secondary text-xs py-2 px-4">
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
