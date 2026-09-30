import { defaultProfile, defaultTemplate } from '../services/settingsService';
import { profileToCompany } from '../constants/company';
import { quantityColumnLabel, getProduct, type ProductKey } from '../constants/products';
import { formatINR, formatDate } from '../utils/currency';
import { round2 } from '../utils/calculations';
import type { Quotation } from '../types/quotation';
import type { CompanyProfile, QuotationTemplate } from '../types/settings';

/** Editable company details embedded in a document. */
export interface BillCompany {
  name: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  addressLine4: string;
  phone: string;
  website: string;
  gstin: string;
}

/** Editable customer details embedded in a document. */
export interface BillCustomer {
  name: string;
  phone: string;
  address: string;
  site: string;
  gstin: string;
}

/** GST bill settings for one document. */
export interface GstBillSettings {
  enabled: boolean;
  percent: number;
  company: BillCompany;
  customer: BillCustomer;
  invoiceNumber: string;
}

/** Caller-supplied business profile + template (both optional → factory defaults). */
export interface DocContext {
  profile: CompanyProfile;
  template: QuotationTemplate;
  /** Optional base64 data URI of the user's uploaded logo, printed in the header. */
  logoDataUri?: string;
}

function resolve(ctx?: Partial<DocContext>): DocContext {
  return {
    profile: { ...defaultProfile(), ...(ctx?.profile ?? {}) },
    template: { ...defaultTemplate(), ...(ctx?.template ?? {}) },
    logoDataUri: ctx?.logoDataUri ?? '',
  };
}

function serialNumbers(items: { product_type: string }[]): string[] {
  const counters: Record<string, number> = {};
  return items.map((it) => {
    counters[it.product_type] = (counters[it.product_type] ?? 0) + 1;
    return String(counters[it.product_type]);
  });
}

