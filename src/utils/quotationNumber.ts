import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultTemplate } from '../services/settingsService';
import { formatQuotationNumber } from './numbering';
import type { QuotationTemplate } from '../types/settings';

const KEY = 'cd_quotation_seq';
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

/** Consume and return the next document number using the configured template. */
export async function nextQuotationNumber(): Promise<string> {
  const t = await loadTemplate();
  const year = new Date().getFullYear();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as { year?: number; seq?: number }) : null;
    const seq = data && data.year === year ? (data.seq ?? 0) + 1 : Math.max(1, t.startNumber);
    await AsyncStorage.setItem(KEY, JSON.stringify({ year, seq }));
    memorySeq = seq;
    return formatQuotationNumber(t, seq, year);
  } catch {
    const seq = (memorySeq ?? t.startNumber - 1) + 1;
    memorySeq = seq;
    return formatQuotationNumber(t, seq, year);
  }
}

/** Peek the next number without consuming it. */
export async function peekQuotationNumber(): Promise<string> {
  const t = await loadTemplate();
  const year = new Date().getFullYear();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as { year?: number; seq?: number }) : null;
    const seq = data && data.year === year ? (data.seq ?? 0) + 1 : Math.max(1, t.startNumber);
    return formatQuotationNumber(t, seq, year);
  } catch {
    return formatQuotationNumber(t, memorySeq ? memorySeq + 1 : t.startNumber, year);
  }
}

/** Reset the running sequence (Settings → Template → Numbering). */
export async function resetQuotationSequence(next = 1): Promise<void> {
  memorySeq = null;
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify({ year: new Date().getFullYear(), seq: Math.max(0, next - 1) })
  );
}
