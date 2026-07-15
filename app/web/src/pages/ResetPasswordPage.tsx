import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import AuthShell from '../components/AuthShell';
import { Notice, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { resetPassword } = useAuth();
  const nav = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPassword(token, password);
      nav('/', { replace: true }); // reset signs you straight in
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password');
      setBusy(false);
    }
  }

  const footer = (
    <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
      Back to sign in
    </Link>
  );

  if (!token) {
    return (
      <AuthShell title="Reset your password" subtitle="This reset link is incomplete." footer={footer}>
        <Notice tone="error">
          Missing reset token. Request a new link from the{' '}
          <Link to="/forgot-password" className="font-semibold underline">
            forgot password
          </Link>{' '}
          page.
        </Notice>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Set a new password for your account." footer={footer}>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="label">New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            autoFocus
            required
          />
        </label>
        <label className="block">
          <span className="label">Confirm password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
            required
          />
        </label>
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner />}
          Reset password
        </button>
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </AuthShell>
  );
}
