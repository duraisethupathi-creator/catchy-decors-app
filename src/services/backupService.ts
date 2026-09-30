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
    (k) => k.startsWith('cd_') && !k.startsWith('cd_sync_') && !k.startsWith('cd_google_') && !k.startsWith('cd_pin_')
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

/** Write a backup payload back into AsyncStorage. Existing keys are overwritten. */
export async function restoreBackup(payload: BackupPayload): Promise<RestoreResult> {
  if (!payload || payload.app !== 'catchy-decors' || typeof payload.data !== 'object') {
    throw new Error('This file is not a CATCHY DECORS backup');
  }
  const entries = Object.entries(payload.data).filter(([k]) => k.startsWith('cd_'));
  let restored = 0;
  let skipped = 0;
  for (const [k, v] of entries) {
    try {
      await AsyncStorage.setItem(k, v);
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
