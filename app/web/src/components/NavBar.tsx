import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
  }`;

export default function NavBar() {
  return (
    <header className="bg-white border-b border-slate-200">
      <nav className="max-w-4xl mx-auto flex items-center gap-2 px-4 h-14">
        <NavLink to="/" className="mr-4 font-bold text-slate-900 flex items-center gap-2">
          <span aria-hidden>🏦</span> Banking Platform
        </NavLink>
        <NavLink to="/" end className={linkClass}>
          Accounts
        </NavLink>
        <NavLink to="/transfer" className={linkClass}>
          Transfer
        </NavLink>
      </nav>
    </header>
  );
}
