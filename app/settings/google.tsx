import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Button, Card } from '../../src/components/common';
import { toast, confirm } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import {
  clearSession,
  getStoredSession,
  isGoogleConfigured,
  signInWithGoogle,
} from '../../src/services/googleAuth';
import { downloadBackup, getLatestBackupInfo, testDriveAccess, uploadBackup, type DriveFile } from '../../src/services/googleDrive';
import { backupFileName, collectBackup, restoreBackup, summariseBackup } from '../../src/services/backupService';
import { useAuth } from '../../src/context/AuthContext';

export default function GoogleSettings() {
  const { refresh } = useAuth();
  const configured = isGoogleConfigured();

  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastFile, setLastFile] = useState<DriveFile | null>(null);
  const [backupTime, setBackupTime] = useState<string | null>(null);
  const [autoBackup, setAutoBackup] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('cd_auto_backup').then((v) => setAutoBackup(v === '1'));
  }, []);

  async function toggleAutoBackup(value: boolean) {
    setAutoBackup(value);
    await AsyncStorage.setItem('cd_auto_backup', value ? '1' : '0');
    toast(value ? 'Daily auto backup enabled' : 'Auto backup disabled');
  }

  async function googleSignIn() {
    setBusy(true);
    try {
      const session = await signInWithGoogle();
      if (!session) {
        toast('Google sign-in was cancelled');
        return;
      }
      setEmail(session.email ?? null);
      toast(`Signed in as ${session.email ?? 'Google user'}`);
      await refresh();
      await loadState();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await clearSession();
    setEmail(null);
    setLastFile(null);
    toast('Signed out of Google');
  }

  async function testConnection() {
    setBusy(true);
    try {
      const res = await testDriveAccess();
      toast(res.message);
    } finally {
      setBusy(false);
    }
  }

  async function backupNow() {
    setBusy(true);
    try {
      const payload = await collectBackup();
      const { file, created } = await uploadBackup(payload);
      setLastFile(file);
      setBackupTime(new Date().toLocaleString());
      const keys = Object.keys(payload.data).length;
      toast(`${created ? 'Backup created' : 'Backup updated'} — ${keys} data store(s)`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Backup failed');
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    try {
      const { payload, file } = await downloadBackup();
      const summary = summariseBackup(payload);
      const total = summary.reduce((s, x) => s + x.records, 0);
      confirm(
        'Restore from Drive',
        `Backup from ${new Date(payload.createdAt).toLocaleString()} contains ${total} record(s). This will overwrite local data. Continue?`,
        async () => {
          const res = await restoreBackup(payload);
          setBackupTime(new Date(file.modifiedTime ?? Date.now()).toLocaleString());
          toast(`Restored ${res.restored} store(s)${res.skipped ? `, skipped ${res.skipped}` : ''}`);
          await refresh();
        }
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setBusy(false);
    }
  }

  async function showContents() {
    const payload = await collectBackup();
    const summary = summariseBackup(payload);
    const lines = summary.map((s) => `• ${s.key.replace('cd_', '')}: ${s.records}`);
    confirm('What gets backed up', lines.join('\n') || 'No local data yet', () => {});
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.title}>Google Account & Drive Backup</Text>
      <Text style={styles.sub}>Sign in with Google and keep a private copy of your data in Drive</Text>

      {!configured ? (
        <Card style={{ marginTop: 14 }}>
          <Text style={styles.warnTitle}>⚙️ One-time setup required</Text>
          <Text style={styles.body}>
            Google sign-in needs OAuth client IDs that only the app owner can create. Until they are added, this
            screen cannot start the sign-in flow.
          </Text>
          <Text style={styles.stepTitle}>Do this once (about 10 minutes):</Text>
          <Text style={styles.step}>1. Create a project at console.cloud.google.com</Text>
          <Text style={styles.step}>2. Enable the Google Drive API</Text>
          <Text style={styles.step}>3. Configure the OAuth consent screen (External, add your own email as a test user)</Text>
          <Text style={styles.step}>4. Create an OAuth client → type Android · package name com.catchydecors.app · paste your SHA-1</Text>
          <Text style={styles.step}>5. Create a second client → type Web application</Text>
          <Text style={styles.step}>6. Copy both client IDs into app.json → expo.extra</Text>
          <View style={styles.codeBox}>
            <Text style={styles.code}>
              {`"extra": {\n  "googleAndroidClientId": "…apps.googleusercontent.com",\n  "googleWebClientId": "…apps.googleusercontent.com"\n}`}
            </Text>
          </View>
          <Text style={styles.hint}>
            Get your SHA-1 with:  eas credentials → android → Keystore → SHA-1 Fingerprint. Full walkthrough is in
            SETUP.md inside the project.
          </Text>
        </Card>
      ) : (
        <>
          <Card style={{ marginTop: 14 }}>
            <Text style={styles.section}>Account</Text>
            {email ? (
              <>
                <View style={styles.statusRow}>
                  <Text style={styles.statusOk}>● Signed in</Text>
                  <Text style={styles.email} numberOfLines={1}>{email}</Text>
                </View>
                <Text style={styles.hint}>Backups are stored in this account’s private app folder (drive.appdata) — they never appear in your normal Drive listing.</Text>
                <Button title="Sign out" icon="log-out-outline" variant="outline" onPress={signOut} />
              </>
            ) : (
              <>
                <Text style={styles.body}>Sign in to enable backup and restore.</Text>
                <Button
                  title={busy ? 'Opening Google…' : 'Sign in with Google'}
                  icon="logo-google"
                  onPress={googleSignIn}
                  disabled={busy}
                />
              </>
            )}
          </Card>

          {email ? (
            <>
              <Card style={{ marginTop: 14 }}>
                <Text style={styles.section}>Backup & Restore</Text>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Last Drive backup</Text>
                  <Text style={styles.statusValue}>
                    {lastFile ? new Date(lastFile.modifiedTime ?? '').toLocaleString() : 'None yet'}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>This session</Text>
                  <Text style={styles.statusValue}>{backupTime ?? '—'}</Text>
                </View>
                <Text style={styles.hint}>Filename in Drive: {backupFileName()}</Text>
                <View style={styles.autoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.autoTitle}>Daily Auto Backup</Text>
                    <Text style={styles.hint}>Automatically backs up at most once per day while the app is open and Google is signed in.</Text>
                  </View>
                  <Switch value={autoBackup} onValueChange={toggleAutoBackup} />
                </View>
                <View style={{ gap: 10, marginTop: 8 }}>
                  <Button title={busy ? 'Working…' : 'Back up now to Google Drive'} icon="cloud-upload" variant="accent" onPress={backupNow} disabled={busy} />
                  <Button title="Restore from Google Drive" icon="cloud-download" variant="outline" onPress={restore} disabled={busy} />
                  <Button title="Test Drive Connection" icon="pulse" variant="ghost" onPress={testConnection} disabled={busy} />
                  <Button title="What gets backed up?" icon="list" variant="ghost" onPress={showContents} disabled={busy} />
                </View>
              </Card>

            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '900', color: colors.navy },
  sub: { color: colors.textMuted, fontSize: 13.5, marginTop: 4, lineHeight: 19 },
  section: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },
  warnTitle: { fontSize: 16, fontWeight: '900', color: '#C77700', marginBottom: 8 },
  body: { color: colors.textDark, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  stepTitle: { fontWeight: '800', color: colors.navy, fontSize: 13.5, marginTop: 6, marginBottom: 6 },
  step: { color: colors.textDark, fontSize: 12.5, lineHeight: 19 },
  codeBox: { backgroundColor: '#0F172A', borderRadius: 10, padding: 12, marginTop: 10 },
  code: { color: '#7EE787', fontSize: 10.5, fontFamily: 'monospace' as never },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  statusOk: { color: '#0E9A4C', fontWeight: '800', fontSize: 13.5 },
  statusLabel: { color: colors.textMuted, fontSize: 13 },
  statusValue: { color: colors.textDark, fontWeight: '700', fontSize: 13 },
  email: { color: colors.textDark, fontWeight: '700', fontSize: 13, flexShrink: 1, marginLeft: 10 },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 4 },
  autoTitle: { color: colors.textDark, fontWeight: '800', fontSize: 13.5 },
  mono: { fontSize: 11.5, color: colors.textMuted, marginTop: 4 },
});
