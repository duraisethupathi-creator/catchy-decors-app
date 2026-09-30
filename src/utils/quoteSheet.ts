/**
 * Pure spreadsheet builder for the Excel (.xlsx) export.
 *
 * No expo / no SheetJS imports here — this module only produces rows of values,
 * so it can be compiled and executed in plain Node for unit tests.
 */
import { profileToCompany } from '../constants/company';
import { getProduct } from '../constants/products';
import { round2 } from './calculations';
import { formatDate } from './currency';
import type { Quotation } from '../types/quotation';
import type { CompanyProfile, QuotationTemplate } from '../types/settings';

export interface SheetSpec {
  name: string;
  aoa: (string | number)[][];
  /** 0-based coordinates of currency cells, so the writer can apply a number format. */
  money: { r: number; c: number }[];
  /** Column widths (characters). */
  widths: number[];
}

/** Values the caller may override on the billing sheet (mirrors GstBillSettings). */
export interface SheetGstInput {
  enabled: boolean;
  percent: number;
  invoiceNumber?: string;
  company?: Partial<{
    name: string;
    tagline: string;
    addressLine1: string;
    addressLine2: string;
    addressLine3: string;
    addressLine4: string;
    phone: string;
    website: string;
    gstin: string;
  }>;
  customer?: Partial<{ name: string; phone: string; address: string; site: string; gstin: string }>;
}

/** Label helper: printed label falls back to the built-in name. */
function labelOf(v: string | undefined, fallback: string): string {
  return (v ?? '').trim() || fallback;
}

class RowWriter {
  aoa: (string | number)[][] = [];
  money: { r: number; c: number }[] = [];

  push(cells: (string | number)[], moneyCols: number[] = []): number {
    const r = this.aoa.length;
    this.aoa.push(cells);
    for (const c of moneyCols) if (typeof cells[c] === 'number') this.money.push({ r, c });
    return r;
  }

  blank(): void {
    this.aoa.push([]);
  }
}

/** Unit shown in the Unit column, derived from the product's formula family. */
function unitFor(productType: string): string {
  const def = getProduct(productType as never);
  if (def.formula === 'curtain') return 'mtr';
  if (def.formula === 'square_feet') return 'sq.ft';
  if (def.formula === 'wallpaper') return 'sq.ft';
  if (def.formula === 'accessories') return 'R.ft';
  return 'nos';
}

/** Company + customer block printed at the top of the sheet. */
function writeMeta(
  w: RowWriter,
  q: Quotation,
  profile: CompanyProfile,
  template: QuotationTemplate,
  docTitle: string,
  numberLabel: string,
  docNumber: string,
  customer: { name: string; phone: string; address: string; site: string; gstin?: string },
  logoDataUri = ''
): void {
  const co = profileToCompany(profile);
  /* Left column = logo + company details, right column (D/E) = customer details. */
  const pair = (left: string | number, rightLabel = '', rightValue: string | number = ''): (string | number)[] =>
    rightLabel === '' ? [left] : [left, '', '', rightLabel, rightValue];

  if (logoDataUri) for (let i = 0; i < 5; i += 1) w.push(['']); // rows kept free for the floating logo
  w.push(pair(co.name));
  w.push(pair(co.tagline, 'Customer', customer.name));
  w.push(pair(co.addressLine1, 'Phone', customer.phone));
  w.push(pair(co.addressLine2, 'Site', customer.site));
  w.push(pair(co.addressLine3, 'Address', customer.address));
  w.push(pair(co.addressLine4, 'GSTIN', customer.gstin ?? ''));
  w.push(pair(`Phone: ${co.phone}${co.altPhone ? ` / ${co.altPhone}` : ''}`));
  if (co.email) w.push(pair(`Email: ${co.email}`));
  if (co.website) w.push(pair(`Website: ${co.website}`));
  if (co.gstin) w.push(pair(`GSTIN: ${co.gstin}`));
  w.blank();

  w.push(pair(docTitle));
  w.push(pair(numberLabel, '', docNumber));
  w.push(pair('Date', '', formatDate(q.quotation_date)));
  w.push(pair('Valid for (days)', '', template.validityDays));
  w.blank();
}

interface TableLayout {
  head: (string | number)[];
  widths: number[];
  priceCol: number;
  totalCol: number;
  firstCol: number;
}

