/**
 * Verifies requirement 6: the exported workbook carries the logo top-left,
 * company details on the left and customer details on the right.
 * Pure Node — no expo imports, so it runs anywhere.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { unzipSync } from 'fflate';
import { buildQuotationSheet } from '../src/utils/quoteSheet';
import { stampImagesIntoXlsx } from '../src/services/excelChart';

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, extra?: unknown) {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { fail += 1; console.log(`  FAIL ${label}`, extra ?? ''); }
}

const logoDataUri = 'data:image/png;base64,' + fs.readFileSync('assets/images/logo.png').toString('base64');

const profile = {
  businessName: 'CATCHY DECORS',
  tagline: 'Curtains · Wallpapers · Furnishing',
  addressLine1: '12 MG Road',
  addressLine2: 'Kochi',
  addressLine3: 'Kerala 682001',
  addressLine4: '',
  phone: '9876543210',
  altPhone: '',
  email: 'hello@catchydecors.in',
  website: 'catchydecors.in',
  gstin: '32ABCDE1234F1Z5',
} as never;

const template = {
  showLogo: true,
  showSerialColumn: true,
  showAreaColumn: true,
  showTypeColumn: true,
  showFabricColumn: true,
  showWidthColumn: true,
  showHeightColumn: true,
  showUnitInQty: true,
  showSignature: true,
  taxLabel: 'GST',
  gstPercent: 18,
  validityDays: 15,
  terms: '50% advance',
  accentColor: '#FF7A00',
} as never;

const q = {
  id: 't1',
  quotation_number: 'CD-2026-0099',
  customer_id: 'c1',
  customer_name: 'Meena / Ravi Kumar',
  customer_phone: '9000000000',
  site_location: 'Kakkanad',
  quotation_date: '2026-09-26',
  status: 'draft',
  created_at: '2026-09-26T00:00:00.000Z',
  items: [
    { id: 'm1', customer_id: 'c1', area_name: 'Living', product_type: 'curtains', type: 'Eyelet', width: 100, height: 80, quantity: 5, price: 450, total: 2250, fabric_type: 'Cotton', fabric_area: 40 },
    { id: 'm2', customer_id: 'c1', area_name: 'Bedroom', product_type: 'wallpaper', type: 'Floral', width: 90, height: 80, quantity: 1, price: 3200, total: 3200, fabric_type: 'Vinyl', fabric_area: 50 },
  ],
  accessories: [
    { id: 'a1', customer_id: 'c1', area_name: 'Living', track_type: 'Aluminium Track', width: 100, quantity: 9, price: 120, total: 1080 },
  ],
  charges: [
    { id: 'k1', description: 'Fitting Charges', quantity: 3, price: 150, total: 450 },
    { id: 'k2', description: 'Stitching Charges', quantity: 5, price: 180, total: 900 },
  ],
  subtotal: 5450,
  accessories_total: 1080,
  other_charges: 1350,
  discount: 200,
  grand_total: 7680,
  charges_label: 'Other Charges',
  discount_label: 'Discount',
} as never;

const spec = buildQuotationSheet(q, profile, template, null, logoDataUri);
const headRowIdx = spec.aoa.findIndex((r) => r.some((c) => String(c) === 'Fabric Details'));
const head = (spec.aoa[headRowIdx] ?? []) as (string | number)[];
console.log('header:', JSON.stringify(head));
check('fabric column present in header (row ' + headRowIdx + ')', headRowIdx > 0 && head.includes('Fabric Details'));
check('logo did not write a base64 cell', !spec.aoa.some((r) => r.some((c) => String(c).startsWith('data:image'))));

// --- company left (col A) / customer right (col D-E) ---
const flat = spec.aoa.map((r) => r.map((c) => String(c)));
check('company name on the left', flat.some((r) => r[0] === 'CATCHY DECORS'), flat.slice(0, 8));
check('customer name on the right', flat.some((r) => r[3] === 'Customer' && r[4] === 'Meena / Ravi Kumar'), flat.slice(0, 8));
check('customer phone on the right', flat.some((r) => r[3] === 'Phone' && r[4] === '9000000000'));
check('logo area left blank above the text', flat.slice(0, 5).every((r) => r.every((c) => c === '')));

// --- logo really lands inside the xlsx package ---
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(spec.aoa), 'Quotation');
const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
const stamped = stampImagesIntoXlsx(base64, [{ dataUri: logoDataUri, from: { col: 0, row: 0 }, width: 116, height: 116 }]);
const bytes = Buffer.from(stamped, 'base64');
const entries = Object.keys(unzipSync(new Uint8Array(bytes)));
check('workbook still opens after stamping', !!XLSX.read(bytes, { type: 'buffer' }).SheetNames.length);
check('image part stored', entries.some((e) => e.startsWith('xl/media/')), entries.filter((e) => e.includes('media')));
check('drawing xml added', entries.some((e) => e.includes('drawing')), entries.filter((e) => e.includes('drawing')));

fs.writeFileSync('/home/user/excel-samples/CatchyDecors_logo_check.xlsx', bytes);
console.log(`\nExcel logo checks: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
