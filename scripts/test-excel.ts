/**
 * Node-only smoke test: builds a real .xlsx from a sample quotation and writes it
 * to /home/user/.tmp-excel/ so the workbook can be inspected (e.g. with openpyxl).
 */
declare const require: any;
declare const Buffer: any;

const fs = require('fs');

import { buildQuotationWorkbookBase64, excelFileName, gstInputFromQuotation } from '../src/services/excelService';
import type { Quotation } from '../src/types/quotation';

const quotation: Quotation = {
  id: 'q-1',
  quotation_number: 'CD-2026-0007',
  customer_id: 'c-1',
  customer_name: 'Meena / Ravi Kumar',
  customer_phone: '9876543210',
  quotation_date: '2026-09-25',
  subtotal: 18750,
  accessories_total: 3200,
  other_charges: 5200,
  discount: 500,
  grand_total: 26650,
  status: 'draft',
  site_location: 'Karur - 639002',
  items: [
    {
      id: 'm-1',
      customer_id: 'c-1',
      product_type: 'curtain_single' as never,
      area_name: 'Living Room',
      type: 'Eyelet',
      width: 60,
      height: 40,
      quantity: 3.75,
      price: 1200,
      total: 4500,
    },
    {
      id: 'm-2',
      customer_id: 'c-1',
      product_type: 'curtain_double' as never,
      area_name: 'Master Bedroom',
      type: 'Pleated',
      width: 84,
      height: 48,
      quantity: 7,
      price: 1500,
      total: 10500,
    },
    {
      id: 'm-3',
      customer_id: 'c-1',
      product_type: 'wallpaper' as never,
      area_name: 'Study Wall',
      type: 'Floral',
      width: 120,
      height: 96,
      quantity: 2,
      price: 1875,
      total: 3750,
    },
  ],
  accessories: [
    {
      id: 'a-1',
      customer_id: 'c-1',
      area_name: 'Living Room',
      track_type: 'Aluminium Track',
      width: 60,
      quantity: 5,
      price: 220,
      total: 1100,
    },
    {
      id: 'a-2',
      customer_id: 'c-1',
      area_name: 'Master Bedroom',
      track_type: 'Wooden Rod',
      width: 84,
      quantity: 7,
      price: 300,
      total: 2100,
    },
  ],
  // Edited stitching quantity (45 mtr instead of the auto width/2) + two individual extra charges.
  charges: [
    { id: 'ch-1', description: 'Fitting Charges', quantity: 6, price: 250, total: 1500 },
    { id: 'ch-2', description: 'Stitching Charges', quantity: 45, price: 20, total: 900 },
    { id: 'ch-3', description: 'Transport Charges', quantity: 1, price: 500, total: 500 },
    { id: 'ch-4', description: 'Material handling', quantity: 1, price: 300, total: 300 },
    { id: 'ch-5', description: 'Packing & crating', quantity: 1, price: 750, total: 750 },
    { id: 'ch-6', description: 'Rod bending', quantity: 1, price: 1250, total: 1250 },
    { id: 'ch-7', description: 'Discount', quantity: 1, price: -500, total: -500 },
  ],
  gst: {
    enabled: true,
    percent: 18,
    invoice_number: 'INV-CD-2026-0007',
    company: {
      name: 'CATCHY DECORS',
      tagline: 'Transform Your Space Beautifully',
      addressLine1: '18th, 4th Cross,',
      addressLine2: 'Kamarajapuram,',
      addressLine3: 'Karur - 639002,',
      addressLine4: 'Tamil Nadu, India',
      phone: '9159194440',
      website: 'www.catchydecors.in',
      gstin: '33AAAAA0000A1Z5',
    },
    customer: {
      name: 'Meena / Ravi Kumar',
      phone: '9876543210',
      address: '12, Anna Nagar, Karur',
      site: 'Karur - 639002',
      gstin: '33BBBBB1111B1Z2',
    },
  },
};

const gstInput = gstInputFromQuotation(quotation);

const outDir = '/home/user/.tmp-excel';
fs.mkdirSync(outDir, { recursive: true });

const results: { kind: 'quotation' | 'gst' | 'both'; file: string; bytes: number }[] = [];
for (const kind of ['quotation', 'gst', 'both'] as const) {
  const b64 = buildQuotationWorkbookBase64(quotation, undefined, gstInput, kind);
  const file = `${outDir}/${excelFileName(quotation, kind)}`;
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(file, buf);
  results.push({ kind, file, bytes: buf.length });
}

let failures = 0;
for (const r of results) {
  const ok = r.bytes > 4000; // a real workbook with 2 sheets is several KB
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  kind=${r.kind}  bytes=${r.bytes}  ${r.file}`);
}

// Sanity check: a valid xlsx is a ZIP archive (PK\x03\x04).
const first = results[0];
const head = fs.readFileSync(first.file).slice(0, 4).toString('hex');
const zipOk = head === '504b0304';
if (!zipOk) failures += 1;
console.log(`${zipOk ? 'PASS' : 'FAIL'}  zip signature ${head} (expected 504b0304)`);

console.log(failures === 0 ? '3/3 workbooks written' : `${failures} failure(s)`);
if (failures > 0) process.exit(1);
