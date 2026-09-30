import { BACKUP_FILE_NAME } from '../constants/version';
import type { BackupPayload } from '../types/settings';
import { requireAccessToken } from './googleAuth';

/**
 * Google Drive REST v3 client for the private app-data folder (scope drive.appdata).
 * Files here are invisible in the user's Drive UI and can only be touched by this app.
 */

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await requireAccessToken();
  return { Authorization: `Bearer ${token}` };
}

/** List our backup files inside appDataFolder (newest first). */
export async function listBackups(): Promise<DriveFile[]> {
  const headers = await authHeaders();
  const q = encodeURIComponent(`name = '${BACKUP_FILE_NAME}' and trashed = false`);
  const url = `${DRIVE}?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Drive list failed (HTTP ${res.status})`);
  const j = (await res.json()) as { files?: DriveFile[] };
  return j.files ?? [];
}

/** Create the backup file in appDataFolder. */
async function createFile(payload: BackupPayload): Promise<DriveFile> {
  const headers = await authHeaders();
  const metadata = { name: BACKUP_FILE_NAME, parents: ['appDataFolder'] };
  const boundary = 'catchydecors-backup-boundary';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(payload)}\r\n` +
    `--${boundary}--`;

  const res = await fetch(`${UPLOAD}?uploadType=multipart&fields=id,name,modifiedTime,size`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload failed (HTTP ${res.status})`);
  return (await res.json()) as DriveFile;
}

/** Overwrite an existing backup file's content. */
async function updateFile(fileId: string, payload: BackupPayload): Promise<DriveFile> {
  const headers = await authHeaders();
  const res = await fetch(`${UPLOAD}/${fileId}?uploadType=media&fields=id,name,modifiedTime,size`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Drive update failed (HTTP ${res.status})`);
  return (await res.json()) as DriveFile;
}

/** Upload a backup, replacing the existing one when present. Returns the Drive file. */
export async function uploadBackup(payload: BackupPayload): Promise<{ file: DriveFile; created: boolean }> {
  const existing = await listBackups();
  if (existing.length > 0) {
    const file = await updateFile(existing[0].id, payload);
    return { file, created: false };
  }
  const file = await createFile(payload);
  return { file, created: true };
}

/** Download and parse the newest backup from appDataFolder. */
export async function downloadBackup(): Promise<{ payload: BackupPayload; file: DriveFile }> {
  const files = await listBackups();
  if (files.length === 0) throw new Error('No backup found in Google Drive for this account');
  const target = files[0];
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE}/${target.id}?alt=media`, { headers });
  if (!res.ok) throw new Error(`Drive download failed (HTTP ${res.status})`);
  const payload = (await res.json()) as BackupPayload;
  return { payload, file: target };
}

/** Metadata of the most recent backup, for the settings screen. */
export async function getLatestBackupInfo(): Promise<DriveFile | null> {
  try {
    const files = await listBackups();
    return files[0] ?? null;
  } catch {
    return null;
  }
}

/** Quick reachability probe used by the "Test connection" button. */
export async function testDriveAccess(): Promise<{ ok: boolean; message: string }> {
  try {
    const files = await listBackups();
    return { ok: true, message: `Connected. ${files.length} backup file(s) found.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
