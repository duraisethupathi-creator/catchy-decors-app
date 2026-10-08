import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchAllRows,
  hydrateSupabaseConfig,
  isSupabaseConfigured,
  upsertMany,
  upsertRow,
} from './supabaseClient';

/**
 * Local-first storage repository.
 * All data lives in AsyncStorage so the app is fully functional offline.
 * When Supabase credentials are configured (via app.json `extra`), the same
 * records are pushed to the cloud and conflicts resolve by `updated_at`.
 */

export interface SyncState {
  pending: number;
  lastSyncAt: string | null;
}

let listeners: Array<(s: SyncState) => void> = [];

export function onSyncStateChange(fn: (s: SyncState) => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

async function emit(state: SyncState): Promise<void> {
  listeners.forEach((l) => l(state));
}

export async function getSyncState(): Promise<SyncState> {
  try {
    const queue = await AsyncStorage.getItem('cd_sync_queue');
    const last = await AsyncStorage.getItem('cd_sync_last');
    return {
      pending: queue ? (JSON.parse(queue) as string[]).length : 0,
      lastSyncAt: last,
    };
  } catch {
    return { pending: 0, lastSyncAt: null };
  }
}

/** Queue a record for cloud sync (no-op queue if cloud not configured). */
export async function queueForSync(table: string, id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem('cd_sync_queue');
    const queue: string[] = raw ? JSON.parse(raw) : [];
    const entry = `${table}:${id}`;
    if (!queue.includes(entry)) queue.push(entry);
    await AsyncStorage.setItem('cd_sync_queue', JSON.stringify(queue));
    await emit(await getSyncState());
  } catch {
    // offline queue failure should never break the app
  }
}

/**
 * Attempt to sync queued records with Supabase.
 * Returns true when everything is synced (or nothing to sync).
 */
export async function syncWithSupabase(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem('cd_sync_queue');
    const queue: string[] = raw ? JSON.parse(raw) : [];
    if (queue.length === 0) {
      await AsyncStorage.setItem('cd_sync_last', new Date().toISOString());
      await emit(await getSyncState());
      return true;
    }
    if (!isSupabaseConfigured()) return false; // stay queued until credentials are set
    const remaining: string[] = [];
    for (const entry of queue) {
      const [table, id] = entry.split(':');
      const payload = await AsyncStorage.getItem(`cd_${table}_${id}`);
      if (!payload) continue; // record deleted locally
      const record = JSON.parse(payload);
      const res = await upsertRow(table, record);
      if (!res.ok) remaining.push(entry);
    }
    await AsyncStorage.setItem('cd_sync_queue', JSON.stringify(remaining));
    await AsyncStorage.setItem('cd_sync_last', new Date().toISOString());
    await emit(await getSyncState());
    return remaining.length === 0;
  } catch {
    return false;
  }
}

/**
 * Multi-device policy: Admin 1, Admin 2 and Staff share the same business data.
 * Authentication remains device-local; operational records below sync through
 * the shared Supabase workspace. Role permissions are enforced separately.
 */
/** Local store ⇄ cloud table mapping (customers first: quotations reference them). */
const SYNC_TARGETS: { table: string; store: string }[] = [
  { table: 'customers', store: 'cd_customers' },
  { table: 'quotations', store: 'cd_quotations' },
  { table: 'measurements', store: 'cd_measurements' },
  { table: 'accessories', store: 'cd_accessories' },
  { table: 'payments', store: 'cd_payments' },
  { table: 'expenses', store: 'cd_expenses' },
  { table: 'rate_library', store: 'cd_rate_library' },
  { table: 'service_bills', store: 'cd_service_bills' },
];

/** Drop undefined / non-finite values so PostgREST never rejects a payload. */
function cleanRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return out;
}

