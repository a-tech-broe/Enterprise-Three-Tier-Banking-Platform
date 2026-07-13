import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const FEATURES = [
  { icon: '🌦', title: 'Live Weather', desc: 'METAR · TAF · PIREPs · SIGMETs · AIRMETs with VFR/MVFR/IFR/LIFR colour coding' },
  { icon: '🗺', title: 'Weather Map', desc: 'Interactive map of all METAR stations with SIGMET and TFR overlays' },
  { icon: '⚠️', title: 'NOTAMs', desc: 'Full-text NOTAM lookup via the FAA API — always current' },
  { icon: '✈️', title: 'Airports', desc: 'Runways, IAP plates, density altitude, sunrise/sunset, nearby alternates' },
  { icon: '📋', title: 'Route Briefing', desc: 'DEP → DEST → ALT preflight strip with weather and NOTAM count per station' },
  { icon: '📝', title: 'Currency Tracker', desc: 'FAR 61 day/night/IFR/flight-review currency stored privately on your device' },
];

type Mode = 'register' | 'login' | 'forgot';

export default function LandingPage() {
  const { user, loading, register, login } = useAuth();

  const [mode, setMode] = useState<Mode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  if (!loading && user) return <Navigate to="/weather" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'forgot') {
      setSubmitting(true);
      try {
        await api.auth.forgotPassword(email);
        setForgotSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'register' && password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✈</span>
          <span className="font-bold text-lg tracking-tight">
            Sky<span className="text-blue-400">Broe</span>
          </span>
          <span className="text-slate-500 text-xs ml-1">by ATechBroe</span>
        </div>
        <button
          onClick={() => { setMode(m => (m === 'login' || m === 'forgot') ? 'register' : 'login'); setError(''); setForgotSent(false); }}
          className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
        >
          {mode === 'register' ? 'Log in' : 'Create account'}
        </button>
      </header>

      {/* ── Hero + form ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-6 py-16 gap-16">

        {/* Left — hero */}
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-4">
            Free for student pilots, crews &amp; ops
          </p>
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-6">
            Your preflight briefing,<br />
            <span className="text-blue-400">all in one place.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-12 max-w-lg">
            Live weather, NOTAMs, airport data, winds aloft, and an interactive
            weather map — everything you need from departure to alternate.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="flex gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4"
              >
                <span className="text-2xl flex-shrink-0">{f.icon}</span>
                <div>
                  <p className="font-semibold text-sm text-slate-100 mb-0.5">{f.title}</p>
                  <p className="text-xs text-slate-500 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — auth form */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sticky top-8">

            {/* Tab toggle — hidden in forgot mode */}
            {mode !== 'forgot' && (
              <div className="flex rounded-lg bg-slate-800 p-1 mb-6">
                {(['register', 'login'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(''); }}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      mode === m
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m === 'register' ? 'Create account' : 'Log in'}
                  </button>
                ))}
              </div>
            )}

            {mode === 'forgot' ? (
              forgotSent ? (
                <div className="flex flex-col gap-4">
                  <div className="bg-green-950 border border-green-800 rounded-lg px-4 py-3">
                    <p className="text-green-400 text-sm font-medium">Check your email for a reset link.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setForgotSent(false); setError(''); }}
                    className="text-xs text-slate-500 hover:text-blue-400 transition-colors text-left"
                  >
                    ← Back to log in
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {error && (
                    <p className="text-red-400 text-xs bg-red-950 border border-red-900 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-colors mt-1"
                  >
                    {submitting ? 'Please wait…' : 'Send reset link'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    className="text-xs text-slate-500 hover:text-blue-400 transition-colors text-left"
                  >
                    ← Back to log in
                  </button>
                </form>
              )
            ) : (
              <>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
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

                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); }}
                      className="text-xs text-slate-500 hover:text-blue-400 transition-colors text-left"
                    >
                      Forgot password?
                    </button>
                  )}

                  {mode === 'register' && (
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
                  )}

                  {error && (
                    <p className="text-red-400 text-xs bg-red-950 border border-red-900 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-colors mt-1"
                  >
                    {submitting
                      ? 'Please wait…'
                      : mode === 'register' ? 'Create free account' : 'Log in'}
                  </button>
                </form>

                {mode === 'register' && (
                  <p className="text-xs text-slate-500 text-center mt-4">
                    No credit card required. Always free.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-600">
        Data from AviationWeather.gov · FAA NOTAM API · FAA d-TPP &nbsp;·&nbsp;
        Not for navigation — always file a full ATC briefing.
      </footer>
    </div>
  );
}
