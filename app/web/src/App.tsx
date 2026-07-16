import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import brandBg from './assets/brand-bg.jpg';
import NavBar from './components/NavBar';
import RequireAuth from './components/RequireAuth';
import AccountPage from './pages/AccountPage';
import AccountsPage from './pages/AccountsPage';
import AdminPage from './pages/AdminPage';
import CreateAccountPage from './pages/CreateAccountPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TransferPage from './pages/TransferPage';

/** The authenticated app shell: nav, page content (via Outlet), footer. */
function MainLayout() {
  const location = useLocation();
  return (
    <>
      <NavBar />
      {/* key on pathname replays the entrance animation on navigation */}
      <main key={location.pathname} className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-center text-xs text-slate-400 sm:px-6">
        Atechbroe Bank · secured with TLS · demo environment
      </footer>
    </>
  );
}

export default function App() {
  return (
    <div className="relative min-h-screen">
      {/* Brand watermark: the Atechbroe kiwi, held to a whisper so it never
          competes with content. A touch stronger on dark grounds to register. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center bg-fixed opacity-[0.10] dark:opacity-[0.14]"
        style={{ backgroundImage: `url(${brandBg})` }}
      />
      {/* Ambient brand glow behind the page content */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-brand-500/10 to-transparent dark:from-brand-500/10"
      />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Authenticated (layout route with a shared shell) */}
        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<AccountsPage />} />
          <Route path="/accounts/new" element={<CreateAccountPage />} />
          <Route path="/accounts/:id" element={<AccountPage />} />
          <Route path="/transfer" element={<TransferPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </div>
  );
}
