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