async function readStore(store: string): Promise<Record<string, unknown>[]> {
  try {
    const raw = await AsyncStorage.getItem(store);
    const rows = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

/**
 * Manual "Push Local → Cloud": upserts every local record and the settings blob.
 * Customers go first so quotations keep valid foreign keys. Batched 100 rows/request.
 */
export async function pushToSupabase(): Promise<{ ok: boolean; detail: string }> {
  await hydrateSupabaseConfig();
  if (!isSupabaseConfigured()) return { ok: false, detail: 'Add your Supabase URL and anon key first.' };
  const lines: string[] = [];
  let failed = 0;

  for (const { table, store } of SYNC_TARGETS) {
    const rows = (await readStore(store)).map(cleanRow);
    if (rows.length === 0) {
      lines.push(`${table}: nothing local`);
      continue;
    }
    let sent = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const res = await upsertMany(table, rows.slice(i, i + 100));
      if (!res.ok) {
        failed += 1;
        lines.push(`${table}: FAILED — ${res.error ?? 'unknown error'}`);
        break;
      }
      sent += Math.min(100, rows.length - i);
    }
    if (sent > 0) lines.push(`${table}: pushed ${sent}`);
  }

  // Business profile + template ride along as one app_settings row.
  try {
    const settingsRaw = await AsyncStorage.getItem('cd_app_settings');
    if (settingsRaw) {
      const res = await upsertRow('app_settings', { key: 'app_settings', value: JSON.parse(settingsRaw) });
      lines.push(res.ok ? 'app_settings: pushed' : `app_settings: skipped (${res.error ?? 'error'})`);
    }
  } catch {
    /* best-effort only — never fail the whole push for settings */
  }

  await AsyncStorage.setItem('cd_sync_last', new Date().toISOString());
  await AsyncStorage.setItem('cd_sync_queue', JSON.stringify([]));
  await emit(await getSyncState());
  return { ok: failed === 0, detail: lines.join('\n') };
}

/**
 * Manual "Pull Cloud → Local": merges cloud rows into this device by id
 * (cloud values win per field) and refreshes the per-record keys used by the queue.
 */
export async function pullFromSupabase(): Promise<{ ok: boolean; detail: string }> {
  await hydrateSupabaseConfig();
  if (!isSupabaseConfigured()) return { ok: false, detail: 'Add your Supabase URL and anon key first.' };
  const lines: string[] = [];
  let failed = 0;

  for (const { table, store } of SYNC_TARGETS) {
    const res = await fetchAllRows<Record<string, unknown>>(table);
    if (!res.ok) {
      failed += 1;
      lines.push(`${table}: FAILED — ${res.error ?? 'unknown error'}`);
      continue;
    }
    const local = await readStore(store);
    const byId = new Map<string, Record<string, unknown>>();
    for (const r of local) {
      if (r.id !== undefined) byId.set(String(r.id), r);
    }
    let merged = 0;
    for (const cloudRow of res.rows) {
      const id = String(cloudRow.id ?? '');
      if (!id) continue;
      const localRow = byId.get(id);
      const cloudClean = cleanRow(cloudRow);
      // Conflict protection: when both devices edited the same record,
      // keep the row with the newest updated_at (fallback created_at/date).
      const localStamp = String(localRow?.updated_at ?? localRow?.created_at ?? localRow?.date ?? '');
      const cloudStamp = String(cloudClean.updated_at ?? cloudClean.created_at ?? cloudClean.date ?? '');
      if (!localRow || !localStamp || !cloudStamp || cloudStamp >= localStamp) {
        byId.set(id, { ...(localRow ?? {}), ...cloudClean });
        merged += 1;
      }
    }
    const rows = Array.from(byId.values());
    await AsyncStorage.setItem(store, JSON.stringify(rows));
    for (const r of rows) {
      if (r.id !== undefined) await AsyncStorage.setItem(`cd_${table}_${String(r.id)}`, JSON.stringify(r));
    }
    lines.push(`${table}: ${merged} merged · ${rows.length} on device`);
  }

  await AsyncStorage.setItem('cd_sync_last', new Date().toISOString());
  await emit(await getSyncState());
  return { ok: failed === 0, detail: lines.join('\n') };
}


let autoSyncRunning = false;
/** Two-device background sync.
 * Pull first so the newest cloud timestamp wins before queued local records are sent.
 * Pull refreshes each per-record cache key, so a stale queued edit cannot overwrite a
 * newer version that another device already uploaded. New local-only rows stay queued
 * and are uploaded immediately afterwards.
 */
export async function autoSyncTwoDevices(): Promise<boolean> {
  if (autoSyncRunning) return false;
  autoSyncRunning = true;
  try {
    await hydrateSupabaseConfig();
    if (!isSupabaseConfigured()) return false;
    const pulled = await pullFromSupabase();
    if (!pulled.ok) return false;
    return await syncWithSupabase();
  } catch {
    return false;
  } finally {
    autoSyncRunning = false;
  }
}

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function loadAll<T>(storeKey: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(storeKey);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export async function saveAll<T>(storeKey: string, rows: T[]): Promise<void> {
  await AsyncStorage.setItem(storeKey, JSON.stringify(rows));
}
