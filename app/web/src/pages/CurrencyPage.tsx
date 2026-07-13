import { useState, useEffect } from 'react';

interface FlightLog {
  id: string;
  date: string;
  aircraft: string;
  dayLandings: number;
  nightLandings: number;
  approaches: number;
  holding: boolean;
}

const STORAGE_KEY = 'skybroe_flight_log';
const REVIEW_KEY = 'skybroe_flight_review';

function loadLogs(): FlightLog[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveLogs(logs: FlightLog[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

interface Currency {
  dayOk: boolean;
  dayCount: number;
  dayExpires: Date | null;
  nightOk: boolean;
  nightCount: number;
  nightExpires: Date | null;
  ifrOk: boolean;
  approachCount: number;
  hasHolding: boolean;
  ifrExpires: Date | null;
  reviewOk: boolean;
  reviewDate: Date | null;
  reviewExpires: Date | null;
}

function calcCurrency(logs: FlightLog[], reviewDateStr: string | null): Currency {
  const now = new Date();
  const cutoff90 = new Date(now); cutoff90.setDate(cutoff90.getDate() - 90);
  const cutoff6mo = addMonths(now, -6);
  const cutoff24mo = addMonths(now, -24);

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const recent90 = sorted.filter((l) => new Date(l.date) >= cutoff90);
  const recent6mo = sorted.filter((l) => new Date(l.date) >= cutoff6mo);

  const dayCount = recent90.reduce((s, l) => s + l.dayLandings, 0);
  const nightCount = recent90.reduce((s, l) => s + l.nightLandings, 0);
  const approachCount = recent6mo.reduce((s, l) => s + l.approaches, 0);
  const hasHolding = recent6mo.some((l) => l.holding);

  // Expiry = date of 3rd-most-recent relevant landing + 90 days
  const dayLandingDates = sorted
    .flatMap((l) => Array(l.dayLandings).fill(l.date) as string[])
    .slice(-3);
  const nightLandingDates = sorted
    .flatMap((l) => Array(l.nightLandings).fill(l.date) as string[])
    .slice(-3);
  const approachDates = sorted
    .flatMap((l) => Array(l.approaches).fill(l.date) as string[])
    .slice(-6);

  const dayExpires =
    dayLandingDates.length >= 3
      ? new Date(new Date(dayLandingDates[0]).getTime() + 90 * 86400000)
      : null;
  const nightExpires =
    nightLandingDates.length >= 3
      ? new Date(new Date(nightLandingDates[0]).getTime() + 90 * 86400000)
      : null;
  const ifrExpires =
    approachDates.length >= 6
      ? addMonths(new Date(approachDates[0]), 6)
      : null;

  const reviewDate = reviewDateStr ? new Date(reviewDateStr) : null;
  const reviewExpires = reviewDate ? addMonths(reviewDate, 24) : null;

  return {
    dayOk: dayCount >= 3,
    dayCount,
    dayExpires,
    nightOk: nightCount >= 3,
    nightCount,
    nightExpires,
    ifrOk: approachCount >= 6 && hasHolding && new Date(approachDates[0] ?? '1970') >= cutoff6mo,
    approachCount,
    hasHolding,
    ifrExpires,
    reviewOk: !!reviewDate && reviewDate >= cutoff24mo,
    reviewDate,
    reviewExpires,
  };
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
        ok
          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
          : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
      }`}
    >
      <span>{ok ? '✓' : '✗'}</span>
      {label}
    </span>
  );
}

const EMPTY_ENTRY = {
  date: new Date().toISOString().slice(0, 10),
  aircraft: '',
  dayLandings: 0,
  nightLandings: 0,
  approaches: 0,
  holding: false,
};

export default function CurrencyPage() {
  const [logs, setLogs] = useState<FlightLog[]>(loadLogs);
  const [form, setForm] = useState({ ...EMPTY_ENTRY });
  const [reviewInput, setReviewInput] = useState(
    () => localStorage.getItem(REVIEW_KEY) ?? ''
  );
  // Committed review date — drives the status card; updated on Save so the UI re-renders.
  const [savedReview, setSavedReview] = useState(
    () => localStorage.getItem(REVIEW_KEY) ?? ''
  );
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    saveLogs(logs);
  }, [logs]);

  function addEntry() {
    if (!form.date) return;
    const entry: FlightLog = {
      id: crypto.randomUUID(),
      date: form.date,
      aircraft: form.aircraft.trim().toUpperCase(),
      dayLandings: Number(form.dayLandings),
      nightLandings: Number(form.nightLandings),
      approaches: Number(form.approaches),
      holding: form.holding,
    };
    setLogs((prev) => [...prev, entry].sort((a, b) => b.date.localeCompare(a.date)));
    setForm({ ...EMPTY_ENTRY });
    setShowForm(false);
  }

  function removeEntry(id: string) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  function saveReview() {
    if (reviewInput) {
      localStorage.setItem(REVIEW_KEY, reviewInput);
    } else {
      localStorage.removeItem(REVIEW_KEY);
    }
    setSavedReview(reviewInput);
  }

  const cur = calcCurrency(logs, savedReview);

  const statusCards = [
    {
      label: 'Day VFR Pax',
      subtitle: '3 landings / 90 days',
      ok: cur.dayOk,
      detail: `${cur.dayCount}/3 landings`,
      expires: cur.dayExpires,
    },
    {
      label: 'Night VFR Pax',
      subtitle: '3 full-stop night landings / 90 days',
      ok: cur.nightOk,
      detail: `${cur.nightCount}/3 night landings`,
      expires: cur.nightExpires,
    },
    {
      label: 'IFR',
      subtitle: '6 approaches + hold / 6 months',
      ok: cur.ifrOk,
      detail: `${cur.approachCount}/6 approaches · hold: ${cur.hasHolding ? 'yes' : 'no'}`,
      expires: cur.ifrExpires,
    },
    {
      label: 'Flight Review',
      subtitle: 'Every 24 calendar months',
      ok: cur.reviewOk,
      detail: cur.reviewDate ? `Last: ${cur.reviewDate.toLocaleDateString()}` : 'Not logged',
      expires: cur.reviewExpires,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Currency Tracker</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          FAR 61 currency — stored on this device only
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {statusCards.map((card) => {
          const days = card.expires ? daysUntil(card.expires) : null;
          return (
            <div
              key={card.label}
              className={`rounded-xl border p-4 ${
                card.ok
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950'
                  : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-semibold text-sm">{card.label}</span>
                <StatusBadge ok={card.ok} label={card.ok ? 'Current' : 'Not Current'} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{card.subtitle}</p>
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300">{card.detail}</p>
              {days !== null && (
                <p
                  className={`text-xs mt-1 font-medium ${
                    days < 0
                      ? 'text-red-500'
                      : days < 14
                      ? 'text-orange-500'
                      : 'text-slate-400'
                  }`}
                >
                  {days < 0
                    ? `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`
                    : `Expires in ${days} day${days !== 1 ? 's' : ''}`}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-sm font-semibold mb-3">Last Flight Review / IPC</h2>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Date</label>
            <input
              type="date"
              className="input w-full"
              value={reviewInput}
              onChange={(e) => setReviewInput(e.target.value)}
            />
          </div>
          <button onClick={saveReview} className="btn-secondary text-sm">
            Save
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Flight Log</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="btn-primary text-xs py-1 px-3"
          >
            {showForm ? 'Cancel' : '+ Add Entry'}
          </button>
        </div>

        {showForm && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-slate-100 dark:border-slate-700 pt-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Date</label>
              <input
                type="date"
                className="input w-full"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Aircraft</label>
              <input
                className="input w-full"
                placeholder="N12345"
                value={form.aircraft}
                onChange={(e) => setForm((f) => ({ ...f, aircraft: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Day Ldg</label>
              <input
                type="number"
                className="input w-full"
                min={0}
                value={form.dayLandings}
                onChange={(e) => setForm((f) => ({ ...f, dayLandings: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Night Ldg</label>
              <input
                type="number"
                className="input w-full"
                min={0}
                value={form.nightLandings}
                onChange={(e) => setForm((f) => ({ ...f, nightLandings: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Approaches</label>
              <input
                type="number"
                className="input w-full"
                min={0}
                value={form.approaches}
                onChange={(e) => setForm((f) => ({ ...f, approaches: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.holding}
                  onChange={(e) => setForm((f) => ({ ...f, holding: e.target.checked }))}
                  className="w-4 h-4 accent-blue-500"
                />
                Holding procedure
              </label>
            </div>
            <div className="col-span-2 sm:col-span-3 flex justify-end">
              <button onClick={addEntry} className="btn-primary text-sm">
                Add to Log
              </button>
            </div>
          </div>
        )}

        {logs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            No entries yet. Add your recent flights to track currency.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  {['Date', 'Aircraft', 'Day', 'Night', 'Appr', 'Hold', ''].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2 px-2 font-semibold text-slate-400 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-2 font-mono">{l.date}</td>
                    <td className="py-2 px-2 font-mono">{l.aircraft || '—'}</td>
                    <td className="py-2 px-2">{l.dayLandings || '—'}</td>
                    <td className="py-2 px-2">{l.nightLandings || '—'}</td>
                    <td className="py-2 px-2">{l.approaches || '—'}</td>
                    <td className="py-2 px-2">{l.holding ? 'Y' : '—'}</td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => removeEntry(l.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors text-base leading-none"
                        aria-label="Delete"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
