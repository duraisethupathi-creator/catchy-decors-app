import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadAll, saveAll, queueForSync, uuid } from './db';
import { appendMeasurements, appendAccessories, clearDraftMeasurements, clearDraftAccessories, clearChargesDraft } from './measurementService';
import { calculateFitting, calculateStitching, round2 } from '../utils/calculations';
import type { Customer } from '../types/customer';
import type { Measurement, Accessory, OtherCharge } from '../types/measurement';
import type { Quotation } from '../types/quotation';
import type { QuotationStatus } from '../constants/products';

const STORE = 'cd_quotations';

export {
  buildCharges,
  computeGrandTotal,
  otherChargesTotalFrom,
  bundleFromCharges,
  bundleFromChargesWithExtras,
  emptyChargesBundle,
  newExtraRow,
  normalizeBundle,
  stitchingQuantity,
} from '../utils/charges';
export type { ChargesBundle, ChargeTotals, ExtraChargeRow } from '../utils/charges';

export async function getQuotations(): Promise<Quotation[]> {
  const rows = await loadAll<Quotation>(STORE);
  return rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

export async function getQuotation(id: string): Promise<Quotation | null> {
  const rows = await getQuotations();
  return rows.find((q) => q.id === id) ?? null;
}

export async function getQuotationsByCustomer(customerId: string): Promise<Quotation[]> {
  const rows = await getQuotations();
  return rows.filter((q) => q.customer_id === customerId);
}

export async function saveQuotation(input: {
  id?: string;
  quotation_number: string;
  customer: Customer;
  items: Measurement[];
  accessories: Accessory[];
  charges: OtherCharge[];
  subtotal: number;
  accessories_total: number;
  other_charges: number;
  discount: number;
  grand_total: number;
  status: QuotationStatus;
  gst?: Quotation['gst'];
  reference_photos?: Quotation['reference_photos'];
}): Promise<Quotation> {
  const now = new Date().toISOString();
  const quotation: Quotation = {
    id: input.id ?? uuid(),
    quotation_number: input.quotation_number,
    customer_id: input.customer.id,
    customer_name: input.customer.name,
    customer_phone: input.customer.phone,
    quotation_date: now.slice(0, 10),
    subtotal: input.subtotal,
    accessories_total: input.accessories_total,
    other_charges: input.other_charges,
    discount: input.discount,
    grand_total: input.grand_total,
    status: input.status,
    created_at: now,
    items: input.items,
    accessories: input.accessories,
    charges: input.charges,
    reference_photos: input.reference_photos ?? [],
    site_location: (input.customer as { site_location?: string }).site_location,
    gst: input.gst,
    updated_at: now,
  } as Quotation;
  const rows = await getQuotations();
  const idx = rows.findIndex((q) => q.id === quotation.id);
  if (idx >= 0) rows[idx] = quotation;
  else rows.unshift(quotation);
  await saveAll(STORE, rows);
  await AsyncStorage.setItem(`cd_quotations_${quotation.id}`, JSON.stringify(quotation));
  await queueForSync('quotations', quotation.id);
  return quotation;
}

/**
 * Full in-place update — used by the editable final quotation screen.
 * Preserves id / created_at / quotation_number unless the caller changed them.
 * Does NOT overwrite quotation_date with "today" (unlike saveQuotation), so an
 * edit to an old quotation keeps its original date.
 */
export async function updateQuotation(updated: Quotation): Promise<Quotation> {
  const rows = await getQuotations();
  const idx = rows.findIndex((q) => q.id === updated.id);
  if (idx < 0) throw new Error('Quotation not found: ' + updated.id);
  const merged: Quotation = {
    ...updated,
    id: rows[idx].id,
    created_at: updated.created_at ?? rows[idx].created_at,
    updated_at: new Date().toISOString(),
  } as Quotation;
  rows[idx] = merged;
  await saveAll(STORE, rows);
  await AsyncStorage.setItem(`cd_quotations_${merged.id}`, JSON.stringify(merged));
  await queueForSync('quotations', merged.id);
  return merged;
}

export async function updateWorkStatus(id: string, workStatus: NonNullable<Quotation['work_status']>): Promise<void> {
  const rows = await getQuotations();
  const idx = rows.findIndex((q) => q.id === id);
  if (idx >= 0) {
    rows[idx].work_status = workStatus;
    (rows[idx] as Quotation & { updated_at?: string }).updated_at = new Date().toISOString();
    await saveAll(STORE, rows);
    await AsyncStorage.setItem(`cd_quotations_${id}`, JSON.stringify(rows[idx]));
    await queueForSync('quotations', id);
  }
}

export async function updateQuotationStatus(id: string, status: QuotationStatus): Promise<void> {
  const rows = await getQuotations();
  const idx = rows.findIndex((q) => q.id === id);
  if (idx >= 0) {
    rows[idx].status = status;
    (rows[idx] as Quotation & { updated_at?: string }).updated_at = new Date().toISOString();
    await saveAll(STORE, rows);
    await AsyncStorage.setItem(`cd_quotations_${id}`, JSON.stringify(rows[idx]));
    await queueForSync('quotations', id);
  }
}

export async function deleteQuotation(id: string): Promise<void> {
  const rows = await getQuotations();
  await saveAll(STORE, rows.filter((q) => q.id !== id));
  await AsyncStorage.removeItem(`cd_quotations_${id}`);
}

export async function duplicateQuotation(id: string): Promise<Quotation | null> {
  const src = await getQuotation(id);
  if (!src) return null;
  const { nextQuotationNumber } = await import('../utils/quotationNumber');
  const num = await nextQuotationNumber();
  const copy: Quotation = {
    ...src,
    id: uuid(),
    quotation_number: num,
    status: 'draft',
    created_at: new Date().toISOString(),
  };
  const rows = await getQuotations();
  rows.unshift(copy);
  await saveAll(STORE, rows);
  return copy;
}

/** Commit a draft into a final quotation: persists items and clears drafts. */
export async function commitQuotation(
  quotation: Quotation,
  customerId: string
): Promise<void> {
  if (quotation.items?.length) await appendMeasurements(quotation.items);
  if (quotation.accessories?.length) {
    const { appendAccessories } = await import('./measurementService');
    await appendAccessories(quotation.accessories);
  }
  await clearDraftMeasurements(customerId);
  await clearDraftAccessories(customerId);
  await clearChargesDraft(customerId);
}

export interface SalesStats {
  totalQuotations: number;
  totalSales: number;
  pending: number;
  approved: number;
}

export async function getStats(): Promise<SalesStats> {
  const rows = await getQuotations();
  return {
    totalQuotations: rows.length,
    // Sales are realised only after a quotation is approved/completed.
    totalSales: rows.filter((q) => q.status === 'approved' || q.status === 'completed').reduce((s, q) => s + q.grand_total, 0),
    pending: rows.filter((q) => q.status === 'draft' || q.status === 'sent').length,
    approved: rows.filter((q) => q.status === 'approved' || q.status === 'completed').length,
  };
}

export async function getMonthSales(): Promise<number> {
  const rows = await getQuotations();
  const now = new Date();
  return rows
    .filter((q) => {
      if (q.status !== 'approved' && q.status !== 'completed') return false;
      const rawDate = q.created_at ?? q.quotation_date;
      if (!rawDate) return false;
      const d = new Date(rawDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, q) => s + q.grand_total, 0);
}

/** Daily / weekly / monthly aggregation for reports. */
export async function getSalesInRange(days: number): Promise<{ label: string; total: number; count: number }[]> {
  const rows = await getQuotations();
  const buckets: { label: string; total: number; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayRows = rows.filter((q) => {
      if (q.status !== 'approved' && q.status !== 'completed') return false;
      const raw = q.created_at ?? q.quotation_date;
      const rowKey = raw ? String(raw).slice(0, 10) : '';
      return rowKey === key || String(q.quotation_date ?? '').slice(0, 10) === key;
    });
    buckets.push({
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      total: dayRows.reduce((s, q) => s + q.grand_total, 0),
      count: dayRows.length,
    });
  }
  return buckets;
}

export async function getProductWiseSales(): Promise<{ product: string; total: number; count: number }[]> {
  const rows = await getQuotations();
  const map = new Map<string, { total: number; count: number }>();
  for (const q of rows) {
    if (q.status !== 'approved' && q.status !== 'completed') continue;
    for (const item of q.items ?? []) {
      const entry = map.get(item.product_type) ?? { total: 0, count: 0 };
      entry.total += item.total;
      entry.count += 1;
      map.set(item.product_type, entry);
    }
  }
  const { PRODUCTS } = await import('../constants/products');
  return Array.from(map.entries()).map(([key, v]) => ({
    product: PRODUCTS.find((p) => p.key === key)?.name ?? key,
    ...v,
  }));
}
