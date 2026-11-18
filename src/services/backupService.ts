import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKUP_VERSION } from '../constants/version';
import type { BackupPayload } from '../types/settings';

/** Every local store the app owns — all of it is part of a backup. */
const DATA_KEYS = [
  'cd_customers',
  'cd_quotations',
  'cd_measurements',
  'cd_accessories_',
  'cd_app_settings',
  'cd_company_profile',
  'cd_quotation_template',
  'cd_supabase_url',
  'cd_supabase_key',
];

/** Snapshot every app-owned AsyncStorage key into a portable JSON object. */
export async function collectBackup(): Promise<BackupPayload> {
  const allKeys = await AsyncStorage.getAllKeys();
  const owned = allKeys.filter(
    (k) => k.startsWith('cd_') && !k.startsWith('cd_sync_') && !k.startsWith('cd_google_') && !k.startsWith('cd_pin_') && !['cd_session','cd_role','cd_users','cd_remember'].includes(k)
  );
  const pairs = await AsyncStorage.multiGet(owned);
  const data: Record<string, string> = {};
  for (const [k, v] of pairs) {
    if (v !== null) data[k] = v;
  }
  return {
    app: 'catchy-decors',
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    device: 'android',
    data,
  };
}

export interface RestoreResult {
  restored: number;
  skipped: number;
}

/** Restore without silently deleting records already present on this device. */
export async function restoreBackup(payload: BackupPayload): Promise<RestoreResult> {
  if (!payload || payload.app !== 'catchy-decors' || typeof payload.data !== 'object') {
    throw new Error('This file is not a CATCHY DECORS backup');
  }
  const entries = Object.entries(payload.data).filter(([k]) => k.startsWith('cd_') && !['cd_session','cd_role','cd_users','cd_remember'].includes(k));
  let restored = 0;
  let skipped = 0;
  for (const [k, v] of entries) {
    try {
      const currentRaw = await AsyncStorage.getItem(k);
      let nextValue = v;
      if (currentRaw) {
        try {
          const current = JSON.parse(currentRaw);
          const incoming = JSON.parse(v);
          if (Array.isArray(current) && Array.isArray(incoming)) {
            const byId = new Map<string, unknown>();
            for (const row of current) {
              const id = row && typeof row === 'object' ? String((row as {id?: unknown}).id ?? '') : '';
              if (id) byId.set(id, row);
            }
            for (const row of incoming) {
              const id = row && typeof row === 'object' ? String((row as {id?: unknown}).id ?? '') : '';
              if (id) byId.set(id, row);
            }
            nextValue = JSON.stringify([...byId.values()]);
          }
        } catch {
          // Preserve normal scalar/object restore behavior for non-record settings.
        }
      }
      await AsyncStorage.setItem(k, nextValue);
      restored += 1;
    } catch {
      skipped += 1;
    }
  }
  return { restored, skipped };
}

/** SUMMARY_KEYS lets the UI show a preview of what a backup holds. */
export function summariseBackup(payload: BackupPayload): { key: string; records: number }[] {
  const out: { key: string; records: number }[] = [];
  for (const [k, v] of Object.entries(payload.data)) {
    let records = 0;
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) records = parsed.length;
      else records = 1;
    } catch {
      records = 1;
    }
    out.push({ key: k, records });
  }
  return out.sort((a, b) => b.records - a.records);
}

export function backupFileName(nameHint?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const clean = (nameHint ?? 'CatchyDecors').replace(/[^a-zA-Z0-9]/g, '');
  return `CatchyDecors-Backup-${clean}-${date}.json`;
}


const AUTO_BACKUP_KEY = 'cd_auto_backup';
const AUTO_BACKUP_LAST_KEY = 'cd_auto_backup_last';

function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Run at most one Drive backup per local calendar day when enabled and signed in. */
export async function runDailyAutoBackup(): Promise<boolean> {
  const enabled = await AsyncStorage.getItem(AUTO_BACKUP_KEY);
  if (enabled !== '1') return false;
  const today = localDateKey();
  if ((await AsyncStorage.getItem(AUTO_BACKUP_LAST_KEY)) === today) return false;
  const { getStoredSession } = await import('./googleAuth');
  if (!(await getStoredSession())) return false;
  const { uploadBackup } = await import('./googleDrive');
  await uploadBackup(await collectBackup());
  await AsyncStorage.setItem(AUTO_BACKUP_LAST_KEY, today);
  return true;
}
