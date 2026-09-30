import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { APP_SCHEME } from '../constants/version';

WebBrowser.maybeCompleteAuthSession();

const STORE_ACCESS = 'cd_google_access';
const STORE_REFRESH = 'cd_google_refresh';
const STORE_PROFILE = 'cd_google_profile';

/** Scopes: identity + Drive app-data folder (files this app created only). */
export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.appdata',
];

export interface GoogleConfig {
  webClientId: string;
  androidClientId: string;
  iosClientId: string;
}

/**
 * Client IDs are read from app.json > expo.extra so they can be set without
 * touching code. They ship EMPTY on purpose: you must create your own OAuth
 * client in Google Cloud Console (see SETUP.md).
 */
export function getGoogleConfig(): GoogleConfig {
  const extra = (Constants?.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof extra[k] === 'string' ? (extra[k] as string) : '');
  return {
    webClientId: s('googleWebClientId') || s('googleClientId'),
    androidClientId: s('googleAndroidClientId'),
    iosClientId: s('googleIosClientId'),
  };
}

export function getActiveClientId(): string {
  const c = getGoogleConfig();
  if (Platform.OS === 'android') return c.androidClientId || c.webClientId;
  if (Platform.OS === 'ios') return c.iosClientId || c.webClientId;
  return c.webClientId;
}

export function isGoogleConfigured(): boolean {
  const c = getGoogleConfig();
  return Boolean(c.androidClientId || c.webClientId || c.iosClientId);
}

export const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/** OAuth redirect URI for the installed app (custom scheme from app.json). */
export function getRedirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: APP_SCHEME, path: 'oauthredirect' });
}

export interface GoogleSession {
  accessToken: string;
  refreshToken?: string;
  email?: string;
  name?: string;
  expiresAt?: number;
}

export async function saveSession(s: GoogleSession): Promise<void> {
  await SecureStore.setItemAsync(STORE_ACCESS, s.accessToken);
  if (s.refreshToken) await SecureStore.setItemAsync(STORE_REFRESH, s.refreshToken);
  await SecureStore.setItemAsync(
    STORE_PROFILE,
    JSON.stringify({ email: s.email ?? '', name: s.name ?? '', expiresAt: s.expiresAt ?? 0 })
  );
}

export async function getStoredSession(): Promise<GoogleSession | null> {
  try {
    const accessToken = await SecureStore.getItemAsync(STORE_ACCESS);
    if (!accessToken) return null;
    const refreshToken = (await SecureStore.getItemAsync(STORE_REFRESH)) ?? undefined;
    const raw = await SecureStore.getItemAsync(STORE_PROFILE);
    const p = raw ? (JSON.parse(raw) as { email?: string; name?: string; expiresAt?: number }) : {};
    return { accessToken, refreshToken, email: p.email, name: p.name, expiresAt: p.expiresAt };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_ACCESS).catch(() => {});
  await SecureStore.deleteItemAsync(STORE_REFRESH).catch(() => {});
  await SecureStore.deleteItemAsync(STORE_PROFILE).catch(() => {});
}

/** Exchange an authorization code (PKCE) when the provider returns a code instead of a token. */
export async function exchangeCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  clientId: string
): Promise<GoogleSession | null> {
  try {
    const res = await AuthSession.exchangeCodeAsync(
      { clientId, code, redirectUri, extraParams: { code_verifier: codeVerifier } },
      GOOGLE_DISCOVERY
    );
    return {
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      expiresAt: res.expiresIn ? Date.now() + res.expiresIn * 1000 : undefined,
    };
  } catch {
    return null;
  }
}

/** Refresh an expired access token using the stored refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = getActiveClientId();
  if (!clientId) return null;
  try {
    const res = await AuthSession.refreshAsync({ clientId, refreshToken }, GOOGLE_DISCOVERY);
    await SecureStore.setItemAsync(STORE_ACCESS, res.accessToken);
    return res.accessToken;
  } catch {
    return null;
  }
}

/** Fetch the signed-in account's email/name for display. */
export async function fetchUserInfo(accessToken: string): Promise<{ email?: string; name?: string }> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return {};
    const j = (await res.json()) as { email?: string; name?: string };
    return { email: j.email, name: j.name };
  } catch {
    return {};
  }
}

/** Returns a valid access token, refreshing it when necessary. */
export async function requireAccessToken(): Promise<string> {
  const s = await getStoredSession();
  if (!s) throw new Error('Not signed in with Google');
  const expired = s.expiresAt ? Date.now() > s.expiresAt - 60_000 : false;
  if (expired && s.refreshToken) {
    const fresh = await refreshAccessToken(s.refreshToken);
    if (fresh) return fresh;
  }
  return s.accessToken;
}
