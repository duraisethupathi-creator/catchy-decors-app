/**
 * Node-only test for the charge engine: editable stitching quantity,
 * individually editable extra-charge rows, totals and GST.
 */
declare const require: any;

import {
  buildCharges,
  computeGrandTotal,
  otherChargesTotalFrom,
  bundleFromChargesWithExtras,
  emptyChargesBundle,
  newExtraRow,
  stitchingQuantity,
  type ChargesBundle,
} from '../src/utils/charges';
import { round2 } from '../src/utils/calculations';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}

/* ---------- 1. stitching quantity is user-editable ---------- */
const stitchingBundle: ChargesBundle = {
  ...emptyChargesBundle(),
  stitchingWidth: '120',
  stitchingQty: '',
  stitchingPrice: '20',
};
check('stitching auto qty = width/20 (120 → 60)', stitchingQuantity(stitchingBundle), 6);
check('stitching auto total 60 × 20', buildCharges(stitchingBundle).totals.stitching, 120);

const editedStitching: ChargesBundle = { ...stitchingBundle, stitchingQty: '45' };
check('stitching edited qty (45)', stitchingQuantity(editedStitching), 45);
check('stitching edited total 45 × 20', buildCharges(editedStitching).totals.stitching, 900);

const freeStitching: ChargesBundle = {
  ...emptyChargesBundle(),
  stitchingWidth: '',
  stitchingQty: '37.5',
  stitchingPrice: '12',
};
check('stitching with no width, manual qty 37.5 × 12', buildCharges(freeStitching).totals.stitching, 450);

/* ---------- 2. two individually editable extra-charge rows ---------- */
const withExtras: ChargesBundle = {
  ...emptyChargesBundle(),
  fittingWindows: '6',
  fittingPrice: '250',
  stitchingWidth: '120',
  stitchingQty: '45',
  stitchingPrice: '20',
  transport: '500',
  additionalDesc: 'Material handling',
  additionalAmount: '300',
  extras: [newExtraRow('Packing & crating', '750'), newExtraRow('Rod bending', '1250')],
  discount: '500',
};

const built = buildCharges(withExtras);
check('fitting 6 × 250', built.totals.fitting, 1500);
check('stitching 45 × 20', built.totals.stitching, 900);
check('transport', built.totals.transport, 500);
check('additional (labelled)', built.totals.additional, 300);
check('extras total 750 + 1250', built.totals.extras, 2000);
check('discount', built.totals.discount, 500);

const otherCharges = otherChargesTotalFrom(built.totals);
check('other_charges = 1500+900+500+300+2000', otherCharges, 5200);

/* ---------- 3. grand total + GST ---------- */
const subtotal = 18750; // 4500 + 10500 + 3750
const accessoriesTotal = 3200; // 1100 + 2100
const grand = computeGrandTotal(subtotal, accessoriesTotal, built.totals);
check('grand total = 18750+3200+5200-500', grand, 26650);

const taxable = round2(subtotal + accessoriesTotal + otherCharges - built.totals.discount);
check('taxable value', taxable, 26650);
const gstAmount = round2((taxable * 18) / 100);
check('GST @ 18%', gstAmount, 4797);
check('CGST half', round2(gstAmount / 2), 2398.5);
check('SGST half', round2(gstAmount / 2), 2398.5);
check('grand total incl. GST', round2(taxable + gstAmount), 31447);

/* ---------- 4. stored rows carry both extra charges ---------- */
const extraRows = built.charges.filter(
  (c) => c.description === 'Packing & crating' || c.description === 'Rod bending'
);
check('two extra charge rows persisted', extraRows.length, 2);
check('extra rows carry their own amounts', extraRows.map((r) => r.total), [750, 1250]);
check(
  'charge row order',
  built.charges.map((c) => c.description),
  ['Fitting Charges', 'Stitching Charges', 'Transport Charges', 'Material handling', 'Packing & crating', 'Rod bending', 'Discount']
);

/* ---------- 5. round-trip: stored rows → editable bundle → rows ---------- */
const roundTrip = buildCharges(bundleFromChargesWithExtras(built.charges));
check('round-trip extras total', roundTrip.totals.extras, 2000);
check('round-trip stitching total', roundTrip.totals.stitching, 900);
check('round-trip fitting total', roundTrip.totals.fitting, 1500);
check('round-trip grand total matches', computeGrandTotal(subtotal, accessoriesTotal, roundTrip.totals), grand);

/* ---------- 6. legacy record without stitchingQty / extras still loads ---------- */
const legacy = buildCharges({ ...emptyChargesBundle(), stitchingWidth: '80', stitchingPrice: '15' });
check('legacy bundle (no extras field) loads', legacy.totals.extras, 0);
check('legacy stitching still auto-computes', legacy.totals.stitching, 60);

/* ---------- 7. blank rows never inflate totals ---------- */
const blanks = buildCharges({
  ...emptyChargesBundle(),
  extras: [newExtraRow('', ''), newExtraRow('Unpriced item', '')],
});
check('blank extra rows ignored in totals', blanks.totals.extras, 0);
check('blank extra rows produce no charge rows', blanks.charges.length, 0);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
