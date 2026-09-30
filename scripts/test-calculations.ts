import { calculateCurtainQty, calculateSquareFeet, calculateAccessories, calculateTotal, calculateFitting, calculateStitching, calculateWallpaperBase, calculateWallpaperQty } from '../src/utils/calculations';
import { formatINR } from '../src/utils/currency';
import { isValidIndianMobile, validateCustomer } from '../src/utils/validation';
import { sha256 } from '../src/utils/sha256';
import { formatQuotationNumber, padSeq } from '../src/utils/numbering';
import { buildQuotationHtml } from '../src/services/pdfService';

let pass = 0;
let fail = 0;
function eq(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else {
    fail++;
    console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}

// ---- Curtain formula: ((w/20)*(h+10))/40 ----
eq('curtain 60x40 = 3.75', calculateCurtainQty(60, 40), 3.75); // (3 * 50)/40
eq('curtain 100x90 = 12.5', calculateCurtainQty(100, 90), 12.5); // (5 * 100)/40
eq('curtain 0 width = 0', calculateCurtainQty(0, 40), 0);
eq('curtain negative clamped', calculateCurtainQty(-60, 40), 0);
eq('curtain string input', calculateCurtainQty('60', '40'), 3.75);
eq('curtain NaN safe', calculateCurtainQty('abc', '40'), 0);

// ---- Square feet: (w*h)/144 ----
eq('sqft 12x12 = 1', calculateSquareFeet(12, 12), 1);
eq('sqft 144x144 = 144', calculateSquareFeet(144, 144), 144);
eq('sqft rounding 2dp', calculateSquareFeet(100, 100), 69.44); // 10000/144 = 69.444...
eq('sqft zero', calculateSquareFeet(0, 100), 0);

// ---- Accessories: w/12 ----
eq('accessories 24 = 2', calculateAccessories(24), 2);
eq('accessories 30 = 2.5', calculateAccessories(30), 2.5);
eq('accessories 0', calculateAccessories(0), 0);

// ---- Wallpaper: D = ((B × C) / 144) / 50 ----
eq('wallpaper 96x96 base 1.28', calculateWallpaperBase(96, 96), 1.28);
eq('wallpaper 96x96 qty ceil 2', calculateWallpaperQty(96, 96, false).qty, 2);
eq('wallpaper 120x96 bonus not eligible', calculateWallpaperQty(120, 96, true).bonusApplied, false);
eq('wallpaper 120x120 base exactly 2 eligible', calculateWallpaperQty(120, 120, false).eligible, true);
eq('wallpaper 120x120 qty 2 no bonus', calculateWallpaperQty(120, 120, false).qty, 2);
eq('wallpaper 120x120 qty 3 with bonus', calculateWallpaperQty(120, 120, true).qty, 3);
eq('wallpaper 144x120 base 2.4', calculateWallpaperBase(144, 120), 2.4);
eq('wallpaper 144x120 qty 3 no bonus', calculateWallpaperQty(144, 120, false).qty, 3);
eq('wallpaper 144x120 qty 4 with bonus', calculateWallpaperQty(144, 120, true).qty, 4);
eq('wallpaper zero dims', calculateWallpaperQty(0, 100, true).qty, 0);

// ---- Totals ----
eq('total 3.75 x 500', calculateTotal(3.75, 500), 1875);
eq('total invalid', calculateTotal('x', 500), 0);
eq('fitting 4 x 250', calculateFitting(4, 250), 1000);
eq('stitching 10in @100 (width/20)', calculateStitching(10, 100), { quantity: 0.5, total: 50 });
eq('stitching 100in @15', calculateStitching(100, 15), { quantity: 5, total: 75 });

// ---- Editable numbering template ----
const tpl = { prefix: 'CD', separator: '-', includeYear: true, padding: 4 };
eq('number CD-2026-0007', formatQuotationNumber(tpl, 7, 2026), 'CD-2026-0007');
eq('number no year', formatQuotationNumber({ ...tpl, includeYear: false }, 7, 2026), 'CD-0007');
eq('number custom separator', formatQuotationNumber({ ...tpl, separator: '/' }, 12, 2026), 'CD/2026/0012');
eq('number 6-digit padding', formatQuotationNumber({ ...tpl, padding: 6 }, 12, 2026), 'CD-2026-000012');
eq('number no prefix', formatQuotationNumber({ ...tpl, prefix: '' }, 3, 2026), '2026-0003');
eq('number padding floor', formatQuotationNumber({ ...tpl, padding: 1 }, 42, 2026), 'CD-2026-42');
eq('padSeq clamps upper bound', padSeq(1, 99), '00000001');
eq('padSeq clamps lower bound', padSeq(1, 0), '0001');

// ---- INR formatting ----
eq('inr 123456.5', formatINR(123456.5), '\u20B91,23,456.50');
eq('inr 100000', formatINR(100000), '\u20B91,00,000.00');
eq('inr 0', formatINR(0), '\u20B90.00');
eq('inr plain grouping', formatINR(5000), '\u20B95,000.00');

// ---- Validation ----
eq('mobile 9159194440 valid', isValidIndianMobile('9159194440'), true);
eq('mobile 8123456789 valid', isValidIndianMobile('8123456789'), true);
eq('mobile 1234567890 invalid', isValidIndianMobile('1234567890'), false);
eq('mobile 5-start invalid', isValidIndianMobile('5123456789'), false);
eq('mobile with +91 valid', isValidIndianMobile('+91 91591 94440'), true);
eq('customer errors', Object.keys(validateCustomer('', 'abc')).sort(), ['name', 'phone']);

// ---- SHA-256 known vector ----
eq('sha256(abc)', sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
eq('sha256(empty)', sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

// ---- PDF HTML builds with company data ----
const html = buildQuotationHtml({
  id: 'q1',
  quotation_number: 'CD-2026-0001',
  customer_id: 'c1',
  customer_name: 'Ramesh Kumar',
  customer_phone: '9159194440',
  quotation_date: '2026-09-07',
  subtotal: 1875,
  accessories_total: 500,
  other_charges: 1000,
  discount: 200,
  grand_total: 3175,
  status: 'draft',
  items: [{ id: 'm1', customer_id: 'c1', product_type: 'curtains', area_name: 'Hall Window', type: 'Eyelet', width: 60, height: 40, quantity: 3.75, price: 500, total: 1875 }],
  accessories: [],
  charges: [{ id: 'x1', description: 'Fitting Charges', quantity: 4, price: 250, total: 1000 }, { id: 'x2', description: 'Discount', quantity: 1, price: -200, total: -200 }],
});
eq('pdf has company name', html.includes('CATCHY DECORS'), true);
eq('pdf has address', html.includes('Karur - 639002'), true);
eq('pdf has phone', html.includes('9159194440'), true);
eq('pdf has website', html.includes('www.catchydecors.in'), true);
eq('pdf has quotation number', html.includes('CD-2026-0001'), true);
eq('pdf has grand total', html.includes('3,175.00'), true);
eq('pdf has curtain formula result', html.includes('3.75'), true);

// ---- Editable quotation: export must show EDITED values, not formula-recalculated ones ----
// Simulate the user overriding quantity 3.75 (formula default for 60x40) to 9.99 in the
// editable final-quotation screen. The PDF must contain the edited qty + recomputed total.
const editedQty = 9.99;
const editedTotal = calculateTotal(editedQty, 500); // 4,995.00 — recompute from edited value
const formulaQtyFor60x40 = calculateCurtainQty(60, 40); // 3.75 — the default an override replaces
const editedHtml = buildQuotationHtml({
  id: 'q1',
  quotation_number: 'CD-2026-0001',
  customer_id: 'c1',
  customer_name: 'Ramesh Kumar',
  customer_phone: '9159194440',
  quotation_date: '2026-09-13',
  subtotal: editedTotal,
  accessories_total: 0,
  other_charges: 0,
  discount: 0,
  grand_total: editedTotal,
  status: 'draft',
  items: [{ id: 'm1', customer_id: 'c1', product_type: 'curtains', area_name: 'Hall Window', type: 'Eyelet', width: 60, height: 40, quantity: editedQty, price: 500, total: editedTotal }],
  accessories: [],
  charges: [],
});
eq('edited qty 9.99 survives into PDF', editedHtml.includes('9.99'), true);
eq('edited total 4,995.00 in PDF', editedHtml.includes('4,995.00'), true);
eq('formula value not substituted back', editedHtml.includes('>3.75<'), false);
eq('formula default still available', formulaQtyFor60x40, 3.75);
eq('edited grand total recompute', editedTotal, 4995);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
