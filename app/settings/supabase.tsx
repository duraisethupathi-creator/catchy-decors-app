import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field } from '../../src/components/common';
import { toast, confirm } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { PermissionGuard } from '../../src/components/PermissionGuard';
import {
  clearSupabaseConfig,
  getSupabaseConfig,
  hydrateSupabaseConfig,
  isSupabaseConfigured,
  setSupabaseConfig,
  testConnection,
} from '../../src/services/supabaseClient';
import { autoSyncTwoDevices, getSyncState, onSyncStateChange, pushToSupabase, pullFromSupabase, type SyncState } from '../../src/services/db';

function SupabaseSettingsContent() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState<SyncState>({ pending: 0, lastSyncAt: null });
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await hydrateSupabaseConfig();
      const c = getSupabaseConfig();
      setUrl(c.url);
      setKey(c.key);
      setSync(await getSyncState());
    })();
    return onSyncStateChange(setSync);
  }, []);

  const connected = isSupabaseConfigured();

  async function save() {
    if (!url.trim() || !key.trim()) {
      toast('Enter both the project URL and the anon key');
      return;
    }
    if (!/^https:\/\/.+\.supabase\.co\/?$/.test(url.trim())) {
      toast('URL should look like https://<project>.supabase.co');
      return;
    }
    setBusy(true);
    try {
      await setSupabaseConfig(url, key);
      toast('Supabase credentials saved on this device');
      setSync(await getSyncState());
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      await setSupabaseConfig(url, key);
      const res = await testConnection();
      toast(res.message);
    } finally {
      setBusy(false);
    }
  }

  async function push() {
    setBusy(true);
    try {
      setSummary(null);
      const res = await pushToSupabase();
      setSummary(res.detail);
      setSync(await getSyncState());
      toast(res.ok ? 'Push complete' : res.detail);
    } finally {
      setBusy(false);
    }
  }

  async function pull() {
    setBusy(true);
    try {
      setSummary(null);
      const res = await pullFromSupabase();
      setSummary(res.detail);
      toast(res.ok ? 'Pull complete' : res.detail);
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    try {
      setSummary(null);
      const ok = await autoSyncTwoDevices();
      setSync(await getSyncState());
      toast(ok ? 'Two-device sync complete' : 'Sync could not complete. Check connection and cloud setup.');
    } finally {
      setBusy(false);
    }
  }

  async function forget() {
    await clearSupabaseConfig();
    setUrl('');
    setKey('');
    toast('Credentials removed from this device');
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Cloud Sync (Supabase)</Text>
      <Text style={styles.sub}>Optional. Paste your own project credentials — the app works fully offline without them.</Text>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Connection</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={connected ? styles.statusOk : styles.statusOff}>
            {connected ? '● Credentials saved' : '○ Not configured'}
          </Text>
        </View>
        <Field
          label="Project URL"
          value={url}
          onChangeText={setUrl}
          placeholder="https://abcdefgh.supabase.co"
        />
        <Field
          label="Anon / public API key"
          value={key}
          onChangeText={setKey}
          placeholder="eyJhbGciOi…"
          multiline
        />
        <Text style={styles.hint}>
          Find both in your Supabase dashboard → Project Settings → API. The anon key is designed for client apps —
          your data is protected by Row Level Security policies.
        </Text>
        <View style={{ gap: 10, marginTop: 10 }}>
          <Button title={busy ? 'Saving…' : 'Save Credentials'} icon="save" variant="accent" onPress={save} disabled={busy} />
          <Button title="Test Connection" icon="pulse" variant="outline" onPress={test} disabled={busy || !url || !key} />
          {connected ? (
            <Button
              title="Remove Credentials from Device"
              icon="trash"
              variant="ghost"
              onPress={() =>
                confirm('Remove Credentials', 'Cloud sync will stop until you add them again. Local data is untouched.', forget)
              }
            />
          ) : null}
        </View>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Manual Sync</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Queued changes</Text>
          <Text style={styles.statusValue}>{sync.pending}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Last sync</Text>
          <Text style={styles.statusValue}>
            {sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString() : 'Never'}
          </Text>
        </View>
        {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        <View style={{ gap: 10, marginTop: 8 }}>
          <Button
            title={busy ? 'Syncing…' : 'Sync Now (Safe 2-Device)'}
            icon="sync"
            variant="accent"
            onPress={syncNow}
            disabled={busy || !connected}
          />
          <Button
            title={busy ? 'Working…' : 'Push Local → Cloud'}
            icon="cloud-upload"
            variant="accent"
            onPress={push}
            disabled={busy || !connected}
          />
          <Button
            title="Pull Cloud → Local"
            icon="cloud-download"
            variant="outline"
            onPress={pull}
            disabled={busy || !connected}
          />
        </View>
        <Text style={styles.hint}>
          Sync Now safely pulls newer cloud records first, then uploads queued local changes. Automatic sync also runs when the app opens, returns to foreground, and every 60 seconds. Manual Push/Pull remain available for recovery.
        </Text>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Database Schema</Text>
        <Text style={styles.body}>
          Two SQL files ship with the project:
        </Text>
        <Text style={styles.mono}>supabase/001_initial_schema.sql</Text>
        <Text style={styles.mono}>supabase/002_schema_with_rls.sql</Text>
        <Text style={styles.hint}>
          Open your Supabase project → SQL Editor → paste the contents of 002_schema_with_rls.sql → Run. That creates
          the tables, indexes and Row Level Security policies needed by Push and Pull. Step-by-step instructions are in
          SETUP.md.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '900', color: colors.navy },
  sub: { color: colors.textMuted, fontSize: 13.5, marginTop: 4, lineHeight: 19 },
  section: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  statusLabel: { color: colors.textMuted, fontSize: 13 },
  statusValue: { color: colors.textDark, fontWeight: '700', fontSize: 13 },
  statusOk: { color: '#0E9A4C', fontWeight: '800', fontSize: 13.5 },
  statusOff: { color: colors.textMuted, fontWeight: '800', fontSize: 13.5 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  body: { color: colors.textDark, fontSize: 13, lineHeight: 19 },
  mono: { fontSize: 11.5, color: colors.navy, marginTop: 4, fontFamily: 'monospace' as never },
  summary: { color: colors.textDark, fontSize: 12.5, marginTop: 8, lineHeight: 18 },
});


export default function GuardedScreen() {
  return <PermissionGuard permission="cloud_sync.manage"><SupabaseSettingsContent /></PermissionGuard>;
}
