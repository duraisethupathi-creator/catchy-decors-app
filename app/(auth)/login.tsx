import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BrandBlock } from '../../src/components/common/Logo';
import { Button, Field } from '../../src/components/common';
import { toast } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { useLogoSource } from '../../src/context/SettingsContext';
import { login } from '../../src/services/authService';
import { validateLogin } from '../../src/utils/validation';
import type { Role } from '../../src/services/authService';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const logoSource = useLogoSource();
  const [fpUser, setFpUser] = useState('');
  const [fpPin, setFpPin] = useState('');
  const [fpNew, setFpNew] = useState('');

  async function doLogin() {
    const errs = validateLogin(username, password);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const { user, error } = await login(username, password);
      if (error || !user) {
        toast(error ?? 'Login failed');
        return;
      }
      if (remember) await AsyncStorage.setItem('cd_remember', username);
      else await AsyncStorage.removeItem('cd_remember');
      await AsyncStorage.setItem('cd_role', user.role as Role);
      toast(`Welcome, ${user.name}!`);
      router.replace('/(tabs)/dashboard');
    } finally {
      setBusy(false);
    }
  }

  async function doReset() {
    if (!fpUser.trim() || !fpNew) {
      toast('Fill all reset fields');
      return;
    }
    const { resetPassword } = await import('../../src/services/authService');
    const res = await resetPassword(fpUser, fpPin, fpNew);
    if (res.ok) {
      toast('Password reset. Please login.');
      setForgot(false);
      setPassword('');
    } else {
      toast(res.error ?? 'Reset failed');
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'android' ? undefined : 'padding'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <BrandBlock light image={logoSource} />
          </View>
          <View style={styles.sheet}>
            <Text style={styles.title}>Sign In</Text>
            <Text style={styles.sub}>Login to manage customers & quotations</Text>

            <Field label="Username" value={username} onChangeText={setUsername} placeholder="admin" error={errors.username} />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secure={!showPw}
              error={errors.password}
              right={
                <TouchableOpacity onPress={() => setShowPw((s) => !s)} style={styles.eye}>
                  <Ionicons name={showPw ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              }
            />

            <View style={styles.row}>
              <TouchableOpacity onPress={() => setRemember((r) => !r)} style={styles.remember}>
                <Ionicons name={remember ? 'checkbox' : 'square-outline'} size={20} color={remember ? colors.orange : colors.textMuted} />
                <Text style={styles.rememberText}>Remember Me</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setForgot(true)}>
                <Text style={styles.forgot}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <Button title={busy ? 'Signing in…' : 'Login'} icon="log-in-outline" onPress={doLogin} style={{ marginTop: 8 }} />
            {busy ? <View style={{ marginTop: 10 }}><Button title="Please wait" variant="ghost" onPress={() => {}} disabled /></View> : null}

            {forgot ? (
              <View style={styles.forgotCard}>
                <Text style={styles.forgotTitle}>Reset Password</Text>
                <Field label="Username" value={fpUser} onChangeText={setFpUser} placeholder="admin or staff" />
                <Field label="Admin Verification (company phone)" value={fpPin} onChangeText={setFpPin} placeholder="9159194440" keyboardType="numeric" />
                <Field label="New Password" value={fpNew} onChangeText={setFpNew} placeholder="min 4 characters" secure />
                <Button title="Reset Password" variant="accent" icon="key-outline" onPress={doReset} />
                <TouchableOpacity onPress={() => setForgot(false)} style={{ marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  scroll: { flexGrow: 1 },
  hero: { alignItems: 'center', paddingTop: 70, paddingBottom: 44 },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
  },
  title: { fontSize: 24, fontWeight: '900', color: colors.navy, marginTop: 8 },
  sub: { color: colors.textMuted, marginTop: 4, marginBottom: 22, fontSize: 14 },
  eye: { paddingHorizontal: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 14 },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rememberText: { color: colors.textDark, fontSize: 14 },
  forgot: { color: colors.orange, fontWeight: '700', fontSize: 13 },
  forgotCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  forgotTitle: { fontWeight: '800', color: colors.navy, marginBottom: 10, fontSize: 15 },
  hint: { marginTop: 24, backgroundColor: '#EEF1F7', borderRadius: 14, padding: 14 },
  hintTitle: { fontWeight: '800', color: colors.navy, fontSize: 13, marginBottom: 6 },
  hintText: { fontSize: 12.5, color: colors.textDark, marginTop: 2 },
  hintNote: { fontSize: 11.5, color: colors.textMuted, marginTop: 6 },
});
