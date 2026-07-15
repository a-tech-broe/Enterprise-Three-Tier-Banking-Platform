// Money is integer minor units (cents) end to end. Format for display only.
export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

// Parse a user-entered amount like "12.34" into integer cents.
export function toCents(amount: string): number {
  const n = Number.parseFloat(amount);
  if (Number.isNaN(n) || n <= 0) throw new Error('Enter a positive amount');
  return Math.round(n * 100);
}

// Compact, human "when": "just now", "5m ago", "3h ago", then a short date.
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
