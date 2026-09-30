/**
 * Charge engine — pure, storage-free, so it can be unit-tested in plain Node.
 *
 * Every value here is user-editable on screen:
 *   fitting   → windows × price/window
 *   stitching → quantity (auto = width / 20, overridable) × price
 *   transport → amount
 *   additional→ description + amount
 *   extras[]  → any number of individual description + amount rows
 *   discount  → amount (subtracted)
 */
import { calculateFitting, calculateStitching, round2 } from './calculations';
import type { OtherCharge } from '../types/measurement';

/** One user-added extra charge row (its own label + its own amount box). */
export interface ExtraChargeRow {
  id: string;
  description: string;
  amount: string;
}

export interface ChargesBundle {
  /** Printed label for the fitting row ("" = built-in name). */
  fittingDesc: string;
  fittingWindows: string;
  fittingPrice: string;
  /** Printed label for the stitching row ("" = built-in name). */
  stitchingDesc: string;
  /** Curtain width in inches — the default input for the stitching quantity. */
  stitchingWidth: string;
  /** Editable stitching quantity (mtr). '' = follow the formula (width / 20). */
  stitchingQty: string;
  stitchingPrice: string;
  /** Printed label for the transport row ("" = built-in name). */
  transportDesc: string;
  transport: string;
  additionalDesc: string;
  additionalAmount: string;
  /** Individually editable extra charge rows. */
  extras: ExtraChargeRow[];
  /** Optional description box replacing the summed "Other Charges" line on documents. */
  descBox: string;
  discount: string;
  /** Optional description box replacing the "Discount" line on documents. */
  discDesc: string;
}

export interface ChargeTotals {
  fitting: number;
  stitching: number;
  transport: number;
  additional: number;
  extras: number;
  discount: number;
}

/** A neutral, fully-empty bundle — also the shape legacy callers should adopt. */
export function emptyChargesBundle(): ChargesBundle {
  return {
    fittingDesc: '',
    fittingWindows: '',
    fittingPrice: '',
    stitchingDesc: '',
    stitchingWidth: '',
    stitchingQty: '',
    stitchingPrice: '',
    transportDesc: '',
    transport: '',
    additionalDesc: '',
    additionalAmount: '',
    extras: [],
    descBox: '',
    discount: '',
    discDesc: 'Discount',
  };
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return `xc-${Date.now().toString(36)}-${seq}`;
}

/** Create a blank extra-charge row. */
export function newExtraRow(description = '', amount = ''): ExtraChargeRow {
  return { id: nextId(), description, amount };
}

/** Fix a partially-deserialised bundle (legacy records lack stitchingQty / extras). */
export function normalizeBundle(input: Partial<ChargesBundle> | null | undefined): ChargesBundle {
  const base = emptyChargesBundle();
  const b = input ?? {};
  return {
    ...base,
    ...b,
    fittingDesc: b.fittingDesc ?? '',
    stitchingDesc: b.stitchingDesc ?? '',
    transportDesc: b.transportDesc ?? '',
    stitchingWidth: b.stitchingWidth ?? '',
    stitchingQty: b.stitchingQty ?? '',
    transport: b.transport ?? '',
    additionalDesc: b.additionalDesc ?? '',
    additionalAmount: b.additionalAmount ?? '',
    descBox: b.descBox ?? '',
    discount: b.discount ?? '',
    discDesc: b.discDesc ?? 'Discount',
    extras: Array.isArray(b.extras)
      ? b.extras.map((r) => ({
          id: r?.id ?? nextId(),
          description: r?.description ?? '',
          amount: r?.amount ?? '',
        }))
      : [],
  };
}

/** Quantity shown for stitching: the override when given, else width / 20. */
export function stitchingQuantity(bundle: Partial<ChargesBundle>): number {
  const override = String(bundle.stitchingQty ?? '').trim();
  if (override !== '') return round2(Math.max(0, Number(override) || 0));
  return calculateStitching(bundle.stitchingWidth, 1).quantity;
}

/** Turn the editable bundle into stored charge rows + totals. */
export function buildCharges(bundleInput: ChargesBundle): { charges: OtherCharge[]; totals: ChargeTotals } {
  const bundle = normalizeBundle(bundleInput);

  const fitting = calculateFitting(bundle.fittingWindows, bundle.fittingPrice);
  const stitchingQty = stitchingQuantity(bundle);
  const stitchingPrice = Math.max(0, Number(bundle.stitchingPrice) || 0);
  const stitching = round2(stitchingQty * stitchingPrice);
  const transport = round2(Math.max(0, Number(bundle.transport) || 0));
  const additional = round2(Math.max(0, Number(bundle.additionalAmount) || 0));
  const discount = round2(Math.max(0, Number(bundle.discount) || 0));

  const extras = bundle.extras
    .map((r) => ({
      id: r.id,
      description: String(r.description ?? '').trim(),
      amount: round2(Number(r.amount) || 0),
    }))
    .filter((r) => r.amount !== 0 || r.description !== '');
  const extrasTotal = round2(extras.reduce((s, r) => s + r.amount, 0));

  const charges: OtherCharge[] = [];
  if (fitting > 0) {
    charges.push({
      id: nextId(),
      description: bundle.fittingDesc.trim() || 'Fitting Charges',
      quantity: Number(bundle.fittingWindows) || 0,
      price: Number(bundle.fittingPrice) || 0,
      total: fitting,
    });
  }
  if (stitching > 0) {
    charges.push({
      id: nextId(),
      description: bundle.stitchingDesc.trim() || 'Stitching Charges',
      quantity: stitchingQty,
      price: stitchingPrice,
      total: stitching,
    });
  }
  if (transport > 0) {
    charges.push({
      id: nextId(),
      description: bundle.transportDesc.trim() || 'Transport Charges',
      quantity: 1,
      price: transport,
      total: transport,
    });
  }
  if (additional > 0) {
    charges.push({
      id: nextId(),
      description: bundle.additionalDesc || 'Additional Charges',
      quantity: 1,
      price: additional,
      total: additional,
    });
  }
  for (const row of extras) {
    if (row.amount === 0) continue;
    charges.push({
      id: nextId(),
      description: row.description || 'Extra Charges',
      quantity: 1,
      price: row.amount,
      total: row.amount,
    });
  }
  if (discount > 0) {
    charges.push({ id: nextId(), description: 'Discount', quantity: 1, price: -discount, total: -discount });
  }

  return {
    charges,
    totals: { fitting, stitching, transport, additional, extras: extrasTotal, discount },
  };
}

