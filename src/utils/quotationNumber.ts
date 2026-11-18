import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultTemplate } from '../services/settingsService';
import { allocateQuotationSequence, isSupabaseConfigured } from '../services/supabaseClient';
import { formatQuotationNumber } from './numbering';
import type { QuotationTemplate } from '../types/settings';

const KEY = 'cd_quotation_seq';
const QUOTATIONS_KEY = 'cd_quotations';
let memorySeq: number | null = null;

export { formatQuotationNumber } from './numbering';

/** Load the numbering part of the user's template (falls back to defaults). */
async function loadTemplate(): Promise<QuotationTemplate> {
  try {
    const raw = await AsyncStorage.getItem('cd_quotation_template');
    if (raw) return { ...defaultTemplate(), ...(JSON.parse(raw) as Partial<QuotationTemplate>) };
    const s = await AsyncStorage.getItem('cd_app_settings');
    if (s) {
      const parsed = JSON.parse(s) as { template?: Partial<QuotationTemplate> };
      if (parsed.template) return { ...defaultTemplate(), ...parsed.template };
    }
  } catch {
    /* fall through to defaults */
  }
  return defaultTemplate();
}

/**
 * Find the highest sequence already present in this device's synced quotation list.
 * Cloud sync stores the shared quotations in cd_quotations, but the old counter was
 * device-local only, so a freshly installed second device could start again at 1.
 */
async function highestLocalSequence(t: QuotationTemplate, year: number): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(QUOTATIONS_KEY);
    const rows = raw ? (JSON.parse(raw) as Array<{ quotation_number?: string }>) : [];
    const sep = typeof t.separator === 'string' ? t.separator : '-';
    const parts: string[] = [];
    const prefix = (t.prefix ?? '').trim();
    if (prefix) parts.push(prefix);
    if (t.includeYear) parts.push(String(year));
    const expectedStart = parts.length ? parts.join(sep) + sep : '';
    let highest = 0;
    for (const row of rows) {
      const number = String(row.quotation_number ?? '').trim();
      if (!number) continue;

      // First honour this device's configured number format.
      if (number.startsWith(expectedStart)) {
        const suffix = number.slice(expectedStart.length);
        if (/^\d+$/.test(suffix)) {
          highest = Math.max(highest, Number(suffix) || 0);
          continue;
        }
      }

      // A new device may not yet have the same numbering template. Recognise
      // already-synced quotation numbers even when their prefix/separator differs.
      if (t.includeYear && !number.includes(String(year))) continue;
      const suffixMatch = number.match(/(\d+)$/);
      if (suffixMatch) highest = Math.max(highest, Number(suffixMatch[1]) || 0);
    }
    return highest;
  } catch {
    return 0;
  }
}

/** Compute next sequence from both the local counter and synced quotation records. */
async function nextSequence(t: QuotationTemplate, year: number): Promise<number> {
  let storedSeq = 0;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as { year?: number; seq?: number }) : null;
    if (data?.year === year) storedSeq = Number(data.seq) || 0;
  } catch {
    /* local counter may be missing on a new device */
  }
  const existingSeq = await highestLocalSequence(t, year);
  return Math.max(storedSeq, existingSeq, memorySeq ?? 0, Math.max(0, t.startNumber - 1)) + 1;
}

/** Consume and return the next document number using the configured template.
 * Online devices use a database-atomic sequence, preventing simultaneous duplicate IDs.
 * Offline devices use a local fallback and reconcile on reconnect; offline-created IDs
 * must still be checked against cloud records before upload.
 */
export async function nextQuotationNumber(): Promise<string> {
  const t = await loadTemplate();
  const year = new Date().getFullYear();
  const startNumber = Math.max(1, Math.floor(t.startNumber) || 1);
  let seq: number;
  if (isSupabaseConfigured()) {
    const allocated = await allocateQuotationSequence((t.prefix ?? '').trim(), year, startNumber);
    if (!allocated.ok || !allocated.sequence) {
      throw new Error(
        'Could not reserve a unique quotation number from Supabase. Apply the quotation sequence SQL migration in Supabase, then try again. ' +
        (allocated.error ?? '')
      );
    }
    seq = allocated.sequence;
  } else {
    seq = await nextSequence(t, year);
  }
  await AsyncStorage.setItem(KEY, JSON.stringify({ year, seq }));
  memorySeq = seq;
  return formatQuotationNumber(t, seq, year);
}

/** Peek the next number without consuming it. */
export async function peekQuotationNumber(): Promise<string> {
  const t = await loadTemplate();
  const year = new Date().getFullYear();
  const seq = await nextSequence(t, year);
  return formatQuotationNumber(t, seq, year);
}

/** Reset the running sequence (Settings → Template → Numbering). */
export async function resetQuotationSequence(next = 1): Promise<void> {
  memorySeq = null;
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify({ year: new Date().getFullYear(), seq: Math.max(0, next - 1) })
  );
}
