/**
 * Pure numbering helpers — no storage imports, so they can be unit-tested in Node.
 */
export interface NumberingSpec {
  prefix: string;
  separator: string;
  includeYear: boolean;
  padding: number;
}

export function padSeq(n: number, len = 4): string {
  const width = Math.max(1, Math.min(8, Math.floor(len) || 4));
  return String(Math.max(0, Math.floor(n))).padStart(width, '0');
}

/** Build a document number from the user's editable numbering template. */
export function formatQuotationNumber(spec: NumberingSpec, seq: number, year: number): string {
  const sep = typeof spec.separator === 'string' ? spec.separator : '-';
  const parts: string[] = [];
  const prefix = (spec.prefix ?? '').trim();
  if (prefix) parts.push(prefix);
  if (spec.includeYear) parts.push(String(year));
  parts.push(padSeq(seq, spec.padding ?? 4));
  return parts.join(sep);
}
