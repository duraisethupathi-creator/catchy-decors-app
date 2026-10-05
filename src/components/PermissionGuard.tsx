import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './common';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { can, type Permission } from '../services/permissions';

export function PermissionGuard({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const allowed = can(user?.role, permission);

  useEffect(() => {
    if (!loading && !user) router.replace('/(auth)/login');
  }, [loading, user]);

  if (loading) return <View style={styles.center}><Text style={styles.muted}>Checking access…</Text></View>;
  if (!user) return null;
  if (!allowed) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={46} color={colors.red} />
        <Text style={styles.title}>Admin Access Required</Text>
        <Text style={styles.muted}>This section is not available for Staff accounts.</Text>
        <Button title="Back to Dashboard" icon="home" onPress={() => router.replace('/(tabs)/dashboard')} style={{ marginTop: 18 }} />
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { color: colors.navy, fontSize: 20, fontWeight: '900', marginTop: 14, marginBottom: 6 },
  muted: { color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
});