/** Build the product/accessory table header, honouring the template toggles. */
function tableLayout(template: QuotationTemplate, sym: string): TableLayout {
  const head: (string | number)[] = [];
  const widths: number[] = [];
  const add = (label: string, width: number) => {
    head.push(label);
    widths.push(width);
  };

  if (template.showSerialColumn) add('S.No', 6);
  if (template.showAreaColumn) add('Area Name', 24);
  add('Product', 18);
  if (template.showTypeColumn) add('Type', 16);
  if (template.showFabricColumn) add('Fabric Details', 24);
  if (template.showWidthColumn) add('Width (in)', 10);
  if (template.showHeightColumn) add('Height (in)', 11);
  add('Quantity', 10);
  if (template.showUnitInQty) add('Unit', 8);
  add(`Price (${sym})`, 12);
  add(`Total (${sym})`, 14);

  const priceCol = head.length - 2;
  const totalCol = head.length - 1;
  const firstCol = template.showSerialColumn ? 1 : 0;
  return { head, widths, priceCol, totalCol, firstCol };
}

/** Product rows + accessory rows for the given layout. */
function writeLines(w: RowWriter, q: Quotation, l: TableLayout, template: QuotationTemplate): void {
  const items = q.items ?? [];
  const counters: Record<string, number> = {};
  const blankTill = (upto: number) => new Array(upto).fill('');

  for (const it of items) {
    counters[it.product_type] = (counters[it.product_type] ?? 0) + 1;
    const cells: (string | number)[] = [];
    if (template.showSerialColumn) cells.push(String(counters[it.product_type]));
    if (template.showAreaColumn) cells.push(it.area_name);
    cells.push(getProduct(it.product_type).name);
    if (template.showTypeColumn) cells.push(it.type ?? '');
    if (template.showFabricColumn)
      cells.push(`${it.fabric_type ?? ''}${it.fabric_area ? ` · ${it.fabric_area} sq.ft` : ''}` || '-');
    if (template.showWidthColumn) cells.push(it.width || '');
    if (template.showHeightColumn) cells.push(it.height || '');
    cells.push(it.quantity);
    if (template.showUnitInQty) cells.push(unitFor(it.product_type));
    cells.push(it.price);
    cells.push(it.total);
    w.push(cells, [l.priceCol, l.totalCol]);
  }

  (q.accessories ?? []).forEach((a, i) => {
    const cells: (string | number)[] = [];
    if (template.showSerialColumn) cells.push(`A${i + 1}`);
    if (template.showAreaColumn) cells.push(a.area_name);
    cells.push('Accessory');
    if (template.showTypeColumn) cells.push(a.track_type);
    if (template.showFabricColumn) cells.push('-');
    if (template.showWidthColumn) cells.push(a.width || '');
    if (template.showHeightColumn) cells.push('');
    cells.push(a.quantity);
    if (template.showUnitInQty) cells.push('R.ft');
    cells.push(a.price);
    cells.push(a.total);
    w.push(cells, [l.priceCol, l.totalCol]);
  });
  void blankTill;
}

/** Label + amount row, right-aligned into the Total column. */
function totRow(w: RowWriter, label: string, value: number | string, l: TableLayout): void {
  const cells: (string | number)[] = new Array(l.totalCol + 1).fill('');
  cells[0] = label;
  cells[l.totalCol] = value;
  w.push(cells, typeof value === 'number' ? [l.totalCol] : []);
}

/** Extra charge lines (fitting / stitching / transport / additional / discount). */
function writeCharges(w: RowWriter, q: Quotation, l: TableLayout): void {
  for (const c of q.charges ?? []) {
    const cells: (string | number)[] = new Array(l.totalCol + 1).fill('');
    cells[0] = c.description;
    cells[l.totalCol] = c.total;
    w.push(cells, [l.totalCol]);
  }
}

function writeTerms(w: RowWriter, template: QuotationTemplate): void {
  if (template.terms) {
    w.blank();
    w.push(['Terms & Conditions']);
    for (const line of template.terms.split('\n')) w.push([line]);
  }
  if (template.notes) {
    w.blank();
    w.push(['Notes']);
    for (const line of template.notes.split('\n')) w.push([line]);
  }
  if (template.footerNote) {
    w.blank();
    w.push([template.footerNote]);
  }
}

/** GST amount helpers shared by both sheets. */
function taxFigures(q: Quotation, percent: number): { taxable: number; gstAmount: number; grand: number } {
  const taxable = round2(q.subtotal + q.accessories_total + (q.other_charges ?? 0) - q.discount);
  const itemGst = round2((q.items ?? []).reduce((sum, it) => sum + ((it.total || 0) * Number(it.gst_percent ?? percent)) / 100, 0));
  const nonItemTaxable = round2(q.accessories_total + (q.other_charges ?? 0) - q.discount);
  const gstAmount = round2(itemGst + (nonItemTaxable * percent) / 100);
  return { taxable, gstAmount, grand: round2(taxable + gstAmount) };
}

