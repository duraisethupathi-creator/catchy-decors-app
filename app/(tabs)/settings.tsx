import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, Field } from '../../src/components/common';
import { confirm, toast } from '../../src/components/common/ui';
import { Logo } from '../../src/components/common/Logo';
import { getBrandLogo } from '../../src/constants/company';
import { colors } from '../../src/constants/colors';
import { APP_PACKAGE, APP_VERSION } from '../../src/constants/version';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { changePassword, logout } from '../../src/services/authService';
import { getSyncState, syncWithSupabase } from '../../src/services/db';
import { isSupabaseConfigured, hydrateSupabaseConfig } from '../../src/services/supabaseClient';
import { getStoredSession } from '../../src/services/googleAuth';

export default function Settings() {
  const { user, refresh } = useAuth();
  const { settings, reset } = useSettings();
  const [sync, setSync] = useState({ pending: 0, lastSyncAt: null as string | null });
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSyncState().then(setSync);
      (async () => {
        await hydrateSupabaseConfig();
        setCloudReady(isSupabaseConfigured());
        const g = await getStoredSession();
        setGoogleEmail(g?.email ?? null);
      })();
    }, [])
  );

  async function doChangePassword() {
    if (!user) return;
    const res = await changePassword(user.id, curPw, newPw);
    if (res.ok) {
      toast('Password changed');
      setCurPw('');
      setNewPw('');
    } else {
      toast(res.error ?? 'Failed');
    }
  }

  function doLogout() {
    confirm('Logout', 'Are you sure you want to logout?', async () => {
      await logout();
      await refresh();
      router.replace('/(auth)/login');
    });
  }

  async function syncNow() {
    toast('Syncing…');
    const ok = await syncWithSupabase();
    setSync(await getSyncState());
    toast(ok ? 'Sync complete' : 'Not configured — data stays safe offline');
  }

  const logoSource = settings.profile.logoUri ? { uri: settings.profile.logoUri } : getBrandLogo();

  const rows: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; route: string; tint: string }[] = [
    {
      icon: 'business',
      title: 'Business Profile',
      sub: 'Name, logo, address, contact, bank details',
      route: '/settings/profile',
      tint: colors.navy,
    },
    {
      icon: 'document-text',
      title: 'Quotation & Invoice Template',
      sub: 'Numbering, titles, columns, GST, terms',
      route: '/settings/template',
      tint: colors.orange,
    },
    {
      icon: 'logo-google',
      title: 'Google Account & Drive Backup',
      sub: googleEmail ? `Signed in · ${googleEmail}` : 'Sign in and back up your data',
      route: '/settings/google',
      tint: '#0E9A4C',
    },
    {
      icon: 'cloud-upload',
      title: 'Cloud Sync (Supabase)',
      sub: cloudReady ? `Credentials saved · ${sync.pending} queued` : 'Paste URL + anon key to enable',
      route: '/settings/supabase',
      tint: '#6B34C7',
    },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.header}>Settings</Text>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Logo size={52} image={logoSource} />
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={styles.companyName}>{settings.profile.name}</Text>
            <Text style={styles.companySub}>{settings.profile.phone} · {settings.profile.website}</Text>
          </View>
        </View>
      </Card>

      <Text style={styles.groupLabel}>Customisation</Text>
      {rows.map((r) => (
        <TouchableOpacity key={r.route} style={styles.navRow} onPress={() => router.push(r.route as never)} activeOpacity={0.85}>
          <View style={[styles.navIcon, { backgroundColor: r.tint + '18' }]}>
            <Ionicons name={r.icon} size={20} color={r.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>{r.title}</Text>
            <Text style={styles.navSub} numberOfLines={1}>{r.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ))}

      <Text style={styles.groupLabel}>Data & Sync</Text>
      <Card>
        <Text style={styles.note}>
          {sync.pending > 0
            ? `${sync.pending} record(s) waiting to sync.`
            : 'Everything is stored on this device. Add Google Drive backup or Supabase sync above.'}
        </Text>
        <Button title="Sync Now (Supabase)" icon="cloud-upload-outline" variant="accent" onPress={syncNow} />
      </Card>

      <Text style={styles.groupLabel}>Account</Text>
      <Card>
        <Text style={styles.note}>Signed in as {user?.name} ({user?.role})</Text>
        <Field label="Current Password" value={curPw} onChangeText={setCurPw} secure />
        <Field label="New Password" value={newPw} onChangeText={setNewPw} secure />
        <Button title="Change Password" icon="key-outline" onPress={doChangePassword} />
        <Button title="Logout" icon="log-out-outline" variant="danger" style={{ marginTop: 10 }} onPress={doLogout} />
      </Card>

      <Text style={styles.groupLabel}>Reset</Text>
      <Card>
        <Text style={styles.note}>Restore business details and the document template to their factory values. Customers, quotations and measurements are not touched.</Text>
        <Button
          title="Reset Customisation"
          icon="refresh"
          variant="outline"
          onPress={() =>
            confirm('Reset Customisation', 'Restore the business profile and template to defaults?', async () => {
              await reset();
              toast('Customisation reset');
            })
          }
        />
      </Card>

      <Text style={styles.version}>CATCHY DECORS · v{APP_VERSION} ({APP_PACKAGE})</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { fontSize: 24, fontWeight: '900', color: colors.navy, paddingBottom: 14 },
  groupLabel: { fontSize: 13, fontWeight: '800', color: colors.textMuted, marginTop: 20, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  companyName: { fontWeight: '900', color: colors.navy, fontSize: 16 },
  companySub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    gap: 12,
  },
  navIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontWeight: '800', color: colors.navy, fontSize: 14.5 },
  navSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  note: { color: colors.textMuted, fontSize: 12.5, marginBottom: 10, lineHeight: 18 },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 11.5, marginTop: 18 },
});