/** Sum of every charge except the discount — stored as `other_charges`. */
export function otherChargesTotalFrom(totals: Partial<ChargeTotals>): number {
  return round2(
    (totals.fitting ?? 0) +
      (totals.stitching ?? 0) +
      (totals.transport ?? 0) +
      (totals.additional ?? 0) +
      (totals.extras ?? 0)
  );
}

/** Grand total = products + accessories + all charges − discount. */
export function computeGrandTotal(
  subtotal: number,
  accTotal: number,
  charges: Partial<ChargeTotals>
): number {
  return round2(
    subtotal +
      accTotal +
      (charges.fitting ?? 0) +
      (charges.stitching ?? 0) +
      (charges.transport ?? 0) +
      (charges.additional ?? 0) +
      (charges.extras ?? 0) -
      (charges.discount ?? 0)
  );
}

/** Re-derive an editable bundle from stored charge rows (round-trips extras). */
const isFitting = (c: OtherCharge) => /fitt?ing|install/i.test(c.description);
const isStitching = (c: OtherCharge) => /stitch/i.test(c.description);
const isTransport = (c: OtherCharge) => /transport|freight|deliver/i.test(c.description);
const isDiscount = (c: OtherCharge) => /discount|rebate/i.test(c.description);
/** Anything that is not one of the four built-in rows is an Additional / Extra charge. */
const isCustom = (c: OtherCharge) =>
  !isFitting(c) && !isStitching(c) && !isTransport(c) && !isDiscount(c);

/** Printed label helper: '' means "use the built-in name", otherwise the user's label. */
function keepLabel(description: string | undefined, builtin: string): string {
  const d = (description ?? '').trim();
  return d && d !== builtin ? d : '';
}

/** Re-derive an editable bundle from stored charge rows (labels + quantities included). */
export function bundleFromCharges(charges: OtherCharge[] | null | undefined): ChargesBundle {
  const list = charges ?? [];
  const fitting = list.find(isFitting);
  const stitching = list.find(isStitching);
  const transport = list.find(isTransport);
  const discount = list.find(isDiscount);
  const additional = list.find(isCustom);

  return {
    fittingDesc: keepLabel(fitting?.description, 'Fitting Charges'),
    fittingWindows: fitting ? String(fitting.quantity) : '',
    fittingPrice: fitting ? String(fitting.price) : '',
    stitchingDesc: keepLabel(stitching?.description, 'Stitching Charges'),
    // width is the inverse of the width / 20 stitching formula
    stitchingWidth: stitching ? String(round2(stitching.quantity * 20)) : '',
    stitchingQty: stitching ? String(stitching.quantity) : '',
    stitchingPrice: stitching ? String(stitching.price) : '',
    transportDesc: keepLabel(transport?.description, 'Transport Charges'),
    transport: transport ? String(transport.price) : '',
    additionalDesc: additional?.description ?? '',
    additionalAmount: additional ? String(additional.total) : '',
    extras: [],
    descBox: '',
    discount: discount ? String(Math.abs(discount.total)) : '',
    discDesc: keepLabel(discount?.description, 'Discount') || 'Discount',
  };
}

/**
 * Bundle for a charge list that may contain many extra rows (legacy-safe).
 *
 * The FIRST non-standard row is treated as the labelled "Additional" charge
 * (matching what buildCharges writes); every further row becomes an individual
 * extra-charge box, so a saved quotation round-trips exactly as it was entered.
 */
export function bundleFromChargesWithExtras(charges: OtherCharge[] | null | undefined): ChargesBundle {
  const list = charges ?? [];
  const bundle = bundleFromCharges(list);
  const custom = list.filter(isCustom);
  const [first, ...rest] = custom;
  return {
    ...bundle,
    additionalDesc: first?.description ?? '',
    additionalAmount: first ? String(first.total) : '',
    extras: rest.map((c, i) => ({
      id: `x${i}-${c.id}`,
      description: c.description,
      amount: String(c.total),
    })),
  };
}

/** Suggest the next free document label ("Discount", "Discount 2", ...). */
export function nextLabel(existing: (string | undefined | null)[], base: string): string {
  const used = new Set(existing.map((v) => String(v ?? '').trim()).filter(Boolean));
  if (!used.has(base)) return base;
  for (let i = 2; i < 999; i += 1) {
    const candidate = `${base} ${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return base;
}
