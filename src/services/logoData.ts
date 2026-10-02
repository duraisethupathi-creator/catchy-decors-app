import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

/**
 * Read a locally picked logo (file:// URI from the image picker) as a base64
 * data URI so it can be embedded straight into the print HTML.
 *
 * Returns '' on any failure — documents then fall back to the branded CD mark,
 * so a missing/unreadable logo never breaks PDF generation.
 */
export async function readLogoDataUri(uri: string | undefined | null): Promise<string> {
  if (!uri) {
    try {
      const asset = Asset.fromModule(require('../../assets/images/logo.png'));
      await asset.downloadAsync();
      uri = asset.localUri ?? asset.uri;
    } catch {
      return '';
    }
  }
  if (uri.startsWith('data:')) return uri;
  try {
    // asset:/ and other bundled URIs are not always readable by FileSystem.
    // Resolve the packaged default logo through expo-asset one more time when needed.
    if (!uri.startsWith('file:') && !uri.startsWith('content:')) {
      const asset = Asset.fromModule(require('../../assets/images/logo.png'));
      await asset.downloadAsync();
      if (asset.localUri) uri = asset.localUri;
    }
    const opts = { encoding: 'base64' } as unknown as Parameters<typeof FileSystem.readAsStringAsync>[1];
    const b64 = await FileSystem.readAsStringAsync(uri, opts);
    const ext = (uri.split('?')[0].split('.').pop() || 'png').toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    return `data:${mime};base64,${b64}`;
  } catch {
    return '';
  }
}
