import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import AuthShell from '../components/AuthShell';
import { Notice, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const nav = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await register(email.trim(), fullName.trim(), password);
      nav('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create account');
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Open your Atechbroe Bank profile in seconds."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="label">Full name</span>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ada Lovelace"
            autoComplete="name"
            autoFocus
            required
          />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </label>
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner />}
          Create account
        </button>
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </AuthShell>
  );
}
