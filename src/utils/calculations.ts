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

/** Curtain: manual Part × (height + 10) / 40 — output in metres. */
export function calculateCurtainQty(part: unknown, height: unknown): number {
  const p = clampNonNeg(toNum(part));
  const h = clampNonNeg(toNum(height));
  if (p === 0 || h === 0) return 0;
  return round2((p * (h + 10)) / 40);
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

/** Wallpaper (Customize/Normal): (W × H) / 144 sq.ft. */
export function calculateWallpaperQty(width: unknown, height: unknown, _legacyBonus = false): { base: number; qty: number; bonusApplied: boolean; eligible: boolean } {
  const qty = calculateSquareFeet(width, height);
  return { base: qty, qty, bonusApplied: false, eligible: false };
}

export const WALLPAPER_BONUS_THRESHOLD_ROLLS = Number.POSITIVE_INFINITY;

/** Accessories: curtainWidth / 12 — output is in RUNNING FEET (R.ft). */
export function calculateAccessories(curtainWidth: unknown): number {
  const w = clampNonNeg(toNum(curtainWidth));
  if (w === 0) return 0;
  return round2(w / 12);
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

/** Stitching: quantity = curtainWidth / 20, total = quantity * price */
export function calculateStitching(curtainWidth: unknown, price: unknown): { quantity: number; total: number } {
  const w = clampNonNeg(toNum(curtainWidth));
  const p = clampNonNeg(toNum(price));
  const quantity = w === 0 ? 0 : round2(w / 20);
  return { quantity, total: round2(quantity * p) };
}

export function calcQuantityFor(
  formula: 'curtain' | 'square_feet' | 'accessories' | 'wallpaper',
  width: unknown,
  height: unknown
): number {
  switch (formula) {
    case 'curtain':
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
