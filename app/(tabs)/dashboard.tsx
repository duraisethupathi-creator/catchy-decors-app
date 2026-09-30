import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '../../src/components/common/Logo';
import { useLogoSource } from '../../src/context/SettingsContext';
import { colors } from '../../src/constants/colors';
import { COMPANY } from '../../src/constants/company';
import { useAuth } from '../../src/context/AuthContext';
import { countCustomers, countNewCustomersThisMonth } from '../../src/services/customerService';
import { getQuotations, getMonthSales } from '../../src/services/quotationService';
import { formatINR } from '../../src/utils/currency';
import { getSyncState, type SyncState } from '../../src/services/db';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ customers: 0, newC: 0, quotations: 0, monthSales: 0 });
  const [sync, setSync] = useState<SyncState>({ pending: 0, lastSyncAt: null });

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [customers, newC, quotes, month] = await Promise.all([
          countCustomers(),
          countNewCustomersThisMonth(),
          getQuotations(),
          getMonthSales(),
        ]);
        setStats({ customers, newC, quotations: quotes.length, monthSales: month });
        setSync(await getSyncState());
      })();
    }, [])
  );

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const cards = [
    { icon: 'people', label: 'Total Customers', value: String(stats.customers), tint: colors.navy },
    { icon: 'person-add', label: 'New Customers', value: String(stats.newC), tint: colors.orange, route: '/(tabs)/customers' },
    { icon: 'document-text', label: 'Total Quotations', value: String(stats.quotations), tint: colors.red, route: '/(tabs)/quotations' },
    { icon: 'trending-up', label: 'This Month Sales', value: formatINR(stats.monthSales), tint: '#0E9A4C', route: '/(tabs)/reports' },
  ];

  const logoSource = useLogoSource();

  const actions = [
    { icon: 'person-add', label: 'Add Customer', route: '/customer/new', tint: colors.navy },
    { icon: 'resize', label: 'New Measurement', route: '/customer/new?mode=measurement', tint: colors.orange },
    { icon: 'document', label: 'Create Quotation', route: '/customer/new?mode=quotation', tint: colors.red },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Logo size={44} light image={logoSource} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.greet}>{greet},</Text>
            <Text style={styles.welcome}>Welcome to Catchy Decors</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings')}>
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {sync.pending > 0 ? (
        <View style={styles.syncBar}>
          <Ionicons name="cloud-offline-outline" size={15} color="#C77700" />
          <Text style={styles.syncText}>{sync.pending} record(s) queued for cloud sync</Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {cards.map((c) => (
          <TouchableOpacity
            key={c.label}
            style={styles.card}
            activeOpacity={c.route ? 0.85 : 1}
            onPress={() => c.route && router.push(c.route as never)}
          >
            <View style={[styles.iconWrap, { backgroundColor: c.tint + '15' }]}>
              <Ionicons name={c.icon as never} size={22} color={c.tint} />
            </View>
            <Text style={styles.cardValue} numberOfLines={1}>{c.value}</Text>
            <Text style={styles.cardLabel}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.section}>Quick Actions</Text>
      <View style={styles.actions}>
        {actions.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={[styles.actionBtn, { backgroundColor: a.tint }]}
            activeOpacity={0.85}
            onPress={() => router.push(a.route as never)}
          >
            <Ionicons name={a.icon as never} size={24} color="#fff" />
            <Text style={styles.actionText}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footerCard}>
        <Ionicons name="business" size={18} color={colors.navy} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.footerTitle}>{COMPANY.name}</Text>
          <Text style={styles.footerText}>Karur, Tamil Nadu · {COMPANY.phone}</Text>
          <Text style={styles.footerText}>{COMPANY.website}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.navy,
    paddingTop: 54,
    paddingBottom: 22,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  greet: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  welcome: { color: '#fff', fontSize: 17, fontWeight: '800' },
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4E0',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
  },
  syncText: { color: '#C77700', fontSize: 12.5, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginTop: 18 },
  card: {
    width: '47.5%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#101D4A',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardValue: { fontSize: 19, fontWeight: '900', color: colors.text },
  cardLabel: { fontSize: 12.5, color: colors.textMuted, marginTop: 3 },
  section: { fontSize: 16, fontWeight: '800', color: colors.text, marginLeft: 20, marginTop: 22, marginBottom: 10 },
  actions: { paddingHorizontal: 16, gap: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    elevation: 3,
  },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 15.5 },
  footerCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  footerTitle: { fontWeight: '800', color: colors.text, fontSize: 14 },
  footerText: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
