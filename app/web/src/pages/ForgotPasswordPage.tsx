import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import AuthShell from '../components/AuthShell';
import { Notice, Spinner } from '../components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.forgotPassword(email.trim());
      setMessage(res.message);
      setDemoToken(res.reset_token); // demo only; normally emailed
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we’ll send a reset link."
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Back to sign in
        </Link>
      }
    >
      {message ? (
        <div className="space-y-4">
          <Notice tone="success">{message}</Notice>
          {demoToken && (
            <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm dark:border-slate-700">
              <p className="text-slate-500 dark:text-slate-400">
                Demo environment — no email is sent. Continue with your reset link:
              </p>
              <Link
                to={`/reset-password?token=${encodeURIComponent(demoToken)}`}
                className="btn-primary mt-3 w-full"
              >
                Continue to reset
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              required
            />
          </label>
          <button className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner />}
            Send reset link
          </button>
          {error && <Notice tone="error">{error}</Notice>}
        </form>
      )}
    </AuthShell>
  );
}
