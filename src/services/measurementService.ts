import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadAll, saveAll, queueForSync, uuid } from './db';
import { calcQuantityFor, calculateTotal } from '../utils/calculations';
import { getProduct } from '../constants/products';
import type { ProductKey } from '../constants/products';
import type { Measurement, Accessory, OtherCharge } from '../types/measurement';

const MEAS_STORE = 'cd_measurements';

export interface MeasurementInput {
  id?: string;
  product_type: ProductKey;
  area_name: string;
  type?: string;
  width: string | number;
  height: string | number;
  price: string | number;
}

/** Create a measurement row with auto-calculated quantity and total. */
export function buildMeasurement(input: MeasurementInput, customerId: string): Measurement {
  const def = getProduct(input.product_type);
  const quantity = def.formula === 'accessories'
    ? 1 // accessories quantity derives from width/12 in accessories flow
    : calcQuantityFor(def.formula, input.width, input.height);
  const qty = input.product_type === 'accessories' ? quantity : quantity;
  return {
    id: input.id ?? uuid(),
    customer_id: customerId,
    product_type: input.product_type,
    area_name: input.area_name.trim(),
    type: input.type ?? '',
    width: Number(input.width) || 0,
    height: def.usesHeight ? Number(input.height) || 0 : 0,
    quantity: qty,
    price: Number(input.price) || 0,
    total: calculateTotal(qty, input.price),
  };
}

export async function saveMeasurements(customerId: string, rows: Measurement[]): Promise<void> {
  await AsyncStorage.setItem(`cd_meas_draft_${customerId}`, JSON.stringify(rows));
}

export async function loadDraftMeasurements(customerId: string): Promise<Measurement[]> {
  try {
    const raw = await AsyncStorage.getItem(`cd_meas_draft_${customerId}`);
    return raw ? (JSON.parse(raw) as Measurement[]) : [];
  } catch {
    return [];
  }
}

export async function clearDraftMeasurements(customerId: string): Promise<void> {
  await AsyncStorage.removeItem(`cd_meas_draft_${customerId}`);
}

export async function getAllMeasurements(): Promise<Measurement[]> {
  return loadAll<Measurement>(MEAS_STORE);
}

export async function appendMeasurements(rows: Measurement[]): Promise<void> {
  const all = await getAllMeasurements();
  await saveAll(MEAS_STORE, [...all, ...rows]);
  for (const r of rows) {
    await AsyncStorage.setItem(`cd_measurements_${r.id}`, JSON.stringify(r));
    await queueForSync('measurements', r.id);
  }
}

export async function deleteMeasurement(id: string): Promise<void> {
  const all = await getAllMeasurements();
  await saveAll(MEAS_STORE, all.filter((m) => m.id !== id));
  await AsyncStorage.removeItem(`cd_measurements_${id}`);
}

export async function saveAccessories(customerId: string, rows: Accessory[]): Promise<void> {
  await AsyncStorage.setItem(`cd_acc_draft_${customerId}`, JSON.stringify(rows));
}

export async function loadDraftAccessories(customerId: string): Promise<Accessory[]> {
  try {
    const raw = await AsyncStorage.getItem(`cd_acc_draft_${customerId}`);
    return raw ? (JSON.parse(raw) as Accessory[]) : [];
  } catch {
    return [];
  }
}

export async function clearDraftAccessories(customerId: string): Promise<void> {
  await AsyncStorage.removeItem(`cd_acc_draft_${customerId}`);
}

export async function appendAccessories(rows: Accessory[]): Promise<void> {
  const store = 'cd_accessories';
  const all = await loadAll<Accessory>(store);
  await saveAll(store, [...all, ...rows]);
  for (const r of rows) {
    await AsyncStorage.setItem(`cd_accessories_${r.id}`, JSON.stringify(r));
    await queueForSync('accessories', r.id);
  }
}

export async function saveChargesDraft(customerId: string, rows: OtherCharge[]): Promise<void> {
  await AsyncStorage.setItem(`cd_charges_draft_${customerId}`, JSON.stringify(rows));
}

export async function loadChargesDraft(customerId: string): Promise<OtherCharge[]> {
  try {
    const raw = await AsyncStorage.getItem(`cd_charges_draft_${customerId}`);
    return raw ? (JSON.parse(raw) as OtherCharge[]) : [];
  } catch {
    return [];
  }
}

export async function clearChargesDraft(customerId: string): Promise<void> {
  await AsyncStorage.removeItem(`cd_charges_draft_${customerId}`);
}
