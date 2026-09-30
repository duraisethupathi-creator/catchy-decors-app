/** Indian currency formatting: 123456.5 -> "₹1,23,456.50" */
export function formatINR(value: unknown, withSymbol = true): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : parseFloat(String(value ?? '0'));
  const safe = Number.isFinite(n) ? n : 0;
  const neg = safe < 0;
  const fixed = Math.abs(roundTo2(safe)).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const formatted = formatIndianGrouping(intPart);
  const sym = withSymbol ? '\u20B9' : '';
  return `${neg ? '-' : ''}${sym}${formatted}.${decPart}`;
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatIndianGrouping(intStr: string): string {
  if (intStr.length <= 3) return intStr;
  const last3 = intStr.slice(-3);
  const rest = intStr.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

/** Format a number without currency symbol (for tables) */
export function formatNum(value: unknown): string {
  const n = toNumber(value);
  return String(roundTo2(n));
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

/** Date -> "12 Jan 2026" */
export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
