/** Requirement 4: the company logo is drawn at the quotation's top-left. */
import { buildStandardQuotationHtml } from '../src/services/pdfService';

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}`, extra ?? ''); }
};

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const profile = { businessName: 'CATCHY DECORS', tagline: 'Curtains', addressLine1: '12 MG Road', addressLine2: 'Kochi', addressLine3: 'Kerala', addressLine4: '', phone: '9876543210', altPhone: '', email: 'a@b.in', website: 'catchydecors.in', gstin: '32ABCDE1234F1Z5' } as never;
const template = { showLogo: true, showSerialColumn: true, showAreaColumn: true, showTypeColumn: true, showFabricColumn: true, showWidthColumn: true, showHeightColumn: true, showUnitInQty: true, showSignature: true, taxLabel: 'GST', gstPercent: 18, validityDays: 15, terms: ['50% advance'], accentColor: '#FF7A00' } as never;
const q = { id: 't', quotation_number: 'CD-2026-0099', customer_id: 'c', customer_name: 'Meena / Ravi Kumar', customer_phone: '9000000000', site_location: 'Kakkanad', quotation_date: '2026-09-26', status: 'draft', created_at: '2026-09-26T00:00:00.000Z', items: [{ id: 'm1', customer_id: 'c', area_name: 'Living', product_type: 'curtains', type: 'Eyelet', width: 100, height: 80, quantity: 5, price: 450, total: 2250, fabric_type: 'Cotton', fabric_area: 40 }], accessories: [], charges: [], subtotal: 2250, accessories_total: 0, other_charges: 0, discount: 0, grand_total: 2250, charges_label: '', discount_label: 'Discount' } as never;

const html = buildStandardQuotationHtml(q, { profile, template, logoDataUri: LOGO } as never);

check('logo image rendered in the header', html.includes(`<img class="logo-img" src="${LOGO}"`));
const brandIdx = html.indexOf('<div class="brand">');
const logoIdx = html.indexOf('<img class="logo-img"');
const nameIdx = html.indexOf('<div class="brand-name">');
check('logo sits inside the brand block', brandIdx > -1 && logoIdx > brandIdx && logoIdx < nameIdx, { brandIdx, logoIdx, nameIdx });
check('logo is the first element of the brand block (top-left)', html.slice(brandIdx, logoIdx).replace(/\s/g, '') === '<divclass="brand">');
check('no absolute-position override on the logo', !/\.logo-img\s*\{[^}]*position:\s*absolute/.test(html));
check('fabric column header present', html.includes('Fabric Details'));
check('fabric value printed in the row', html.includes('Cotton') && html.includes('40 sq.ft'));
check('custom charge label honoured', buildStandardQuotationHtml({ ...(q as object), other_charges: 500, charges_label: 'Fabric total: curtains 5 mtr' } as never, { profile, template } as never).includes('Fabric total: curtains 5 mtr'));
console.log(`\nPDF logo checks: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
