import type { DocContext } from './pdfService';
import type { ServiceBill } from './serviceBillService';
import { defaultProfile, defaultTemplate } from './settingsService';
import { profileToCompany } from '../constants/company';

const esc = (v: unknown) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const money = (v: number) => `₹${Number(v || 0).toFixed(2)}`;

export function serviceBillFileName(b: ServiceBill) {
  const customer = (b.customerName || 'Customer').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `Catchy-Decors-Service-${b.billNumber}-${customer}.pdf`;
}

export function buildServiceBillHtml(b: ServiceBill, ctx?: Partial<DocContext>): string {
  const profile = { ...defaultProfile(), ...(ctx?.profile ?? {}) };
  const template = { ...defaultTemplate(), ...(ctx?.template ?? {}) };
  const co = profileToCompany(profile);
  const logo = template.showLogo && ctx?.logoDataUri ? `<img class="logo" src="${esc(ctx.logoDataUri)}"/>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{size:A4;margin:0}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17213d;margin:0;font-size:12px}
  .head{background:#101D4A;color:white;padding:22px 30px;display:flex;justify-content:space-between}.brand{display:flex;gap:12px;align-items:center}.logo{width:58px;height:58px;object-fit:contain;background:white;border-radius:10px}.name{font-size:22px;font-weight:800}.tag{color:#F5B942;font-size:10px;margin-top:4px}.right{text-align:right;line-height:1.55;font-size:10px}.bar{height:5px;background:#FF7A00}.wrap{padding:24px 30px}.title{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:14px}.title h1{margin:0;font-size:19px}.bill{color:#FF7A00;font-weight:700}.customer{margin:18px 0;line-height:1.7}.customer b{font-size:14px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#101D4A;color:#fff;padding:9px}td{padding:10px 8px;border-bottom:1px solid #e5e8ef;text-align:right}th:first-child,td:first-child{text-align:left}.totals{width:52%;margin-left:auto;margin-top:18px}.row{display:flex;justify-content:space-between;padding:6px 0}.grand{border-top:2px solid #101D4A;font-size:16px;font-weight:800;padding-top:10px}.note{margin-top:32px;color:#667085}.thanks{text-align:center;margin-top:50px;color:#101D4A;font-weight:700}
  </style></head><body><div class="head"><div class="brand">${logo}<div><div class="name">${esc(co.name)}</div><div class="tag">${esc(co.tagline)}</div></div></div><div class="right">${esc(co.addressLine1)}<br>${esc(co.addressLine2)}<br>${esc(co.phone)} · ${esc(co.website)}</div></div><div class="bar"></div>
  <div class="wrap"><div class="title"><div><h1>SERVICE BILL</h1><div class="bill">${esc(b.billNumber)}</div></div><div>Date: ${esc(b.date)}</div></div>
  <div class="customer"><span>Bill To</span><br><b>${esc(b.customerName)}</b><br>${esc(b.phone)}<br>${esc(b.address)}</div>
  <table><tr><th>Service</th><th>Qty</th><th>Service Charge</th><th>Material / Spare</th><th>Total</th></tr>
  <tr><td><b>${esc(b.category)}</b><br><span style="color:#667085">${esc(b.description)}</span></td><td>${b.quantity}</td><td>${money(b.serviceCharge)}</td><td>${money(b.materialCharge)}</td><td>${money(b.subtotal)}</td></tr></table>
  <div class="totals"><div class="row"><span>Subtotal</span><b>${money(b.subtotal)}</b></div><div class="row"><span>Discount</span><b>-${money(b.discount)}</b></div><div class="row"><span>GST (${b.gstPercent}%)</span><b>${money(b.gstAmount)}</b></div><div class="row grand"><span>Grand Total</span><span>${money(b.grandTotal)}</span></div></div>
  <div class="note">Service / repair charges are based on the work completed and materials used.</div><div class="thanks">Thank you for choosing ${esc(co.name)}!</div></div></body></html>`;
}
