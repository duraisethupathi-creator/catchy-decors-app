import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { autoSyncTwoDevices } from '../src/services/db';
import { runDailyAutoBackup } from '../src/services/backupService';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { SettingsProvider } from '../src/context/SettingsContext';
import { colors } from '../src/constants/colors';

export default function RootLayout() {
  useEffect(() => {
    runDailyAutoBackup().catch(() => {});
    autoSyncTwoDevices().catch(() => {});
    const timer = setInterval(() => { autoSyncTwoDevices().catch(() => {}); }, 60000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') autoSyncTwoDevices().catch(() => {}); });
    return () => { clearInterval(timer); sub.remove(); };
  }, []);

  return (
    <SettingsProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="customer/new" />
          <Stack.Screen name="customer/[id]" />
          <Stack.Screen name="customer/edit/[id]" />
          <Stack.Screen name="measurement/new" />
          <Stack.Screen name="quotation/new" />
          <Stack.Screen name="quotation/preview" />
          <Stack.Screen name="quotation/[id]" />
          <Stack.Screen name="service/new" />
          <Stack.Screen name="expense/index" />
          <Stack.Screen name="settings/profile" />
          <Stack.Screen name="settings/template" />
          <Stack.Screen name="settings/google" />
          <Stack.Screen name="settings/supabase" />
        </Stack>
      </AuthProvider>
    </SettingsProvider>
  );
}