/** Sheet 1 — Quotation (line items + charges + totals). */
export function buildQuotationSheet(
  q: Quotation,
  profile: CompanyProfile,
  template: QuotationTemplate,
  gst?: SheetGstInput | null,
  logoDataUri = ''
): SheetSpec {
  const sym = template.currencySymbol || '\u20B9';
  const w = new RowWriter();

  writeMeta(
    w,
    q,
    profile,
    template,
    template.quotationTitle || 'QUOTATION',
    'Quotation No',
    q.quotation_number,
    {
      name: gst?.customer?.name || q.customer_name || '',
      phone: gst?.customer?.phone || q.customer_phone || '',
      address: gst?.customer?.address || '',
      site: gst?.customer?.site || q.site_location || '-',
      gstin: gst?.customer?.gstin || '',
    },
    logoDataUri
  );

  const l = tableLayout(template, sym);
  w.push(l.head);
  writeLines(w, q, l, template);

  w.blank();
  writeCharges(w, q, l);
  w.blank();

  totRow(w, 'Subtotal (Products)', q.subtotal, l);
  totRow(w, 'Accessories Total', q.accessories_total, l);
  if (q.other_charges) totRow(w, labelOf(q.charges_label, 'Other Charges'), q.other_charges, l);
  if (q.discount) totRow(w, labelOf(q.discount_label, 'Discount'), -q.discount, l);

  if (gst?.enabled) {
    const percent = Number(gst.percent ?? template.gstPercent ?? 0);
    const { taxable, gstAmount, grand } = taxFigures(q, percent);
    totRow(w, 'Taxable Value', taxable, l);
    totRow(w, `${template.taxLabel || 'GST'} @ ${percent}%`, gstAmount, l);
    totRow(w, 'Grand Total (incl. GST)', grand, l);
  } else {
    totRow(w, 'Grand Total', q.grand_total, l);
  }

  writeTerms(w, template);

  return { name: 'Quotation', aoa: w.aoa, money: w.money, widths: l.widths };
}

/** Sheet 2 — GST Tax Invoice / billing (CGST + SGST split, HSN, invoice number). */
export function buildGstSheet(
  q: Quotation,
  gst: SheetGstInput,
  profile: CompanyProfile,
  template: QuotationTemplate,
  logoDataUri = ''
): SheetSpec {
  const sym = template.currencySymbol || '\u20B9';
  const w = new RowWriter();

  const co = profileToCompany({
    ...profile,
    ...(gst.company ?? {}),
  });
  const company = {
    ...co,
    name: gst.company?.name || co.name,
    gstin: gst.company?.gstin || co.gstin || template.gstin,
  };
  const invoiceNumber = (gst.invoiceNumber ?? '').trim() || `INV-${q.quotation_number}`;

  writeMeta(w, q, profile, template, template.invoiceTitle || 'TAX INVOICE', 'Invoice No', invoiceNumber, {
    name: gst.customer?.name || q.customer_name || '',
    phone: gst.customer?.phone || q.customer_phone || '',
    address: gst.customer?.address || '',
    site: gst.customer?.site || q.site_location || '-',
    gstin: gst.customer?.gstin || '',
  }, logoDataUri);

  const l = tableLayout(template, sym);

  // Billing-specific meta lines above the table.
  const meta: (string | number)[][] = [['Quotation Ref', q.quotation_number]];
  if (company.gstin) meta.push(['Supplier GSTIN', company.gstin]);
  if (template.hsnCode) meta.push(['HSN / SAC', template.hsnCode]);
  meta.push(['Tax Type', template.taxLabel || 'GST']);
  w.blank();
  for (const row of meta) w.push(row);

  w.blank();
  w.push(l.head);
  writeLines(w, q, l, template);

  w.blank();
  writeCharges(w, q, l);
  w.blank();

  const percent = Number(gst.percent ?? template.gstPercent ?? 0);
  const half = round2(percent / 2);
  const { taxable, gstAmount, grand } = taxFigures(q, percent);

  totRow(w, 'Subtotal (Products)', q.subtotal, l);
  totRow(w, 'Accessories Total', q.accessories_total, l);
  if (q.other_charges) totRow(w, labelOf(q.charges_label, 'Other Charges'), q.other_charges, l);
  if (q.discount) totRow(w, labelOf(q.discount_label, 'Discount'), -q.discount, l);
  totRow(w, 'Taxable Value', taxable, l);
  totRow(w, `CGST @ ${half}%`, round2(gstAmount / 2), l);
  totRow(w, `SGST @ ${half}%`, round2(gstAmount / 2), l);
  totRow(w, `Total ${template.taxLabel || 'GST'} (${percent}%)`, gstAmount, l);
  totRow(w, `GRAND TOTAL (${sym})`, grand, l);

  writeTerms(w, template);

  return { name: 'GST Invoice', aoa: w.aoa, money: w.money, widths: l.widths };
}
