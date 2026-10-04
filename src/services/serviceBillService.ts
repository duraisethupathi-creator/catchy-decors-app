import AsyncStorage from '@react-native-async-storage/async-storage';
import { queueForSync } from './db';

export type ServiceCategory = 'Curtain Service' | 'Blinds Service' | 'Mosquito Net Service' | 'Track Service' | 'Other Service';

export interface ServiceBill {
  id: string;
  billNumber: string;
  date: string;
  customerName: string;
  phone: string;
  address: string;
  category: ServiceCategory;
  description: string;
  quantity: number;
  serviceCharge: number;
  materialCharge: number;
  discount: number;
  gstPercent: number;
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  updated_at?: string;
}

const KEY = 'cd_service_bills';

export async function getServiceBills(): Promise<ServiceBill[]> {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || '[]'); } catch { return []; }
}

export async function nextServiceBillNumber(): Promise<string> {
  const rows = await getServiceBills();
  const max = rows.reduce((m, r) => Math.max(m, Number((r.billNumber.match(/\d+/) || ['0'])[0])), 0);
  return `SRV-${String(max + 1).padStart(4, '0')}`;
}

export async function saveServiceBill(bill: ServiceBill): Promise<void> {
  const rows = await getServiceBills();
  const i = rows.findIndex((r) => r.id === bill.id);
  const syncedBill: ServiceBill = { ...bill, updated_at: new Date().toISOString() };
  if (i >= 0) rows[i] = syncedBill; else rows.unshift(syncedBill);
  await AsyncStorage.setItem(KEY, JSON.stringify(rows));
  await AsyncStorage.setItem(`cd_service_bills_${bill.id}`, JSON.stringify(syncedBill));
  await queueForSync('service_bills', bill.id);
}
