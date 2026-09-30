/** Pure-JS base64 <-> bytes helpers (no Buffer / atob dependency, RN-safe). */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const LOOKUP: Record<string, number> = {};
for (let i = 0; i < CHARS.length; i++) LOOKUP[CHARS[i]] = i;

export function base64ToBytes(b64: string): Uint8Array {
  const clean = String(b64).replace(/[^A-Za-z0-9+/=]/g, '');
  const len = clean.length;
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array(Math.floor((len * 3) / 4) - pad);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const c1 = LOOKUP[clean[i]] ?? 0;
    const c2 = LOOKUP[clean[i + 1]] ?? 0;
    const c3 = LOOKUP[clean[i + 2]] ?? 0;
    const c4 = LOOKUP[clean[i + 3]] ?? 0;
    if (p < out.length) out[p++] = (c1 << 2) | (c2 >> 4);
    if (p < out.length) out[p++] = ((c2 & 15) << 4) | (c3 >> 2);
    if (p < out.length) out[p++] = ((c3 & 3) << 6) | c4;
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    out += CHARS[b1 >> 2];
    out += CHARS[((b1 & 3) << 4) | ((b2 ?? 0) >> 4)];
    out += i + 1 < bytes.length ? CHARS[((b2 & 15) << 2) | ((b3 ?? 0) >> 6)] : '=';
    out += i + 2 < bytes.length ? CHARS[(b3 ?? 0) & 63] : '=';
  }
  return out;
}

/** Split a data URI into its mime type and raw base64 payload. */
export function splitDataUri(uri: string): { mime: string; base64: string } | null {
  const m = /^data:([^;,]+);base64,(.+)$/i.exec(String(uri ?? '').trim());
  if (!m) return null;
  return { mime: m[1].toLowerCase(), base64: m[2] };
}

export function extForMime(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpeg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'png';
}