/** Turn a free-text name into a filesystem-safe token. */
export function sanitizeFileToken(name: string | undefined | null): string {
  const raw = String(name ?? '').trim();
  const safe = raw
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return safe || 'Customer';
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(s: string): string {
  return esc(s).replace(/\n/g, '<br/>');
}

/**
 * Build the printable HTML for a quotation or tax invoice.
 *
 * All branding, numbering, column visibility, tax fields and free text come from
 * `ctx` (Settings → Business Profile / Quotation Template). Everything is
 * optional: omitting it reproduces the original factory layout.
 */
export function buildQuotationHtml(
  q: Quotation,
  gst?: GstBillSettings | null,
  ctx?: Partial<DocContext>
): string {
  const { profile, template } = resolve(ctx);
  const co = profileToCompany(profile);
  const isGst = !!gst?.enabled;
  const sym = template.currencySymbol || '\u20B9';

  const money = (v: number) => `${sym}${formatINR(v, false)}`;

  const company: BillCompany = {
    name: gst?.company?.name || co.name,
    tagline: gst?.company?.tagline || co.tagline,
    addressLine1: gst?.company?.addressLine1 || co.addressLine1,
    addressLine2: gst?.company?.addressLine2 || co.addressLine2,
    addressLine3: gst?.company?.addressLine3 || co.addressLine3,
    addressLine4: gst?.company?.addressLine4 || co.addressLine4,
    phone: gst?.company?.phone || co.phone,
    website: gst?.company?.website || co.website,
    gstin: gst?.company?.gstin || co.gstin || template.gstin,
  };

  const customer: BillCustomer = {
    name: gst?.customer?.name || q.customer_name || '',
    phone: gst?.customer?.phone || q.customer_phone || '',
    address: gst?.customer?.address || '',
    site: gst?.customer?.site || q.site_location || '-',
    gstin: gst?.customer?.gstin || '',
  };

  const items = q.items ?? [];
  const accessories = q.accessories ?? [];
  const charges = (q.charges ?? []).filter((c) => c.description !== 'Discount');
  const discounts = (q.charges ?? []).filter((c) => c.description === 'Discount');
  const serials = serialNumbers(items);
  const accent = template.accentColor || '#FF7A00';
  const tOpt = (v: string | undefined) => (v ?? '').trim() || '-';
  const sOpt = (v: string | undefined, fb: string) => ((v ?? '').trim() ? (v as string).trim() : fb);
  const fabricCell = (it: { fabric_type?: string; fabric_area?: number }) =>
    `${esc(tOpt(it.fabric_type))}${it.fabric_area ? ` · ${it.fabric_area} sq.ft` : ''}`;
  const productStartCols = (template.showSerialColumn ? 1 : 0) + (template.showAreaColumn ? 1 : 0);
  const chargeColSpan = productStartCols + 1;
  const discountColSpan = productStartCols + (template.showTypeColumn ? 1 : 0);

  /* ---------- product table, honouring the column toggles ---------- */
  const head: string[] = [];
  if (template.showSerialColumn) head.push('S.No');
  if (template.showAreaColumn) head.push('Area Name');
  head.push('Product');
  if (template.showTypeColumn) head.push('Type');
  if (template.showFabricColumn) head.push('Fabric Details');
  if (template.showWidthColumn) head.push('Width');
  if (template.showHeightColumn) head.push('Height');
  head.push(quantityColumnLabel('curtains'));
  head.push('Price');
  head.push('Total');
  const cols = head.length;

  const productRows = items.length
    ? items
        .map((it, i) => {
          const cells: string[] = [];
          if (template.showSerialColumn) cells.push(`<td>${serials[i]}</td>`);
          if (template.showAreaColumn) cells.push(`<td style="text-align:left">${esc(it.area_name)}</td>`);
          cells.push(`<td style="text-align:left">${esc(getProduct(it.product_type).name)}</td>`);
          if (template.showTypeColumn) cells.push(`<td style="text-align:left">${esc(tOpt(it.type))}</td>`);
          if (template.showFabricColumn) cells.push(`<td style="text-align:left">${fabricCell(it)}</td>`);
          if (template.showWidthColumn) cells.push(`<td>${it.width || '-'}</td>`);
          if (template.showHeightColumn) cells.push(`<td>${it.height || '-'}</td>`);
          cells.push(`<td>${it.quantity}</td>`);
          cells.push(`<td>${money(it.price)}</td>`);
          cells.push(`<td>${money(it.total)}</td>`);
          return `<tr>${cells.join('')}</tr>`;
        })
        .join('')
    : `<tr><td colspan="${cols}" class="empty">No products</td></tr>`;

  const accRows = accessories.length
    ? accessories
        .map((a, i) => {
          const cells: string[] = [];
          if (template.showSerialColumn) cells.push(`<td>${i + 1}</td>`);
          if (template.showAreaColumn) cells.push(`<td style="text-align:left">${esc(a.area_name)}</td>`);
          cells.push(`<td style="text-align:left">${esc(tOpt(a.track_type))}</td>`);
          if (template.showTypeColumn) cells.push('<td>-</td>');
          if (template.showFabricColumn) cells.push('<td>-</td>');
          if (template.showWidthColumn) cells.push(`<td>${a.width || '-'}</td>`);
          cells.push(`<td>${a.quantity}</td>`);
          cells.push(`<td>${money(a.price)}</td>`);
          cells.push(`<td>${money(a.total)}</td>`);
          return `<tr>${cells.join('')}</tr>`;
        })
        .join('')
    : '';

  const chargeRows = charges
    .map(
      (c) => `<tr>
      <td colspan="${chargeColSpan}" style="text-align:left">${esc(c.description)}</td>
      <td>${c.quantity}</td>
      <td>${money(c.price)}</td>
      <td>${money(c.total)}</td>
    </tr>`
    )
    .join('');

  const discountRow = discounts.length
    ? `<tr class="discount"><td colspan="${discountColSpan}" style="text-align:left">${esc(sOpt(q.discount_label, 'Discount'))}</td><td>1</td><td>-${money(
        q.discount
      )}</td><td>-${money(q.discount)}</td></tr>`
    : '';

  /* ---------- totals ---------- */
  const taxable = round2(q.subtotal + q.accessories_total + (q.other_charges ?? 0) - q.discount);
  const gstPercent = isGst ? Number(gst?.percent ?? template.gstPercent ?? 0) : 0;
  const itemGstAmount = isGst ? round2(items.reduce((sum, it) => sum + ((it.total || 0) * Number(it.gst_percent ?? gstPercent)) / 100, 0)) : 0;
  const nonItemTaxable = round2(q.accessories_total + (q.other_charges ?? 0) - q.discount);
  const gstAmount = isGst ? round2(itemGstAmount + (nonItemTaxable * gstPercent) / 100) : 0;
  const grand = isGst ? round2(taxable + gstAmount) : q.grand_total;
  const invoiceNumber = gst?.invoiceNumber?.trim() || `INV-${q.quotation_number}`;

  const docTitle = isGst ? template.invoiceTitle || 'TAX INVOICE' : template.quotationTitle || 'QUOTATION';
  const docNumber = isGst ? invoiceNumber : q.quotation_number;

  const unitNote =
    template.showUnitInQty && items.length
      ? `<div class="note-line">* Curtains in <b>metres (mtr)</b> · accessories in <b>running feet (R.ft)</b> · wallpaper in <b>sq.ft</b>${
          template.showHeightColumn ? '' : ' · widths/heights in inches'
        }</div>`
      : '';

  const bankBlock =
    template.showBankDetails && (co.bankName || co.upiId)
      ? `<div class="aside">
    <div class="aside-title">Payment Details</div>
    ${co.bankName ? `<div>Bank: <b>${esc(co.bankName)}</b></div>` : ''}
    ${co.bankAccount ? `<div>A/C No: <b>${esc(co.bankAccount)}</b></div>` : ''}
    ${co.bankIfsc ? `<div>IFSC: <b>${esc(co.bankIfsc)}</b></div>` : ''}
    ${co.upiId ? `<div>UPI: <b>${esc(co.upiId)}</b></div>` : ''}
  </div>`
      : '';

  const gstinLine =
    template.showGstin && company.gstin ? `<div class="gstin">GSTIN: ${esc(company.gstin)}</div>` : '';

  const thanks = (template.thankYouNote || 'Thank you for choosing {COMPANY}!').replace(
    /\{COMPANY\}/g,
    co.name
  );

  const signatureBlockContent = template.showSignature
    ? `<div class="sign"><div class="sign-line"></div><div class="sign-label">${esc(
        template.signatureLabel || 'Authorised Signatory'
      )}</div><div class="sign-sub">For ${esc(co.name)}</div></div>`
    : '';

  const logoBlock = !template.showLogo
    ? ''
    : ctx?.logoDataUri
      ? `<img class="logo-img" src="${esc(ctx.logoDataUri)}" alt="logo" />`
      : `<div class="logo-wrap">CD</div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; }
  body { font-family: 'DejaVuSans', sans-serif; color: #1a2440; font-size: 11px; }
  .header { background: #101D4A; color: #fff; padding: 20px 28px; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-name { font-size: 22px; font-weight: bold; letter-spacing: 1px; color: #FFFFFF; }
  .brand-tag { font-size: 9px; color: ${esc(accent)}; letter-spacing: 2px; text-transform: uppercase; margin-top: 3px; }
  .co-info { text-align: right; font-size: 9.5px; line-height: 1.6; color: #E8ECF5; }
  .accent { height: 5px; background: ${esc(accent)}; }
  .meta { display: flex; justify-content: space-between; padding: 16px 28px 4px; }
  .q-title { font-size: 17px; font-weight: bold; color: #101D4A; }
  .q-num { font-size: 12px; color: ${esc(accent)}; font-weight: bold; margin-top: 3px; }
  .cust { text-align: right; font-size: 10.5px; line-height: 1.65; }
  .cust .label { color: #6B7390; }
  .cust .name { font-weight: bold; color: #101D4A; font-size: 12px; }
  .sect { padding: 10px 28px 2px; font-size: 12px; font-weight: bold; color: #101D4A; letter-spacing: 0.5px; }
  table { width: calc(100% - 56px); margin: 6px 28px; border-collapse: collapse; }
  th { background: #101D4A; color: #fff; padding: 7px 6px; font-size: 10px; text-align: center; }
  td { padding: 6px; border-bottom: 1px solid #E5E8EF; text-align: center; font-size: 10.5px; }
  tr:nth-child(even) td { background: #F8F9FC; }
  .empty { color: #6B7390; font-style: italic; padding: 12px; }
  .discount td { color: #1DB954; font-weight: bold; background: #F0FBF4 !important; }
  .totals { width: calc(100% - 56px); margin: 8px 28px 0; border-collapse: collapse; }
  .totals td { border: none; padding: 4px 8px; font-size: 11px; }
  .totals .lbl { text-align: right; color: #6B7390; }
  .totals .val { text-align: right; font-weight: bold; color: #101D4A; width: 130px; }
  .grand td { border-top: 2px solid #101D4A; padding: 10px 8px; font-size: 15px; font-weight: bold; color: #ED1C24; }
  .grand .lbl { color: #101D4A; }
  .gst-box, .aside { margin: 10px 28px; padding: 10px 14px; background: #FFFBEC; border: 1px solid ${esc(
    accent
  )}; border-radius: 10px; font-size: 11px; }
  .aside { background: #F3F6FC; border-color: #D7DCE5; }
  .aside-title { font-weight: bold; color: #101D4A; margin-bottom: 4px; }
  .gst-box .row { display:flex; justify-content:space-between; padding:2px 0; }
  .gst-box .row b { color: #101D4A; }
  .note-line { font-size: 10px; color: #6B7390; margin: 2px 28px 0; }
  .gstin { font-size: 9.5px; color: #6B7390; margin-top:2px; }
  .terms { margin: 12px 28px 0; font-size: 9.5px; color: #4A5270; line-height: 1.6; }
  .terms b { color: #101D4A; }
  .sign { margin: 26px 28px 0; text-align: right; }
  .sign-line { border-bottom: 1px solid #101D4A; width: 160px; margin-left: auto; margin-bottom: 4px; }
  .sign-label { font-size: 10px; font-weight: bold; color: #101D4A; }
  .sign-sub { font-size: 9px; color: #6B7390; }
  .footer { margin-top: 22px; padding: 14px 28px; background: #F6F7F9; font-size: 9px; color: #6B7390; text-align: center; line-height: 1.6; }
  .thanks { text-align: center; padding: 14px; font-size: 11px; color: #101D4A; font-weight: bold; letter-spacing: 0.5px; }
  .logo-wrap { width: 52px; height: 52px; border-radius: 10px; background: #fff; display: flex; align-items: center; justify-content: center; font-weight:bold; color:#101D4A; font-size: 17px; }
  .logo-img { width: 52px; height: 52px; object-fit: contain; border-radius: 10px; background: #fff; padding: 3px; }
  .drawer { position: relative; padding-bottom: 74px; }
  .sign-bottom { position: absolute; bottom: 4px; left: 28px; }
  .sign-bottom .sign { margin: 0; text-align: left; }
  .sign-bottom .sign-line { margin-left: 0; }
</style></head>
<body>
  <div class="drawer">
  <div class="header">
    <div class="brand">
      ${logoBlock}
      <div>
        <div class="brand-name">${esc(company.name)}</div>
        <div class="brand-tag">${esc(company.tagline)}</div>
      </div>
    </div>
    <div class="co-info">
      ${esc(company.addressLine1)}<br/>${esc(company.addressLine2)}<br/>${esc(company.addressLine3)}<br/>${esc(company.addressLine4)}<br/>
      Phone: ${esc(company.phone)}${co.altPhone ? ` / ${esc(co.altPhone)}` : ''}<br/>${esc(company.website)}
      ${co.email ? `<br/>${esc(co.email)}` : ''}
      ${gstinLine}
    </div>
  </div>
  <div class="accent"></div>

  <div class="meta">
    <div>
      <div class="q-title">${esc(docTitle)}</div>
      <div class="q-num">${esc(docNumber)}</div>
      <div style="font-size:10px;color:#6B7390;margin-top:3px">Date: ${formatDate(q.quotation_date)}</div>
      <div style="font-size:10px;color:#6B7390">Valid for: ${template.validityDays} days</div>
      ${isGst ? `<div style="font-size:10px;color:#6B7390">Quotation Ref: ${esc(q.quotation_number)}</div>` : ''}
    </div>
    <div class="cust">
      <div class="name">${esc(customer.name)}</div>
      <div>Phone: ${esc(customer.phone)}</div>
      ${customer.address ? `<div class="label">Addr: ${esc(customer.address)}</div>` : ''}
      <div class="label">Site: ${esc(customer.site)}</div>
      ${customer.gstin ? `<div class="label">GSTIN: ${esc(customer.gstin)}</div>` : ''}
    </div>
  </div>

  <div class="sect">PRODUCTS</div>
  <table>
    <tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>
    ${productRows}
  </table>
  ${
    accRows
      ? `<div class="sect">ACCESSORIES</div>
  <table>
    <tr>${[
      template.showSerialColumn ? '<th>S.No</th>' : '',
      template.showAreaColumn ? '<th>Area Name</th>' : '',
      '<th>Track Type</th>',
      template.showWidthColumn ? '<th>Width</th>' : '',
      '<th>Qty / R.ft</th>',
      '<th>Price</th>',
      '<th>Total</th>',
    ]
      .filter(Boolean)
      .join('')}</tr>
    ${accRows}
  </table>`
      : ''
  }
  ${
    chargeRows || discountRow
      ? `<div class="sect">OTHER CHARGES</div>
  <table>
    <tr><th colspan="2">Description</th><th>Quantity</th><th>Price</th><th>Total</th></tr>
    ${chargeRows}${discountRow}
  </table>`
      : ''
  }

  <table class="totals">
    <tr><td class="lbl">Products Subtotal</td><td class="val">${money(q.subtotal)}</td></tr>
    <tr><td class="lbl">Accessories Total</td><td class="val">${money(q.accessories_total)}</td></tr>
    <tr><td class="lbl">${esc(sOpt(q.charges_label, 'Other Charges'))}</td><td class="val">${money(round2(q.other_charges))}</td></tr>
    ${q.discount > 0 ? `<tr><td class="lbl">${esc(sOpt(q.discount_label, 'Discount'))}</td><td class="val">- ${money(q.discount)}</td></tr>` : ''}
    ${isGst ? `<tr><td class="lbl">Taxable Value</td><td class="val">${money(taxable)}</td></tr>` : ''}
    ${
      isGst
        ? `<tr><td class="lbl">${esc(template.taxLabel || 'GST')} (item-wise; default ${gstPercent}%)</td><td class="val">${money(
            gstAmount
          )}</td></tr>`
        : ''
    }
    <tr class="grand"><td class="lbl">${isGst ? 'INVOICE TOTAL' : 'GRAND TOTAL'}</td><td class="val">${money(
      grand
    )}</td></tr>
  </table>

  ${unitNote}

  ${bankBlock}

  ${
    isGst
      ? `<div class="gst-box">
    <div class="row"><b>Tax Summary</b></div>
    ${template.hsnCode ? `<div class="row"><span>HSN/SAC</span><span>${esc(template.hsnCode)}</span></div>` : ''}
    <div class="row"><span>Rate</span><span>Item-wise (default ${esc(String(gstPercent))}%)</span></div>
    <div class="row"><span>Tax amount on Taxable Value</span><span>${money(gstAmount)}</span></div>
  </div>`
      : ''
  }

  ${
    template.terms || template.notes
      ? `<div class="terms">
    ${template.terms ? `<b>Terms &amp; Conditions</b><br/>${nl2br(template.terms)}` : ''}
    ${template.notes ? `<br/><b>Notes</b><br/>${nl2br(template.notes)}` : ''}
  </div>`
      : ''
  }

  <div class="thanks">${esc(thanks)}</div>
  <div class="footer">
    ${esc(template.footerNote || '')}<br/>
    ${esc(co.name)} &bull; ${esc(company.phone)} &bull; ${esc(company.website)}
    ${company.gstin ? ` &bull; GSTIN ${esc(company.gstin)}` : ''}
  </div>
  <div class="sign-bottom">${signatureBlockContent}</div>
</div></body></html>`;
}

export function buildStandardQuotationHtml(q: Quotation, ctx?: Partial<DocContext>): string {
  return buildQuotationHtml(q, null, ctx);
}

export function buildGstBillHtml(
  q: Quotation,
  gst: GstBillSettings,
  ctx?: Partial<DocContext>
): string {
  return buildQuotationHtml(q, { ...gst, enabled: true }, ctx);
}

/** PDF filename derived from the sanitized customer name. */
export function quotationFileName(q: Quotation, kind: 'quotation' | 'gst' = 'quotation'): string {
  const token = sanitizeFileToken(q.customer_name);
  const num = String(q.quotation_number ?? '').replace(/[^a-zA-Z0-9_\-]/g, '_') || 'Quotation';
  return kind === 'gst'
    ? `CatchyDecors_${num}_GSTInvoice_${token}.pdf`
    : `CatchyDecors_${num}_${token}.pdf`;
}

/** Product key helper kept for callers that need the unit label. */
export type { ProductKey };
