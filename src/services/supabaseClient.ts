/**
 * Minimal, dependency-free Supabase REST client (PostgREST).
 *
 * Credentials are supplied MANUALLY by the user in Settings → Cloud Sync and
 * stored locally in AsyncStorage. The app remains fully offline-capable either way.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const SUPABASE_URL_KEY = 'cd_supabase_url';
export const SUPABASE_KEY_KEY = 'cd_supabase_key';

let url = '';
let key = '';
let hydrated = false;

/** Read credentials that were previously saved on this device (or from app.json extra). */
export async function hydrateSupabaseConfig(): Promise<void> {
  if (hydrated) return;
  try {
    const [u, k] = await AsyncStorage.multiGet([SUPABASE_URL_KEY, SUPABASE_KEY_KEY]);
    if (u[1]) url = u[1].trim();
    if (k[1]) key = k[1].trim();
    if (!url || !key) {
      const extra = (Constants?.expoConfig?.extra ?? {}) as Record<string, unknown>;
      url = url || ((extra.supabaseUrl as string) ?? '').trim();
      key = key || ((extra.supabaseAnonKey as string) ?? '').trim();
    }
  } catch {
    /* keep whatever we have */
  }
  hydrated = true;
}

/** Save credentials coming from the Cloud Sync settings screen. */
export async function setSupabaseConfig(newUrl: string, newKey: string): Promise<void> {
  url = newUrl.trim().replace(/\/+$/, '');
  key = newKey.trim();
  hydrated = true;
  await AsyncStorage.setItem(SUPABASE_URL_KEY, url);
  await AsyncStorage.setItem(SUPABASE_KEY_KEY, key);
}

export async function clearSupabaseConfig(): Promise<void> {
  url = '';
  key = '';
  hydrated = true;
  await AsyncStorage.removeItem(SUPABASE_URL_KEY);
  await AsyncStorage.removeItem(SUPABASE_KEY_KEY);
}

export function getSupabaseConfig(): { url: string; key: string } {
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return url.length > 0 && key.length > 0;
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

/** Upsert a single record via PostgREST. */
export async function upsertRow(
  table: string,
  record: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  await hydrateSupabaseConfig();
  if (!isSupabaseConfigured()) return { ok: false, error: 'not-configured' };
  try {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(record),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${await safeText(res)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Fetch every row of a table (used by the pull/restore direction). */
export async function fetchAllRows<T = Record<string, unknown>>(
  table: string
): Promise<{ ok: boolean; rows: T[]; error?: string }> {
  await hydrateSupabaseConfig();
  if (!isSupabaseConfigured()) return { ok: false, rows: [], error: 'not-configured' };
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=*`, { headers: headers() });
    if (!res.ok) return { ok: false, rows: [], error: `HTTP ${res.status} ${await safeText(res)}` };
    return { ok: true, rows: (await res.json()) as T[] };
  } catch (e) {
    return { ok: false, rows: [], error: String(e) };
  }
}

/** Insert/update many rows in one request. */
export async function upsertMany(
  table: string,
  rows: Record<string, unknown>[]
): Promise<{ ok: boolean; error?: string }> {
  await hydrateSupabaseConfig();
  if (!isSupabaseConfigured()) return { ok: false, error: 'not-configured' };
  if (rows.length === 0) return { ok: true };
  try {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${await safeText(res)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Connectivity + credential check for the settings screen. */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  await hydrateSupabaseConfig();
  if (!isSupabaseConfigured()) return { ok: false, message: 'Add your project URL and anon key first.' };
  if (!/^https:\/\/.+\.supabase\.co$/.test(url)) {
    return { ok: false, message: 'URL should look like https://<project>.supabase.co' };
  }
  try {
    const res = await fetch(`${url}/rest/v1/customers?select=id&limit=1`, { headers: headers() });
    if (res.status === 404) return { ok: false, message: 'Connected, but the "customers" table is missing. Run the SQL schema.' };
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'Rejected — check the anon key and RLS policies.' };
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    return { ok: true, message: 'Connected successfully.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '';
  }
}

/** Tables that take part in sync (order matters for referential sanity). */
export const SYNC_TABLES = ['customers', 'quotations', 'measurements', 'accessories', 'app_settings'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];
