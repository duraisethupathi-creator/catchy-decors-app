import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import type { AppUser } from './authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = 'cd_biometric_enabled';
const USER_KEY = 'cd_biometric_user';

export async function biometricAvailable(): Promise<boolean> {
  const hardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return hardware && enrolled;
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ENABLED_KEY)) === '1';
}

export async function enableBiometric(user: AppUser): Promise<{ ok: boolean; error?: string }> {
  if (!(await biometricAvailable())) return { ok: false, error: 'Fingerprint / biometric is not set up on this phone' };
  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Enable fingerprint login',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  if (!auth.success) return { ok: false, error: 'Biometric verification cancelled or failed' };
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  await SecureStore.setItemAsync(ENABLED_KEY, '1');
  return { ok: true };
}

export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(ENABLED_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function biometricLogin(): Promise<{ user?: AppUser; error?: string }> {
  if (!(await isBiometricEnabled())) return { error: 'Fingerprint login is not enabled' };
  if (!(await biometricAvailable())) return { error: 'Fingerprint / biometric is unavailable' };
  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Catchy Decors',
    cancelLabel: 'Use Password',
    fallbackLabel: 'Use device PIN',
    disableDeviceFallback: false,
  });
  if (!auth.success) return { error: 'Biometric verification failed' };
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return { error: 'Saved biometric account not found' };
  try {
    const user = JSON.parse(raw) as AppUser;
    await AsyncStorage.setItem('cd_session', JSON.stringify(user));
    return { user };
  } catch {
    return { error: 'Saved biometric account is invalid' };
  }
}
