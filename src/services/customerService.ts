import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadAll, saveAll, queueForSync, uuid } from './db';
import type { Customer } from '../types/customer';

const STORE = 'cd_customers';

export async function getCustomers(): Promise<Customer[]> {
  return loadAll<Customer>(STORE);
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const rows = await getCustomers();
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
  );
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const rows = await getCustomers();
  return rows.find((c) => c.id === id) ?? null;
}

export async function saveCustomer(input: Partial<Customer> & { name: string; phone: string }): Promise<Customer> {
  const now = new Date().toISOString();
  const rows = await getCustomers();
  const existingIdx = rows.findIndex((c) => c.id === input.id);
  let saved: Customer;
  if (existingIdx >= 0) {
    saved = { ...rows[existingIdx], ...input, updated_at: now } as Customer;
    rows[existingIdx] = saved;
  } else {
    saved = {
      id: input.id ?? uuid(),
      name: input.name.trim(),
      phone: input.phone.trim(),
      address: input.address ?? '',
      site_location: input.site_location ?? '',
      date: input.date ?? now.slice(0, 10),
      notes: input.notes ?? '',
      created_at: now,
      updated_at: now,
    };
    rows.unshift(saved);
  }
  await saveAll(STORE, rows);
  await AsyncStorage.setItem(`cd_customers_${saved.id}`, JSON.stringify(saved));
  await queueForSync('customers', saved.id);
  return saved;
}

export async function deleteCustomer(id: string): Promise<void> {
  const rows = await getCustomers();
  await saveAll(STORE, rows.filter((c) => c.id !== id));
  await AsyncStorage.removeItem(`cd_customers_${id}`);
}

export async function countCustomers(): Promise<number> {
  return (await getCustomers()).length;
}

export async function countNewCustomersThisMonth(): Promise<number> {
  const rows = await getCustomers();
  const now = new Date();
  return rows.filter((c) => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
}
