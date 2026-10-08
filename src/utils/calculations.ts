export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function round0(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function clampNonNeg(n: number): number {
  return n < 0 ? 0 : n;
}

/** Curtain: manual Part × (height + 12) / 40 — output in metres. */
export function calculateCurtainQty(part: unknown, height: unknown): number {
  const p = clampNonNeg(toNum(part));
  const h = clampNonNeg(toNum(height));
  if (p === 0 || h === 0) return 0;
  return round2((p * (h + 12)) / 40);
}

/** Inch square-feet formula: (W × H) / 144. */
export function calculateSquareFeet(width: unknown, height: unknown): number {
  const w = clampNonNeg(toNum(width));
  const h = clampNonNeg(toNum(height));
  if (w === 0 || h === 0) return 0;
  return round2((w * h) / 144);
}

/** MM square-feet approximation requested by business: W × H / 305 / 305. */
export function calculateSquareFeetMm(width: unknown, height: unknown): number {
  const w = clampNonNeg(toNum(width));
  const h = clampNonNeg(toNum(height));
  if (w === 0 || h === 0) return 0;
  return round2((w * h) / 305 / 305);
}

/** Wallpaper: area = (W × H) / 144 sq.ft.
 * Normal wallpaper is sold by full rolls: 1 roll = 50 sq.ft, rounded up.
 * Customize wallpaper continues to use sq.ft quantity.
 */
export function calculateWallpaperQty(
  width: unknown,
  height: unknown,
  _legacyBonus = false,
  type: 'Customize' | 'Normal Wallpaper' | 'Normal' = 'Customize'
): { base: number; qty: number; bonusApplied: boolean; eligible: boolean } {
  const area = calculateSquareFeet(width, height);
  const isNormal = type === 'Normal Wallpaper' || type === 'Normal';
  const qty = isNormal && area > 0 ? Math.ceil(area / 50) : area;
  return { base: area, qty, bonusApplied: false, eligible: false };
}

export const WALLPAPER_BONUS_THRESHOLD_ROLLS = Number.POSITIVE_INFINITY;

/** Curtain track: W/12, business rounding to 0 / .5 / next whole. */
export function calculateAccessories(curtainWidth: unknown): number {
  const w = clampNonNeg(toNum(curtainWidth));
  if (w === 0) return 0;
  const raw = w / 12;
  const whole = Math.floor(raw);
  const fraction = raw - whole;
  // 0.0–0.1 => whole; >0.1–0.5 => half; >0.5 => next whole.
  const rounded = fraction <= 0.1 ? whole : fraction <= 0.5 ? whole + 0.5 : whole + 1;
  return round2(rounded);
}

export function calculateTotal(quantity: unknown, price: unknown): number {
  const q = clampNonNeg(toNum(quantity));
  const p = clampNonNeg(toNum(price));
  return round2(q * p);
}

/** Fitting: numberOfWindows * pricePerWindow */
export function calculateFitting(windows: unknown, pricePerWindow: unknown): number {
  const n = clampNonNeg(toNum(windows));
  const p = clampNonNeg(toNum(pricePerWindow));
  return round2(n * p);
}

/** Stitching: quantity is Curtain Parts (decimal supported), total = parts × price. */
export function calculateStitching(parts: unknown, price: unknown): { quantity: number; total: number } {
  const quantity = clampNonNeg(toNum(parts));
  const p = clampNonNeg(toNum(price));
  return { quantity, total: round2(quantity * p) };
}

export function calcQuantityFor(
  formula: 'curtain' | 'square_feet' | 'accessories' | 'wallpaper',
  width: unknown,
  height: unknown
): number {
  switch (formula) {
    case 'curtain':
      // For curtain callers the first argument represents Parts, not physical width.
      return calculateCurtainQty(width, height);
    case 'square_feet':
      return calculateSquareFeet(width, height);
    case 'accessories':
      return calculateAccessories(width);
    case 'wallpaper':
      // (without bonus) — kept for legacy callers; UI uses calculateWallpaperQty.
      return calculateWallpaperQty(width, height, false).qty;
    default:
      return 0;
  }
}
