import { useRef, useState } from 'react';
import { api } from '../api/client';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect: (icao: string) => void;
  searchType: 'airport' | 'weather' | 'notam';
  placeholder?: string;
  maxLength?: number;
  loading?: boolean;
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  onSelect,
  searchType,
  placeholder = 'ICAO',
  maxLength = 4,
  loading = false,
  className = 'input w-40',
}: Props) {
  const [history, setHistory] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch history once on first focus
  async function fetchHistory() {
    if (fetched) return;
    setFetched(true);
    try {
      const items = await api.history.get(searchType);
      setHistory(items);
    } catch {
      // history is best-effort
    }
  }

  function handleFocus() {
    fetchHistory();
    setOpen(true);
  }

  function handleBlur() {
    // Delay so a mousedown on a list item registers before we close
    setTimeout(() => setOpen(false), 150);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value.toUpperCase());
    setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false);
  }

  function pick(icao: string) {
    setOpen(false);
    onSelect(icao);
  }

  const filtered = history.filter((h) =>
    value ? h.startsWith(value.toUpperCase()) : true
  );

  const showDropdown = open && filtered.length > 0 && !loading;

  return (
    <div ref={containerRef} className="relative">
      <input
        className={className}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        spellCheck={false}
      />

      {showDropdown && (
        <ul className="absolute z-50 top-full mt-1 left-0 min-w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
          {filtered.map((icao) => (
            <li key={icao}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(icao)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm font-mono hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <ClockIcon />
                {icao}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7v5l3 3" />
    </svg>
  );
}
