import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!token) { setError('Invalid reset link.'); return; }

    setSubmitting(true);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✈</span>
          <span className="font-bold text-lg tracking-tight">
            Sky<span className="text-blue-400">Broe</span>
          </span>
        </div>

        {!token ? (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">Invalid or missing reset token.</p>
            <button onClick={() => navigate('/')} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              ← Back to login
            </button>
          </div>
        ) : done ? (
          <div className="space-y-4">
            <div className="bg-green-950 border border-green-800 rounded-lg px-4 py-3">
              <p className="text-green-400 text-sm font-medium">Password updated successfully.</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              Log in
            </button>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-lg font-bold">Set new password</h1>
              <p className="text-slate-400 text-sm mt-1">Must be at least 8 characters.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="Repeat password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs bg-red-950 border border-red-900 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {submitting ? 'Updating…' : 'Set new password'}
              </button>
            </form>

            <button onClick={() => navigate('/')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              ← Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
