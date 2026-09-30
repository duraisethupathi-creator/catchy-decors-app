/**
 * Node-only check: the extra charges, the edited stitching value and the GST
 * figures must all appear in the printed document HTML.
 */
declare const require: any;

import { buildQuotationHtml, buildGstBillHtml } from '../src/services/pdfService';
import type { Quotation } from '../src/types/quotation';
import type { GstBillSettings } from '../src/services/pdfService';

const q: Quotation = {
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
    { id: 'm-1', customer_id: 'c-1', product_type: 'curtain_single' as never, area_name: 'Living Room', type: 'Eyelet', width: 60, height: 40, quantity: 3.75, price: 1200, total: 4500 },
  ],
  accessories: [
    { id: 'a-1', customer_id: 'c-1', area_name: 'Living Room', track_type: 'Aluminium Track', width: 60, quantity: 5, price: 220, total: 1100 },
  ],
  charges: [
    { id: 'ch-1', description: 'Fitting Charges', quantity: 6, price: 250, total: 1500 },
    { id: 'ch-2', description: 'Stitching Charges', quantity: 45, price: 20, total: 900 },
    { id: 'ch-3', description: 'Transport Charges', quantity: 1, price: 500, total: 500 },
    { id: 'ch-4', description: 'Material handling', quantity: 1, price: 300, total: 300 },
    { id: 'ch-5', description: 'Packing & crating', quantity: 1, price: 750, total: 750 },
    { id: 'ch-6', description: 'Rod bending', quantity: 1, price: 1250, total: 1250 },
    { id: 'ch-7', description: 'Discount', quantity: 1, price: -500, total: -500 },
  ],
};

const gst: GstBillSettings = {
  enabled: true,
  percent: 18,
  invoiceNumber: 'INV-CD-2026-0007',
  company: { name: 'CATCHY DECORS', tagline: 'Transform Your Space Beautifully', addressLine1: '18th, 4th Cross,', addressLine2: 'Kamarajapuram,', addressLine3: 'Karur - 639002,', addressLine4: 'Tamil Nadu, India', phone: '9159194440', website: 'www.catchydecors.in', gstin: '33AAAAA0000A1Z5' },
  customer: { name: 'Meena / Ravi Kumar', phone: '9876543210', address: '12, Anna Nagar, Karur', site: 'Karur - 639002', gstin: '33BBBBB1111B1Z2' },
};

let pass = 0;
let fail = 0;
function expect(label: string, haystack: string, needle: string): void {
  const ok = haystack.includes(needle);
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (${needle})`);
}

const quotationHtml = buildQuotationHtml(q, null, undefined);
const gstHtml = buildGstBillHtml(q, gst, undefined);

console.log('--- quotation PDF ---');
for (const label of ['Fitting Charges', 'Stitching Charges', 'Transport Charges', 'Material handling', 'Packing &amp; crating', 'Rod bending']) {
  expect('quotation shows charge line', quotationHtml, label);
}
expect('quotation shows edited stitching qty 45', quotationHtml, '45');
expect('quotation grand total 26,650', quotationHtml, '26,650');

console.log('--- GST bill PDF ---');
for (const label of ['Material handling', 'Packing &amp; crating', 'Rod bending']) {
  expect('GST bill shows extra charge', gstHtml, label);
}
expect('GST bill invoice number', gstHtml, 'INV-CD-2026-0007');
expect('GST bill taxable 26,650', gstHtml, '26,650');
expect('GST bill tax 4,797', gstHtml, '4,797');
expect('GST bill grand total 31,447', gstHtml, '31,447');
console.log('GST bill mentions CGST:', gstHtml.includes('CGST'), '| SGST:', gstHtml.includes('SGST'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
