import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

const STORE_ACCESS = 'cd_google_access';
const STORE_PROFILE = 'cd_google_profile';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
];

export interface GoogleConfig {
  webClientId: string;
  androidClientId: string;
  iosClientId: string;
}

export function getGoogleConfig(): GoogleConfig {
  const extra = (Constants?.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof extra[k] === 'string' ? (extra[k] as string) : '');
  return {
    webClientId: s('googleWebClientId') || s('googleClientId'),
    androidClientId: s('googleAndroidClientId'),
    iosClientId: s('googleIosClientId'),
  };
}

export function isGoogleConfigured(): boolean {
  const c = getGoogleConfig();
  return Boolean(c.webClientId && c.androidClientId);
}

let configured = false;
export function configureGoogleSignIn(): void {
  if (configured) return;
  const c = getGoogleConfig();
  GoogleSignin.configure({
    webClientId: c.webClientId,
    scopes: GOOGLE_SCOPES,
  });
  configured = true;
}

export interface GoogleSession {
  accessToken: string;
  email?: string;
  name?: string;
}

export async function saveSession(s: GoogleSession): Promise<void> {
  await SecureStore.setItemAsync(STORE_ACCESS, s.accessToken);
  await SecureStore.setItemAsync(
    STORE_PROFILE,
    JSON.stringify({ email: s.email ?? '', name: s.name ?? '' })
  );
}

export async function getStoredSession(): Promise<GoogleSession | null> {
  try {
    const accessToken = await SecureStore.getItemAsync(STORE_ACCESS);
    if (!accessToken) return null;
    const raw = await SecureStore.getItemAsync(STORE_PROFILE);
    const p = raw ? (JSON.parse(raw) as { email?: string; name?: string }) : {};
    return { accessToken, email: p.email, name: p.name };
  } catch {
    return null;
  }
}

export async function signInWithGoogle(): Promise<GoogleSession | null> {
  configureGoogleSignIn();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  const tokens = await GoogleSignin.getTokens();
  const user = response.data.user;
  const session = {
    accessToken: tokens.accessToken,
    email: user.email,
    name: user.name ?? undefined,
  };
  await saveSession(session);
  return session;
}

export async function clearSession(): Promise<void> {
  configureGoogleSignIn();
  await GoogleSignin.signOut().catch(() => {});
  await SecureStore.deleteItemAsync(STORE_ACCESS).catch(() => {});
  await SecureStore.deleteItemAsync(STORE_PROFILE).catch(() => {});
}

export async function requireAccessToken(): Promise<string> {
  configureGoogleSignIn();
  try {
    const tokens = await GoogleSignin.getTokens();
    if (tokens.accessToken) {
      await SecureStore.setItemAsync(STORE_ACCESS, tokens.accessToken);
      return tokens.accessToken;
    }
  } catch {
    // Fall back to the last securely stored token so the UI can show a useful API error.
  }
  const s = await getStoredSession();
  if (!s?.accessToken) throw new Error('Not signed in with Google');
  return s.accessToken;
}
