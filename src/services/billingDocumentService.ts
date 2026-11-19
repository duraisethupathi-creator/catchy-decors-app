import AsyncStorage from '@react-native-async-storage/async-storage';
import { queueForSync } from './db';
import type { Quotation } from '../types/quotation';

export type BillingDocumentType = 'bill' | 'gst';

export interface BillingDocument {
  id: string;
  quotation_id: string;
  quotation_number: string;
  document_type: BillingDocumentType;
  document_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  document_date: string;
  subtotal: number;
  grand_total: number;
  paid_amount: number;
  balance_amount: number;
  snapshot: Quotation;
  created_at: string;
  updated_at: string;
}

const STORE = 'cd_bills';

/** Keep billing documents independent from quotations; regenerate updates the same document. */
export async function saveBillingDocument(
  quotation: Quotation,
  type: BillingDocumentType,
  paidAmount = 0
): Promise<BillingDocument> {
  const rows = await getBillingDocuments();
  const id = `${quotation.id}:${type}`;
  const existing = rows.find((row) => row.id === id);
  const now = new Date().toISOString();
  const total = type === 'gst' && quotation.gst?.enabled
    ? quotation.grand_total
    : quotation.grand_total;
  const doc: BillingDocument = {
    id,
    quotation_id: quotation.id,
    quotation_number: quotation.quotation_number,
    document_type: type,
    document_number: type === 'gst'
      ? (quotation.gst?.invoice_number || `INV-${quotation.quotation_number}`)
      : `BILL-${quotation.quotation_number}`,
    customer_id: quotation.customer_id,
    customer_name: quotation.customer_name || '',
    customer_phone: quotation.customer_phone || '',
    document_date: now.slice(0, 10),
    subtotal: quotation.subtotal + quotation.accessories_total + quotation.other_charges - quotation.discount,
    grand_total: total,
    paid_amount: Math.max(0, paidAmount),
    balance_amount: Math.max(0, total - paidAmount),
    snapshot: quotation,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  const next = [doc, ...rows.filter((row) => row.id !== id)];
  await AsyncStorage.setItem(STORE, JSON.stringify(next));
  await AsyncStorage.setItem(`cd_bills_${id}`, JSON.stringify(doc));
  await queueForSync('bills', id);
  return doc;
}

export async function getBillingDocuments(): Promise<BillingDocument[]> {
  try {
    const raw = await AsyncStorage.getItem(STORE);
    return raw ? JSON.parse(raw) as BillingDocument[] : [];
  } catch {
    return [];
  }
}

export async function getBillingDocumentsForCustomer(customerId: string): Promise<BillingDocument[]> {
  return (await getBillingDocuments())
    .filter((doc) => doc.customer_id === customerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getBillingDocumentForQuotation(
  quotationId: string,
  type: BillingDocumentType
): Promise<BillingDocument | null> {
  return (await getBillingDocuments()).find((doc) => doc.quotation_id === quotationId && doc.document_type === type) ?? null;
}
